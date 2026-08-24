import { describe, it, expect, vi, afterEach } from "vitest";
import { callAnthropic } from "./anthropicAdapter.js";

function sseStream(events) {
  const text = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("");
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}

function streamResponse(events) {
  return { ok: true, status: 200, body: sseStream(events) };
}

function errorResponse(body, status = 401) {
  return { ok: false, status, json: async () => body };
}

// Anthropic's own streaming event shape (message_start/content_block_start/
// content_block_delta/content_block_stop/message_stop) for one round whose
// content is exactly the given blocks — each {type:"text", text} or
// {type:"tool_use", id, name, input}. Mirrors what a real Messages API
// stream sends closely enough to exercise streamOnce's reconstruction.
function roundEvents(blocks) {
  const events = [{ type: "message_start", message: { content: [] } }];
  blocks.forEach((block, index) => {
    if (block.type === "text") {
      events.push({ type: "content_block_start", index, content_block: { type: "text", text: "" } });
      events.push({ type: "content_block_delta", index, delta: { type: "text_delta", text: block.text } });
      events.push({ type: "content_block_stop", index });
    } else {
      events.push({ type: "content_block_start", index, content_block: { type: "tool_use", id: block.id, name: block.name, input: {} } });
      const json = JSON.stringify(block.input);
      // Split the tool call's JSON args across two input_json_delta
      // fragments — a real stream never delivers it as one chunk, and this
      // exercises the accumulate-then-JSON.parse reconstruction in
      // streamOnce rather than only ever testing the trivial single-chunk case.
      const mid = Math.max(1, Math.floor(json.length / 2));
      events.push({ type: "content_block_delta", index, delta: { type: "input_json_delta", partial_json: json.slice(0, mid) } });
      events.push({ type: "content_block_delta", index, delta: { type: "input_json_delta", partial_json: json.slice(mid) } });
      events.push({ type: "content_block_stop", index });
    }
  });
  events.push({ type: "message_delta", delta: { stop_reason: "end_turn" }, usage: {} });
  events.push({ type: "message_stop" });
  return events;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("anthropicAdapter: tool-call loop (streamed)", () => {
  it("feeds a tool_use block's result back and returns the model's final text, discarding an earlier round's own text", async () => {
    const calls = [];
    const fetchMock = vi.fn(async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body) });
      if (calls.length === 1) {
        return streamResponse(roundEvents([
          { type: "text", text: "Let me check that." },
          { type: "tool_use", id: "toolu_1", name: "search_workspace", input: { query: "growth" } },
        ]));
      }
      return streamResponse(roundEvents([{ type: "text", text: "<response>Found it — Growth already exists.</response>" }]));
    });
    vi.stubGlobal("fetch", fetchMock);

    const runTool = vi.fn(() => ({ count: 1, matches: [{ id: "a1", title: "Growth" }] }));

    const { reply } = await callAnthropic({
      apiKey: "sk-ant-test",
      model: "claude-sonnet-5",
      systemPrompt: "system",
      contextPrompt: "context",
      tools: [],
      runTool,
    });

    // `reply` is only the LAST round's own <response> content — per RESPONSE
    // FORMAT, an earlier round's text ("Let me check that.") made a tool
    // call, so it's narration the model was told not to write and is simply
    // discarded here, never surfaced.
    expect(reply).toBe("Found it — Growth already exists.");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(runTool).toHaveBeenCalledWith("search_workspace", { query: "growth" });

    // Every round now asks for `stream: true`.
    expect(calls[0].body.stream).toBe(true);
    // First call is just the context prompt as a user turn.
    expect(calls[0].body.messages).toEqual([{ role: "user", content: "context" }]);
    // Second call carries the assistant's tool_use turn, then a user turn
    // whose content is a real tool_result block referencing the same id.
    const secondMessages = calls[1].body.messages;
    expect(secondMessages[1].role).toBe("assistant");
    expect(secondMessages[2]).toEqual({
      role: "user",
      content: [{ type: "tool_result", tool_use_id: "toolu_1", content: JSON.stringify({ count: 1, matches: [{ id: "a1", title: "Growth" }] }) }],
    });
  });

  it("falls back to the raw trimmed text for `reply` when the model forgot the <response> tag", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => streamResponse(roundEvents([{ type: "text", text: "Just a reply, no tag." }]))));

    const { reply } = await callAnthropic({ apiKey: "k", model: "m", systemPrompt: "s", contextPrompt: "c", tools: [], runTool: vi.fn() });

    expect(reply).toBe("Just a reply, no tag.");
  });

  it("fires onEvent with each text_delta live, as it streams in — not just the final joined text", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => streamResponse(roundEvents([{ type: "text", text: "<response>Just a reply.</response>" }]))));
    const events = [];
    const { reply } = await callAnthropic({
      apiKey: "k", model: "m", systemPrompt: "s", contextPrompt: "c", tools: [], runTool: vi.fn(),
      onEvent: (e) => events.push(e),
    });
    expect(reply).toBe("Just a reply.");
    expect(events).toEqual([{ type: "thinking-delta", text: "<response>Just a reply.</response>" }]);
  });

  it("keeps a genuinely multi-paragraph reply intact when it's the ONLY round (no tool calls at all this turn) — paragraph breaks are not round boundaries", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => streamResponse(roundEvents([
      { type: "text", text: "<response>Here's the first thing to know.\n\nAnd here's the second, equally real, paragraph.</response>" },
    ]))));
    const { reply } = await callAnthropic({ apiKey: "k", model: "m", systemPrompt: "s", contextPrompt: "c", tools: [], runTool: vi.fn() });
    // A single round with zero tool calls has nothing to separate out — the
    // whole thing, both paragraphs, is the real reply.
    expect(reply).toBe("Here's the first thing to know.\n\nAnd here's the second, equally real, paragraph.");
  });

  it("keeps the FINAL round's own text whole, even with multiple paragraphs, once a real tool-call round preceded it — the earlier round's own narration is discarded", async () => {
    const fetchMock = vi.fn(async () => {
      const calls = fetchMock.mock.calls.length;
      if (calls === 1) {
        return streamResponse(roundEvents([
          { type: "text", text: "I'll create three areas." },
          { type: "tool_use", id: "toolu_1", name: "create_area", input: { title: "A" } },
        ]));
      }
      return streamResponse(roundEvents([
        { type: "text", text: "<response>Done — created the area.\n\nHere's a quick summary of what's in it now.</response>" },
      ]));
    });
    vi.stubGlobal("fetch", fetchMock);
    const events = [];
    const { reply } = await callAnthropic({
      apiKey: "k", model: "m", systemPrompt: "s", contextPrompt: "c", tools: [], runTool: vi.fn(),
      onEvent: (e) => events.push(e),
    });
    // The first round's own build-up narration ("I'll create three areas.")
    // is discarded entirely — per RESPONSE FORMAT, a round that makes a tool
    // call writes nothing else; the final round's own <response> content is
    // kept WHOLE, both its paragraphs, not trimmed to just the last one.
    expect(reply).toBe("Done — created the area.\n\nHere's a quick summary of what's in it now.");
    // A real "round-boundary" event fires once, between the two rounds, so
    // the client can draw the same "past round vs. current round" line live
    // that this function draws server-side.
    expect(events.filter((e) => e.type === "round-boundary")).toHaveLength(1);
  });

  it("sends analyze_attachment's image as a real image content block, not just JSON text — the model actually SEES it next round", async () => {
    const calls = [];
    const fetchMock = vi.fn(async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body) });
      if (calls.length === 1) {
        return streamResponse(roundEvents([
          { type: "tool_use", id: "toolu_1", name: "analyze_attachment", input: { file_url: "https://x/y.png" } },
        ]));
      }
      return streamResponse(roundEvents([{ type: "text", text: "That's a chart of Q3 revenue." }]));
    });
    vi.stubGlobal("fetch", fetchMock);
    const runTool = vi.fn(() => ({ file_url: "https://x/y.png", is_image: true, media_type: "image/png", image_base64: "QUJD" }));

    await callAnthropic({ apiKey: "k", model: "m", systemPrompt: "s", contextPrompt: "c", tools: [], runTool });

    const secondMessages = calls[1].body.messages;
    const toolResultContent = secondMessages[2].content[0].content;
    // image_base64 rides as its own real content block...
    expect(toolResultContent).toEqual([
      { type: "text", text: JSON.stringify({ file_url: "https://x/y.png", is_image: true }) },
      { type: "image", source: { type: "base64", media_type: "image/png", data: "QUJD" } },
    ]);
    // ...and is never ALSO duplicated inside the JSON text half.
    expect(toolResultContent[0].text).not.toContain("QUJD");
  });

  it("always sends Anthropic's own native web_search tool alongside the client tool catalog", async () => {
    const calls = [];
    const fetchMock = vi.fn(async (url, init) => {
      calls.push(JSON.parse(init.body));
      return streamResponse(roundEvents([{ type: "text", text: "Just a reply." }]));
    });
    vi.stubGlobal("fetch", fetchMock);
    await callAnthropic({ apiKey: "k", model: "m", systemPrompt: "s", contextPrompt: "c", tools: [{ name: "search_workspace" }], runTool: vi.fn() });
    expect(calls[0].tools).toEqual([{ name: "search_workspace" }, { type: "web_search_20250305", name: "web_search", max_uses: 5 }]);
  });

  it("doesn't crash on Anthropic's own server-executed web search block types (server_tool_use / web_search_tool_result), and still derives reply/reasoning from the surrounding real text", async () => {
    const events = [
      { type: "message_start", message: { content: [] } },
      { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
      { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Let me check the latest news." } },
      { type: "content_block_stop", index: 0 },
      { type: "content_block_start", index: 1, content_block: { type: "server_tool_use", id: "srvtoolu_1", name: "web_search" } },
      { type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: '{"query":"vaea"}' } },
      { type: "content_block_stop", index: 1 },
      { type: "content_block_start", index: 2, content_block: { type: "web_search_tool_result", tool_use_id: "srvtoolu_1", content: [{ type: "web_search_result", url: "https://x", title: "X" }] } },
      { type: "content_block_stop", index: 2 },
      { type: "content_block_start", index: 3, content_block: { type: "text", text: "" } },
      { type: "content_block_delta", index: 3, delta: { type: "text_delta", text: "Found it — here's what I found." } },
      { type: "content_block_stop", index: 3 },
      { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: {} },
      { type: "message_stop" },
    ];
    vi.stubGlobal("fetch", vi.fn(async () => streamResponse(events)));
    const { reply } = await callAnthropic({ apiKey: "k", model: "m", systemPrompt: "s", contextPrompt: "c", tools: [], runTool: vi.fn() });
    // The server_tool_use/web_search_tool_result blocks never reach runTool
    // (Anthropic already executed the search itself) and never pollute the
    // reply text — only the two real text blocks do, joined and (with no
    // <response> tag present) taken as-is via extractResponse's fallback.
    expect(reply).toBe("Let me check the latest news.\nFound it — here's what I found.");
  });

  it("surfaces the provider's own error message on a non-2xx response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => errorResponse({ error: { message: "invalid x-api-key" } })));
    await expect(
      callAnthropic({ apiKey: "bad", model: "m", systemPrompt: "s", contextPrompt: "c", tools: [], runTool: vi.fn() })
    ).rejects.toThrow("invalid x-api-key");
  });

  it("surfaces an in-stream error event even on a 200 response", async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", error: { message: "overloaded_error: try again" } })}\n\n`));
        controller.close();
      },
    });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, body })));
    await expect(
      callAnthropic({ apiKey: "k", model: "m", systemPrompt: "s", contextPrompt: "c", tools: [], runTool: vi.fn() })
    ).rejects.toThrow("overloaded_error: try again");
  });
});

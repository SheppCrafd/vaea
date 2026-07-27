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
  it("feeds a tool_use block's result back and returns the model's final text", async () => {
    const calls = [];
    const fetchMock = vi.fn(async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body) });
      if (calls.length === 1) {
        return streamResponse(roundEvents([
          { type: "text", text: "Let me check that." },
          { type: "tool_use", id: "toolu_1", name: "search_workspace", input: { query: "growth" } },
        ]));
      }
      return streamResponse(roundEvents([{ type: "text", text: "Found it — Growth already exists." }]));
    });
    vi.stubGlobal("fetch", fetchMock);

    const runTool = vi.fn(() => ({ count: 1, matches: [{ id: "a1", title: "Growth" }] }));

    const reply = await callAnthropic({
      apiKey: "sk-ant-test",
      model: "claude-sonnet-5",
      systemPrompt: "system",
      contextPrompt: "context",
      tools: [],
      runTool,
    });

    // Both rounds' own text now carry through — "Let me check that." was
    // real thinking the model produced before calling the tool, not just
    // filler to discard; see THINK OUT LOUD AS YOU GO.
    expect(reply).toBe("Let me check that.\n\nFound it — Growth already exists.");
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

  it("fires onEvent with each text_delta live, as it streams in — not just the final joined text", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => streamResponse(roundEvents([{ type: "text", text: "Just a reply." }]))));
    const events = [];
    const reply = await callAnthropic({
      apiKey: "k", model: "m", systemPrompt: "s", contextPrompt: "c", tools: [], runTool: vi.fn(),
      onEvent: (e) => events.push(e),
    });
    expect(reply).toBe("Just a reply.");
    expect(events).toEqual([{ type: "thinking-delta", text: "Just a reply." }]);
  });

  it("returns text directly when the first response has no tool_use blocks", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => streamResponse(roundEvents([{ type: "text", text: "Just a reply." }]))));
    const reply = await callAnthropic({ apiKey: "k", model: "m", systemPrompt: "s", contextPrompt: "c", tools: [], runTool: vi.fn() });
    expect(reply).toBe("Just a reply.");
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

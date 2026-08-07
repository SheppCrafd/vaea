import { describe, it, expect, vi, afterEach } from "vitest";
import { callOpenAiCompatible } from "./openaiCompatibleAdapter.js";

function sseStream(chunks) {
  const text = chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join("") + "data: [DONE]\n\n";
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}

function streamResponse(chunks) {
  return { ok: true, status: 200, body: sseStream(chunks) };
}

function errorResponse(body, status = 401) {
  return { ok: false, status, json: async () => body };
}

// One round's worth of chat-completions streaming chunks reconstructing the
// given `content` string (split into a couple of fragments, like a real
// token stream) and/or tool calls (each call's `arguments` JSON also split
// across two fragments — a real stream never delivers a tool call's args as
// one chunk).
function roundChunks({ content, toolCalls = [] }) {
  const chunks = [];
  if (content) {
    const mid = Math.max(1, Math.floor(content.length / 2));
    chunks.push({ choices: [{ delta: { content: content.slice(0, mid) } }] });
    chunks.push({ choices: [{ delta: { content: content.slice(mid) } }] });
  }
  toolCalls.forEach((call, index) => {
    const json = JSON.stringify(call.args);
    const mid = Math.max(1, Math.floor(json.length / 2));
    chunks.push({ choices: [{ delta: { tool_calls: [{ index, id: call.id, type: "function", function: { name: call.name } }] } }] });
    chunks.push({ choices: [{ delta: { tool_calls: [{ index, function: { arguments: json.slice(0, mid) } }] } }] });
    chunks.push({ choices: [{ delta: { tool_calls: [{ index, function: { arguments: json.slice(mid) } }] } }] });
  });
  chunks.push({ choices: [{ delta: {}, finish_reason: toolCalls.length ? "tool_calls" : "stop" }] });
  return chunks;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("openaiCompatibleAdapter: tool-call loop (streamed)", () => {
  it("feeds a tool_calls result back (as a role:tool message) and returns the final content", async () => {
    const calls = [];
    const fetchMock = vi.fn(async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body) });
      if (calls.length === 1) {
        return streamResponse(roundChunks({ toolCalls: [{ id: "call_1", name: "search_workspace", args: { query: "growth" } }] }));
      }
      return streamResponse(roundChunks({ content: "Found it — Growth already exists." }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const runTool = vi.fn(() => ({ count: 1, matches: [{ id: "a1", title: "Growth" }] }));

    const { reply, reasoning } = await callOpenAiCompatible({
      baseUrl: "https://api.openai.com/v1",
      apiKey: "sk-test",
      model: "gpt-5",
      systemPrompt: "system",
      contextPrompt: "context",
      tools: [],
      runTool,
    });

    expect(reply).toBe("Found it — Growth already exists.");
    expect(reasoning).toBe("Found it — Growth already exists.");
    expect(calls[0].url).toBe("https://api.openai.com/v1/chat/completions");
    expect(calls[0].body.stream).toBe(true);
    expect(runTool).toHaveBeenCalledWith("search_workspace", { query: "growth" });

    const secondMessages = calls[1].body.messages;
    // system, user, assistant(tool_calls), tool result
    expect(secondMessages).toHaveLength(4);
    expect(secondMessages[3]).toEqual({
      role: "tool",
      tool_call_id: "call_1",
      content: JSON.stringify({ count: 1, matches: [{ id: "a1", title: "Growth" }] }),
    });
  });

  it("sends analyze_attachment's image as a follow-up user message with an image_url part — the chat-completions tool role can't carry an image itself", async () => {
    const calls = [];
    const fetchMock = vi.fn(async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body) });
      if (calls.length === 1) {
        return streamResponse(roundChunks({ toolCalls: [{ id: "call_1", name: "analyze_attachment", args: { file_url: "https://x/y.png" } }] }));
      }
      return streamResponse(roundChunks({ content: "That's a chart." }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const runTool = vi.fn(() => ({ file_url: "https://x/y.png", is_image: true, media_type: "image/png", image_base64: "QUJD" }));
    await callOpenAiCompatible({
      baseUrl: "https://api.openai.com/v1", apiKey: "sk-test", model: "gpt-5",
      systemPrompt: "system", contextPrompt: "context", tools: [], runTool,
    });

    const secondMessages = calls[1].body.messages;
    // system, user, assistant(tool_calls), tool result (text only), user (image)
    expect(secondMessages).toHaveLength(5);
    expect(secondMessages[3]).toEqual({
      role: "tool",
      tool_call_id: "call_1",
      content: JSON.stringify({ file_url: "https://x/y.png", is_image: true }),
    });
    expect(secondMessages[4]).toEqual({
      role: "user",
      content: [
        { type: "text", text: "(Image from the analyze_attachment call above — analyze it directly.)" },
        { type: "image_url", image_url: { url: "data:image/png;base64,QUJD" } },
      ],
    });
  });

  it("adds xAI's own native search_parameters only when providerId is xai", async () => {
    const calls = [];
    const fetchMock = vi.fn(async (url, init) => {
      calls.push(JSON.parse(init.body));
      return streamResponse(roundChunks({ content: "Just a reply." }));
    });
    vi.stubGlobal("fetch", fetchMock);

    await callOpenAiCompatible({ baseUrl: "https://api.x.ai/v1", apiKey: "k", model: "grok-4", systemPrompt: "s", contextPrompt: "c", tools: [], runTool: vi.fn(), providerId: "xai" });
    expect(calls[0].search_parameters).toEqual({ mode: "auto" });
  });

  it("never sends search_parameters for OpenAI/Google — only documented for xAI", async () => {
    const calls = [];
    const fetchMock = vi.fn(async (url, init) => {
      calls.push(JSON.parse(init.body));
      return streamResponse(roundChunks({ content: "Just a reply." }));
    });
    vi.stubGlobal("fetch", fetchMock);

    await callOpenAiCompatible({ baseUrl: "https://api.openai.com/v1", apiKey: "k", model: "gpt-5", systemPrompt: "s", contextPrompt: "c", tools: [], runTool: vi.fn(), providerId: "openai" });
    expect(calls[0].search_parameters).toBeUndefined();
  });

  it("carries a round's own text forward even when that round also made a tool call", async () => {
    const fetchMock = vi.fn(async (url, init) => {
      const body = JSON.parse(init.body);
      if (!body.messages.some((m) => m.role === "tool")) {
        return streamResponse(roundChunks({ content: "Let me check that.", toolCalls: [{ id: "call_1", name: "search_workspace", args: { query: "growth" } }] }));
      }
      return streamResponse(roundChunks({ content: "Found it — Growth already exists." }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { reply, reasoning } = await callOpenAiCompatible({
      baseUrl: "https://api.openai.com/v1", apiKey: "sk-test", model: "gpt-5",
      systemPrompt: "system", contextPrompt: "context", tools: [], runTool: vi.fn(() => ({ count: 1 })),
    });

    // `reply` is only the last round's own text; `reasoning` is every
    // round's own text joined — the two used to be the same string, which
    // is what a real user caught as the plan modal being a verbatim echo
    // of the chat bubble.
    expect(reply).toBe("Found it — Growth already exists.");
    expect(reasoning).toBe("Let me check that.\n\nFound it — Growth already exists.");
  });

  it("fires onEvent with each content fragment live, as it streams in", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => streamResponse(roundChunks({ content: "Just a reply." }))));
    const events = [];
    const { reply, reasoning } = await callOpenAiCompatible({
      baseUrl: "https://api.openai.com/v1", apiKey: "k", model: "gpt-5", systemPrompt: "s", contextPrompt: "c", tools: [], runTool: vi.fn(),
      onEvent: (e) => events.push(e),
    });
    expect(reply).toBe("Just a reply.");
    expect(reasoning).toBe("Just a reply.");
    expect(events.map((e) => e.text).join("")).toBe("Just a reply.");
    expect(events.every((e) => e.type === "thinking-delta")).toBe(true);
  });

  it("returns the same text for both reply and reasoning when there's only one round (nothing to separate out)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => streamResponse(roundChunks({ content: "Just a reply." }))));
    const { reply, reasoning } = await callOpenAiCompatible({ baseUrl: "https://api.x.ai/v1", apiKey: "k", model: "grok-4", systemPrompt: "s", contextPrompt: "c", tools: [], runTool: vi.fn() });
    expect(reply).toBe("Just a reply.");
    expect(reasoning).toBe("Just a reply.");
  });

  it("keeps a genuinely multi-paragraph reply intact when it's the ONLY round (no tool calls at all this turn) — paragraph breaks are not round boundaries", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => streamResponse(roundChunks({
      content: "Here's the first thing to know.\n\nAnd here's the second, equally real, paragraph.",
    }))));
    const { reply, reasoning } = await callOpenAiCompatible({ baseUrl: "https://api.openai.com/v1", apiKey: "k", model: "gpt-5", systemPrompt: "s", contextPrompt: "c", tools: [], runTool: vi.fn() });
    // A single round with zero tool calls has nothing to separate out — the
    // whole thing, both paragraphs, is the real reply (see
    // anthropicAdapter.test.js's matching case for why an earlier version of
    // this code got this wrong).
    expect(reasoning).toBe("Here's the first thing to know.\n\nAnd here's the second, equally real, paragraph.");
    expect(reply).toBe(reasoning);
  });

  it("surfaces the provider's own error message on a non-2xx response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => errorResponse({ error: { message: "Incorrect API key provided" } })));
    await expect(
      callOpenAiCompatible({ baseUrl: "https://api.openai.com/v1", apiKey: "bad", model: "gpt-5", systemPrompt: "s", contextPrompt: "c", tools: [], runTool: vi.fn() })
    ).rejects.toThrow("Incorrect API key provided");
  });

  it("surfaces an in-stream error chunk even on a 200 response", async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: { message: "rate_limit_exceeded" } })}\n\n`));
        controller.close();
      },
    });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, body })));
    await expect(
      callOpenAiCompatible({ baseUrl: "https://api.openai.com/v1", apiKey: "k", model: "gpt-5", systemPrompt: "s", contextPrompt: "c", tools: [], runTool: vi.fn() })
    ).rejects.toThrow("rate_limit_exceeded");
  });

  it("doesn't crash the turn on malformed tool-call JSON from the model", async () => {
    const fetchMock = vi.fn(async (url, init) => {
      const parsedCalls = JSON.parse(init.body).messages.filter((m) => m.role === "tool");
      if (parsedCalls.length) return streamResponse(roundChunks({ content: "Handled the bad call." }));
      // Malformed JSON delivered as one raw fragment, not built via
      // roundChunks (which always produces valid JSON.stringify output).
      return {
        ok: true, status: 200,
        body: (() => {
          const encoder = new TextEncoder();
          const text = `data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, id: "call_1", type: "function", function: { name: "search_workspace", arguments: "{not json" } }] } }] })}\n\n`
            + `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "tool_calls" }] })}\n\n`;
          return new ReadableStream({ start(controller) { controller.enqueue(encoder.encode(text)); controller.close(); } });
        })(),
      };
    });
    vi.stubGlobal("fetch", fetchMock);
    const runTool = vi.fn(() => ({ ok: true }));
    const { reply } = await callOpenAiCompatible({ baseUrl: "https://api.openai.com/v1", apiKey: "k", model: "gpt-5", systemPrompt: "s", contextPrompt: "c", tools: [], runTool });
    expect(reply).toBe("Handled the bad call.");
    expect(runTool).toHaveBeenCalledWith("search_workspace", {});
  });
});

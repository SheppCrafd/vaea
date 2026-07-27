import { describe, it, expect, vi, afterEach } from "vitest";
import { callOpenAiCompatible } from "./openaiCompatibleAdapter.js";

function jsonResponse(body, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("openaiCompatibleAdapter: tool-call loop", () => {
  it("feeds a tool_calls result back (as a role:tool message) and returns the final content", async () => {
    const calls = [];
    const fetchMock = vi.fn(async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body) });
      if (calls.length === 1) {
        return jsonResponse({
          choices: [{
            message: {
              role: "assistant",
              content: null,
              tool_calls: [{ id: "call_1", type: "function", function: { name: "search_workspace", arguments: '{"query":"growth"}' } }],
            },
          }],
        });
      }
      return jsonResponse({ choices: [{ message: { role: "assistant", content: "Found it — Growth already exists." } }] });
    });
    vi.stubGlobal("fetch", fetchMock);

    const runTool = vi.fn(() => ({ count: 1, matches: [{ id: "a1", title: "Growth" }] }));

    const reply = await callOpenAiCompatible({
      baseUrl: "https://api.openai.com/v1",
      apiKey: "sk-test",
      model: "gpt-5",
      systemPrompt: "system",
      contextPrompt: "context",
      tools: [],
      runTool,
    });

    expect(reply).toBe("Found it — Growth already exists.");
    expect(calls[0].url).toBe("https://api.openai.com/v1/chat/completions");
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

  it("carries a round's own text forward even when that round also made a tool call", async () => {
    // The existing test above happens to have `content: null` on its
    // tool-calling round, which never exercised this — real models often
    // narrate before calling a tool (see THINK OUT LOUD AS YOU GO), and
    // that text used to be silently discarded, keeping only the final
    // round's own content.
    const fetchMock = vi.fn(async (url, init) => {
      const body = JSON.parse(init.body);
      if (!body.messages.some((m) => m.role === "tool")) {
        return jsonResponse({
          choices: [{
            message: {
              role: "assistant",
              content: "Let me check that.",
              tool_calls: [{ id: "call_1", type: "function", function: { name: "search_workspace", arguments: '{"query":"growth"}' } }],
            },
          }],
        });
      }
      return jsonResponse({ choices: [{ message: { role: "assistant", content: "Found it — Growth already exists." } }] });
    });
    vi.stubGlobal("fetch", fetchMock);

    const reply = await callOpenAiCompatible({
      baseUrl: "https://api.openai.com/v1", apiKey: "sk-test", model: "gpt-5",
      systemPrompt: "system", contextPrompt: "context", tools: [], runTool: vi.fn(() => ({ count: 1 })),
    });

    expect(reply).toBe("Let me check that.\n\nFound it — Growth already exists.");
  });

  it("returns content directly when there are no tool_calls", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ choices: [{ message: { role: "assistant", content: "Just a reply." } }] })));
    const reply = await callOpenAiCompatible({ baseUrl: "https://api.x.ai/v1", apiKey: "k", model: "grok-4", systemPrompt: "s", contextPrompt: "c", tools: [], runTool: vi.fn() });
    expect(reply).toBe("Just a reply.");
  });

  it("surfaces the provider's own error message on a non-2xx response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: { message: "Incorrect API key provided" } }, false, 401)));
    await expect(
      callOpenAiCompatible({ baseUrl: "https://api.openai.com/v1", apiKey: "bad", model: "gpt-5", systemPrompt: "s", contextPrompt: "c", tools: [], runTool: vi.fn() })
    ).rejects.toThrow("Incorrect API key provided");
  });

  it("doesn't crash the turn on malformed tool-call JSON from the model", async () => {
    const fetchMock = vi.fn(async (url, init) => {
      const parsedCalls = JSON.parse(init.body).messages.filter((m) => m.role === "tool");
      if (parsedCalls.length) return jsonResponse({ choices: [{ message: { role: "assistant", content: "Handled the bad call." } }] });
      return jsonResponse({
        choices: [{ message: { role: "assistant", content: null, tool_calls: [{ id: "call_1", type: "function", function: { name: "search_workspace", arguments: "{not json" } }] } }],
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const runTool = vi.fn(() => ({ ok: true }));
    const reply = await callOpenAiCompatible({ baseUrl: "https://api.openai.com/v1", apiKey: "k", model: "gpt-5", systemPrompt: "s", contextPrompt: "c", tools: [], runTool });
    expect(reply).toBe("Handled the bad call.");
    expect(runTool).toHaveBeenCalledWith("search_workspace", {});
  });
});

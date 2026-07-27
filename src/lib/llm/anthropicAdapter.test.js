import { describe, it, expect, vi, afterEach } from "vitest";
import { callAnthropic } from "./anthropicAdapter.js";

function jsonResponse(body, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("anthropicAdapter: tool-call loop", () => {
  it("feeds a tool_use block's result back and returns the model's final text", async () => {
    const calls = [];
    const fetchMock = vi.fn(async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body) });
      if (calls.length === 1) {
        return jsonResponse({
          content: [
            { type: "text", text: "Let me check that." },
            { type: "tool_use", id: "toolu_1", name: "search_workspace", input: { query: "growth" } },
          ],
        });
      }
      return jsonResponse({ content: [{ type: "text", text: "Found it — Growth already exists." }] });
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

  it("returns text directly when the first response has no tool_use blocks", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ content: [{ type: "text", text: "Just a reply." }] })));
    const reply = await callAnthropic({ apiKey: "k", model: "m", systemPrompt: "s", contextPrompt: "c", tools: [], runTool: vi.fn() });
    expect(reply).toBe("Just a reply.");
  });

  it("surfaces the provider's own error message on a non-2xx response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: { message: "invalid x-api-key" } }, false, 401)));
    await expect(
      callAnthropic({ apiKey: "bad", model: "m", systemPrompt: "s", contextPrompt: "c", tools: [], runTool: vi.fn() })
    ).rejects.toThrow("invalid x-api-key");
  });
});

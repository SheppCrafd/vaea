import { describe, it, expect, vi, beforeEach } from "vitest";
import { callLocalBridge } from "./localBridgeAdapter.js";

vi.mock("./localBridgeStorage.js", () => ({
  writeRequestFile: vi.fn(async () => {}),
  pollForResponseFile: vi.fn(),
}));

import { writeRequestFile, pollForResponseFile } from "./localBridgeStorage.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("localBridgeAdapter: file-based round loop", () => {
  it("writes round 0, and returns the model's text when there are no tool_use blocks", async () => {
    pollForResponseFile.mockResolvedValueOnce({ content: [{ type: "text", text: "Just a reply." }] });

    const reply = await callLocalBridge({ systemPrompt: "s", contextPrompt: "c", tools: [], runTool: vi.fn() });

    expect(reply).toBe("Just a reply.");
    expect(writeRequestFile).toHaveBeenCalledTimes(1);
    const [requestId, round, body] = writeRequestFile.mock.calls[0];
    expect(round).toBe(0);
    expect(body).toMatchObject({ round: 0, system: "s", tools: [], messages: [{ role: "user", content: "c" }] });
    expect(pollForResponseFile).toHaveBeenCalledWith(requestId, 0, expect.any(Object));
  });

  it("runs a tool_use block, writes the next round with the result, and returns the following round's text", async () => {
    pollForResponseFile
      .mockResolvedValueOnce({
        content: [
          { type: "text", text: "Let me check that." },
          { type: "tool_use", id: "toolu_1", name: "search_workspace", input: { query: "growth" } },
        ],
      })
      .mockResolvedValueOnce({ content: [{ type: "text", text: "Found it." }] });

    const runTool = vi.fn(() => ({ count: 1 }));
    const reply = await callLocalBridge({ systemPrompt: "s", contextPrompt: "c", tools: [], runTool });

    expect(reply).toBe("Found it.");
    expect(runTool).toHaveBeenCalledWith("search_workspace", { query: "growth" });
    expect(writeRequestFile).toHaveBeenCalledTimes(2);

    const [, round1, body1] = writeRequestFile.mock.calls[1];
    expect(round1).toBe(1);
    expect(body1.messages[1].role).toBe("assistant");
    expect(body1.messages[2]).toEqual({
      role: "user",
      content: [{ type: "tool_result", tool_use_id: "toolu_1", content: JSON.stringify({ count: 1 }) }],
    });
  });

  it("throws on a malformed response file instead of treating it as final", async () => {
    pollForResponseFile.mockResolvedValueOnce({ notContent: true });
    await expect(
      callLocalBridge({ systemPrompt: "s", contextPrompt: "c", tools: [], runTool: vi.fn() })
    ).rejects.toThrow("Malformed response");
  });

  it("gives up after MAX_TOOL_ROUNDS rounds of nothing but tool_use blocks", async () => {
    pollForResponseFile.mockResolvedValue({
      content: [{ type: "tool_use", id: "toolu_x", name: "search_workspace", input: {} }],
    });
    await expect(
      callLocalBridge({ systemPrompt: "s", contextPrompt: "c", tools: [], runTool: vi.fn(() => ({})) })
    ).rejects.toThrow("Gave up after 15 tool-call rounds");
    expect(writeRequestFile).toHaveBeenCalledTimes(15);
  });
});

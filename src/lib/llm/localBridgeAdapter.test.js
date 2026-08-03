import { describe, it, expect, vi, beforeEach } from "vitest";
import { callLocalBridge } from "./localBridgeAdapter.js";

vi.mock("./localBridgeStorage.js", () => ({
  writeRequestFile: vi.fn(async () => {}),
  pollForResponseFile: vi.fn(),
  archiveProcessedRound: vi.fn(async () => {}),
}));

import { writeRequestFile, pollForResponseFile } from "./localBridgeStorage.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("localBridgeAdapter: file-based round loop", () => {
  it("writes round 0, and returns the model's text when there are no tool_use blocks", async () => {
    pollForResponseFile.mockResolvedValueOnce({ content: [{ type: "text", text: "Just a reply." }] });

    const { reply, reasoning } = await callLocalBridge({ systemPrompt: "s", contextPrompt: "c", tools: [], runTool: vi.fn() });

    expect(reply).toBe("Just a reply.");
    expect(reasoning).toBe("Just a reply.");
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
    const { reply, reasoning } = await callLocalBridge({ systemPrompt: "s", contextPrompt: "c", tools: [], runTool });

    // `reply` is only the last round's own text; `reasoning` carries both
    // rounds' — "Let me check that." was real thinking the model produced
    // before calling the tool (see THINK OUT LOUD AS YOU GO), which belongs
    // in the plan's own natural-language detail, not doubled into the
    // chat-facing reply too.
    expect(reply).toBe("Found it.");
    expect(reasoning).toBe("Let me check that.\n\nFound it.");
    expect(runTool).toHaveBeenCalledWith("search_workspace", { query: "growth" });
    expect(writeRequestFile).toHaveBeenCalledTimes(2);

    const [, round1, body1] = writeRequestFile.mock.calls[1];
    expect(round1).toBe(1);
    expect(body1.messages[1].role).toBe("assistant");
    expect(body1.messages[2]).toEqual({
      role: "user",
      content: [{ type: "tool_result", tool_use_id: "toolu_1", content: JSON.stringify({ count: 1 }) }],
    });
    // system/tools are large and identical every round of the same turn —
    // only round 0 actually writes them to disk (bridge_watcher.py
    // reconstructs the rest); round 1's own file must not repeat them.
    expect(body1).not.toHaveProperty("system");
    expect(body1).not.toHaveProperty("tools");
  });

  it("splits reply from reasoning even when a SINGLE round's own text has multiple paragraphs — a model very often writes its whole build-up and its conclusion together, with no tool call forcing a second round at all", async () => {
    pollForResponseFile.mockResolvedValueOnce({
      content: [{ type: "text", text: "I'll set up three areas with a product each.\n\nDone — created three areas with their own products." }],
    });

    const { reply, reasoning } = await callLocalBridge({ systemPrompt: "s", contextPrompt: "c", tools: [], runTool: vi.fn() });

    // "Last round's own text" alone would have made reply === reasoning here
    // (there's only one round) — the exact regression a real user caught a
    // second time, even after the round-based version of this fix.
    expect(reasoning).toBe("I'll set up three areas with a product each.\n\nDone — created three areas with their own products.");
    expect(reply).toBe("Done — created three areas with their own products.");
    expect(reply).not.toBe(reasoning);
  });

  it("sends analyze_attachment's image as a real image content block, matching Anthropic's own tool_result shape (this transport is documented as Claude-compatible)", async () => {
    pollForResponseFile
      .mockResolvedValueOnce({
        content: [{ type: "tool_use", id: "toolu_1", name: "analyze_attachment", input: { file_url: "https://x/y.png" } }],
      })
      .mockResolvedValueOnce({ content: [{ type: "text", text: "That's a chart." }] });

    const runTool = vi.fn(() => ({ file_url: "https://x/y.png", is_image: true, media_type: "image/png", image_base64: "QUJD" }));
    await callLocalBridge({ systemPrompt: "s", contextPrompt: "c", tools: [], runTool });

    const [, , body1] = writeRequestFile.mock.calls[1];
    expect(body1.messages[2]).toEqual({
      role: "user",
      content: [{
        type: "tool_result",
        tool_use_id: "toolu_1",
        content: [
          { type: "text", text: JSON.stringify({ file_url: "https://x/y.png", is_image: true }) },
          { type: "image", source: { type: "base64", media_type: "image/png", data: "QUJD" } },
        ],
      }],
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

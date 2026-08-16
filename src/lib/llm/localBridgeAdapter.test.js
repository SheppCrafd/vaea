import { describe, it, expect, vi, beforeEach } from "vitest";
import { callLocalBridge, resumeLocalBridgeRequest } from "./localBridgeAdapter.js";

vi.mock("./localBridgeStorage.js", () => ({
  writeRequestFile: vi.fn(async () => {}),
  pollForResponseFile: vi.fn(),
  archiveProcessedRound: vi.fn(async () => {}),
  savePendingBackdoorRequest: vi.fn(async () => {}),
  clearPendingBackdoorRequest: vi.fn(async () => {}),
  findLatestLivePromptRound: vi.fn(),
  readPromptFile: vi.fn(),
}));

import {
  writeRequestFile,
  pollForResponseFile,
  savePendingBackdoorRequest,
  clearPendingBackdoorRequest,
  findLatestLivePromptRound,
  readPromptFile,
} from "./localBridgeStorage.js";

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

  it("keeps a genuinely multi-paragraph reply intact when it's the ONLY round (no tool calls at all this turn) — paragraph breaks are not round boundaries", async () => {
    pollForResponseFile.mockResolvedValueOnce({
      content: [{ type: "text", text: "Here's the first thing to know.\n\nAnd here's the second, equally real, paragraph." }],
    });

    const { reply, reasoning, thinking } = await callLocalBridge({ systemPrompt: "s", contextPrompt: "c", tools: [], runTool: vi.fn() });

    // A single round with zero tool calls has nothing to separate out — the
    // whole thing, both paragraphs, is the real reply (see
    // anthropicAdapter.test.js's matching case for why an earlier version of
    // this code got this wrong).
    expect(reasoning).toBe("Here's the first thing to know.\n\nAnd here's the second, equally real, paragraph.");
    expect(reply).toBe(reasoning);
    expect(thinking).toEqual(["Here's the first thing to know.\n\nAnd here's the second, equally real, paragraph."]);
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

// A real customer's Backdoor Mode reply went permanently missing: they
// navigated away while a human was still relaying the answer, and the
// requestId that would have claimed the eventually-written response only
// ever lived in one in-memory JS closure — gone the moment that navigation
// happened, even though the answer sat right there on disk, fully written,
// forever unread. These tests cover the fix: a durable pending-request
// pointer (localBridgeStorage.js) recorded before the first round and
// cleared on any clean outcome, plus resumeLocalBridgeRequest picking a
// genuinely orphaned exchange back up from whatever's already on disk.
describe("localBridgeAdapter: orphaned-request pointer + resume", () => {
  it("saves a pending-request pointer before the first round, and clears it on a clean success", async () => {
    pollForResponseFile.mockResolvedValueOnce({ content: [{ type: "text", text: "Just a reply." }] });

    await callLocalBridge({ systemPrompt: "s", contextPrompt: "c", tools: [], runTool: vi.fn(), sessionId: "sess_1" });

    expect(savePendingBackdoorRequest).toHaveBeenCalledTimes(1);
    const [{ sessionId, requestId }] = savePendingBackdoorRequest.mock.calls[0];
    expect(sessionId).toBe("sess_1");
    expect(requestId).toEqual(expect.any(String));
    expect(clearPendingBackdoorRequest).toHaveBeenCalledTimes(1);
    // The pointer has to clear AFTER the real work finishes, not before —
    // otherwise a tab dying mid-poll would look "already cleared" even
    // though nothing actually completed.
    expect(clearPendingBackdoorRequest.mock.invocationCallOrder[0]).toBeGreaterThan(
      pollForResponseFile.mock.invocationCallOrder[0]
    );
  });

  it("clears the pending-request pointer on a clean error too, not just success — nothing left to resume from a real terminal failure", async () => {
    pollForResponseFile.mockResolvedValueOnce({ notContent: true });

    await expect(
      callLocalBridge({ systemPrompt: "s", contextPrompt: "c", tools: [], runTool: vi.fn(), sessionId: "sess_1" })
    ).rejects.toThrow("Malformed response");

    expect(savePendingBackdoorRequest).toHaveBeenCalledTimes(1);
    expect(clearPendingBackdoorRequest).toHaveBeenCalledTimes(1);
  });

  it("resumeLocalBridgeRequest returns null when nothing is live for that id — already fully resolved, not actually orphaned", async () => {
    findLatestLivePromptRound.mockResolvedValueOnce(-1);

    const result = await resumeLocalBridgeRequest({ requestId: "req-1", runTool: vi.fn() });

    expect(result).toBeNull();
    expect(readPromptFile).not.toHaveBeenCalled();
    expect(writeRequestFile).not.toHaveBeenCalled();
  });

  it("resumeLocalBridgeRequest picks up the latest live round without re-writing it, using the messages already reconstructed from disk", async () => {
    findLatestLivePromptRound.mockResolvedValueOnce(2);
    readPromptFile.mockResolvedValueOnce({
      round: 2,
      messages: [
        { role: "user", content: "original message" },
        { role: "assistant", content: [{ type: "tool_use", id: "toolu_1", name: "search_workspace", input: {} }] },
        { role: "user", content: [{ type: "tool_result", tool_use_id: "toolu_1", content: "{}" }] },
      ],
    });
    // The exact bug this closes: the answer was already sitting there,
    // written while nothing was polling for it.
    pollForResponseFile.mockResolvedValueOnce({ content: [{ type: "text", text: "Recovered reply." }] });

    const result = await resumeLocalBridgeRequest({ requestId: "req-1", runTool: vi.fn() });

    expect(result).toEqual({ reply: "Recovered reply.", reasoning: "Recovered reply.", thinking: ["Recovered reply."] });
    // Round 2's own file already exists on disk (that's what got read to
    // reconstruct `messages`) — writing it again would clobber it.
    expect(writeRequestFile).not.toHaveBeenCalled();
    expect(pollForResponseFile).toHaveBeenCalledWith("req-1", 2, expect.any(Object));
  });

  it("resumeLocalBridgeRequest writes a genuinely NEW round if the resumed exchange still needs another tool call, without re-sending system/tools", async () => {
    findLatestLivePromptRound.mockResolvedValueOnce(1);
    readPromptFile.mockResolvedValueOnce({
      round: 1,
      messages: [{ role: "user", content: "original message" }],
    });
    pollForResponseFile
      .mockResolvedValueOnce({
        content: [{ type: "tool_use", id: "toolu_2", name: "search_workspace", input: { query: "x" } }],
      })
      .mockResolvedValueOnce({ content: [{ type: "text", text: "Done after resuming." }] });

    const runTool = vi.fn(() => ({ found: true }));
    const result = await resumeLocalBridgeRequest({ requestId: "req-1", runTool });

    expect(result.reply).toBe("Done after resuming.");
    // Round 1 (what was resumed from) never gets re-written; only the new
    // round 2 does, and — being a non-zero round — without system/tools.
    expect(writeRequestFile).toHaveBeenCalledTimes(1);
    const [, round, body] = writeRequestFile.mock.calls[0];
    expect(round).toBe(2);
    expect(body).not.toHaveProperty("system");
    expect(body).not.toHaveProperty("tools");
  });
});

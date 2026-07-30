import { describe, expect, it } from "vitest";
import {
  MAX_DREAM_SESSIONS,
  MAX_MESSAGES_PER_SESSION,
  MAX_MESSAGE_CHARS,
  MAX_TRANSCRIPT_CHARS,
  buildDreamInstruction,
  formatDreamTranscript,
} from "./dreamSummary.js";

function msg(sessionId, role, content, isoTime) {
  return { session_id: sessionId, role, content, created_date: isoTime };
}

describe("formatDreamTranscript", () => {
  it("reports no messages for empty input", () => {
    expect(formatDreamTranscript([])).toEqual({ hasMessages: false, transcriptText: "", sessionCount: 0, messageCount: 0 });
    expect(formatDreamTranscript(undefined)).toEqual({ hasMessages: false, transcriptText: "", sessionCount: 0, messageCount: 0 });
  });

  it("groups messages by session and formats as ROLE: text blocks", () => {
    const messages = [
      msg("s1", "user", "hi", "2026-07-30T09:00:00.000Z"),
      msg("s1", "assistant", "hello", "2026-07-30T09:00:05.000Z"),
      msg("s2", "user", "second convo", "2026-07-30T14:00:00.000Z"),
    ];
    const result = formatDreamTranscript(messages);
    expect(result.hasMessages).toBe(true);
    expect(result.sessionCount).toBe(2);
    expect(result.messageCount).toBe(3);
    expect(result.transcriptText).toContain("USER: hi");
    expect(result.transcriptText).toContain("ASSISTANT: hello");
    expect(result.transcriptText).toContain("USER: second convo");
    // two distinct conversation blocks
    expect(result.transcriptText.match(/--- Conversation/g)).toHaveLength(2);
  });

  it("strips tool-log fences from message content", () => {
    const messages = [msg("s1", "assistant", "```tool-log\nhidden stuff\n```\n\nthe real reply", "2026-07-30T09:00:00.000Z")];
    const result = formatDreamTranscript(messages);
    expect(result.transcriptText).toContain("the real reply");
    expect(result.transcriptText).not.toContain("hidden stuff");
  });

  it("truncates an individual message past MAX_MESSAGE_CHARS", () => {
    const long = "x".repeat(MAX_MESSAGE_CHARS + 500);
    const messages = [msg("s1", "user", long, "2026-07-30T09:00:00.000Z")];
    const result = formatDreamTranscript(messages);
    expect(result.transcriptText).toContain("[...truncated]");
    expect(result.transcriptText.length).toBeLessThan(long.length);
  });

  it("caps per-session message count at MAX_MESSAGES_PER_SESSION", () => {
    const messages = Array.from({ length: MAX_MESSAGES_PER_SESSION + 10 }, (_, i) =>
      msg("s1", i % 2 === 0 ? "user" : "assistant", `msg ${i}`, `2026-07-30T09:${String(i).padStart(2, "0")}:00.000Z`)
    );
    const result = formatDreamTranscript(messages);
    const lineCount = result.transcriptText.split("\n").filter((l) => l.startsWith("USER:") || l.startsWith("ASSISTANT:")).length;
    expect(lineCount).toBe(MAX_MESSAGES_PER_SESSION);
  });

  it("keeps only the most recent MAX_DREAM_SESSIONS sessions and notes the omission", () => {
    const sessionCount = MAX_DREAM_SESSIONS + 5;
    const messages = Array.from({ length: sessionCount }, (_, i) =>
      msg(`s${i}`, "user", `hi from session ${i}`, `2026-07-30T${String(9 + Math.floor(i / 4)).padStart(2, "0")}:${String((i % 4) * 10).padStart(2, "0")}:00.000Z`)
    );
    const result = formatDreamTranscript(messages);
    expect(result.transcriptText.match(/--- Conversation/g)).toHaveLength(MAX_DREAM_SESSIONS);
    expect(result.transcriptText).toContain("5 earlier conversation(s) omitted");
    // kept the most recent, not the earliest
    expect(result.transcriptText).not.toContain("hi from session 0");
    expect(result.transcriptText).toContain(`hi from session ${sessionCount - 1}`);
  });

  it("omits whole conversation blocks once MAX_TRANSCRIPT_CHARS would be exceeded, and notes it", () => {
    const big = "y".repeat(MAX_MESSAGE_CHARS);
    // enough sessions, each near the per-message cap, to blow well past the total budget
    const sessionsNeeded = Math.ceil(MAX_TRANSCRIPT_CHARS / big.length) + 3;
    const messages = Array.from({ length: sessionsNeeded }, (_, i) =>
      msg(`s${i}`, "user", big, `2026-07-30T09:${String(i * 2).padStart(2, "0")}:00.000Z`)
    );
    const result = formatDreamTranscript(messages);
    expect(result.transcriptText).toContain("conversation(s) omitted to stay within the review budget");
  });
});

describe("buildDreamInstruction", () => {
  it("includes the anti-laziness instruction and the inline-reasoning-only constraint", () => {
    const text = buildDreamInstruction("--- Conversation ---\nUSER: hi");
    expect(text).toContain("do not skip straight to the ones with obvious friction");
    expect(text).toContain("not via any tool call");
    expect(text).toContain("--- Conversation ---\nUSER: hi");
  });

  it("forbids user-behavior notes by default", () => {
    const text = buildDreamInstruction("transcript");
    expect(text).toContain("Do not analyze or save anything about how the user themselves communicates");
    expect(text).not.toContain('"## User Notes"');
  });

  it("permits a new User Notes section only when userAnalysisConsent is true", () => {
    const text = buildDreamInstruction("transcript", { userAnalysisConsent: true });
    expect(text).toContain('"## User Notes"');
    expect(text).toContain("Nothing about the user belongs in \"## Notes\"");
    expect(text).not.toContain("Do not analyze or save anything about how the user themselves communicates");
  });
});

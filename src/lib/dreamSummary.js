// The heavier, once-a-day layer folded into a reflection turn (see
// reflectionPreferences.js's DREAM_INTERVAL_MS and useChatController.js's
// runReflectionTurn) — reviews today's real conversation content, not just
// workspace facts. Split into a pure formatter (formatDreamTranscript,
// directly testable) and a thin async fetch wrapper (gatherDreamTranscript,
// not unit tested, same as runIdleVaultLog's own direct base44 fetch),
// mirroring computeWorkspaceDelta/buildReflectionInstruction's own
// pure/impure split in reflectionSummary.js.
import { base44 } from "@/api/base44Client";
import { stripToolLog } from "@/lib/chatActions";

// A realistic day's worth of distinct conversations to review — past this,
// keep only the most recent ones rather than let the prompt grow unbounded.
export const MAX_DREAM_SESSIONS = 20;
// Per-conversation cap, tighter than runIdleVaultLog's single-session 200
// since a dream turn spans many sessions in one prompt.
export const MAX_MESSAGES_PER_SESSION = 60;
// One oversized pasted message (a long paste, a big tool result) can't blow
// the whole review budget alone.
export const MAX_MESSAGE_CHARS = 2000;
// A firm ceiling on the whole day's formatted transcript text — ~10k tokens.
export const MAX_TRANSCRIPT_CHARS = 40000;
// The @base44/sdk's own per-request hard cap on list()/filter() — realistic
// for one day of personal use; no pagination loop needed for v1.
const DREAM_FETCH_LIMIT = 5000;

// Pure — takes already-fetched ChatMessage rows (ascending by created_date,
// as gatherDreamTranscript's own query below already returns them), groups
// by session, formats as plain "ROLE: text" transcript blocks, and caps
// volume three ways (session count, per-session message count, total
// character budget) so this can be unit tested with plain arrays, no
// network or base44 import needed to exercise it.
export function formatDreamTranscript(messages) {
  if (!messages?.length) {
    return { hasMessages: false, transcriptText: "", sessionCount: 0, messageCount: 0 };
  }

  const bySession = new Map();
  for (const m of messages) {
    if (!bySession.has(m.session_id)) bySession.set(m.session_id, []);
    bySession.get(m.session_id).push(m);
  }

  // Map preserves insertion order, which equals chronological order since
  // the input is ascending by created_date — so "most recent" is just "last".
  let entries = [...bySession.entries()];
  const omittedSessions = Math.max(0, entries.length - MAX_DREAM_SESSIONS);
  if (omittedSessions) entries = entries.slice(-MAX_DREAM_SESSIONS);

  const blocks = [];
  let totalChars = 0;
  let omittedForBudget = 0;
  for (const [, msgs] of entries) {
    const capped = msgs.slice(0, MAX_MESSAGES_PER_SESSION);
    const time = new Date(capped[0].created_date).toISOString().slice(11, 16);
    const lines = capped.map((m) => {
      const text = stripToolLog(m.content || "");
      const body = text.length > MAX_MESSAGE_CHARS ? `${text.slice(0, MAX_MESSAGE_CHARS)} [...truncated]` : text;
      return `${m.role.toUpperCase()}: ${body}`;
    });
    const block = `--- Conversation (${time}) ---\n${lines.join("\n")}`;
    if (totalChars + block.length > MAX_TRANSCRIPT_CHARS) {
      omittedForBudget++;
      continue;
    }
    totalChars += block.length;
    blocks.push(block);
  }

  const notes = [];
  if (omittedSessions) notes.push(`${omittedSessions} earlier conversation(s) omitted (kept the most recent ${MAX_DREAM_SESSIONS})`);
  if (omittedForBudget) notes.push(`${omittedForBudget} conversation(s) omitted to stay within the review budget`);

  return {
    hasMessages: blocks.length > 0,
    transcriptText: [...blocks, ...(notes.length ? [`[${notes.join("; ")}]`] : [])].join("\n\n"),
    sessionCount: bySession.size,
    messageCount: messages.length,
  };
}

// Thin, impure orchestrator — fetches every ChatMessage since sinceIso
// across ALL sessions in one request (RLS already scopes this to the signed
// -in user, same as useChatSessions.js/useChatMessages.js, so no manual
// user-filtering or session-list-first step is needed), then hands the raw
// rows to the pure formatter above. Not unit tested, same as
// useChatController.js's runIdleVaultLog, which has no test today either.
export async function gatherDreamTranscript(sinceIso) {
  const rows = await base44.entities.ChatMessage.filter({ created_date: { $gte: sinceIso } }, "created_date", DREAM_FETCH_LIMIT);
  return formatDreamTranscript(rows);
}

// The dream review instruction itself — composed into
// reflectionSummary.js's buildReflectionInstruction when a dream cycle is
// due. `userAnalysisConsent` gates ONLY whether this cycle may also notice
// and save patterns about the USER (a new, separate "## User Notes" section
// of Vaea Self.md) — self-analysis into the existing "## Notes" section
// happens either way and needs no extra permission, since that's Vaea
// judging Vaea, the same category of self-observation the base reflection
// feature already allows.
export function buildDreamInstruction(transcriptText, { userAnalysisConsent = false } = {}) {
  const userGuidance = userAnalysisConsent
    ? `You also have permission this cycle to notice real, repeated patterns in how the user themselves communicates or works — not a guess from one message — and save genuinely useful ones under a new "## User Notes" section of the same file (create it if missing; write its full revised body, consolidate rather than endlessly append, same discipline as "## Notes"). Nothing about the user belongs in "## Notes" — keep the two sections strictly separate.`
    : `Do not analyze or save anything about how the user themselves communicates, writes, or behaves — same as always, this is only ever about your own responses. If something about them is genuinely worth mentioning, say it in your reply this turn, but do not write it to notes.`;

  return `[DAILY REVIEW — folded into this check-in]
Below are today's real conversations with the user since your last review — not just workspace facts. Look closely at ALL of them, including the ones that look simple or went fine on the surface — do not skip straight to the ones with obvious friction; an exchange that "worked fine" often still has a better version worth finding.

For each one, reason briefly (in your own thinking for this response, not via any tool call) about whether your actual reply was the best available one, and what a noticeably better reply would have looked like and why.

From that review, note:
- Real friction: replies that missed the ask, over- or under-explained, or could simply have been more useful.
- Real wins: replies that landed well, and why — so the pattern repeats.

Distill 1-3 CONCRETE, checkable takeaways — not platitudes ("be more helpful") but specific behavior changes ("when asked to X, do X directly instead of Y first").

${userGuidance}

Write your self-takeaways into "## Notes" the same way you always do this turn (consolidate, don't just append). Your opening chat message this turn may mention ONE thing you noticed and changed, in one warm, plain sentence — no invented framing, no speculation beyond what you actually found. The real detail belongs in Notes, not in what the user reads here.

--- Today's conversations ---
${transcriptText}`;
}

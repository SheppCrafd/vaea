import { writeRequestFile, pollForResponseFile, archiveProcessedRound, savePendingLocalModeRequest, clearPendingLocalModeRequest, findLatestLivePromptRound, readPromptFile } from "@/lib/llm/localBridgeStorage";
import { extractPlan } from "@/lib/llm/streamUtils";

// "Local Mode" — same plan-then-tools loop shape as anthropicAdapter.js's
// callAnthropic, but the transport is two folders on disk instead of a
// fetch() call: each round writes prompts/<id>-r<round>.json and polls
// responses/<id>-r<round>.json (localBridgeStorage.js) until the user's own
// local watcher script (running against their on-prem/local model) answers
// it. Request/response bodies use the same {content: [...]} shape Anthropic's
// Messages API does — a text block and/or tool_use blocks — since that's
// already the richest shape this codebase produces (toAnthropicTools()) and
// it lets a watcher script forward the request almost unmodified to any
// Claude-compatible local runtime, or translate it for another one. See
// LocalModeSetupGuidePage.jsx for the full file contract and a sample
// script.
//
// Every prompts/<id>-r<round>.json is now uniformly {round, messages} — the
// system prompt and full tool catalog used to be duplicated into round 0's
// own file (a real workspace was hitting ~44,000 tokens per round file
// before this); they're now static files written once when the folder is
// connected instead (localBridgeStorage.js's writeStaticContextFiles:
// VAEA_SYSTEM_PROMPT.md/VAEA_TOOL_CATALOG.json), so a relay reads them
// straight off disk rather than out of every prompt payload. bridge_watcher.py
// mirrors this (its own _load_static_context, replacing what used to be a
// per-requestId cache keyed off round 0). This adapter never even receives
// systemPrompt/tools as params any more — only byokChat.js's HTTP adapters
// (anthropicAdapter.js/openaiCompatibleAdapter.js) still need them inline.
const MAX_TOOL_ROUNDS = 15;
const DEFAULT_POLL_INTERVAL_MS = 5000;
// How many times a single round gets to resend after a malformed/wrong-shape
// response before the turn actually fails — see the malformed-response
// handling in runToolLoop below.
const MAX_MALFORMED_RETRIES = 1;

function newRequestId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// The actual poll-and-continue loop, extracted so both a fresh send
// (callLocalBridge, starting at round 0 with nothing written yet) and a
// resumed one (resumeLocalBridgeRequest, starting wherever the previous
// browser session left off, with that round's own file already on disk)
// run through exactly the same logic — no separate "resume" copy to drift
// out of sync with the real thing. `firstRoundAlreadyWritten` is what tells
// the two apart: false for a fresh call (round 0 genuinely needs writing),
// true for a resume (the starting round's file already exists — writing it
// again would clobber the real messages with whatever a resume happens to
// reconstruct). Returns {reply, reasoning, thinking} — see callLocalBridge's
// own comment for what each means.
// Polls one round, and — if the response is malformed (unparseable JSON, or
// valid JSON that doesn't match {content: [...]}) — gives the relay up to
// MAX_MALFORMED_RETRIES chances to resend correctly before actually failing.
// Each retry writes a NEW round file (never rewrites the malformed one —
// an automated watcher only ever looks at rounds with no response yet, so
// reusing the same round number would mean it never gets picked back up)
// carrying a plain-language correction message describing exactly what was
// wrong. Returns {response, round} — `round` may be higher than the one
// passed in if any retries happened, and the caller should treat THAT as
// the round whose response it just consumed.
async function pollRoundWithRetries({ requestId, round, messages, pollIntervalMs }) {
  let attempt = 0;
  let currentRound = round;
  for (;;) {
    const response = await pollForResponseFile(requestId, currentRound, { intervalMs: pollIntervalMs });
    const content = response?.content;
    const malformed = response?.malformed === true || !Array.isArray(content);
    if (!malformed) return { response, round: currentRound };

    // response can legitimately be undefined here (readResponseFileIfPresent
    // only returns {malformed, raw} for a truthy-but-unparseable file — an
    // empty/never-written file resolves to null/undefined instead), so
    // JSON.stringify(response) has to be guarded rather than assumed to
    // return a string.
    const responseDump = JSON.stringify(response ?? null) ?? "null";
    if (attempt >= MAX_MALFORMED_RETRIES) {
      const reason = response?.malformed
        ? `wasn't valid JSON: ${String(response.raw).slice(0, 500)}`
        : `was valid JSON but didn't match the expected {"content": [...]} shape: ${responseDump.slice(0, 500)}`;
      throw new Error(`Malformed response in responses/${requestId}-r${currentRound}.json — ${reason}`);
    }
    attempt += 1;
    currentRound += 1;
    const correction = response?.malformed
      ? `Your last response wasn't valid JSON — no markdown fence, no text outside the object. You sent:\n${String(response.raw).slice(0, 2000)}\n\nResend ONLY a raw JSON object shaped {"content": [...]} to responses/${requestId}-r${currentRound}.json.`
      : `Your last response was valid JSON but didn't match the expected {"content": [...]} shape. You sent:\n${responseDump.slice(0, 2000)}\n\nResend a correctly shaped {"content": [...]} object to responses/${requestId}-r${currentRound}.json.`;
    messages.push({ role: "user", content: correction });
    await writeRequestFile(requestId, currentRound, { round: currentRound, messages });
  }
}

async function runToolLoop({ requestId, startRound, messages, runTool, pollIntervalMs, firstRoundAlreadyWritten = false }) {
  const thinking = [];
  const planParts = [];

  for (let round = startRound; round < MAX_TOOL_ROUNDS; round++) {
    const isFirstIteration = round === startRound;
    if (!isFirstIteration || !firstRoundAlreadyWritten) {
      // Every round is just the conversation delta now — see this file's
      // own module comment for where system/tools moved instead.
      await writeRequestFile(requestId, round, { round, messages });
    }
    const { response, round: answeredRound } = await pollRoundWithRetries({ requestId, round, messages, pollIntervalMs });
    round = answeredRound;

    const content = response.content;
    // This round's response has been read and is about to drive the turn —
    // the prompt has successfully done its job, so the pair moves from the
    // live folders (the "new" list) into processed/ (the "known" list).
    await archiveProcessedRound(requestId, round);
    const toolUseBlocks = content.filter((block) => block.type === "tool_use");
    const rawRoundText = content.filter((block) => block.type === "text").map((block) => block.text).join("\n").trim();
    const { text: roundText, plan } = extractPlan(rawRoundText);
    if (plan) planParts.push(plan);
    if (roundText) thinking.push(roundText);

    if (toolUseBlocks.length === 0) {
      return {
        reply: roundText || "I couldn't come up with a reply — could you rephrase?",
        reasoning: planParts.length ? planParts.join("\n\n") : thinking.join("\n\n"),
        thinking,
      };
    }

    messages.push({ role: "assistant", content });
    // Sequential, not Promise.all — runTool is async now (vault tools,
    // read_project_link, analyze_attachment all make real network calls).
    const toolResults = [];
    for (const block of toolUseBlocks) {
      const result = await runTool(block.name, block.input);
      // See anthropicAdapter.js's matching comment — same Anthropic-shaped
      // content format, so a real image rides along as its own content
      // block for whatever local runtime the user's watcher script forwards
      // this to (already documented as "Claude-compatible" — see
      // LocalModeSetupGuidePage.jsx).
      const { image_base64, media_type, ...rest } = result || {};
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: image_base64
          ? [
              { type: "text", text: JSON.stringify(rest) },
              { type: "image", source: { type: "base64", media_type, data: image_base64 } },
            ]
          : JSON.stringify(result),
      });
    }
    messages.push({ role: "user", content: toolResults });
  }

  throw new Error(`Gave up after ${MAX_TOOL_ROUNDS} tool-call rounds without a final reply.`);
}

// Returns {reply, reasoning, thinking} for one turn — `reply` is just the
// last round's own text, taken whole (the actual conversational answer,
// however many paragraphs it takes — see anthropicAdapter.js's matching
// comment for why this is no longer a paragraph-split guess), `reasoning` is
// every round's own text joined (the full deliberation, self-corrections
// included), and `thinking` is that same set of rounds as a real array
// (not yet joined into one string) — this adapter never streams live (see
// the module comment above), so byokChat.js's simulateLiveReveal needs the
// real round boundaries back, not just a flat string, to fake the same
// live "past round dims, new round grows" behavior real streaming gives.
//
// `sessionId` is only used to record the pending-request pointer
// (localBridgeStorage.js) so an interrupted browser session (reload, tab
// killed while backgrounded, crash) can be resumed later instead of the
// eventual answer sitting unread on disk forever — see
// resumeLocalBridgeRequest below and its own header comment for the real
// incident this closes.
export async function callLocalBridge({ contextPrompt, runTool, sessionId, pollIntervalMs = DEFAULT_POLL_INTERVAL_MS }) {
  const requestId = newRequestId();
  const messages = [{ role: "user", content: contextPrompt }];
  await savePendingLocalModeRequest({ sessionId, requestId });
  try {
    const result = await runToolLoop({ requestId, startRound: 0, messages, runTool, pollIntervalMs });
    await clearPendingLocalModeRequest();
    return result;
  } catch (err) {
    // A clean failure (malformed response, gave up after MAX_TOOL_ROUNDS,
    // the poll itself timing out after 10 minutes) is a real terminal state
    // the user already sees surfaced as an error — nothing left to resume,
    // so the pointer should clear here too. It's specifically an UNCLEAN
    // exit (the tab dying mid-poll, never reaching either branch of this
    // catch at all) that's supposed to leave the pointer behind.
    await clearPendingLocalModeRequest();
    throw err;
  }
}

// The resume path: called on load/reconnect when a leftover pointer is
// found (localBridgeStorage.js's getPendingLocalModeRequest). Reconstructs
// exactly where the previous browser session left off from what's already
// sitting on disk — no separate persisted copy of the conversation needed —
// and picks the SAME poll-and-continue loop back up. Returns null if the
// request turns out to already be fully resolved (every round archived,
// nothing live) rather than genuinely orphaned, so the caller can just clear
// the stale pointer without treating it as a real answer.
export async function resumeLocalBridgeRequest({ requestId, runTool, pollIntervalMs = DEFAULT_POLL_INTERVAL_MS }) {
  const latestRound = await findLatestLivePromptRound(requestId);
  if (latestRound < 0) return null; // nothing live — already fully resolved, or never really started

  const latestPrompt = await readPromptFile(requestId, latestRound);
  if (!latestPrompt) return null;
  const messages = latestPrompt.messages || [];

  return runToolLoop({ requestId, startRound: latestRound, messages, runTool, pollIntervalMs, firstRoundAlreadyWritten: true });
}

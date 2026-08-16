import { writeRequestFile, pollForResponseFile, archiveProcessedRound, savePendingBackdoorRequest, clearPendingBackdoorRequest, findLatestLivePromptRound, readPromptFile } from "@/lib/llm/localBridgeStorage";
import { extractPlan } from "@/lib/llm/streamUtils";

// "Backdoor Mode" — same plan-then-tools loop shape as anthropicAdapter.js's
// callAnthropic, but the transport is two folders on disk instead of a
// fetch() call: each round writes prompts/<id>-r<round>.json and polls
// responses/<id>-r<round>.json (localBridgeStorage.js) until the user's own
// local watcher script (running against their on-prem/local model) answers
// it. Request/response bodies use the same {content: [...]} shape Anthropic's
// Messages API does — a text block and/or tool_use blocks — since that's
// already the richest shape this codebase produces (toAnthropicTools()) and
// it lets a watcher script forward the request almost unmodified to any
// Claude-compatible local runtime, or translate it for another one. See
// BackdoorModeSetupGuidePage.jsx for the full file contract and a sample
// script.
const MAX_TOOL_ROUNDS = 15;
const DEFAULT_POLL_INTERVAL_MS = 5000;

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
// again would clobber the real system/tools with the undefined ones a
// resume never has). Returns {reply, reasoning, thinking} — see
// callLocalBridge's own comment for what each means.
async function runToolLoop({ requestId, startRound, messages, runTool, pollIntervalMs, systemPrompt, tools, firstRoundAlreadyWritten = false }) {
  const thinking = [];
  const planParts = [];

  for (let round = startRound; round < MAX_TOOL_ROUNDS; round++) {
    const isFirstIteration = round === startRound;
    if (!isFirstIteration || !firstRoundAlreadyWritten) {
      // system/tools are large (the full instruction text plus the whole
      // Zod-derived tool catalog — tens of thousands of tokens for a real
      // workspace) and byte-for-byte identical on every round of the SAME
      // turn, so only round 0 actually writes them — a real user's own
      // multi-round conversation was hitting the on-disk prompt file at
      // ~44,000 tokens per round before this, almost entirely duplicated
      // content. bridge_watcher.py caches round 0's copy per requestId (or
      // recovers it from processed/prompts/ if the watcher restarted
      // mid-conversation) and reconstructs the full request before handing
      // it to whichever connector answers it — every existing connector
      // function (echo/ollama/lmstudio/etc.) needed zero changes for this.
      const payload = round === 0 ? { round, system: systemPrompt, tools, messages } : { round, messages };
      await writeRequestFile(requestId, round, payload);
    }
    const response = await pollForResponseFile(requestId, round, { intervalMs: pollIntervalMs });

    const content = response?.content;
    if (!Array.isArray(content)) {
      throw new Error(`Malformed response in responses/${requestId}-r${round}.json — expected a {"content": [...]} object.`);
    }
    // This round's response has been read and is about to drive the turn —
    // the prompt has successfully done its job, so the pair moves from the
    // live folders (the "new" list) into processed/ (the "known" list).
    // A malformed response deliberately never reaches this line: the pair
    // stays in place for debugging. Best-effort — see localBridgeStorage.js.
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
      // BackdoorModeSetupGuidePage.jsx).
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
export async function callLocalBridge({ systemPrompt, contextPrompt, tools, runTool, sessionId, pollIntervalMs = DEFAULT_POLL_INTERVAL_MS }) {
  const requestId = newRequestId();
  const messages = [{ role: "user", content: contextPrompt }];
  await savePendingBackdoorRequest({ sessionId, requestId });
  try {
    const result = await runToolLoop({ requestId, startRound: 0, messages, runTool, pollIntervalMs, systemPrompt, tools });
    await clearPendingBackdoorRequest();
    return result;
  } catch (err) {
    // A clean failure (malformed response, gave up after MAX_TOOL_ROUNDS,
    // the poll itself timing out after 10 minutes) is a real terminal state
    // the user already sees surfaced as an error — nothing left to resume,
    // so the pointer should clear here too. It's specifically an UNCLEAN
    // exit (the tab dying mid-poll, never reaching either branch of this
    // catch at all) that's supposed to leave the pointer behind.
    await clearPendingBackdoorRequest();
    throw err;
  }
}

// The resume path: called on load/reconnect when a leftover pointer is
// found (localBridgeStorage.js's getPendingBackdoorRequest). Reconstructs
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

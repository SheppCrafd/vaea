import { writeRequestFile, pollForResponseFile } from "@/lib/llm/localBridgeStorage";

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

export async function callLocalBridge({ systemPrompt, contextPrompt, tools, runTool, pollIntervalMs = DEFAULT_POLL_INTERVAL_MS }) {
  const requestId = newRequestId();
  const messages = [{ role: "user", content: contextPrompt }];
  // Every round's own text — not just the final round's — is real thinking
  // the model produced as it worked through the request (see THINK OUT LOUD
  // AS YOU GO in systemPrompt.js): "I'll check the workspace first...",
  // then after results come back, "Found two matches, now creating the
  // plan...". Discarding every round but the last one was throwing that
  // away entirely.
  const thinking = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    await writeRequestFile(requestId, round, { round, system: systemPrompt, tools, messages });
    const response = await pollForResponseFile(requestId, round, { intervalMs: pollIntervalMs });

    const content = response?.content;
    if (!Array.isArray(content)) {
      throw new Error(`Malformed response in responses/${requestId}-r${round}.json — expected a {"content": [...]} object.`);
    }
    const toolUseBlocks = content.filter((block) => block.type === "tool_use");
    const roundText = content.filter((block) => block.type === "text").map((block) => block.text).join("\n").trim();
    if (roundText) thinking.push(roundText);

    if (toolUseBlocks.length === 0) {
      return thinking.join("\n\n") || "I couldn't come up with a reply — could you rephrase?";
    }

    messages.push({ role: "assistant", content });
    const toolResults = toolUseBlocks.map((block) => ({
      type: "tool_result",
      tool_use_id: block.id,
      content: JSON.stringify(runTool(block.name, block.input)),
    }));
    messages.push({ role: "user", content: toolResults });
  }

  throw new Error(`Gave up after ${MAX_TOOL_ROUNDS} tool-call rounds without a final reply.`);
}

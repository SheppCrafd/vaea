// Two real, separate, hidden model calls that generate the <plan> block's
// genuine deliberation for any turn whose finalized plan queues MORE THAN 2
// tool calls (see RESPONSE FORMAT in systemPrompt.js/entry.ts). By the time
// this runs, the main model has already decided the real tool calls — these
// two agents never see or change them, they only explain them, given the
// user's own message and the exact steps about to run:
//   Agent A (propose) drafts a plain first-person planning paragraph from
//   scratch.
//   Agent B (reconsider) reads that draft back against the same steps and
//   either leaves it or revises it with a genuine second thought — the "but
//   wait, that depends on X" a person re-reading their own plan would catch.
// Neither call ever executes a tool itself; both are plain, toolless
// completions on the SAME provider/model config as the main turn (no
// separate key to manage), pinned to that provider's fastest model since
// latency here is pure overhead the user is waiting through.
//
// Budgeted at MICRO_AGENT_BUDGET_MS total across both calls. Either one
// missing its share of the budget degrades to skipping the <plan> block
// entirely (byokChat.js just omits `reasoning`) rather than blocking the
// reply on it — a turn with no reasoning trail beats a slow one. Not
// offered for local-bridge (Local Mode): its own transport is file-polling
// with no fast-call path, so a plan block just doesn't exist for turns
// answered that way — see the module comment in localBridgeAdapter.js.
import { PROVIDERS } from "@/lib/llm/providers";
import { callAnthropic } from "@/lib/llm/anthropicAdapter";
import { callOpenAiCompatible } from "@/lib/llm/openaiCompatibleAdapter";

const MICRO_AGENT_BUDGET_MS = 3000;

// The fastest model each provider currently offers — see providers.js's own
// model catalog. Not user-configurable: this is pure background plumbing,
// never shown as a choice.
const FAST_MODEL = {
  anthropic: "claude-haiku-4-5-20251001",
  openai: "gpt-5-mini",
  google: "gemini-2.5-flash",
  xai: "grok-4-fast",
};

const PROPOSE_SYSTEM_PROMPT =
  "You write ONE short first-person planning paragraph (3-5 sentences) explaining a plan that's already been decided for someone else — you're not deciding anything, only narrating the reasoning behind steps you're given. Plain and direct, no headers, no bullet lists, no restating the raw tool syntax. Do not add or omit steps; explain only the ones given. Output the paragraph and nothing else.";

const RECONSIDER_SYSTEM_PROMPT =
  "You review a colleague's just-written planning paragraph against the same already-decided steps you're also given. If it's already clear and correct, return it unchanged. If a genuinely better second thought exists — a real reconsideration, not a rewrite for its own sake, e.g. \"wait, that depends on X existing first\" — revise it to include that. Keep it 3-6 sentences, plain first-person, no headers or lists. Output ONLY the final paragraph, nothing else.";

function describeToolCalls(actions) {
  return (actions || []).map((a, i) => `${i + 1}. ${a.type}(${JSON.stringify(a.args || {})})`).join("\n");
}

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(null), ms))]);
}

// One toolless completion — no tool catalog offered, so `runTool` is never
// actually invoked; it's a required param on both adapters, not an optional
// hook, so a no-op stub is passed through rather than making either adapter
// tolerate a missing one.
async function callFast({ provider, apiKey, baseUrl, model, systemPrompt, userText }) {
  const runTool = async () => ({});
  if (provider.adapter === "anthropic") {
    const { reply } = await callAnthropic({ apiKey, model, systemPrompt, contextPrompt: userText, tools: [], runTool });
    return reply;
  }
  const { reply } = await callOpenAiCompatible({ baseUrl, apiKey, model, systemPrompt, contextPrompt: userText, tools: [], runTool, providerId: provider.id });
  return reply;
}

// userMessage: the latest real user message this turn is answering.
// actions: the finalized plan array (chatActions.js shape: [{type, args}]).
// Returns the plan paragraph, or null if this provider has no fast-call
// path, both agents missed their budget, or either call errored.
export async function runPlanMicroAgents({ providerConfig, userMessage, actions }) {
  const provider = PROVIDERS[providerConfig?.provider];
  if (!provider?.adapter || provider.adapter === "local-bridge") return null;
  if (provider.keyRequired !== false && !providerConfig?.apiKey) return null;

  const fastModel = FAST_MODEL[provider.id] || providerConfig.model;
  const call = (systemPrompt, userText) =>
    callFast({ provider, apiKey: providerConfig.apiKey, baseUrl: provider.baseUrl || providerConfig.baseUrl, model: fastModel, systemPrompt, userText }).catch(() => null);

  const toolSummary = describeToolCalls(actions);
  const budgetStart = Date.now();

  const draft = await withTimeout(
    call(PROPOSE_SYSTEM_PROMPT, `User asked: "${userMessage}"\n\nSteps about to run:\n${toolSummary}`),
    MICRO_AGENT_BUDGET_MS * 0.6,
  );
  if (!draft) return null;

  const remaining = MICRO_AGENT_BUDGET_MS - (Date.now() - budgetStart);
  if (remaining < 300) return draft.trim();

  const revised = await withTimeout(call(RECONSIDER_SYSTEM_PROMPT, `Steps:\n${toolSummary}\n\nDraft:\n${draft}`), remaining);
  return (revised || draft).trim();
}

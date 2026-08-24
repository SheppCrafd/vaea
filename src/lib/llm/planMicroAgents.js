// Two real, separate, hidden model calls that plan a turn BEFORE the real
// model call ever happens — not a narration of a plan already decided. Both
// agents get the exact same systemPrompt + contextPrompt the main call is
// about to receive (the same [DATABASE STATE], conversation history, and
// latest user message), with one real difference: they're offered only a
// READ-ONLY tool set (search/audit/read/list calls, web search, fetching a
// URL — see toolCatalog.js's `readOnly` filter and toolRunner.js's
// STAGED_TOOL_NAMES) and a short prompt override telling them this is a
// planning pass, not the final response. They can genuinely use those
// read-only tools to check something for real before committing to a plan;
// they can never call a mutating one, because none is ever offered.
//   Agent A (propose) drafts a plain first-person planning narrative from
//   scratch.
//   Agent B (reconsider) reads that draft back against the same context and
//   either leaves it or revises it with a genuine second thought.
// The resulting narrative is then handed to the REAL main call as part of
// its own contextPrompt (see byokChat.js), framed as the model's own
// reasoning to execute — never something it should reference in its reply.
//
// Runs on the SAME provider/key config as the main turn, pinned to that
// provider's fastest model since latency here is pure overhead the user is
// waiting through. Budgeted at MICRO_AGENT_BUDGET_MS total across both
// calls (each may itself spend part of its own share on a real tool round);
// missing that budget just means this turn gets no plan at all — a
// duller/faster turn beats a slow one. Not offered for local-bridge (Local
// Mode): its own transport is file-polling with no fast-call path — see the
// module comment in localBridgeAdapter.js.
import { PROVIDERS } from "@/lib/llm/providers";
import { toAnthropicTools, toOpenAiCompatibleTools } from "@/lib/llm/toolCatalog";
import { makeToolRunner } from "@/lib/llm/toolRunner";
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

const PLANNING_OVERRIDE = `

[PLANNING PASS — overrides RESPONSE FORMAT above for this call only]
This is a hidden planning pass that runs BEFORE the real response — you are not answering the user yet, and nothing you write here is ever shown to them directly. Read everything above as full real context for what's being asked and what's already true in the workspace right now.

Write ONE genuine planning narrative in plain first-person prose — real deliberation, including real second-guessing where it's actually warranted ("I should... but wait, that depends on... so instead I'll..."), not a final answer, not a list, not addressed to the user. You may call a read-only tool (search/audit/read/list, web search, fetching a URL) if checking something for real would change your plan — no mutating tool is offered to you in this pass, so don't attempt one. Describe, in plain language, any create/update/delete-type step you'd actually take ("I'll archive the two stale projects and create one new one for...") without literally calling it — that's the real plan those words describe, even though you can't execute it here.

Do not wrap your output in <response> or <plan> tags. Do not mention that this is a "planning pass" or refer to yourself as a separate agent — just write the plan itself.`;

const reconsiderOverride = (draft) => `

[REVIEW PASS — overrides RESPONSE FORMAT above for this call only]
You're reviewing a colleague's draft plan below, written from the exact same real context above.

Draft:
${draft}

If it's already clear and correct, output it back unchanged. If a genuinely better second thought exists — a real reconsideration ("wait, that depends on X existing first"), not a rewrite for its own sake — revise it to include that. Same rules as the draft: plain first-person prose, no <response>/<plan> tags, never addressed to the user, nothing about being a "review pass." Output ONLY the final planning narrative.`;

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(null), ms))]);
}

// One real planning pass — a genuine (possibly multi-round) tool-call loop,
// same as the main turn gets, just with a read-only-filtered catalog and no
// mutation possible. Its own plan/liveTrace are scratch: real read-tool
// calls it makes along the way are never merged into the turn's actual
// plan or shown as live tool-call rows — this is the planning agent's own
// scratch work, not something that happened.
async function runOnePlanningPass({ provider, providerConfig, fastModel, connections, dataset, externalVault, systemPrompt, contextPrompt }) {
  const runTool = makeToolRunner({ plan: [], liveTrace: [], dataset, externalVault, onEvent: undefined });
  try {
    if (provider.adapter === "anthropic") {
      const { reply } = await callAnthropic({
        apiKey: providerConfig.apiKey, model: fastModel, systemPrompt, contextPrompt,
        tools: toAnthropicTools(connections, { readOnly: true }), runTool,
      });
      return reply;
    }
    const { reply } = await callOpenAiCompatible({
      baseUrl: provider.baseUrl || providerConfig.baseUrl, apiKey: providerConfig.apiKey, model: fastModel, systemPrompt, contextPrompt,
      tools: toOpenAiCompatibleTools(connections, { readOnly: true }), runTool, providerId: provider.id,
    });
    return reply;
  } catch {
    return null;
  }
}

// systemPrompt/contextPrompt: the exact same strings byokChat.js is about to
// send the real main call. connections/dataset/externalVault: the same
// values already built for the real tool runner, reused here so the
// planning agents can genuinely search/read for real. onEvent (optional):
// fires {type:"planning-start"} right before the first call and
// {type:"planning-end"} once both are done (success, timeout, or error) —
// this is what lets the UI show a "(planning...)" line before the real
// response starts streaming. Returns the plan narrative, or null if this
// provider has no fast-call path or both calls missed budget/errored.
export async function runPlanMicroAgents({ providerConfig, systemPrompt, contextPrompt, connections, dataset, externalVault, onEvent }) {
  const provider = PROVIDERS[providerConfig?.provider];
  if (!provider?.adapter || provider.adapter === "local-bridge") return null;
  if (provider.keyRequired !== false && !providerConfig?.apiKey) return null;

  onEvent?.({ type: "planning-start" });
  try {
    const fastModel = FAST_MODEL[provider.id] || providerConfig.model;
    const runPass = (system) =>
      runOnePlanningPass({ provider, providerConfig, fastModel, connections, dataset, externalVault, systemPrompt: system, contextPrompt });

    const budgetStart = Date.now();
    const draft = await withTimeout(runPass(systemPrompt + PLANNING_OVERRIDE), MICRO_AGENT_BUDGET_MS * 0.6);
    if (!draft) return null;

    const remaining = MICRO_AGENT_BUDGET_MS - (Date.now() - budgetStart);
    if (remaining < 300) return draft.trim();

    const revised = await withTimeout(runPass(systemPrompt + reconsiderOverride(draft)), remaining);
    return (revised || draft).trim();
  } finally {
    onEvent?.({ type: "planning-end" });
  }
}

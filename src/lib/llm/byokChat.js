import { PROVIDERS } from "@/lib/llm/providers";
import { toAnthropicTools, toOpenAiCompatibleTools } from "@/lib/llm/toolCatalog";
import { buildInstructions, buildContextPrompt } from "@/lib/llm/systemPrompt";
import { makeToolRunner, MAX_ACTIONS_PER_REQUEST } from "@/lib/llm/toolRunner";
import { callAnthropic } from "@/lib/llm/anthropicAdapter";
import { callOpenAiCompatible } from "@/lib/llm/openaiCompatibleAdapter";
import { callLocalBridge } from "@/lib/llm/localBridgeAdapter";
import { getBridgeStatus } from "@/lib/llm/localBridgeStorage";

// A short pause between each simulated "live" chunk shown for Backdoor
// Mode — its file-polling transport can't stream mid-generation (see
// callLocalBridge's own comment), so by the time we get here, `reasoning`
// and `liveTrace` already fully exist. Replaying them through the exact
// same onEvent sequence real streaming uses gives the same visual
// experience — "the same, just not real time" — without touching
// localBridgeAdapter.js or its documented file contract at all. Duration is
// capped the same way ChatMessageList.jsx's own useTypewriter caps itself,
// so a long reply doesn't turn into a multi-second wait. Paces `reasoning`
// (every round's own text, not just the final one) since that's what
// genuinely streams live for every other provider too — the chat bubble
// still only ever shows `reply` (the last round's own text) once this is
// done; see anthropicAdapter.js's comment for why those are two different
// strings now, not the same one shown twice.
const SIMULATED_STEP_DELAY_MS = 150;
const SIMULATED_TEXT_DURATION_MS = (text) => Math.min(1800, Math.max(300, text.length * 8));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function simulateLiveReveal({ liveTrace, reasoning, onEvent }) {
  for (const entry of liveTrace) {
    onEvent({ type: "tool-call", label: entry.label, detail: entry.detail });
    await sleep(SIMULATED_STEP_DELAY_MS);
  }
  // Word-sized chunks (not characters) — plenty granular to read as "typing
  // live" without the overhead of a delay per character.
  const chunks = reasoning.match(/\S+\s*/g) || [reasoning];
  const perChunkDelay = SIMULATED_TEXT_DURATION_MS(reasoning) / chunks.length;
  for (const chunk of chunks) {
    onEvent({ type: "thinking-delta", text: chunk });
    await sleep(perChunkDelay);
  }
}

// The bring-your-own-key counterpart to useChatController.js's
// invokeAssistant -> base44.functions.invoke("aiChatStream", ...) path.
// Same contract in, same contract out ({reply, actions}) — chatActions.js,
// the pending_action/confirm flow, tool-log rendering, undo, and snapshots
// all stay exactly as they are; only *who decides the plan* changes.
// contextArgs is the same shape useChatController already builds for the
// base44 path (areas/products/.../aiIdentity/activeProjectId/etc). `onEvent`
// (optional) fires {type:"thinking-delta"|"tool-call", ...} live, the same
// vocabulary regardless of which provider answers — real streaming for
// anthropic/openai-compatible, a paced simulation (see simulateLiveReveal
// above) for local-bridge.
// Despite the name, this also covers the "local-bridge" (Backdoor Mode)
// provider even though it isn't really BYOK (no key, no HTTP call at all) —
// it decides the plan client-side the same way every other non-base44
// provider does, so it belongs in the same dispatch rather than a
// parallel copy of this function.
export async function runByokChat({ providerConfig, contextArgs, onEvent }) {
  const provider = PROVIDERS[providerConfig?.provider];
  if (!provider || !provider.adapter) {
    throw new Error(`Unknown AI provider "${providerConfig?.provider}" — check Settings -> AI Model.`);
  }
  if (provider.adapter === "local-bridge") {
    const status = await getBridgeStatus();
    if (status !== "connected") {
      throw new Error("Connect your Backdoor Mode folder in Settings -> AI Model first (or re-grant access if you've already picked one).");
    }
  } else {
    if (!providerConfig.apiKey) {
      throw new Error(`Add your ${provider.label} API key in Settings -> AI Model first.`);
    }
    if (!providerConfig.model) {
      throw new Error(`Pick a ${provider.label} model in Settings -> AI Model first.`);
    }
  }

  const plan = [];
  const liveTrace = [];
  const dataset = {
    areas: contextArgs.areas,
    products: contextArgs.products,
    projects: contextArgs.projects,
    archivedProjects: contextArgs.archivedProjects,
    tasks: contextArgs.tasks,
    archivedTasks: contextArgs.archivedTasks,
    stakeholders: contextArgs.stakeholders,
    notes: contextArgs.notes,
  };
  // local-bridge never gets a live onEvent wired into its own tool runner —
  // its whole round-trip only produces a real result once polling finishes,
  // so there's nothing genuinely live to emit mid-call; see
  // simulateLiveReveal below for how it still shows the same thing anyway.
  const isLocalBridge = provider.adapter === "local-bridge";
  const runTool = makeToolRunner({ plan, liveTrace, dataset, externalVault: contextArgs.externalVault, onEvent: isLocalBridge ? undefined : onEvent });

  const systemPrompt = buildInstructions({ maxActionsPerRequest: MAX_ACTIONS_PER_REQUEST });
  const contextPrompt = buildContextPrompt(contextArgs);

  const { reply, reasoning } = provider.adapter === "anthropic"
    ? await callAnthropic({
        apiKey: providerConfig.apiKey, model: providerConfig.model, systemPrompt, contextPrompt,
        tools: toAnthropicTools(), runTool, onEvent,
      })
    : isLocalBridge
    ? await callLocalBridge({ systemPrompt, contextPrompt, tools: toAnthropicTools(), runTool })
    : await callOpenAiCompatible({
        baseUrl: provider.baseUrl, apiKey: providerConfig.apiKey, model: providerConfig.model, systemPrompt, contextPrompt,
        tools: toOpenAiCompatibleTools(), runTool, onEvent, providerId: provider.id,
      });

  if (isLocalBridge && onEvent) {
    await simulateLiveReveal({ liveTrace, reasoning, onEvent });
  }

  return { reply, reasoning, actions: plan, liveTrace };
}

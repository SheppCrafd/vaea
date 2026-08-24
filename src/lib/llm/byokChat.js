import { PROVIDERS } from "@/lib/llm/providers";
import { toAnthropicTools, toOpenAiCompatibleTools } from "@/lib/llm/toolCatalog";
import { buildInstructions, buildContextPrompt, getConnectionFlags } from "@/lib/llm/systemPrompt";
import { makeToolRunner, MAX_ACTIONS_PER_REQUEST } from "@/lib/llm/toolRunner";
import { callAnthropic } from "@/lib/llm/anthropicAdapter";
import { callOpenAiCompatible } from "@/lib/llm/openaiCompatibleAdapter";
import { callLocalBridge, resumeLocalBridgeRequest } from "@/lib/llm/localBridgeAdapter";
import { getBridgeStatus, writeWorkspaceDataFile } from "@/lib/llm/localBridgeStorage";
import { buildWorkspaceDataSnapshot } from "@/lib/llm/systemPrompt";
import { runPlanMicroAgents } from "@/lib/llm/planMicroAgents";

// Any turn queuing MORE than this many tool calls gets a real <plan> block
// — see RESPONSE FORMAT in systemPrompt.js/entry.ts and planMicroAgents.js's
// own module comment for how that block is actually generated.
const PLAN_TOOL_CALL_THRESHOLD = 2;

// A short pause between each simulated "live" chunk shown for Local
// Mode — its file-polling transport can't stream mid-generation (see
// callLocalBridge's own comment), so by the time we get here, `reasoning`
// and `liveTrace` already fully exist. Replaying them through the exact
// same onEvent sequence real streaming uses gives the same visual
// experience — "the same, just not real time" — without touching
// localBridgeAdapter.js or its documented file contract at all. Duration is
// capped the same way ChatMessageList.jsx's own useTypewriter caps itself,
// so a long reply doesn't turn into a multi-second wait. Paces `thinking`
// (every round's own text, not just the final one) since that's what
// genuinely streams live for every other provider too, one round at a time
// with a real "round-boundary" event between them — the chat bubble still
// only ever shows `reply` (the last round's own text, taken whole) once this
// is done; see anthropicAdapter.js's comment for why those are two different
// strings now, not the same one shown twice.
const SIMULATED_STEP_DELAY_MS = 150;
const SIMULATED_TEXT_DURATION_MS = (text) => Math.min(1800, Math.max(300, text.length * 8));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function simulateLiveReveal({ liveTrace, thinking, onEvent }) {
  for (const entry of liveTrace) {
    onEvent({ type: "tool-call", label: entry.label, detail: entry.detail });
    await sleep(SIMULATED_STEP_DELAY_MS);
  }
  for (let i = 0; i < thinking.length; i++) {
    const roundText = thinking[i];
    // Word-sized chunks (not characters) — plenty granular to read as
    // "typing live" without the overhead of a delay per character.
    const chunks = roundText.match(/\S+\s*/g) || [roundText];
    const perChunkDelay = SIMULATED_TEXT_DURATION_MS(roundText) / chunks.length;
    for (const chunk of chunks) {
      onEvent({ type: "thinking-delta", text: chunk });
      await sleep(perChunkDelay);
    }
    // Not fired after the LAST round — nothing follows it, so there's no
    // boundary to mark; ChatMessageList.jsx already treats "everything
    // since the last boundary" as the current, undimmed round.
    if (i < thinking.length - 1) onEvent({ type: "round-boundary" });
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
// Despite the name, this also covers the "local-bridge" (Local Mode)
// provider even though it isn't really BYOK (no key, no HTTP call at all) —
// it decides the plan client-side the same way every other non-base44
// provider does, so it belongs in the same dispatch rather than a
// parallel copy of this function.
// Deliberately offers the FULL tool catalog regardless of whether this is a
// reflection-initiated turn — an earlier version restricted reflection
// turns to READ_ONLY_TOOL_CATALOG, which excludes every `staged: true` tool
// including WRITE_VAULT_NOTE, silently making it impossible for a
// reflection turn to ever write to Vaea Self.md/the Daily log on BYOK or
// Local Mode. That restriction never protected anything real: the actual
// "cannot mutate the workspace" guarantee is chatActions.js's
// filterReflectionActions, which inspects what the model RETURNS regardless
// of what it was offered, and web_search (the other thing it was meant to
// stop) isn't in TOOL_CATALOG at all — it's wired natively per-provider, so
// restricting this catalog never touched it; the real (and only working)
// mitigation there is the "Do not use web search this turn" line already in
// every reflection prompt, which every provider receives regardless.
export async function runByokChat({ providerConfig, contextArgs, onEvent }) {
  const provider = PROVIDERS[providerConfig?.provider];
  if (!provider || !provider.adapter) {
    throw new Error(`Unknown AI provider "${providerConfig?.provider}" — check Settings -> AI Model.`);
  }
  if (provider.adapter === "local-bridge") {
    const status = await getBridgeStatus();
    if (status !== "connected") {
      throw new Error("Connect your Local Mode folder in Settings -> AI Model first (or re-grant access if you've already picked one).");
    }
  } else {
    if (provider.keyRequired !== false && !providerConfig.apiKey) {
      throw new Error(`Add your ${provider.label} API key in Settings -> AI Model first.`);
    }
    if (provider.needsBaseUrl && !providerConfig.baseUrl) {
      throw new Error(`Enter your local server's URL in Settings -> AI Model first.`);
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
  // local-bridge: the system prompt/tool catalog are static files written
  // once at folder-connect time (localBridgeStorage.js's
  // writeStaticContextFiles), not re-sent here — and current date/time +
  // the live dataset are written fresh to workspace-data.json below instead
  // of inlined as prompt text, since a Claude Code relay has its own real
  // tools to fetch both directly. See buildContextPrompt's own comment.
  const contextPrompt = buildContextPrompt({ ...contextArgs, liveDataExternalized: isLocalBridge });
  if (isLocalBridge) {
    await writeWorkspaceDataFile(buildWorkspaceDataSnapshot(contextArgs));
  }
  // local-bridge writes the FULL catalog to VAEA_TOOL_CATALOG.json once at
  // folder-connect time (localBridgeStorage.js), not per-request, so
  // filtering here wouldn't save anything for it and would just make that
  // static file inconsistent with what's actually offered turn to turn —
  // only anthropic/openai-compatible get the filtered set.
  const connections = getConnectionFlags(contextArgs);

  const { reply, thinking } = provider.adapter === "anthropic"
    ? await callAnthropic({
        apiKey: providerConfig.apiKey, model: providerConfig.model, systemPrompt, contextPrompt,
        tools: toAnthropicTools(connections), runTool, onEvent,
      })
    : isLocalBridge
    ? await callLocalBridge({ contextPrompt, runTool, sessionId: contextArgs.sessionId })
    : await callOpenAiCompatible({
        baseUrl: provider.baseUrl || providerConfig.baseUrl, apiKey: providerConfig.apiKey, model: providerConfig.model, systemPrompt, contextPrompt,
        tools: toOpenAiCompatibleTools(connections), runTool, onEvent, providerId: provider.id,
      });

  if (isLocalBridge && onEvent) {
    await simulateLiveReveal({ liveTrace, thinking, onEvent });
  }

  // The <plan> block's real content — see planMicroAgents.js's own module
  // comment. Only ever attempted once the real tool-call plan is known and
  // exceeds the threshold; `null` (no fast-call path, budget missed, or a
  // turn that never needed one) just means this turn has no plan detail.
  const reasoning = plan.length > PLAN_TOOL_CALL_THRESHOLD
    ? await runPlanMicroAgents({ providerConfig, userMessage: contextArgs.userText, actions: plan })
    : null;

  return { reply, reasoning, actions: plan, liveTrace };
}

// The other half of the orphaned-request fix (see localBridgeAdapter.js's
// resumeLocalBridgeRequest and localBridgeStorage.js's
// savePendingLocalModeRequest for the real incident this closes): called on
// load/reconnect, not from a live user send, so there's no fresh chat
// message driving it — just a leftover pointer saying "this session had a
// Local Mode reply still in flight." Builds the exact same dataset/tool
// runner a real send would (in case the resumed conversation still needs
// another tool-call round to finish), but skips buildInstructions/
// buildContextPrompt entirely — round 0's own system/tools are already
// sitting in whatever prompt file this is resuming from, never re-sent.
// Returns null (nothing to show) when the request turns out to have already
// fully resolved rather than actually being orphaned.
export async function resumeOrphanedLocalModeRequest({ requestId, contextArgs }) {
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
  const runTool = makeToolRunner({ plan, liveTrace, dataset, externalVault: contextArgs.externalVault, onEvent: undefined });

  const result = await resumeLocalBridgeRequest({ requestId, runTool });
  if (!result) return null;

  // No plan-detail here — see planMicroAgents.js's own module comment on why
  // Local Mode never gets one.
  return { reply: result.reply, reasoning: null, actions: plan, liveTrace };
}

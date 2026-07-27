import { PROVIDERS } from "@/lib/llm/providers";
import { toAnthropicTools, toOpenAiCompatibleTools } from "@/lib/llm/toolCatalog";
import { buildInstructions, buildContextPrompt } from "@/lib/llm/systemPrompt";
import { makeToolRunner, MAX_ACTIONS_PER_REQUEST } from "@/lib/llm/toolRunner";
import { callAnthropic } from "@/lib/llm/anthropicAdapter";
import { callOpenAiCompatible } from "@/lib/llm/openaiCompatibleAdapter";
import { callLocalBridge } from "@/lib/llm/localBridgeAdapter";
import { getBridgeStatus } from "@/lib/llm/localBridgeStorage";

// The bring-your-own-key counterpart to useChatController.js's
// invokeAssistant -> base44.functions.invoke("aiChatStream", ...) path.
// Same contract in, same contract out ({reply, actions}) — chatActions.js,
// the pending_action/confirm flow, tool-log rendering, undo, and snapshots
// all stay exactly as they are; only *who decides the plan* changes.
// contextArgs is the same shape useChatController already builds for the
// base44 path (areas/products/.../aiIdentity/activeProjectId/etc).
// Despite the name, this also covers the "local-bridge" (Backdoor Mode)
// provider even though it isn't really BYOK (no key, no HTTP call at all) —
// it decides the plan client-side the same way every other non-base44
// provider does, so it belongs in the same dispatch rather than a
// parallel copy of this function.
export async function runByokChat({ providerConfig, contextArgs }) {
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
  const runTool = makeToolRunner({ plan, liveTrace, dataset });

  const systemPrompt = buildInstructions({ maxActionsPerRequest: MAX_ACTIONS_PER_REQUEST });
  const contextPrompt = buildContextPrompt(contextArgs);

  const reply = provider.adapter === "anthropic"
    ? await callAnthropic({
        apiKey: providerConfig.apiKey, model: providerConfig.model, systemPrompt, contextPrompt,
        tools: toAnthropicTools(), runTool,
      })
    : provider.adapter === "local-bridge"
    ? await callLocalBridge({ systemPrompt, contextPrompt, tools: toAnthropicTools(), runTool })
    : await callOpenAiCompatible({
        baseUrl: provider.baseUrl, apiKey: providerConfig.apiKey, model: providerConfig.model, systemPrompt, contextPrompt,
        tools: toOpenAiCompatibleTools(), runTool,
      });

  return { reply, actions: plan, liveTrace };
}

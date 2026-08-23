// Local-only storage for user-defined named agents (the chat sidebar's
// Agents card). Each agent is { id, name, purpose, cadenceHours, lastRunAt }
// — cadenceHours is null/undefined for a manual-run-only agent (the
// original Phase 1 shape; still the default from "New agent"), or a number
// of hours for one that also auto-runs the next time the app happens to be
// open and that much time has passed (see agentRunner.js's getDueAgents,
// checked from useChatController.js's notifyChatOpened). lastRunAt is null
// until the agent's first real run. Execution itself (a real, foreground
// chat turn scoped to the agent's purpose) lives in useChatController.js's
// runAgentTurn — this module only ever holds the definitions.
import { readKey, writeKey } from "@/lib/deviceStorage";

const AGENTS_KEY = "vaea_named_agents";

export async function loadAgents() {
  try {
    const stored = await readKey(AGENTS_KEY);
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

export async function saveAgents(agents) {
  try {
    await writeKey(AGENTS_KEY, agents);
  } catch {
    // best-effort — the list just won't survive a reload
  }
}

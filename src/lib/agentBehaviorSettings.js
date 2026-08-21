// Three opt-in toggles gating agent-autonomy features that shouldn't be on
// by default: widening the confirm-before-anything gate into a full
// approval queue, showing multiple BYOK providers' answers side by side,
// and letting Vaea Calendar auto-place task time blocks. Same deviceStorage
// pattern as aiPreferences.js.
import { readKey, writeKey } from "@/lib/deviceStorage";

export const AGENT_BEHAVIOR_KEY = "vaea_agent_behavior";

export const DEFAULTS = {
  approvalQueueEnabled: false,
  multiModelComparisonEnabled: false,
  autoSchedulingEnabled: false,
};

export async function loadAgentBehavior() {
  try {
    const stored = await readKey(AGENT_BEHAVIOR_KEY);
    return { ...DEFAULTS, ...(stored || {}) };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function saveAgentBehavior(settings) {
  try {
    await writeKey(AGENT_BEHAVIOR_KEY, { ...DEFAULTS, ...settings });
  } catch {
    // best-effort — the setting just won't survive a reload
  }
}

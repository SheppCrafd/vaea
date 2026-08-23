// Two opt-in toggles gating agent-autonomy features that shouldn't be on by
// default: widening the confirm-before-anything gate into a full approval
// queue, and letting Vaea Calendar auto-place task time blocks. Same
// deviceStorage pattern as aiPreferences.js. Lives here (not inline in
// AiPreferencesSection.jsx) since chatActions.js's SCHEDULE_CALENDAR_TIME
// and SET_AGENT_BEHAVIOR handlers also read/write it directly. A third
// toggle, multiModelComparisonEnabled, used to live here too — removed, it
// was pure UI with nothing anywhere actually reading it to compare BYOK
// providers side by side.
import { readKey, writeKey } from "@/lib/deviceStorage";

export const AGENT_BEHAVIOR_KEY = "vaea_agent_behavior";

export const DEFAULTS = {
  approvalQueueEnabled: false,
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

// Two opt-in toggles gating agent-autonomy features that shouldn't be on by
// default: widening the confirm-before-anything gate into a full approval
// queue, and letting Vaea Calendar auto-place task time blocks. Same
// deviceStorage pattern as aiPreferences.js. Lives here (not inline in
// AiPreferencesSection.jsx) since chatActions.js's SCHEDULE_CALENDAR_TIME
// handler also reads it directly. These toggles are deliberately only ever
// written from the Settings UI itself — the chat assistant can read them
// (e.g. to decide whether it may auto-place a task's time block) but must
// never change them; that's the user's own call, not something to flip on
// their behalf via chat. A third toggle, multiModelComparisonEnabled, used
// to live here too — removed, it was pure UI with nothing anywhere actually
// reading it to compare BYOK providers side by side.
import { createDeviceKeyStore } from "@/lib/deviceKeyStore";

export const DEFAULTS = {
  approvalQueueEnabled: false,
  autoSchedulingEnabled: false,
};

const store = createDeviceKeyStore("vaea_agent_behavior", DEFAULTS);

export const loadAgentBehavior = store.load;
export const saveAgentBehavior = store.save;

// Local-only storage for Workflow Canvas cards — same deviceStorage pattern
// as agentsStore.js/promptTemplatesStore.js/notificationRules.js (moved off
// plain localStorage so the AI chat tools below can read/write the same
// cards a user places by hand).
import { readKey, writeKey } from "@/lib/deviceStorage";

const CARDS_KEY = "vaea_workflow_canvas_cards";

export async function loadWorkflowCards() {
  try {
    const stored = await readKey(CARDS_KEY);
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

export async function saveWorkflowCards(cards) {
  try {
    await writeKey(CARDS_KEY, cards);
  } catch {
    // best-effort — cards just won't survive a reload
  }
}

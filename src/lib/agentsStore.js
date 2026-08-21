// Local-only storage for user-defined named agents (the chat sidebar's
// Agents card). Phase 1 is a definitions manager, not an execution engine —
// naming and scoping an agent here doesn't make it run autonomously yet
// (background task execution, sub-agent forking, and a real activity feed
// are later work); every agent below is shown with an honest "not running
// yet" status rather than implying it does something it doesn't.
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

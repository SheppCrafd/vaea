// Local-only storage for saved prompt templates (the chat sidebar's Prompt
// Templates card). Same deviceStorage pattern as agentsStore.js.
import { readKey, writeKey } from "@/lib/deviceStorage";

const TEMPLATES_KEY = "vaea_prompt_templates";

export async function loadPromptTemplates() {
  try {
    const stored = await readKey(TEMPLATES_KEY);
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

export async function savePromptTemplates(templates) {
  try {
    await writeKey(TEMPLATES_KEY, templates);
  } catch {
    // best-effort — the list just won't survive a reload
  }
}

// Local-only storage for the /snippet slash command — a reusable block of
// text you save once and drop back into the composer by name. Same
// deviceStorage pattern as agentsStore.js/promptTemplatesStore.js.
import { readKey, writeKey } from "@/lib/deviceStorage";

const SNIPPETS_KEY = "vaea_snippets";

export async function loadSnippets() {
  try {
    const stored = await readKey(SNIPPETS_KEY);
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

export async function saveSnippets(snippets) {
  try {
    await writeKey(SNIPPETS_KEY, snippets);
  } catch {
    // best-effort — the list just won't survive a reload
  }
}

export async function saveSnippet(name, text) {
  const snippets = await loadSnippets();
  const next = [...snippets.filter((s) => s.name !== name), { name, text }];
  await saveSnippets(next);
  return next;
}

export async function findSnippet(name) {
  const snippets = await loadSnippets();
  return snippets.find((s) => s.name === name) || null;
}

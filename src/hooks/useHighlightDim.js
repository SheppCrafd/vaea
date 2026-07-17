import { useHighlight } from "@/lib/HighlightContext";

// True when at least one active highlight in the given category/categories
// exists AND it matches `stakeholderIds` — the standard "tint this card/row"
// check used across cards and tables. `categories` scopes which checkbox
// category(ies) this entity type reacts to (e.g. a task row only reacts to
// the "tasks" category; a Project card reacts to "projects" AND "products",
// since a card must not stay untinted while a product/project stakeholder
// match inside it is lit).
//
// Highlighted UI reads by color (a tint on the match) rather than by fading
// everything else out, since overlapping highlights need to stay legible
// instead of stacking opacity cuts.
//
// Exported as a plain function too, for callers that need to check the match
// per-row inside a list (where calling a hook per item would break the rules
// of hooks) — call useHighlight() once at the top of the component and reuse
// isHighlightMatch(highlights, categories, ...) per row.
export function isHighlightMatch(highlights, categories, stakeholderIds = []) {
  const cats = Array.isArray(categories) ? categories : [categories];
  const active = highlights.filter((h) => cats.includes(h.category));
  if (active.length === 0) return false;
  return active.some((h) => stakeholderIds.includes(h.stakeholderId));
}

export function useHighlightMatch(stakeholderIds = [], categories) {
  const { highlights } = useHighlight();
  return isHighlightMatch(highlights, categories, stakeholderIds);
}

import { useHighlight } from "@/lib/HighlightContext";

// True when at least one active highlight in the given category/categories
// exists and none of `stakeholderIds` match any of them — the standard
// "dim this card/row out" check used across cards and tables. `categories`
// scopes which checkbox category(ies) this entity type reacts to (e.g. a
// task row only reacts to the "tasks" category; a Project card reacts to
// "projects" AND "products", since a card must not sit dimmed while a
// product/project stakeholder match inside it stays lit).
//
// Exported as a plain function too, for callers that need to check dimming
// per-row inside a list (where calling a hook per item would break the
// rules of hooks) — call useHighlight() once at the top of the component
// and reuse isDimmedByHighlight(highlights, categories, ...) per row.
export function isDimmedByHighlight(highlights, categories, stakeholderIds = []) {
  const cats = Array.isArray(categories) ? categories : [categories];
  const active = highlights.filter((h) => cats.includes(h.category));
  if (active.length === 0) return false;
  return !active.some((h) => stakeholderIds.includes(h.stakeholderId));
}

export function useHighlightDim(stakeholderIds = [], categories) {
  const { highlights } = useHighlight();
  return isDimmedByHighlight(highlights, categories, stakeholderIds);
}

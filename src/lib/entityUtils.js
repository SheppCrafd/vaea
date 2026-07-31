// Small generic helpers shared across the entity hooks and destructive UI actions.
import { useAppStore } from "@/lib/store";

export function excludeSoftDeleted(items = []) {
  return items.filter((item) => !item.deleted_at);
}

// Every call site here is a plain event handler, not always inside a
// component that could call a hook — this needs Zustand's vanilla
// getState() API, not the useAppStore() hook, so it works the same way
// whether it's called from a card's onClick or deep inside a settings
// section's async handler. See store.js's confirmDialog slice and
// ConfirmDialog.jsx (mounted once in App.jsx) for what actually renders.
export function confirmThen(message, action) {
  useAppStore.getState().requestConfirm(message, action);
}

// Sorts by a `position` field (ascending) that not every record has yet —
// no area/product/task ever had one until drag-to-reorder existed, and
// there's no migration backfilling it onto records created before that.
// Anything missing a position sorts after everything that has one, in its
// original relative order (a stable sort with an always-0 comparator keeps
// unset-vs-unset pairs in place) — so a collection nobody has ever dragged
// yet still renders in plain creation order, exactly as it always has.
export function sortByPosition(items = []) {
  return [...items].sort((a, b) => {
    const ap = a.position;
    const bp = b.position;
    if (ap == null && bp == null) return 0;
    if (ap == null) return 1;
    if (bp == null) return -1;
    return ap - bp;
  });
}

// Computes a fresh 0..n-1 `position` for every id in `ids` (which must
// already be in current display order and include `draggedId`) after
// moving `draggedId` to sit immediately before `targetId` — the classic
// "drop onto X to take X's spot" reorder, not a full sortable-list library.
// `targetId` not being found (e.g. it's not actually one of these siblings)
// appends the dragged item at the end instead of silently doing nothing.
export function reorderPositions(ids, draggedId, targetId) {
  const withoutDragged = ids.filter((id) => id !== draggedId);
  const targetIndex = withoutDragged.indexOf(targetId);
  const insertAt = targetIndex === -1 ? withoutDragged.length : targetIndex;
  const next = [...withoutDragged];
  next.splice(insertAt, 0, draggedId);
  return Object.fromEntries(next.map((id, index) => [id, index]));
}

// Display-only line-break hints for card titles: a zero-width space after
// each delimiter (colon, slash, hyphen, comma, period, em-dash, underscore)
// gives the browser a break opportunity exactly there — paired with
// removing `break-words` from title elements, wrapping happens after
// delimiters and never mid-word ("Measurements/Insights" splits at the
// slash, not wherever the line runs out). Purely presentational:
// useEditableField strips the U+200B back out of anything typed or saved,
// so stored titles never contain it.
export function titleWithBreakHints(text) {
  return (text || "").replace(/([:/\-,.—_])/g, "$1\u200B");
}

// Only allow http(s) URLs to prevent stored XSS via unsafe protocols (e.g.
// javascript:). Returns the trimmed URL, or null if it's missing/invalid.
export function sanitizeHttpUrl(url) {
  const trimmed = (url || "").trim();
  if (!trimmed) return null;
  let protocol = "";
  try {
    protocol = new URL(trimmed).protocol;
  } catch {
    return null;
  }
  return protocol === "http:" || protocol === "https:" ? trimmed : null;
}

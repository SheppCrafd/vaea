// Small generic helpers shared across the entity hooks and destructive UI actions.
import { useAppStore } from "@/lib/store";

export function excludeSoftDeleted(items = []) {
  return items.filter((item) => !item.deleted_at);
}

// Defense in depth against orphaned data: a soft-delete cascade interrupted
// partway through (see useAreas.js's deleteArea), a stale-parent write from
// a race condition, or any future bug that manages to leave a child pointing
// at a parent that no longer resolves. Without this, an orphan silently
// counts as "active" everywhere it's read — the real bug a user hit, where
// the dashboard showed 0 areas while the sidebar's Task Statistics still
// counted 6 tasks whose parent chain no longer existed. `parentKey` is
// required to be present and resolve to something in `liveParentIds`.
export function requireLiveParent(items = [], parentKey, liveParentIds) {
  return items.filter((item) => liveParentIds.has(item[parentKey]));
}

// Same idea, for an optional parent reference (a Project's parent_product_id
// — "standalone" projects legitimately have none) — passes through anything
// with no value set, but still filters out a SET value that doesn't resolve.
export function allowOptionalLiveParent(items = [], parentKey, liveParentIds) {
  return items.filter((item) => !item[parentKey] || liveParentIds.has(item[parentKey]));
}

// Throws a clear, catchable error if `id` doesn't resolve to a real,
// non-deleted record in `collection` (a localDb collection — areas/products/
// projects) — the guard against creating or re-parenting a child onto a
// stale/deleted parent in the first place. Used to be enforced ONLY inside
// the AI chat action executor (chatActions.js's own now-removed local copy);
// callers there create/move records through the exact same plain functions
// below, so sharing this one implementation means a chat-driven plan and a
// regular form submission get identical protection instead of the form path
// silently having none at all.
export async function assertLiveParent(collection, id, label) {
  const parent = await collection.get(id);
  if (!parent || parent.deleted_at) {
    throw new Error(`${label} "${id}" doesn't exist — the record it should belong to was deleted, moved, or never existed.`);
  }
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

// LoginScreen/SignUpScreen read `?from=` (an attacker-shareable link, not
// app-generated input at read time) and hand it straight to navigate()/
// window.location.href/the OAuth provider's own post-login redirect target —
// exactly the shape of an open-redirect bug, and worse for the raw
// location.href assignment (a "javascript:" value there can execute).
// Must be a same-origin relative path: a bare "/app" is fine, but
// "https://evil.com", "//evil.com" (protocol-relative), "/\evil.com"
// (browsers normalize a leading backslash to a second forward slash before
// parsing — the exact bug behind GHSA-wrjc-x8rr-h8h6), and "javascript:..."
// all resolve off-site or execute, despite some of them "starting with /".
export function sanitizeReturnTo(value, fallback = "/app") {
  if (typeof value !== "string" || !/^\/(?!\/|\\)/.test(value)) return fallback;
  return value;
}

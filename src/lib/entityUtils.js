// Small generic helpers shared across the entity hooks and destructive UI actions.

export function excludeSoftDeleted(items = []) {
  return items.filter((item) => !item.deleted_at);
}

export function confirmThen(message, action) {
  if (window.confirm(message)) action();
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

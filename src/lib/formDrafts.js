import { useEffect, useState } from "react";

// Keeps what someone typed into a create form if they close it (Escape, the
// close button, clicking outside) before saving, so reopening the form
// brings it back. Memory only, for this visit. clearDraft() after a
// successful create.
const drafts = new Map();

export function useDraft(key, initial = "") {
  const [value, setValue] = useState(() => (drafts.has(key) ? drafts.get(key) : initial));
  useEffect(() => {
    if (value) drafts.set(key, value);
    else drafts.delete(key);
  }, [key, value]);
  return [value, setValue];
}

export function clearDraft(...keys) {
  keys.forEach((k) => drafts.delete(k));
}

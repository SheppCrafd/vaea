import { useState } from "react";

// Naive "smart" field autofill for Phase 1: prefill a create-form field with
// whatever was typed there last time, remembered in localStorage per field
// key. Real AI-assisted autofill (proposing values from vault/memory
// context) is later work once that context exists — this is deliberately
// just "remember the last one," not inference.
export function useLastUsedValue(key) {
  const [value, setValue] = useState(() => {
    try {
      return localStorage.getItem(`vaea_last_used_${key}`) || "";
    } catch {
      return "";
    }
  });

  const setAndRemember = (next) => {
    setValue(next);
    try {
      if (next.trim()) localStorage.setItem(`vaea_last_used_${key}`, next);
    } catch {
      // best-effort — just won't be remembered next time
    }
  };

  return [value, setAndRemember];
}

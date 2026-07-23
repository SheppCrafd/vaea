import { useEffect, useState } from "react";

const STORAGE_KEY = "vaea_accent_theme";

// Curated presets only (not a raw color picker) — each is a single hex used
// for the picker's swatch preview; the actual applied colors live in the
// `[data-accent="..."]` CSS variable blocks in index.css.
export const ACCENT_THEMES = [
  { key: "slate", label: "Slate", swatch: "#1E333E" },
  { key: "indigo", label: "Indigo", swatch: "#4f46e5" },
  { key: "emerald", label: "Emerald", swatch: "#059669" },
  { key: "amber", label: "Amber", swatch: "#f59e0b" },
];

function loadAccent() {
  try {
    return localStorage.getItem(STORAGE_KEY) || "slate";
  } catch {
    return "slate";
  }
}

// Accent color preference, applied via a `data-accent` attribute on <html>
// (matching CSS variable overrides in index.css) and persisted the same
// lightweight way useChatController persists icon choice — plain
// localStorage, no state library. "slate" is the app's existing default
// look and needs no attribute at all.
export function useAccentTheme() {
  const [accent, setAccentState] = useState(loadAccent);

  useEffect(() => {
    if (accent === "slate") {
      document.documentElement.removeAttribute("data-accent");
    } else {
      document.documentElement.dataset.accent = accent;
    }
  }, [accent]);

  const setAccent = (key) => {
    setAccentState(key);
    localStorage.setItem(STORAGE_KEY, key);
  };

  return { accent, setAccent };
}

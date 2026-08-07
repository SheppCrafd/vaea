// Shared between src/components/shared/ChatAppearanceBridge.jsx (the real
// React listener — next-themes' own setTheme and useAccentTheme's setAccent
// both live behind React hooks, so a plain, React-free module like
// chatActions.js can't call them directly) and src/lib/chatActions.js (the
// AI chat's SET_APPEARANCE action, which needs to change this same state
// from outside any component tree) — same shape as cardViewConstants.js's
// own event-bridge pattern for SET_CARD_VIEW, kept in its own module for the
// same reason: chatActions.js shouldn't have to import a .jsx file just for
// a couple of string constants.
import { ACCENT_THEMES } from "@/hooks/useAccentTheme";

export const APPEARANCE_CHANGE_EVENT = "vaea:appearance-change";
export const THEME_MODES = ["light", "dark", "system"];
// Derived from the real preset list (useAccentTheme.js), not hand-copied —
// stays correct automatically if a preset is ever added/renamed/removed.
export const ACCENT_KEYS = ACCENT_THEMES.map((a) => a.key);

import { MessageCircle, Bot, Sparkles, HelpCircle, Smile } from "lucide-react";

// Icon component references only (no JSX here) — actual rendering happens
// in ChatIcon.jsx. Deliberately its own module, not part of
// useChatController.js (where this used to live): ChatIcon.jsx is needed by
// the dashboard's always-mounted chat launcher button, which renders before
// the full chat controller (and its heavy deps — chatActions, byokChat,
// githubApi, the reflection machinery) ever mounts. Importing
// CHAT_ICON_OPTIONS from useChatController.js would pull that whole module
// graph in just to draw an icon, since ES module imports bundle the whole
// file regardless of which export is actually used.
export const CHAT_ICON_OPTIONS = [
  { key: "message-circle", Icon: MessageCircle },
  { key: "bot", Icon: Bot },
  { key: "sparkles", Icon: Sparkles },
  { key: "help-circle", Icon: HelpCircle },
  { key: "smile", Icon: Smile },
];

export const ICON_STORAGE_KEY = "vaea_chat_icon";

export function loadIconChoice() {
  try {
    const raw = localStorage.getItem(ICON_STORAGE_KEY);
    return JSON.parse(raw) || { key: "message-circle" };
  } catch {
    return { key: "message-circle" };
  }
}

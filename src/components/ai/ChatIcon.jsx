import { CHAT_ICON_OPTIONS } from "@/lib/chatIcon";

// Renders the chosen chat icon — an emoji if the user typed a custom one,
// otherwise the picked preset lucide icon. Shared by the floating widget's
// trigger/header and the full-page chat's header so the choice always looks
// identical everywhere it appears.
export default function ChatIcon({ iconChoice, className }) {
  if (iconChoice.emoji) return <span className={className}>{iconChoice.emoji}</span>;
  const match = CHAT_ICON_OPTIONS.find((o) => o.key === iconChoice.key) || CHAT_ICON_OPTIONS[0];
  const Icon = match.Icon;
  return <Icon className={className} />;
}

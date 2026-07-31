import { useState } from "react";
import ChatIcon from "@/components/ai/ChatIcon";
import { loadIconChoice } from "@/lib/chatIcon";

// Stands in for ChatBox's own floating launcher button before chat has ever
// been opened this session — same markup/classes as ChatBox's collapsed
// state, so swapping one for the other on first click is visually seamless.
// Deliberately lightweight: ChatIcon now reads from lib/chatIcon.js (not
// useChatController.js), so this component never pulls in the full chat
// controller's module graph (chatActions, byokChat, githubApi, the
// reflection machinery) just to sit there as a button. That graph — and the
// ~220KB react-markdown-containing chunk it drags in — only downloads once
// the user actually clicks to open chat, instead of on every dashboard
// visit regardless of whether they ever do.
//
// No reflection badge dot here: that badge only ever gets set as a result
// of ChatBox's own notifyChatOpened() effect, which requires chat to have
// already been opened at least once this session — so before that first
// open, there's never anything for a badge to show anyway. Once opened,
// ChatBox stays mounted and owns its own collapsed-button rendering
// (including the badge) for the rest of the session, same as before this
// split existed.
export default function ChatLauncherButton({ onOpen }) {
  const [iconChoice] = useState(loadIconChoice);

  return (
    <button
      onClick={onOpen}
      aria-label="Open Vaea Chat"
      className="fixed bottom-6 right-6 z-[110] w-14 h-14 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center shadow-[0_0_0_1px_hsl(var(--foreground)/0.05),0_16px_36px_-12px_hsl(var(--primary)/0.55)] hover:shadow-[0_0_0_1px_hsl(var(--foreground)/0.06),0_20px_44px_-12px_hsl(var(--primary)/0.65)] hover:-translate-y-1 transition-all duration-300"
    >
      <ChatIcon iconChoice={iconChoice} className="w-6 h-6" />
    </button>
  );
}

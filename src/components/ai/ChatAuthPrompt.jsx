import { LogIn } from "lucide-react";

// Chat is the one feature in this app that genuinely needs Base44 auth —
// ChatSession/ChatMessage are hosted entities, RLS-gated — for every
// provider except Backdoor Mode, which keeps its own chat history entirely
// local instead (see useChatSessions.js/useChatMessages.js) and so never
// hits this prompt. Everything else already works fine for an anonymous
// visitor by design (requiresAuth: false, see AuthContext.jsx). Shown in
// place of the composer once useChatController catches a 401/403 from
// Base44, instead of the send silently doing nothing.
export default function ChatAuthPrompt({ onSignIn, onDismiss }) {
  return (
    <div className="px-3 py-2.5 bg-secondary/60 border-t border-border flex items-center gap-2.5 text-xs">
      <LogIn className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
      <span className="flex-1 text-muted-foreground">Chat needs you signed in — your dashboard data stays local either way.</span>
      <button
        onClick={onSignIn}
        className="shrink-0 px-2.5 py-1 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md transition-colors"
      >
        Sign in
      </button>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="shrink-0 text-muted-foreground hover:text-foreground"
      >
        ×
      </button>
    </div>
  );
}

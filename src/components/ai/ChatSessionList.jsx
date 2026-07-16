import { X } from "lucide-react";
import Portal from "@/lib/Portal";
import { useChatSessions, useDeleteChatSession } from "@/hooks/useChatSessions";
import { confirmThen } from "@/lib/entityUtils";

// The "<" caret under the chat icon pops this card out to the left of the
// chat box, floating above the rest of the page, listing previous sessions.
export default function ChatSessionList({ activeSessionId, onSelect, onNewChat, onClose, onDeleted }) {
  const { data: sessions = [] } = useChatSessions();
  const deleteSession = useDeleteChatSession();

  const handleDelete = (session) => {
    confirmThen(`Delete chat "${session.title || "Untitled chat"}"? This cannot be undone.`, () => {
      deleteSession.mutate(session.id);
      if (session.id === activeSessionId) onDeleted?.();
    });
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[9998]" onClick={onClose}>
        <div
          className="fixed bottom-24 right-[26rem] w-64 max-h-96 overflow-y-auto bg-card border border-border rounded-xl shadow-2xl p-2 animate-in fade-in slide-in-from-right-2 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-1 py-1.5 border-b border-border mb-1">
            <p className="text-[10px] font-bold uppercase text-muted-foreground">Chat History</p>
            <button onClick={onNewChat} className="text-[11px] text-primary hover:underline">
              New chat
            </button>
          </div>
          {sessions.length === 0 ? (
            <p className="text-xs text-muted-foreground p-2">No previous sessions yet.</p>
          ) : (
            <div className="flex flex-col gap-0.5">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className={`group flex items-center gap-1 rounded-md ${s.id === activeSessionId ? "bg-primary/15" : "hover:bg-secondary"}`}
                >
                  <button
                    onClick={() => onSelect(s.id)}
                    className={`flex-1 min-w-0 text-left text-xs px-2 py-1.5 truncate ${s.id === activeSessionId ? "text-primary font-medium" : ""}`}
                  >
                    {s.title || "Untitled chat"}
                  </button>
                  <button
                    onClick={() => handleDelete(s)}
                    aria-label="Delete chat"
                    className="shrink-0 pr-1.5 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
}

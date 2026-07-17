import Portal from "@/lib/Portal";
import { useChatSessions } from "@/hooks/useChatSessions";
import ChatSessionRow from "@/components/ai/ChatSessionRow";
import { clampPositionToViewport } from "@/lib/viewportClamp";

const POPOVER_WIDTH = 256; // w-64
const MAX_HEIGHT = 384; // max-h-96
const GAP = 12;

// The "<" caret under the chat icon pops this card out to the left of the
// chat box, floating above the rest of the page, listing previous sessions.
// Positioned relative to the chat panel's current geometry (it's now a
// draggable window, not pinned to a fixed corner), clamped so it never
// renders off-screen if the panel is dragged near an edge.
export default function ChatSessionList({ activeSessionId, onSelect, onNewChat, onClose, onDeleted, anchor }) {
  const { data: sessions = [] } = useChatSessions();

  const { top, left } = clampPositionToViewport({
    top: anchor.y,
    left: anchor.x - POPOVER_WIDTH - GAP,
    width: POPOVER_WIDTH,
    height: MAX_HEIGHT,
  });

  return (
    <Portal>
      <div className="fixed inset-0 z-[9998]" onClick={onClose}>
        <div
          style={{ left, top, width: POPOVER_WIDTH }}
          className="fixed max-h-96 overflow-y-auto bg-card border border-border rounded-xl shadow-2xl p-2 animate-in fade-in slide-in-from-right-2 duration-150"
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
                <ChatSessionRow
                  key={s.id}
                  session={s}
                  isActive={s.id === activeSessionId}
                  onSelect={onSelect}
                  onDeleted={onDeleted}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
}

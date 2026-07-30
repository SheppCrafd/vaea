import { useState } from "react";
import { X, Pencil } from "lucide-react";
import { useDeleteChatSession, useUpdateChatSession } from "@/hooks/useChatSessions";
import { confirmThen } from "@/lib/entityUtils";

// One row in a session list — title (click to select, double-click or the
// pencil to rename), plus a delete button. Shared between the floating
// widget's popover history list and the full-page chat's persistent sidebar,
// so rename/delete only exists in one place.
export default function ChatSessionRow({ session, isActive, onSelect, onDeleted }) {
  const deleteSession = useDeleteChatSession();
  const updateSession = useUpdateChatSession();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");

  const handleDelete = () => {
    confirmThen(`Delete chat "${session.title || "Untitled chat"}"? This cannot be undone.`, () => {
      deleteSession.mutate(session.id);
      if (isActive) onDeleted?.();
    });
  };

  const startEditing = () => {
    setEditValue(session.title || "");
    setIsEditing(true);
  };

  const commitRename = () => {
    const title = editValue.trim();
    if (title && title !== session.title) {
      updateSession.mutate({ id: session.id, data: { title } });
    }
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <input
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={commitRename}
        onKeyDown={(e) => {
          if (e.key === "Enter") commitRename();
          if (e.key === "Escape") setIsEditing(false);
        }}
        autoFocus
        aria-label="Chat session name"
        className="flex-1 min-w-0 text-xs px-2 py-1.5 bg-background border border-input rounded outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    );
  }

  return (
    <div className={`group flex items-center gap-1 rounded-md ${isActive ? "bg-primary/15" : "hover:bg-secondary"}`}>
      <button
        onClick={() => onSelect(session.id)}
        onDoubleClick={startEditing}
        className={`flex-1 min-w-0 text-left text-xs px-2 py-1.5 truncate ${isActive ? "text-primary font-medium" : ""}`}
      >
        {session.title || "Untitled chat"}
      </button>
      <button
        onClick={startEditing}
        aria-label="Rename chat"
        className="shrink-0 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Pencil className="w-3 h-3" />
      </button>
      <button
        onClick={handleDelete}
        aria-label="Delete chat"
        className="shrink-0 pr-1.5 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

import { useState } from "react";
import { Pencil, ArrowUp, ArrowDown, Archive, Trash2 } from "lucide-react";
import StatusDropdown from "@/components/projects/StatusDropdown";
import EditableText from "@/components/shared/EditableText";

// One line in the focus rail. Collapsed: a status dot you can click, the
// task (up to two lines, never mid-word truncated), and its project as a
// quiet sub-label. A single pencil — revealed on hover, always shown once
// open — expands the row in place into a full editor: status, description,
// notes, the move-between-lists action, and archive / delete. This is the
// only place a focus task is edited without leaving the rail.
export default function FocusTaskRow({
  task,
  projectTitle,
  direction, // "promote" (Weekly -> Top 3) | "demote" (Top 3 -> Weekly)
  onMove,
  onArchive,
  onDelete,
  onStatusChange,
  onFieldChange,
  isMatched,
}) {
  const [open, setOpen] = useState(false);

  const moveLabel = direction === "promote" ? "Move to Today" : "Move to This Week";
  const MoveIcon = direction === "promote" ? ArrowUp : ArrowDown;

  return (
    <li className={`rounded-lg transition-colors ${isMatched ? "bg-primary/10" : ""} ${open ? "bg-muted/50" : "hover:bg-muted/50"}`}>
      <div className="group flex items-start gap-2.5 px-2 py-2">
        <div className="pt-[3px] shrink-0">
          <StatusDropdown task={task} onStatusChange={onStatusChange} variant="dot" />
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex-1 min-w-0 text-left"
        >
          <p className="text-[13px] leading-snug text-foreground line-clamp-2">{task.description}</p>
          {projectTitle && (
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{projectTitle}</p>
          )}
        </button>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close editor" : "Edit task"}
          className={`shrink-0 -mr-1 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-background transition-all ${
            open ? "opacity-100 bg-background text-foreground" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
          }`}
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>

      {open && (
        <div className="ml-[9px] border-l-2 border-primary pl-3 pr-2 pb-3 pt-1 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex items-center justify-between gap-2 mb-2">
            <StatusDropdown task={task} onStatusChange={onStatusChange} variant="chip" />
            <button
              type="button"
              onClick={onMove}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors"
            >
              <MoveIcon className="w-3 h-3" />
              {moveLabel}
            </button>
          </div>

          <label className="block text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Task</label>
          <EditableText
            value={task.description}
            onSave={(v) => onFieldChange({ description: v })}
            placeholder="Describe the task…"
            multiline
            className="text-[13px] bg-background border border-border rounded-md px-2 py-1.5 leading-snug"
          />

          <label className="block text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mt-2.5 mb-1">Notes</label>
          <EditableText
            value={task.notes}
            onSave={(v) => onFieldChange({ notes: v })}
            placeholder="Add notes — context, blockers, links…"
            multiline
            className="text-xs bg-background border border-border rounded-md px-2 py-1.5 leading-snug min-h-[52px]"
          />

          <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/60">
            <button
              type="button"
              onClick={onArchive}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <Archive className="w-3 h-3" /> Archive
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 className="w-3 h-3" /> Delete
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

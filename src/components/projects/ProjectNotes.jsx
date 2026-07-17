import { X } from "lucide-react";
import EditableText from "@/components/shared/EditableText";
import { useUpdateProjectNote, useDeleteProjectNote } from "@/hooks/useProjectNotes";
import { useHighlight } from "@/lib/HighlightContext";
import { isHighlightMatch } from "@/hooks/useHighlightDim";
import { confirmThen } from "@/lib/entityUtils";

const TYPE_ICON = { RISK: "⚠️", QUESTION: "❓", NOTE: "📝" };

// Renders risks (⚠️), questions (❓), and general notes (📝) attached to a
// project, fetched from ProjectNote records. Content is editable inline;
// each note can be deleted.
export default function ProjectNotes({ notes, allStakeholders = [] }) {
  const updateNote = useUpdateProjectNote();
  const deleteNote = useDeleteProjectNote();
  const { highlights } = useHighlight();

  if (!notes?.length) return null;

  return (
    <ul className="space-y-2 mt-2">
      {notes.map((note) => {
        const stakeholderNames = (note.stakeholder_ids || [])
          .map((id) => allStakeholders.find((s) => s.id === id)?.name)
          .filter(Boolean);
        const isMatched = isHighlightMatch(highlights, "notes", note.stakeholder_ids || []);

        return (
          <li key={note.id} className={`text-xs flex flex-col gap-1 group transition-colors rounded ${isMatched ? "bg-primary/5" : ""}`}>
            <div className="flex items-start gap-1.5">
              <span aria-hidden="true" className="shrink-0 mt-0.5">{TYPE_ICON[note.type] || "📝"}</span>
              <div className="flex-1 min-w-0 text-muted-foreground">
                <EditableText
                  value={note.content}
                  onSave={(val) => updateNote.mutate({ id: note.id, data: { content: val } })}
                  className="text-xs"
                />
                {note.reporter && <p className="text-[10px] font-medium text-foreground mt-0.5">Reported by {note.reporter}</p>}
              </div>
              <button
                onClick={() =>
                  confirmThen(
                    `Delete this ${(note.type || "note").toLowerCase()}? This cannot be undone.`,
                    () => deleteNote.mutate(note.id)
                  )
                }
                aria-label="Delete note"
                className="shrink-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            {(stakeholderNames.length > 0 || note.created_date) && (
              <div className="pl-5 flex items-center gap-2 text-[10px] text-muted-foreground/80">
                {note.created_date && <span>{new Date(note.created_date).toLocaleString()}</span>}
                {note.created_date && stakeholderNames.length > 0 && <span>•</span>}
                {stakeholderNames.length > 0 && <span>Stakeholders: {stakeholderNames.join(", ")}</span>}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

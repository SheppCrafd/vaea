import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { useNotes } from "@/hooks/useNotes";
import { useAllProjectNotes } from "@/hooks/useProjectNotes";

const TYPE_LABEL = { RISK: "Risk", QUESTION: "Open question", NOTE: "Note" };

// A product's consolidated notes view: every free-floating Notepad note
// tagged to this product (or to one of its projects) plus every ProjectNote
// on the projects under it, in one list — with a "Summarize with Vaea"
// handoff that sends the whole set to chat.
export default function ProductNotesSection({ product, projects, onClose }) {
  const navigate = useNavigate();
  const { data: allNotes = [] } = useNotes();
  const { data: allProjectNotes = [] } = useAllProjectNotes();

  const projectIds = projects.map((p) => p.id);
  const projectTitle = (id) => projects.find((p) => p.id === id)?.title || "";

  const notepadNotes = allNotes.filter(
    (n) =>
      (n.product_ids || []).includes(product.id) ||
      (n.project_ids || []).some((id) => projectIds.includes(id))
  );
  const projectNotes = allProjectNotes.filter((n) => projectIds.includes(n.project_id));

  const total = notepadNotes.length + projectNotes.length;

  const summarize = () => {
    const lines = [
      ...notepadNotes.map((n) => `- ${n.content}`),
      ...projectNotes.map((n) => `- (${TYPE_LABEL[n.type] || "Note"} — ${projectTitle(n.project_id)}) ${n.content}`),
    ].join("\n");
    onClose();
    navigate("/app/chat", {
      state: {
        initialMessage:
          `Summarize the notes across the "${product.title}" product — group the themes, ` +
          `call out risks and open questions, and list any action items:\n\n${lines}`,
      },
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Notes {total > 0 && <span className="text-muted-foreground/60">({total})</span>}
        </p>
        {total > 0 && (
          <button
            onClick={summarize}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Summarize with Vaea
          </button>
        )}
      </div>

      {total === 0 ? (
        <p className="text-sm text-muted-foreground">No notes tagged to this product yet.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {notepadNotes.map((n) => (
            <li key={`np-${n.id}`} className="text-sm bg-card border border-border rounded-md px-3 py-2">
              <p className="whitespace-pre-wrap break-words">{n.content}</p>
              {n.date && <p className="text-[10px] text-muted-foreground/80 mt-1">{n.date}</p>}
            </li>
          ))}
          {projectNotes.map((n) => (
            <li key={`pn-${n.id}`} className="text-sm bg-card border border-border rounded-md px-3 py-2">
              <p className="whitespace-pre-wrap break-words">{n.content}</p>
              <p className="text-[10px] text-muted-foreground/80 mt-1">
                {TYPE_LABEL[n.type] || "Note"} · {projectTitle(n.project_id)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

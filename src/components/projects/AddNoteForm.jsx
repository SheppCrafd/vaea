import { useState } from "react";
import { useCreateProjectNote } from "@/hooks/useProjectNotes";
import StakeholderAssigner from "@/components/shared/StakeholderAssigner";
import { Select } from "@/components/ui/select";

const TYPE_LABELS = { RISK: "Risk", QUESTION: "Open Question", NOTE: "Note" };
// Each kind of note asks for what it actually is.
const PLACEHOLDERS = {
  RISK: "What could go wrong?",
  QUESTION: "What's still unanswered?",
  NOTE: "Add a note...",
};

// Small inline form for creating a ProjectNote with reporter + stakeholders,
// used both for Risks/Open Questions and for the separate general Notes log.
export default function AddNoteForm({ projectId, allStakeholders = [], defaultType = "RISK", allowedTypes = ["RISK", "QUESTION"] }) {
  const [type, setType] = useState(defaultType);
  const [content, setContent] = useState("");
  const [reporter, setReporter] = useState("");
  const [stakeholderIds, setStakeholderIds] = useState([]);
  const createNote = useCreateProjectNote();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    createNote.mutate({
      project_id: projectId,
      type,
      content: content.trim(),
      reporter: reporter.trim(),
      stakeholder_ids: stakeholderIds,
    });
    setContent("");
    setReporter("");
    setStakeholderIds([]);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 bg-secondary/20 border border-border rounded-lg p-3 mt-2">
      <div className="flex items-center gap-2">
        {allowedTypes.length > 1 && (
          <Select
            value={type}
            onChange={(e) => setType(e.target.value)}
            aria-label="Note type"
            className="text-xs px-1.5 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            options={allowedTypes.map((t) => ({ value: t, label: TYPE_LABELS[t] }))}
          />
        )}
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={PLACEHOLDERS[type]}
          aria-label={`${TYPE_LABELS[type]} text`}
          className="flex-1 text-xs px-2 py-1.5 bg-background border border-input rounded outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          value={reporter}
          onChange={(e) => setReporter(e.target.value)}
          placeholder="Raised by (optional)"
          aria-label="Raised by"
          title="Who raised this. Optional."
          className="flex-1 text-xs px-2 py-1.5 bg-background border border-input rounded outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <StakeholderAssigner
          currentStakeholderIds={stakeholderIds}
          allStakeholders={allStakeholders}
          onSave={setStakeholderIds}
          label="Add Stakeholders"
        />
        <button
          type="submit"
          disabled={!content.trim()}
          className="text-xs px-3 py-1.5 bg-primary text-primary-foreground border border-border rounded-md disabled:opacity-50 shrink-0"
        >
          Add
        </button>
      </div>
    </form>
  );
}

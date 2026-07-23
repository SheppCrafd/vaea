import { useState } from "react";
import { Expand, GripVertical, AlertTriangle, HelpCircle } from "lucide-react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import TaskTableModal from "@/components/projects/TaskTableModal";
import ProjectDetailModal from "@/components/projects/ProjectDetailModal";
import { useTasks } from "@/hooks/useTasks";
import { useProjectNotes } from "@/hooks/useProjectNotes";
import { useEditableField } from "@/hooks/useEditableField";
import { useHighlightMatch } from "@/hooks/useHighlightDim";
import { useHighlight } from "@/lib/HighlightContext";
import { useUpdateProject } from "@/hooks/useProjects";
import { getQuadrantCounts, getMiniStatusCounts, STATUS_COLORS } from "@/lib/taskUtils";

// Mini card: the dashboard's default project face is deliberately just
// title + quadrant + a 3-bucket stats bar. Everything else that used to live
// here (objective, risks/questions inline editors, owner/due date, stakeholder
// assigner, links, custom fields, problem statement) is still fully editable
// one click away in ProjectDetailModal — nothing was dropped, just moved
// behind Expand so the dashboard reads as a grid of small squares.
export default function ProjectCard({ project, stakeholderIds = [] }) {
  const [isTableOpen, setIsTableOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // See taskUtils.js comment history: `[] || x` is always `[]`, so fall back
  // on empty length rather than truthiness or the parent's stakeholders never
  // apply when this project has its own (empty) stakeholder_ids array.
  const cardStakeholderIds = (project.stakeholder_ids?.length ? project.stakeholder_ids : stakeholderIds) || [];
  const isMatched = useHighlightMatch(cardStakeholderIds, "projects");
  const { highlights } = useHighlight();

  const { data: tasks = [] } = useTasks(project.id);
  const { data: notes = [] } = useProjectNotes(project.id);
  const riskNotes = notes.filter((n) => n.type === "RISK");
  const questionNotes = notes.filter((n) => n.type === "QUESTION");
  const updateProject = useUpdateProject();

  const { value: title, handleInput: handleTitleInput, handleBlur: handleTitleBlur, handleKeyDown: handleTitleKeyDown } = useEditableField(
    project.title,
    (value) => updateProject.mutate({ id: project.id, data: { title: value } })
  );

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: project.id,
    data: { type: "project", id: project.id, title: project.title },
  });
  // Also a stakeholder-drop target: dragging a stakeholder from the sidebar
  // onto this card assigns them to the project.
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `project-drop-${project.id}`,
    data: { type: "project", id: project.id },
  });
  const setRefs = (node) => {
    setDragRef(node);
    setDropRef(node);
  };

  const style = {
    opacity: isDragging ? 0.4 : 1,
  };

  const quadrants = getQuadrantCounts(tasks, highlights);
  const miniStats = getMiniStatusCounts(tasks);
  const miniTotal = miniStats.reduce((sum, c) => sum + c.count, 0);

  const hasRisks = riskNotes.length > 0;
  const hasQuestions = questionNotes.length > 0;
  const hasFlags = hasRisks || hasQuestions;

  return (
    <div
      ref={setRefs}
      style={style}
      data-project-card={project.id}
      // No fixed width: this card is only ever rendered inside ProjectsGrid's
      // Mini-mode CSS grid (auto-fit/minmax(112px, 1fr)), which sets a 112px
      // floor and grows this card via 1fr when there's leftover space in its
      // row, same as ProjectCardFull one card-view up. Height stays fixed —
      // only the width grows — so it reads as a wider tile, not a stretched
      // square.
      className={`relative bg-card border border-border rounded-xl p-2 w-full h-28 flex flex-col items-center transition-colors ${isMatched ? "bg-primary/10 ring-1 ring-primary/30" : ""} ${isDragging ? "shadow-2xl scale-105 border-primary" : "shadow-sm"} ${isOver ? "ring-2 ring-primary ring-offset-1" : ""}`}
    >
      <div
        {...attributes}
        {...listeners}
        className="absolute top-1 left-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-0.5 z-20"
      >
        <GripVertical className="w-3 h-3" />
      </div>

      <button
        onClick={() => setIsDetailOpen(true)}
        className="absolute top-1 right-1 z-20 text-muted-foreground hover:text-foreground p-0.5 rounded hover:bg-muted transition-colors"
        aria-label="Expand project"
      >
        <Expand className="w-3 h-3" />
      </button>

      <h4
        className="font-heading font-semibold text-[11px] leading-tight text-center break-words outline-none focus:ring-1 focus:ring-primary/40 rounded cursor-text w-full px-3 mt-3 line-clamp-2"
        contentEditable
        suppressContentEditableWarning
        onInput={handleTitleInput}
        onBlur={handleTitleBlur}
        onKeyDown={handleTitleKeyDown}
      >
        {title}
      </h4>

      <div className="flex-1 flex items-center justify-center gap-1 w-full min-h-0">
        <button
          onClick={() => setIsTableOpen(true)}
          className={`shrink-0 grid grid-cols-2 gap-0.5 border border-border rounded overflow-hidden w-11 h-11 text-xs z-20 select-none transition-transform ${hasFlags ? "-translate-x-1.5" : ""}`}
          title="Open Task Table"
        >
          {quadrants.map((q) => (
            <div
              key={q.quadrant}
              className={`flex items-center justify-center transition-colors ${
                q.hasHighlightedStakeholder
                  ? "text-foreground font-bold"
                  : q.hasFocus
                  ? "bg-green-800 text-white font-bold"
                  : "bg-muted/40 text-muted-foreground"
              }`}
              style={q.hasHighlightedStakeholder ? { backgroundColor: STATUS_COLORS.DONE } : undefined}
            >
              {q.count}
            </div>
          ))}
        </button>

        {hasFlags && (
          <div className="flex flex-col gap-0.5 shrink-0">
            {hasRisks && (
              <AlertTriangle
                className="w-3.5 h-3.5"
                style={{ color: "#FCA5A5" }}
                aria-label={`${riskNotes.length} risk${riskNotes.length === 1 ? "" : "s"}`}
              >
                <title>{`${riskNotes.length} risk${riskNotes.length === 1 ? "" : "s"}`}</title>
              </AlertTriangle>
            )}
            {hasQuestions && (
              <HelpCircle
                className="w-3.5 h-3.5"
                style={{ color: "#FDBA74" }}
                aria-label={`${questionNotes.length} question${questionNotes.length === 1 ? "" : "s"}`}
              >
                <title>{`${questionNotes.length} question${questionNotes.length === 1 ? "" : "s"}`}</title>
              </HelpCircle>
            )}
          </div>
        )}
      </div>

      {miniTotal > 0 && (
        <div className="w-full flex h-1.5 rounded-full overflow-hidden shrink-0 mb-0.5">
          {miniStats
            .filter((s) => s.count > 0)
            .map((s) => (
              <div
                key={s.key}
                className="h-full"
                style={{ width: `${(s.count / miniTotal) * 100}%`, backgroundColor: s.color }}
                title={`${s.label}: ${s.count}`}
              />
            ))}
        </div>
      )}

      {isTableOpen && (
        <TaskTableModal project={project} onClose={() => setIsTableOpen(false)} />
      )}
      {isDetailOpen && (
        <ProjectDetailModal project={project} onClose={() => setIsDetailOpen(false)} />
      )}
    </div>
  );
}

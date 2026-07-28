import { useState } from "react";
import { Expand, GripVertical, AlertTriangle, HelpCircle, Trash2 } from "lucide-react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import TaskTableModal from "@/components/projects/TaskTableModal";
import ProjectDetailModal from "@/components/projects/ProjectDetailModal";
import { useTasks } from "@/hooks/useTasks";
import { useProjectNotes } from "@/hooks/useProjectNotes";
import { useEditableField } from "@/hooks/useEditableField";
import { useHighlightMatch } from "@/hooks/useHighlightDim";
import { useHighlight } from "@/lib/HighlightContext";
import { useUpdateProject, useDeleteProject } from "@/hooks/useProjects";
import { confirmThen } from "@/lib/entityUtils";
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
  const deleteProject = useDeleteProject();

  const { value: title, handleInput: handleTitleInput, handleBlur: handleTitleBlur, handleKeyDown: handleTitleKeyDown } = useEditableField(
    project.title,
    (value) => updateProject.mutate({ id: project.id, data: { title: value } })
  );

  const handleDelete = () => {
    confirmThen(
      `Delete project "${project.title}"? This cannot be undone.`,
      () => deleteProject.mutate(project.id)
    );
  };

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

  return (
    <div
      ref={setRefs}
      style={style}
      data-project-card={project.id}
      // No fixed dimensions: ProjectsGrid's Mini-mode CSS grid
      // (auto-fill/minmax(112px, 1fr)) decides the tile's width, and
      // aspect-square derives the height from it — the tile is a square at
      // every track size, per design review, instead of the old fixed-height
      // h-28 rectangle that only its width could grow.
      className={`relative bg-card border border-border rounded-xl p-2 w-full aspect-square flex flex-col items-center transition-colors ${isMatched ? "bg-primary/10 ring-1 ring-primary/30" : ""} ${isDragging ? "shadow-2xl scale-105 border-primary" : "shadow-sm"} ${isOver ? "ring-2 ring-primary ring-offset-1" : ""}`}
    >
      {/* Header row in normal flow (not absolute corners): grip, then the
          title sitting between the move and expand icons, then the
          expand/delete cluster — the title's flex-1 keeps it centered in
          whatever width the icons leave over. */}
      <div className="w-full flex items-start gap-0.5 z-20">
        <div
          {...attributes}
          {...listeners}
          className="shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-0.5"
        >
          <GripVertical className="w-3 h-3" />
        </div>

        <h4
          className="flex-1 min-w-0 font-heading font-semibold text-[11px] leading-tight text-center break-words outline-none focus:ring-1 focus:ring-primary/40 rounded cursor-text line-clamp-2"
          contentEditable
          suppressContentEditableWarning
          onInput={handleTitleInput}
          onBlur={handleTitleBlur}
          onKeyDown={handleTitleKeyDown}
        >
          {title}
        </h4>

        <div className="shrink-0 flex items-center gap-0.5">
          <button
            onClick={() => setIsDetailOpen(true)}
            className="text-muted-foreground hover:text-foreground p-0.5 rounded hover:bg-muted transition-colors"
            title="Expand Project"
            aria-label="Expand project"
          >
            <Expand className="w-3 h-3" />
          </button>
          <button
            onClick={handleDelete}
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 p-0.5 rounded transition-colors"
            title="Delete Project"
            aria-label="Delete project"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center gap-1 w-full min-h-0">
        <button
          onClick={() => setIsTableOpen(true)}
          className="shrink-0 grid grid-cols-2 gap-0.5 border border-border rounded overflow-hidden w-11 h-11 text-xs z-20 select-none"
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

        {/* Both flag icons render always, so the tile's composition never
            shifts as notes come and go — greyed out while there's nothing
            behind them, full color the moment there is. */}
        <div className="flex flex-col gap-0.5 shrink-0">
          <AlertTriangle
            className={`w-3.5 h-3.5 ${hasRisks ? "" : "text-muted-foreground/35"}`}
            style={hasRisks ? { color: "#FCA5A5" } : undefined}
            aria-label={hasRisks ? `${riskNotes.length} risk${riskNotes.length === 1 ? "" : "s"}` : "No risks"}
          >
            <title>{hasRisks ? `${riskNotes.length} risk${riskNotes.length === 1 ? "" : "s"}` : "No risks"}</title>
          </AlertTriangle>
          <HelpCircle
            className={`w-3.5 h-3.5 ${hasQuestions ? "" : "text-muted-foreground/35"}`}
            style={hasQuestions ? { color: "#FDBA74" } : undefined}
            aria-label={hasQuestions ? `${questionNotes.length} question${questionNotes.length === 1 ? "" : "s"}` : "No open questions"}
          >
            <title>{hasQuestions ? `${questionNotes.length} question${questionNotes.length === 1 ? "" : "s"}` : "No open questions"}</title>
          </HelpCircle>
        </div>
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

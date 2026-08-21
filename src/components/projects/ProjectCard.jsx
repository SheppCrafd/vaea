import { memo, useState, lazy, Suspense } from "react";
import { Expand, GripVertical, Trash2 } from "lucide-react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { useTasks } from "@/hooks/useTasks";
import { useProjectNotes } from "@/hooks/useProjectNotes";
import { useEditableField } from "@/hooks/useEditableField";
import { useHighlightMatch } from "@/hooks/useHighlightDim";
import { useHighlight } from "@/lib/HighlightContext";
import { useUpdateProject, useDeleteProject } from "@/hooks/useProjects";
import { confirmThen } from "@/lib/entityUtils";
import { getQuadrantCounts, getMiniStatusCounts } from "@/lib/taskUtils";
import EditableTitle from "@/components/shared/EditableTitle";
import ProjectMiniStats from "@/components/projects/ProjectMiniStats";

// Lazy: neither modal is needed until a user opens it from this card.
const TaskTableModal = lazy(() => import("@/components/projects/TaskTableModal"));
const ProjectDetailModal = lazy(() => import("@/components/projects/ProjectDetailModal"));

// Mini card: the dashboard's default project face is deliberately just
// title + quadrant + a 3-bucket stats bar. Everything else that used to live
// here (objective, risks/questions inline editors, owner/due date, stakeholder
// assigner, links, custom fields, problem statement) is still fully editable
// one click away in ProjectDetailModal — nothing was dropped, just moved
// behind Expand so the dashboard reads as a grid of small squares.
function ProjectCard({ project, stakeholderIds = [] }) {
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

  return (
    <div
      ref={setRefs}
      style={style}
      data-project-card={project.id}
      // Width comes from ProjectsGrid's Mini-mode CSS grid, which fixes every
      // track at 112px rather than letting them grow to fill the row —
      // sized to this tile's own content instead of wasting leftover grid
      // space. aspect-square derives the height from that same 112px.
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

        <EditableTitle
          as="h4"
          value={title}
          onInput={handleTitleInput}
          onBlur={handleTitleBlur}
          onKeyDown={handleTitleKeyDown}
          tooltip={title}
          className="flex-1 min-w-0 font-heading font-semibold text-[11px] leading-tight text-center cursor-text line-clamp-2"
        />

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

      <ProjectMiniStats
        quadrants={quadrants}
        riskNotes={riskNotes}
        questionNotes={questionNotes}
        miniStats={miniStats}
        miniTotal={miniTotal}
        onOpenTable={() => setIsTableOpen(true)}
      />

      <Suspense fallback={null}>
        {isTableOpen && (
          <TaskTableModal project={project} onClose={() => setIsTableOpen(false)} />
        )}
        {isDetailOpen && (
          <ProjectDetailModal project={project} onClose={() => setIsDetailOpen(false)} />
        )}
      </Suspense>
    </div>
  );
}

export default memo(ProjectCard);

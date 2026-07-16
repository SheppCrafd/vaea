import { useState } from "react";
import { Expand, GripVertical } from "lucide-react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import ProjectNotes from "@/components/projects/ProjectNotes";
import TaskTableModal from "@/components/projects/TaskTableModal";
import ProjectDetailModal from "@/components/projects/ProjectDetailModal";
import TaskStatistics from "@/components/shared/TaskStatistics";
import { useTasks } from "@/hooks/useTasks";
import { useProjectNotes, useCreateProjectNote } from "@/hooks/useProjectNotes";
import { useStakeholders } from "@/hooks/useStakeholders";
import { useUpdateProject } from "@/hooks/useProjects";
import { useEditableField } from "@/hooks/useEditableField";
import { useHighlightDim } from "@/hooks/useHighlightDim";
import { useHighlight } from "@/lib/HighlightContext";
import { filterActiveTasks, getQuadrantCounts, isTaskDone } from "@/lib/taskUtils";
import { getProjectOwner, getDueDateColorClass, formatDueDate } from "@/lib/projectUtils";

export default function ProjectCard({ project, stakeholderIds = [] }) {
  const [isTableOpen, setIsTableOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // `project.stakeholder_ids || stakeholderIds` looks like a reasonable
  // "fall back to the parent product/area's stakeholders" chain, but an
  // empty array is truthy in JS — `[] || x` always evaluates to `[]`, so
  // that fallback silently never fired for the common case of a project
  // with no stakeholders of its own, and the card dimmed unconditionally
  // whenever any stakeholder was selected instead of reflecting whether its
  // parent product/area actually included them. Fall back on empty length
  // instead of truthiness.
  const cardStakeholderIds = (project.stakeholder_ids?.length ? project.stakeholder_ids : stakeholderIds) || [];
  // Reacts to both the "projects" and "products" checkbox categories — a
  // project card must not stay dimmed while a matching parent-product
  // highlight lights it up via the fallback above, or vice versa.
  const isDimmed = useHighlightDim(cardStakeholderIds, ["projects", "products"]);
  const { highlights } = useHighlight();

  const { data: tasks = [] } = useTasks(project.id);
  const { data: notes = [] } = useProjectNotes(project.id);
  // Card's center block is "Risks and open questions" only, per spec — the
  // general "NOTE" type belongs in the full detail view, not the compact card.
  const riskNotes = notes.filter((n) => n.type === "RISK" || n.type === "QUESTION");
  const { data: allStakeholders = [] } = useStakeholders();
  const updateProject = useUpdateProject();
  const createProjectNote = useCreateProjectNote();

  const { value: title, handleInput: handleTitleInput } = useEditableField(
    project.title,
    (value) => updateProject.mutate({ id: project.id, data: { title: value } })
  );

  const [newNoteText, setNewNoteText] = useState("");

  const handleNewNoteKeyDown = (e) => {
    if (e.key !== "Enter" || !newNoteText.trim()) return;
    createProjectNote.mutate({ project_id: project.id, type: "RISK", content: newNoteText.trim() });
    setNewNoteText("");
  };

  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({
    id: project.id,
    data: { type: "project", id: project.id },
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
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 50 : 10,
    opacity: isDragging ? 0.8 : 1,
  };

  const doneTasks = tasks.filter(isTaskDone);
  const projectProgress = tasks.length > 0 ? Math.round((doneTasks.length / tasks.length) * 100) : 0;
  const quadrants = getQuadrantCounts(tasks, highlights);

  const activeTasks = filterActiveTasks(tasks);
  const allDone = activeTasks.length > 0 && activeTasks.every(isTaskDone);

  const dateColorClass = getDueDateColorClass(project, allDone);
  const formattedDate = formatDueDate(project);
  const owner = getProjectOwner(project) || "Unassigned";

  return (
    <div
      ref={setRefs}
      style={style}
      data-project-card={project.id}
      className={`relative bg-background border border-border rounded-lg p-3 transition-colors ${isDimmed ? "opacity-30" : ""} ${isDragging ? "shadow-2xl scale-105 border-primary" : "shadow-sm"} ${isOver ? "ring-2 ring-primary ring-offset-1" : ""}`}
    >
      <div 
        {...attributes} 
        {...listeners} 
        className="absolute top-2 left-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1 z-20"
      >
        <GripVertical className="w-4 h-4" />
      </div>

      <button
        onClick={() => setIsDetailOpen(true)}
        className="absolute top-2 right-2 z-20 text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted transition-colors"
        aria-label="Expand project"
      >
        <Expand className="w-3.5 h-3.5" />
      </button>

      <div className="flex items-start gap-3 pr-5 pl-5">
        <button 
          onClick={() => setIsTableOpen(true)} 
          className="shrink-0 mt-1 grid grid-cols-2 gap-0.5 border border-border rounded overflow-hidden w-9 h-9 text-[10px] z-20 select-none"
          title="Open Task Table"
        >
          {quadrants.map((q) => (
            <div
              key={q.quadrant}
              className={`flex items-center justify-center transition-colors ${
                q.hasFocus ? "bg-green-800 text-white font-bold" : "bg-muted/40 text-muted-foreground"
              } ${q.hasHighlightedStakeholder ? "ring-2 ring-inset ring-primary" : ""}`}
            >
              {q.count}
            </div>
          ))}
        </button>

        <div className="flex-1 text-center px-1 min-w-0 flex flex-col items-center">
          <h4 
            className="font-heading font-semibold text-sm break-words outline-none focus:ring-1 focus:ring-primary/40 rounded cursor-text w-full px-1"
            contentEditable
            suppressContentEditableWarning
            onInput={handleTitleInput}
          >
            {title}
          </h4>
          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1 break-words w-full px-1">
            {project.objective || "No objective defined"}
          </p>

          <div className="mt-2 w-full max-w-[95%] bg-destructive/5 border border-destructive/15 rounded px-2 py-1 z-20">
            <p className="text-[8px] font-bold text-destructive/60 uppercase tracking-wider text-left mb-0.5">Risks & Questions</p>
            <input
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              onKeyDown={handleNewNoteKeyDown}
              placeholder="Add a risk or question and press Enter..."
              className="w-full text-[10px] bg-transparent outline-none text-left placeholder:text-muted-foreground/60"
            />
            <ProjectNotes notes={riskNotes} allStakeholders={allStakeholders} />
          </div>
        </div>

        <div className="text-right shrink-0 min-w-[75px] select-none mt-0.5">
          <p className="text-[10px] font-semibold text-muted-foreground truncate" title={owner}>
            {owner}
          </p>
          <p className={`text-[11px] mt-0.5 ${dateColorClass}`}>
            {formattedDate}
          </p>
        </div>
      </div>

      <div className="pl-5 pr-1 mt-2">
        <TaskStatistics tasks={tasks} />
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border pt-2 px-1 ml-5">
        <div className="flex flex-col">
          <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider">Progress</span>
          <span className="text-xs font-bold text-primary">{projectProgress}%</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider">Tasks</span>
          <span className="text-xs font-semibold text-foreground">{doneTasks.length} <span className="text-muted-foreground font-normal">/ {tasks.length}</span></span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider">Notes</span>
          <span className="text-xs font-semibold text-foreground">{notes.length}</span>
        </div>
      </div>

      {(project.display_on_card_fields || []).length > 0 && (
        <div className="mt-2 pl-5 flex flex-wrap gap-x-3 gap-y-1">
          {(project.display_on_card_fields || []).map((key) => {
            const field = project.custom_data?.[key];
            if (!field) return null;
            return (
              <span key={key} className="text-[10px] text-muted-foreground">
                <span className="font-medium text-foreground">{field.label}:</span> {field.value || "—"}
              </span>
            );
          })}
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
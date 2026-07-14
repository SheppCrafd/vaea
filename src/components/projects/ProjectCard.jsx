import { useState, useEffect } from "react";
import { Expand, GripVertical } from "lucide-react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import ProjectNotes from "@/components/projects/ProjectNotes";
import TaskTableModal from "@/components/projects/TaskTableModal";
import ProjectDetailModal from "@/components/projects/ProjectDetailModal";
import { useHighlight } from "@/lib/HighlightContext";
import { useTasks } from "@/hooks/useTasks";
import { useProjectNotes } from "@/hooks/useProjectNotes";
import { useUpdateProject } from "@/hooks/useProjects";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";

export default function ProjectCard({ project, stakeholderIds = [] }) {
  // Original modal and highlighting state
  const [isTableOpen, setIsTableOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const { highlightedIds } = useHighlight();
  const isDimmed = highlightedIds.length > 0 && !stakeholderIds.some((id) => highlightedIds.includes(id));
  
  // Original data fetching hooks
  const { data: tasks = [] } = useTasks(project.id);
  const { data: notes = [] } = useProjectNotes(project.id);
  const updateProject = useUpdateProject();

  // Original Title setup & debounced saving
  const [title, setTitle] = useState(project.title);
  useEffect(() => setTitle(project.title), [project.title]);

  const debouncedSaveTitle = useDebouncedCallback(
    (value) => updateProject.mutate({ id: project.id, data: { title: value } }),
    500
  );

  const handleTitleInput = (e) => {
    const value = e.currentTarget.textContent;
    setTitle(value);
    debouncedSaveTitle(value);
  };

  // NEW: Debounced saving for Risks & Open Questions
  const debouncedSaveRisks = useDebouncedCallback(
    (value) => updateProject.mutate({ id: project.id, data: { risks: value } }),
    500
  );

  const handleRisksInput = (e) => {
    debouncedSaveRisks(e.currentTarget.textContent);
  };

  // Original Draggable configuration for dnd-kit
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: project.id,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 50 : 10,
    opacity: isDragging ? 0.8 : 1,
  };

  // --- REQUIREMENT 1: TASK COUNT & WEEKLY FOCUS CHECK (Excludes Archived/Deleted) ---
  const activeTasks = tasks.filter(t => !t.isArchived && t.status !== "DELETED");
  
  const getQuadData = (quadNum) => {
    const quadTasks = activeTasks.filter(t => 
      quadNum === 4 ? (t.quadrant === 4 || !t.quadrant) : t.quadrant === quadNum
    );
    const hasFocus = quadTasks.some(t => t.isWeeklyFocus);
    return {
      count: quadTasks.length,
      className: hasFocus 
        ? "bg-green-800 text-white font-bold" 
        : "bg-muted/40 text-muted-foreground"
    };
  };

  const q1 = getQuadData(1);
  const q2 = getQuadData(2);
  const q3 = getQuadData(3);
  const q4 = getQuadData(4);

  // --- REQUIREMENT 2: DUE DATE STATUS COLOR-CODING ---
  const allDone = activeTasks.length > 0 && activeTasks.every((t) => t.status === "DONE" || t.status === "DELEGATED_DONE" || t.status === "DELEGATED-DONE");
  
  let dateColorClass = "text-black dark:text-white"; // Default: Estimated
  if (allDone || project.dueDateStatus === "Done") {
    dateColorClass = "text-blue-500 font-bold";
  } else if (project.dueDateStatus === "Committed - On Track") {
    dateColorClass = "text-green-600 font-bold";
  } else if (project.dueDateStatus === "Committed - At Risk") {
    dateColorClass = "text-orange-500 font-bold";
  } else if (project.dueDateStatus === "Committed - Missed") {
    dateColorClass = "text-red-600 font-bold";
  }

  const formattedDate = project.dueDate
    ? new Date(project.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "No due date";

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className={`relative bg-background border border-border rounded-lg p-3 transition-colors ${isDimmed ? "opacity-30" : ""} ${isDragging ? "shadow-2xl scale-105 border-primary" : "shadow-sm"}`}
    >
      {/* Original Dedicated Grip Handle */}
      <div 
        {...attributes} 
        {...listeners} 
        className="absolute top-2 left-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1 z-20"
      >
        <GripVertical className="w-4 h-4" />
      </div>

      {/* Original Expand Details Button */}
      <button
        onClick={() => setIsDetailOpen(true)}
        className="absolute top-2 right-2 z-20 text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted transition-colors"
        aria-label="Expand project"
      >
        <Expand className="w-3.5 h-3.5" />
      </button>

      {/* Main Content Layout Block */}
      <div className="flex items-start gap-3 pr-5 pl-5">
        
        {/* REQUIREMENT: FAR LEFT - 4-Square Quadrant Grid (Triggers Task Popup) */}
        <button 
          onClick={() => setIsTableOpen(true)} 
          className="shrink-0 mt-1 grid grid-cols-2 gap-0.5 border border-border rounded overflow-hidden w-9 h-9 text-[10px] z-20 select-none"
          title="Open Task Table"
        >
          <div className={`flex items-center justify-center transition-colors ${q1.className}`}>{q1.count}</div>
          <div className={`flex items-center justify-center transition-colors ${q2.className}`}>{q2.count}</div>
          <div className={`flex items-center justify-center transition-colors ${q3.className}`}>{q3.count}</div>
          <div className={`flex items-center justify-center transition-colors ${q4.className}`}>{q4.count}</div>
        </button>

        {/* REQUIREMENT: CENTER - Title, Objective, and Risks box */}
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

          {/* REQUIREMENT: Center Content (Risks and open questions) */}
          <div className="mt-2 w-full max-w-[95%] bg-destructive/5 border border-destructive/15 rounded px-2 py-0.5 z-20">
            <p className="text-[8px] font-bold text-destructive/60 uppercase tracking-wider text-left">Risks & Questions</p>
            <p
              className="text-[10px] text-muted-foreground text-left line-clamp-1 outline-none focus:ring-1 focus:ring-primary/40 rounded cursor-text px-0.5"
              contentEditable
              suppressContentEditableWarning
              onInput={handleRisksInput}
              placeholder="Add risks or open questions..."
            >
              {project.risks || ""}
            </p>
          </div>
        </div>

        {/* REQUIREMENT: FAR RIGHT - Owner Name & Status Color-Coded Due Date */}
        <div className="text-right shrink-0 min-w-[75px] select-none mt-0.5">
          <p className="text-[10px] font-semibold text-muted-foreground truncate" title={project.owner || "Unassigned"}>
            {project.owner || "Unassigned"}
          </p>
          <p className={`text-[11px] mt-0.5 ${dateColorClass}`}>
            {formattedDate}
          </p>
        </div>
      </div>

      {/* Original Notes Display Section */}
      <div className="mt-2 pl-5">
        <ProjectNotes notes={notes} />
      </div>

      {/* Original Conditional Modals Mounting */}
      {isTableOpen && (
        <TaskTableModal project={project} onClose={() => setIsTableOpen(false)} />
      )}
      {isDetailOpen && (
        <ProjectDetailModal project={project} onClose={() => setIsDetailOpen(false)} />
      )}
    </div>
  );
}

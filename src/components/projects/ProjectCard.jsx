import { useState } from "react";
import { Expand } from "lucide-react";
import ProjectQuadrant from "@/components/projects/ProjectQuadrant";
import ProjectNotes from "@/components/projects/ProjectNotes";
import DueDateBadge from "@/components/projects/DueDateBadge";
import TaskTableModal from "@/components/projects/TaskTableModal";
import ProjectDetailModal from "@/components/projects/ProjectDetailModal";
import { useHighlight } from "@/lib/HighlightContext";
import { useTasks } from "@/hooks/useTasks";
import { useProjectNotes } from "@/hooks/useProjectNotes";

export default function ProjectCard({ project, stakeholderIds = [] }) {
  const [isTableOpen, setIsTableOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const { highlightedIds } = useHighlight();
  const isDimmed = highlightedIds.length > 0 && !stakeholderIds.some((id) => highlightedIds.includes(id));
  const { data: tasks = [] } = useTasks(project.id);
  const { data: notes = [] } = useProjectNotes(project.id);

  const allDone = tasks.length > 0 && tasks.every((t) => t.status === "DONE" || t.status === "DELEGATED_DONE");

  return (
    <div className={`relative z-10 bg-background border border-border rounded-lg p-3 transition-colors ${isDimmed ? "opacity-30" : ""}`}>
      <button
        onClick={() => setIsDetailOpen(true)}
        className="absolute top-2 right-2 z-20 text-muted-foreground hover:text-foreground"
        aria-label="Expand project"
      >
        <Expand className="w-3.5 h-3.5" />
      </button>

      <div className="flex items-start gap-3 pr-5">
        <button onClick={() => setIsTableOpen(true)} className="shrink-0">
          <ProjectQuadrant tasks={tasks} />
        </button>

        <div className="flex-1 text-center px-1 min-w-0">
          <h4 className="font-heading font-semibold text-sm break-words">{project.title}</h4>
          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 break-words">{project.objective}</p>
        </div>

        <DueDateBadge project={project} allDone={allDone} />
      </div>

      <div className="mt-2">
        <ProjectNotes notes={notes} />
      </div>

      {isTableOpen && (
        <TaskTableModal project={project} onClose={() => setIsTableOpen(false)} />
      )}
      {isDetailOpen && (
        <ProjectDetailModal project={project} onClose={() => setIsDetailOpen(false)} />
      )}
    </div>
  );
}
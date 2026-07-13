import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import ProjectQuadrant from "@/components/projects/ProjectQuadrant";
import ProjectNotes from "@/components/projects/ProjectNotes";
import TaskTableModal from "@/components/projects/TaskTableModal";

function getDueBadge(dueDate) {
  const diffHours = (new Date(dueDate) - new Date()) / (1000 * 60 * 60);
  if (diffHours < 0) return { label: "Overdue", className: "bg-red-100 text-red-700" };
  if (diffHours < 48) return { label: "Due soon", className: "bg-orange-100 text-orange-700" };
  return { label: dueDate, className: "bg-secondary text-secondary-foreground" };
}

export default function ProjectCard({ project }) {
  const [isTableOpen, setIsTableOpen] = useState(false);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: project.id });
  const dueBadge = getDueBadge(project.dueDate);

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: isDragging ? 20 : "auto" }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => setIsTableOpen(true)}
      className={`bg-background border border-border rounded-lg p-3 cursor-pointer hover:border-primary/50 transition-colors ${isDragging ? "opacity-50" : ""}`}
    >
      <h4 className="font-medium text-sm" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        {project.title}
      </h4>
      <span className={`inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full ${dueBadge.className}`}>
        {dueBadge.label}
      </span>
      <div className="mt-3">
        <ProjectQuadrant quadrant={project.quadrant} />
      </div>
      <ProjectNotes notes={project.notes} />

      {isTableOpen && (
        <TaskTableModal project={project} onClose={() => setIsTableOpen(false)} />
      )}
    </div>
  );
}
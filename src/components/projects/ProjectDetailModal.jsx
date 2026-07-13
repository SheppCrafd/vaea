import { useEffect } from "react";
import { X, Archive, RotateCcw, Trash2 } from "lucide-react";
import Portal from "@/lib/Portal";
import { useProjectNotes } from "@/hooks/useProjectNotes";
import { useStakeholders } from "@/hooks/useStakeholders";
import { useArchiveProject, useRestoreProject, useUpdateProject, useDeleteProject } from "@/hooks/useProjects";
import TaskTable from "@/components/projects/TaskTable";
import EditableText from "@/components/shared/EditableText";

const DUE_DATE_STATUS_OPTIONS = ["ESTIMATED", "COMMITTED"];

// Full-screen expanded project view: problem statement, metrics, activity,
// notes, stakeholders by department, archive/restore/delete, and the full task table.
// Every field here is directly editable (title, objective, owner, due date, status,
// problem statement, activity).
export default function ProjectDetailModal({ project, onClose }) {
  const { data: notes = [] } = useProjectNotes(project.id);
  const { data: allStakeholders = [] } = useStakeholders();
  const archiveProject = useArchiveProject();
  const restoreProject = useRestoreProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const stakeholders = allStakeholders.filter((s) => (project.stakeholder_ids || []).includes(s.id));
  const departments = [...new Set(stakeholders.map((s) => s.department))];
  const metrics = project.metrics || {};

  const handleArchiveToggle = () => {
    if (project.is_archived) restoreProject.mutate(project.id);
    else archiveProject.mutate(project.id);
    onClose();
  };

  const handleDelete = () => {
    if (window.confirm(`Delete project "${project.title}"? This will also delete all of its tasks. This cannot be undone.`)) {
      deleteProject.mutate(project.id);
      onClose();
    }
  };

  return (
    <Portal>
      <div className="fixed inset-0 bg-background z-50 overflow-y-auto">
        <div className="flex items-center justify-between gap-3 p-6 border-b border-border sticky top-0 bg-background z-10">
          <EditableText
            value={project.title}
            onSave={(v) => updateProject.mutate({ id: project.id, data: { title: v } })}
            className="font-heading text-xl font-semibold"
          />
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleArchiveToggle}
              className="text-sm flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-secondary-foreground rounded-md whitespace-nowrap"
            >
              {project.is_archived ? <RotateCcw className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
              {project.is_archived ? "Restore Project" : "Archive Project"}
            </button>
            <button
              onClick={handleDelete}
              className="text-sm flex items-center gap-1.5 px-3 py-1.5 bg-destructive text-destructive-foreground rounded-md whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
            <button onClick={onClose}><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="p-6 max-w-4xl mx-auto space-y-6">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Objective</label>
            <EditableText
              value={project.objective}
              onSave={(v) => updateProject.mutate({ id: project.id, data: { objective: v } })}
              multiline
              className="text-sm bg-card border border-border rounded-md p-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Owner</label>
              <EditableText
                value={project.owner_name}
                onSave={(v) => updateProject.mutate({ id: project.id, data: { owner_name: v } })}
                placeholder="Unassigned"
                className="text-sm bg-card border border-border rounded-md p-2"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Due Date</label>
              <input
                type="date"
                value={project.due_date ? project.due_date.slice(0, 10) : ""}
                onChange={(e) => updateProject.mutate({ id: project.id, data: { due_date: e.target.value ? new Date(e.target.value).toISOString() : null } })}
                className="w-full text-sm bg-card border border-border rounded-md p-2"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Due Date Status</label>
              <select
                value={project.due_date_status || "ESTIMATED"}
                onChange={(e) => updateProject.mutate({ id: project.id, data: { due_date_status: e.target.value } })}
                className="w-full text-sm bg-card border border-border rounded-md p-2"
              >
                {DUE_DATE_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Problem Statement</label>
            <EditableText
              value={project.problem_statement}
              onSave={(v) => updateProject.mutate({ id: project.id, data: { problem_statement: v } })}
              multiline
              placeholder="No problem statement yet"
              className="text-sm bg-card border border-border rounded-md p-2"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Activity</label>
            <EditableText
              value={project.activity}
              onSave={(v) => updateProject.mutate({ id: project.id, data: { activity: v } })}
              multiline
              placeholder="No activity logged yet"
              className="text-sm bg-card border border-border rounded-md p-2"
            />
          </div>

          {(metrics.forecast || metrics.measured) && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Metrics</p>
              <div className="flex gap-6 text-sm">
                <span>Forecast: {metrics.forecast ?? "—"}</span>
                <span>Measured: {metrics.measured ?? "—"}</span>
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Risks & Open Questions</p>
            <ul className="space-y-1">
              {notes.map((note) => (
                <li key={note.id} className="text-sm flex items-start gap-1.5 min-w-0">
                  <span className="shrink-0">{note.type === "RISK" ? "⚠️" : "❓"}</span>
                  <span className="break-words min-w-0">{note.content}{note.reporter ? <span className="text-muted-foreground"> — {note.reporter}</span> : null}</span>
                </li>
              ))}
              {notes.length === 0 && <p className="text-sm text-muted-foreground">No notes yet.</p>}
            </ul>
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Stakeholders</p>
            {departments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No stakeholders assigned.</p>
            ) : (
              departments.map((dept) => (
                <div key={dept} className="mb-2">
                  <p className="text-xs text-muted-foreground">{dept}</p>
                  <p className="text-sm break-words">{stakeholders.filter((s) => s.department === dept).map((s) => s.name).join(", ")}</p>
                </div>
              ))
            )}
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Tasks</p>
            <div className="border border-border rounded-lg overflow-x-auto">
              <TaskTable project={project} />
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}
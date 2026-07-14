import { useEffect } from "react";
import { X, Archive, RotateCcw, Trash2 } from "lucide-react";
import Portal from "@/lib/Portal";
import { useProjectNotes } from "@/hooks/useProjectNotes";
import { useStakeholders } from "@/hooks/useStakeholders";
import { useArchiveProject, useRestoreProject, useUpdateProject, useDeleteProject } from "@/hooks/useProjects";
import TaskTable from "@/components/projects/TaskTable";
import EditableText from "@/components/shared/EditableText";
import ProjectNotes from "@/components/projects/ProjectNotes";
import StakeholderAssigner from "@/components/shared/StakeholderAssigner";

const DUE_DATE_STATUS_OPTIONS = ["ESTIMATED", "COMMITTED"];

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
  const departments = [...new Set(stakeholders.map((s) => s.department).filter(Boolean))];

  return (
    <Portal>
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          
          {/* Header */}
          <div className="flex items-start justify-between p-6 border-b border-border bg-muted/30">
            <div className="flex-1 mr-4">
              <EditableText
                value={project.title}
                onSave={(val) => updateProject.mutate({ id: project.id, data: { title: val } })}
                className="text-2xl font-bold font-heading mb-2 w-full"
              />
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Owner:</span>
                  <EditableText
                    value={project.owner || "Unassigned"}
                    onSave={(val) => updateProject.mutate({ id: project.id, data: { owner: val } })}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Due:</span>
                  <EditableText
                    value={project.due_date || "Not set"}
                    onSave={(val) => updateProject.mutate({ id: project.id, data: { due_date: val } })}
                    type="date"
                  />
                  <select
                    value={project.due_date_status || "ESTIMATED"}
                    onChange={(e) => updateProject.mutate({ id: project.id, data: { due_date_status: e.target.value } })}
                    className="bg-transparent border border-border rounded px-1.5 py-0.5 text-xs ml-1 outline-none"
                  >
                    {DUE_DATE_STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-secondary rounded-full transition-colors shrink-0">
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Objective</p>
                <EditableText
                  value={project.objective || "No objective set."}
                  onSave={(val) => updateProject.mutate({ id: project.id, data: { objective: val } })}
                  className="text-sm"
                  multiline
                />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Problem Statement</p>
                <EditableText
                  value={project.problem_statement || "No problem statement set."}
                  onSave={(val) => updateProject.mutate({ id: project.id, data: { problem_statement: val } })}
                  className="text-sm"
                  multiline
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Risks & Open Questions powered by ProjectNotes */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Risks & Open Questions</p>
                {notes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No notes yet.</p>
                ) : (
                  <ProjectNotes notes={notes} />
                )}
              </div>

              {/* Stakeholders Section with Assigner Dropdown */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Project Stakeholders</p>
                  <StakeholderAssigner 
                    currentStakeholderIds={project.stakeholder_ids || []} 
                    allStakeholders={allStakeholders} 
                    onSave={(newIds) => updateProject.mutate({ id: project.id, data: { stakeholder_ids: newIds } })}
                  />
                </div>
                
                {departments.length === 0 ? (
                  <p className="text-sm text-muted-foreground bg-secondary/20 p-3 rounded-lg border border-dashed border-border text-center">No stakeholders assigned yet.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {departments.map((dept) => {
                      const deptStakeholders = stakeholders.filter((s) => s.department === dept);
                      return (
                        <div key={dept} className="bg-secondary/20 p-3 rounded-lg border border-border">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">{dept}</p>
                          
                          <div className="flex items-center pl-2 mb-2">
                            {deptStakeholders.slice(0, 5).map((s, i) => (
                              <div key={s.id} className="w-8 h-8 rounded-full bg-primary/20 border-2 border-background flex items-center justify-center text-xs font-bold shadow-sm" style={{ marginLeft: i > 0 ? '-12px' : '0', zIndex: 10 - i }} title={s.name}>
                                {s.name.charAt(0).toUpperCase()}
                              </div>
                            ))}
                            {deptStakeholders.length > 5 && (
                              <div className="w-8 h-8 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[10px] font-bold" style={{ marginLeft: '-12px', zIndex: 0 }}>
                                +{deptStakeholders.length - 5}
                              </div>
                            )}
                          </div>
                          
                          <p className="text-xs break-words text-muted-foreground">
                            {deptStakeholders.map((s) => s.name).join(", ")}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">Tasks</p>
              <div className="border border-border rounded-lg overflow-x-auto bg-card shadow-sm">
                <TaskTable project={project} />
              </div>
            </div>

          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-border bg-muted/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => {
                  if (window.confirm("Are you sure you want to delete this project?")) {
                    deleteProject.mutate(project.id);
                    onClose();
                  }
                }}
                className="text-xs flex items-center gap-1.5 text-muted-foreground hover:text-destructive px-3 py-1.5 rounded transition-colors"
              >
                <Trash2 className="w-4 h-4" /> Delete Project
              </button>
            </div>
            
            {project.is_archived ? (
              <button 
                onClick={() => {
                  restoreProject.mutate(project.id);
                  onClose();
                }}
                className="text-xs flex items-center gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md font-medium transition-colors shadow-sm"
              >
                <RotateCcw className="w-4 h-4" /> Restore Project
              </button>
            ) : (
              <button 
                onClick={() => {
                  archiveProject.mutate(project.id);
                  onClose();
                }}
                className="text-xs flex items-center gap-1.5 bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border px-4 py-2 rounded-md font-medium transition-colors shadow-sm"
              >
                <Archive className="w-4 h-4" /> Archive Project
              </button>
            )}
          </div>

        </div>
      </div>
    </Portal>
  );
}

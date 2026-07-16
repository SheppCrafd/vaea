import { useEffect, useState } from "react";
import { X, Archive, RotateCcw, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import Portal from "@/lib/Portal";
import { useProjectNotes } from "@/hooks/useProjectNotes";
import { useStakeholders } from "@/hooks/useStakeholders";
import { useProducts } from "@/hooks/useProducts";
import { useAreas, useUpdateArea } from "@/hooks/useAreas";
import { useArchiveProject, useRestoreProject, useUpdateProject, useDeleteProject } from "@/hooks/useProjects";
import { confirmThen } from "@/lib/entityUtils";
import TaskTable from "@/components/projects/TaskTable";
import ArchivedTaskList from "@/components/projects/ArchivedTaskList";
import EditableText from "@/components/shared/EditableText";
import ProjectNotes from "@/components/projects/ProjectNotes";
import AddNoteForm from "@/components/projects/AddNoteForm";
import AttachmentsAndLinks from "@/components/projects/AttachmentsAndLinks";
import StakeholderAssigner from "@/components/shared/StakeholderAssigner";
import Avatar from "@/components/shared/Avatar";
import ProductAssigner from "@/components/shared/ProductAssigner";
import CustomFieldsSection from "@/components/shared/CustomFieldsSection";

const DUE_DATE_STATUS_OPTIONS = ["ESTIMATED", "COMMITTED"];

const METRIC_FIELDS = [
  { key: "impact_forecast", label: "Impact (Forecast)" },
  { key: "impact_measured", label: "Impact (Measured)" },
  { key: "outcome_forecast", label: "Outcome (Forecast)" },
  { key: "outcome_measured", label: "Outcome (Measured)" },
];

export default function ProjectDetailModal({ project, onClose }) {
  const { data: notes = [] } = useProjectNotes(project.id);
  const { data: allStakeholders = [] } = useStakeholders();
  const { data: allProducts = [] } = useProducts();
  const { data: allAreas = [] } = useAreas();
  const archiveProject = useArchiveProject();
  const restoreProject = useRestoreProject();
  const updateProject = useUpdateProject();
  const updateArea = useUpdateArea();
  const deleteProject = useDeleteProject();
  const [showArchivedTasks, setShowArchivedTasks] = useState(false);

  const area = allAreas.find((a) => a.id === project.parent_area_id);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const stakeholders = allStakeholders.filter((s) => (project.stakeholder_ids || []).includes(s.id));
  const departments = [...new Set(stakeholders.map((s) => s.department).filter(Boolean))];

  const riskNotes = notes.filter((n) => n.type !== "NOTE");
  const generalNotes = notes.filter((n) => n.type === "NOTE");

  const saveMetric = (key, value) => {
    updateProject.mutate({ id: project.id, data: { metrics: { ...project.metrics, [key]: value } } });
  };

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
                    value={project.owner_name || "Unassigned"}
                    onSave={(val) => updateProject.mutate({ id: project.id, data: { owner_name: val } })}
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
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Activity</p>
                <EditableText
                  value={project.activity || "No activity logged."}
                  onSave={(val) => updateProject.mutate({ id: project.id, data: { activity: val } })}
                  className="text-sm"
                  multiline
                />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Impact & Outcome Metrics</p>
                <div className="grid grid-cols-2 gap-2">
                  {METRIC_FIELDS.map(({ key, label }) => (
                    <div key={key}>
                      <label className="text-[10px] text-muted-foreground block mb-0.5">{label}</label>
                      <EditableText
                        value={project.metrics?.[key] || ""}
                        onSave={(val) => saveMetric(key, val)}
                        placeholder="—"
                        className="text-xs bg-background border border-border rounded px-1.5 py-1"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Risks & Open Questions powered by ProjectNotes */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Risks & Open Questions</p>
                {riskNotes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No risks or open questions yet.</p>
                ) : (
                  <ProjectNotes notes={riskNotes} allStakeholders={allStakeholders} />
                )}
                <AddNoteForm
                  projectId={project.id}
                  allStakeholders={allStakeholders}
                  defaultType="RISK"
                  allowedTypes={["RISK", "QUESTION"]}
                />
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
                              <div key={s.id} style={{ marginLeft: i > 0 ? '-12px' : '0', zIndex: 10 - i }}>
                                <Avatar name={s.name} avatarUrl={s.avatar_url} />
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
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Notes</p>
              {generalNotes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No notes yet.</p>
              ) : (
                <ProjectNotes notes={generalNotes} allStakeholders={allStakeholders} />
              )}
              <AddNoteForm
                projectId={project.id}
                allStakeholders={allStakeholders}
                defaultType="NOTE"
                allowedTypes={["NOTE"]}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Related Products</p>
                <ProductAssigner
                  currentProductIds={project.related_product_ids || []}
                  allProducts={allProducts}
                  excludeProductId={project.parent_product_id}
                  onSave={(newIds) => updateProject.mutate({ id: project.id, data: { related_product_ids: newIds } })}
                />
              </div>
              {(project.related_product_ids || []).length === 0 ? (
                <p className="text-sm text-muted-foreground bg-secondary/20 p-3 rounded-lg border border-dashed border-border text-center">
                  Not linked to any other products yet.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {allProducts
                    .filter((p) => (project.related_product_ids || []).includes(p.id))
                    .map((p) => (
                      <span key={p.id} className="text-xs px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground">
                        {p.title}
                      </span>
                    ))}
                </div>
              )}
            </div>

            <CustomFieldsSection
              entity={project}
              entityType="project"
              area={area}
              onUpdateEntity={(data) => updateProject.mutate({ id: project.id, data })}
              onUpdateArea={(data) => updateArea.mutate({ id: area.id, data })}
              areaScopeLabel="All projects in this area"
              entityScopeLabel="This project only"
            />

            <AttachmentsAndLinks
              project={project}
              onSave={(data) => updateProject.mutate({ id: project.id, data })}
            />

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">Tasks</p>
              <div className="border border-border rounded-lg overflow-x-auto bg-card shadow-sm">
                <TaskTable project={project} />
              </div>

              <button
                onClick={() => setShowArchivedTasks((v) => !v)}
                className="mt-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {showArchivedTasks ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                Archived tasks
              </button>
              {showArchivedTasks && (
                <div className="mt-2">
                  <ArchivedTaskList projectId={project.id} />
                </div>
              )}
            </div>

          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-border bg-muted/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  confirmThen("Are you sure you want to delete this project?", () => {
                    deleteProject.mutate(project.id);
                    onClose();
                  })
                }
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

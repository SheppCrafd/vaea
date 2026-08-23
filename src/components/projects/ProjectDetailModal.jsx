import { useEffect, useState } from "react";
import { X, Archive, RotateCcw, ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import { DeleteButton } from "@/components/ui/delete-button";
import { Select } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import Modal from "@/components/shared/Modal";
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
import DateField from "@/components/shared/DateField";
import { DUE_DATE_STATUS_OPTIONS, METRIC_FIELDS } from "@/lib/projectUtils";

export default function ProjectDetailModal({ project, onClose }) {
  const navigate = useNavigate();
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

  const riskNotes = notes.filter((n) => n.type === "RISK");
  const questionNotes = notes.filter((n) => n.type === "QUESTION");
  const generalNotes = notes.filter((n) => n.type === "NOTE");

  const saveMetric = (key, value) => {
    updateProject.mutate({ id: project.id, data: { metrics: { ...project.metrics, [key]: value } } });
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      closeOnBackdropClick={false}
      label={project.title}
      overlayClassName="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      panelClassName="bg-card border border-border rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
    >
          {/* Header */}
          <div className="flex items-start justify-between p-6 border-b border-border bg-muted/30">
            <div className="flex-1 mr-4">
              <EditableText
                value={project.title}
                onSave={(val) => updateProject.mutate({ id: project.id, data: { title: val } })}
                aria-label="Project title"
                className="text-2xl font-bold font-heading mb-2 w-full"
              />
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Owner:</span>
                  <EditableText
                    value={project.owner_name || "Unassigned"}
                    onSave={(val) => updateProject.mutate({ id: project.id, data: { owner_name: val } })}
                    aria-label="Owner"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Due:</span>
                  <DateField
                    value={project.due_date}
                    onSave={(val) => updateProject.mutate({ id: project.id, data: { due_date: val } })}
                    aria-label="Due date"
                  />
                  <Select
                    value={project.due_date_status || "ESTIMATED"}
                    onChange={(e) => updateProject.mutate({ id: project.id, data: { due_date_status: e.target.value } })}
                    aria-label="Due date status"
                    className="bg-transparent px-1.5 py-0.5 text-xs ml-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    options={DUE_DATE_STATUS_OPTIONS.map((opt) => ({ value: opt, label: opt }))}
                  />
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                navigate("/app/chat", {
                  state: {
                    initialMessage: `Brief me on "${project.title}". What's the current status, which tasks are open or overdue, and is there anything that needs my attention?`,
                  },
                });
              }}
              aria-label="Ask Vaea about this project"
              title="Brief me on this project"
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Brief me
            </button>
            <button onClick={onClose} aria-label="Close" className="p-2 hover:bg-secondary rounded-full transition-colors shrink-0">
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label htmlFor="project-detail-objective" className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider block">Objective</label>
                <EditableText
                  id="project-detail-objective"
                  value={project.objective}
                  onSave={(val) => updateProject.mutate({ id: project.id, data: { objective: val } })}
                  placeholder="No objective set"
                  className="text-sm"
                  multiline
                />
              </div>
              <div>
                <label htmlFor="project-detail-problem-statement" className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider block">Problem Statement</label>
                <EditableText
                  id="project-detail-problem-statement"
                  value={project.problem_statement}
                  onSave={(val) => updateProject.mutate({ id: project.id, data: { problem_statement: val } })}
                  placeholder="No problem statement set"
                  className="text-sm"
                  multiline
                />
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Impact & Outcome Metrics</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {METRIC_FIELDS.map(({ key, label }) => (
                  <div key={key}>
                    <label htmlFor={`project-metric-${key}`} className="text-[10px] text-muted-foreground block mb-0.5">{label}</label>
                    <EditableText
                      id={`project-metric-${key}`}
                      value={project.metrics?.[key] || ""}
                      onSave={(val) => saveMetric(key, val)}
                      placeholder="—"
                      className="text-xs bg-background border border-border rounded px-1.5 py-1"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Risks and Open Questions are separate ProjectNote types, each
                  its own plain section — matching every other section in this
                  modal (Objective, Notes, Stakeholders, ...), none of which
                  are boxed/tinted. The tint-when-populated treatment lives on
                  the compact ProjectCard face, not here. */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Risks</p>
                <ProjectNotes notes={riskNotes} allStakeholders={allStakeholders} />
                <AddNoteForm
                  projectId={project.id}
                  allStakeholders={allStakeholders}
                  defaultType="RISK"
                  allowedTypes={["RISK"]}
                />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Open Questions</p>
                <ProjectNotes notes={questionNotes} allStakeholders={allStakeholders} />
                <AddNoteForm
                  projectId={project.id}
                  allStakeholders={allStakeholders}
                  defaultType="QUESTION"
                  allowedTypes={["QUESTION"]}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Stakeholders Section with Assigner Dropdown */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Project Stakeholders</p>
                  <StakeholderAssigner
                    currentStakeholderIds={project.stakeholder_ids || []}
                    allStakeholders={allStakeholders}
                    onSave={(newIds) => updateProject.mutate({ id: project.id, data: { stakeholder_ids: newIds } })}
                    forceAddIcon
                    label="Add Stakeholders"
                  />
                </div>

                {departments.length === 0 ? (
                  <p className="text-sm text-muted-foreground bg-secondary/20 p-3 rounded-lg border border-border text-center">No stakeholders assigned yet.</p>
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

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Notes</p>
                <ProjectNotes notes={generalNotes} allStakeholders={allStakeholders} />
                <AddNoteForm
                  projectId={project.id}
                  allStakeholders={allStakeholders}
                  defaultType="NOTE"
                  allowedTypes={["NOTE"]}
                />
              </div>
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
                <p className="text-sm text-muted-foreground bg-secondary/20 p-3 rounded-lg border border-border text-center">
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
              <DeleteButton
                onClick={() =>
                  confirmThen(`Delete project "${project.title}"? This cannot be undone.`, () => {
                    deleteProject.mutate(project.id);
                    onClose();
                  })
                }
                label="Delete project"
                showLabel
                size="md"
              />
            </div>

            {project.is_archived ? (
              <button
                onClick={() => {
                  restoreProject.mutate(project.id);
                  onClose();
                }}
                className="text-xs flex items-center gap-1.5 bg-primary text-primary-foreground border border-border hover:bg-primary/90 px-4 py-2 rounded-md font-medium transition-colors shadow-sm"
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

    </Modal>
  );
}

import { useEffect } from "react";
import { X } from "lucide-react";
import { DeleteButton } from "@/components/ui/delete-button";
import Modal from "@/components/shared/Modal";
import { useStakeholders } from "@/hooks/useStakeholders";
import { useUpdateProduct, useDeleteProduct } from "@/hooks/useProducts";
import { useProjects } from "@/hooks/useProjects";
import { useTasksForProjects } from "@/hooks/useTasks";
import { useAreas, useUpdateArea } from "@/hooks/useAreas";
import { isTaskDone } from "@/lib/taskUtils";
import { confirmThen, sortByPosition } from "@/lib/entityUtils";
import EditableText from "@/components/shared/EditableText";
import StakeholderAssigner from "@/components/shared/StakeholderAssigner";
import CustomFieldsSection from "@/components/shared/CustomFieldsSection";
import ProjectCardFull from "@/components/projects/ProjectCardFull";

export default function ProductDetailModal({ product, onClose }) {
  const { data: allStakeholders = [] } = useStakeholders();
  const { data: allProjects = [] } = useProjects();
  const { data: allAreas = [] } = useAreas();
  const updateProduct = useUpdateProduct();
  const updateArea = useUpdateArea();
  const deleteProduct = useDeleteProduct();

  const stakeholders = allStakeholders.filter((s) => (product.stakeholder_ids || []).includes(s.id));
  const departments = [...new Set(stakeholders.map((s) => s.department))];
  const area = allAreas.find((a) => a.id === product.parent_area_id);

  const projects = sortByPosition(allProjects.filter((p) => p.parent_product_id === product.id));
  const projectIds = projects.map((p) => p.id);
  const { data: productTasks = [] } = useTasksForProjects(projectIds);
  const doneCount = productTasks.filter(isTaskDone).length;
  const completionPct = productTasks.length ? Math.round((doneCount / productTasks.length) * 100) : 0;

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <Modal
      isOpen
      onClose={onClose}
      closeOnBackdropClick={false}
      label={product.title}
      overlayClassName="fixed inset-0 bg-background z-50 overflow-y-auto"
    >
        <div className="flex items-center justify-between gap-3 p-6 border-b border-border sticky top-0 bg-background z-10">
          <EditableText
            value={product.title}
            onSave={(v) => updateProduct.mutate({ id: product.id, data: { title: v } })}
            className="font-heading text-xl font-semibold"
          />
          <button onClick={onClose} aria-label="Close" className="shrink-0"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 max-w-3xl mx-auto flex flex-col gap-6">
          <div>
            <label htmlFor="product-description" className="text-xs font-medium text-muted-foreground block mb-1">Description</label>
            <EditableText
              id="product-description"
              value={product.description}
              onSave={(v) => updateProduct.mutate({ id: product.id, data: { description: v } })}
              multiline
              placeholder="No description yet"
              className="text-sm bg-card border border-border rounded-md p-2"
            />
          </div>

          <div className="flex items-center justify-between border-t border-b border-border py-3">
            <div className="flex flex-col">
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Progress</span>
              <span className="text-sm font-bold text-primary">{completionPct}%</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Tasks</span>
              <span className="text-sm font-semibold text-foreground">{doneCount} <span className="text-muted-foreground font-normal">/ {productTasks.length}</span></span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Projects</span>
              <span className="text-sm font-semibold text-foreground">{projects.length}</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Stakeholders</p>
              <StakeholderAssigner
                currentStakeholderIds={product.stakeholder_ids || []}
                allStakeholders={allStakeholders}
                onSave={(newIds) => updateProduct.mutate({ id: product.id, data: { stakeholder_ids: newIds } })}
              />
            </div>
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

          <CustomFieldsSection
            entity={product}
            entityType="product"
            area={area}
            onUpdateEntity={(data) => updateProduct.mutate({ id: product.id, data })}
            onUpdateArea={(data) => updateArea.mutate({ id: area.id, data })}
            areaScopeLabel="All products in this area"
            entityScopeLabel="This product only"
          />

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">Projects</p>
            {projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">No projects yet.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {projects.map((project) => (
                  <ProjectCardFull key={project.id} project={project} stakeholderIds={product.stakeholder_ids} />
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-border pt-4">
            <DeleteButton
              onClick={() =>
                confirmThen(
                  `Delete product "${product.title}"? This will also delete all of its projects and their tasks. This cannot be undone.`,
                  () => {
                    deleteProduct.mutate(product.id);
                    onClose();
                  }
                )
              }
              label="Delete product"
              showLabel
              size="md"
            />
          </div>
        </div>
    </Modal>
  );
}

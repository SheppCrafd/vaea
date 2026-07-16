import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { Expand } from "lucide-react";
import { useFilter } from "@/lib/FilterContext";
import { useStakeholders } from "@/hooks/useStakeholders";
import { useProjects } from "@/hooks/useProjects";
import { useAllTasks } from "@/hooks/useTasks";
import { useUpdateProduct } from "@/hooks/useProducts";
import { useEditableField } from "@/hooks/useEditableField";
import { useHighlightDim } from "@/hooks/useHighlightDim";
import { isTaskDone } from "@/lib/taskUtils";
import EditableText from "@/components/shared/EditableText";
import AvatarStack from "@/components/products/AvatarStack";
import ProjectCard from "@/components/projects/ProjectCard";
import ProductDetailModal from "@/components/products/ProductDetailModal";
import TaskStatistics from "@/components/shared/TaskStatistics";

export default function ProductCard({ product }) {
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const { data: allStakeholders = [] } = useStakeholders();
  const { data: allProjects = [] } = useProjects();
  const { data: allTasks = [] } = useAllTasks();
  const { excludedIds } = useFilter();
  const updateProduct = useUpdateProduct();

  const { value: title, handleInput } = useEditableField(
    product.title,
    (value) => updateProduct.mutate({ id: product.id, data: { title: value } })
  );

  const stakeholders = allStakeholders.filter((st) => product.stakeholder_ids?.includes(st.id));
  const projects = allProjects.filter((p) => p.parent_product_id === product.id && !excludedIds.includes(p.id));

  const { setNodeRef, isOver } = useDroppable({ id: product.id, data: { type: "product", id: product.id } });

  // Mirrors the Area-level aggregation: a Product's own stakeholder_ids
  // alone isn't enough to decide whether it should dim, since a stakeholder
  // is just as often assigned directly to one of its projects as to the
  // product itself.
  const productStakeholderIds = [
    ...(product.stakeholder_ids || []),
    ...projects.flatMap((p) => p.stakeholder_ids || []),
  ];
  const isDimmed = useHighlightDim(productStakeholderIds, ["projects", "products"]);

  const projectIds = projects.map((p) => p.id);
  const productTasks = allTasks.filter((t) => projectIds.includes(t.project_id));
  const doneCount = productTasks.filter(isTaskDone).length;
  const completionPct = productTasks.length ? Math.round((doneCount / productTasks.length) * 100) : 0;

  return (
    <div
      ref={setNodeRef}
      data-product-card={product.id}
      className={`relative z-10 bg-card border border-border rounded-xl p-4 overflow-hidden ${isDimmed ? "opacity-30" : ""} ${isOver ? "ring-2 ring-primary ring-offset-1" : ""}`}
    >
      <button
        onClick={() => setIsDetailOpen(true)}
        className="absolute top-3 right-3 z-20 text-muted-foreground hover:text-foreground"
        aria-label="Expand product"
      >
        <Expand className="w-4 h-4" />
      </button>
      
      <div className="relative z-[1] min-w-0 pr-6">
        <h3 
          className="font-heading font-semibold break-words min-w-0 outline-none focus:ring-1 focus:ring-primary/40 rounded cursor-text"
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
        >
          {title}
        </h3>
        
        <div className="mt-0.5 min-w-0">
           <EditableText
             value={product.description}
             onSave={(v) => updateProduct.mutate({ id: product.id, data: { description: v } })}
             placeholder="Add a description..."
             className="text-xs text-muted-foreground break-words"
           />
        </div>
      </div>
      
      <div className="relative z-[1] mt-3 flex justify-center">
        <AvatarStack stakeholders={stakeholders} />
      </div>

      <div
        className={`relative z-[1] mt-4 space-y-2 min-h-[80px] rounded-lg p-2 transition-colors ${isOver ? "bg-primary/10 ring-2 ring-primary/40" : "bg-transparent"}`}
      >
        {projects.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">Drop a project here</p>
        ) : (
          projects.map((project) => (
            <ProjectCard key={project.id} project={project} stakeholderIds={product.stakeholder_ids} />
          ))
        )}
      </div>

      <TaskStatistics tasks={productTasks} />

      <div className="relative z-[1] mt-5 flex items-center justify-between border-t border-border pt-3 px-1">
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

      {(product.display_on_card_fields || []).length > 0 && (
        <div className="relative z-[1] mt-3 pt-3 border-t border-border flex flex-wrap gap-x-3 gap-y-1">
          {(product.display_on_card_fields || []).map((key) => {
            const field = product.custom_data?.[key];
            if (!field) return null;
            return (
              <span key={key} className="text-[10px] text-muted-foreground">
                <span className="font-medium text-foreground">{field.label}:</span> {field.value || "—"}
              </span>
            );
          })}
        </div>
      )}

      {isDetailOpen && <ProductDetailModal product={product} onClose={() => setIsDetailOpen(false)} />}
    </div>
  );
}
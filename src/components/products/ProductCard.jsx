import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { Expand } from "lucide-react";
import { useFilter } from "@/lib/FilterContext";
import { useStakeholders } from "@/hooks/useStakeholders";
import { useProjects } from "@/hooks/useProjects";
import { useAllTasks } from "@/hooks/useTasks";
import { useUpdateProduct } from "@/hooks/useProducts";
import { useEditableField } from "@/hooks/useEditableField";
import { useHighlightMatch } from "@/hooks/useHighlightDim";
import EditableText from "@/components/shared/EditableText";
import CardCustomFields from "@/components/shared/CardCustomFields";
import StakeholderAssigner from "@/components/shared/StakeholderAssigner";
import ProjectsGrid from "@/components/shared/ProjectsGrid";
import ProductDetailModal from "@/components/products/ProductDetailModal";
import TaskStatistics from "@/components/shared/TaskStatistics";

export default function ProductCard({ product }) {
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const { data: allStakeholders = [] } = useStakeholders();
  const { data: allProjects = [] } = useProjects();
  const { data: allTasks = [] } = useAllTasks();
  const { excludedIds } = useFilter();
  const updateProduct = useUpdateProduct();

  const { value: title, handleInput, handleBlur: handleTitleBlur, handleKeyDown: handleTitleKeyDown } = useEditableField(
    product.title,
    (value) => updateProduct.mutate({ id: product.id, data: { title: value } })
  );

  const projects = allProjects.filter((p) => p.parent_product_id === product.id && !excludedIds.includes(p.id));

  const { setNodeRef, isOver } = useDroppable({ id: product.id, data: { type: "product", id: product.id } });

  // Only the Product's own direct stakeholders, only the "products"
  // category — a match shouldn't cascade up from a child Project's own
  // highlight, per direct feedback that only the actual matching card
  // should visually react, not everything containing it.
  const isMatched = useHighlightMatch(product.stakeholder_ids || [], "products");

  const projectIds = projects.map((p) => p.id);
  const productTasks = allTasks.filter((t) => projectIds.includes(t.project_id));

  // The Area's products row is a CSS grid (`auto-fit`/`minmax`) — it decides
  // how many Products fit per row and how wide each one's column is (growing
  // to fill leftover space when there's room, wrapping to a new row when
  // there isn't). This card just needs to stretch to fill that column.
  const sizingClass = "flex flex-col";

  // A Product sits nested one level inside its Area card (which already owns
  // the elevated bg-card/shadow-md surface) — a recessed muted surface here
  // (no shadow of its own) reads as "inset into" the parent rather than a
  // second identical elevated card stacked on top of it, matching the same
  // recessed treatment AreaCard already uses for its own "Direct Projects"
  // drop zone.
  return (
    <div
      ref={setNodeRef}
      data-product-card={product.id}
      className={`relative z-10 bg-muted/40 border border-border/70 rounded-xl p-4 overflow-hidden ${sizingClass} ${isMatched ? "bg-primary/10 ring-1 ring-primary/30" : ""} ${isOver ? "ring-2 ring-primary ring-offset-1" : ""}`}
    >
      <button
        onClick={() => setIsDetailOpen(true)}
        className="absolute top-3 right-3 z-20 text-muted-foreground hover:text-foreground hover:bg-card p-1 rounded-md transition-colors"
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
          onBlur={handleTitleBlur}
          onKeyDown={handleTitleKeyDown}
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
        <StakeholderAssigner
          currentStakeholderIds={product.stakeholder_ids || []}
          allStakeholders={allStakeholders}
          onSave={(newIds) => updateProduct.mutate({ id: product.id, data: { stakeholder_ids: newIds } })}
        />
      </div>

      <ProjectsGrid
        projects={projects}
        stakeholderIds={product.stakeholder_ids}
        emptyMessage="Drop a project here"
        gap={8}
        className={`relative z-[1] mt-4 min-h-[80px] rounded-lg p-2 transition-colors ${isOver ? "bg-primary/10 ring-2 ring-primary/40" : "bg-transparent"}`}
      />

      <TaskStatistics tasks={productTasks} />

      <CardCustomFields
        entity={product}
        onUpdateEntity={(data) => updateProduct.mutate({ id: product.id, data })}
        className="relative z-[1] mt-3 pt-3 border-t border-border flex flex-wrap gap-x-3 gap-y-1"
      />

      {isDetailOpen && <ProductDetailModal product={product} onClose={() => setIsDetailOpen(false)} />}
    </div>
  );
}
import { memo, useState, lazy, Suspense } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { Expand, GripVertical } from "lucide-react";
import { DeleteButton } from "@/components/ui/delete-button";
import { useFilter } from "@/lib/FilterContext";
import { useProjects } from "@/hooks/useProjects";
import { useTasksForProjects } from "@/hooks/useTasks";
import { useUpdateProduct, useDeleteProduct } from "@/hooks/useProducts";
import { useEditableField } from "@/hooks/useEditableField";
import { useHighlightMatch } from "@/hooks/useHighlightDim";
import { confirmThen, sortByPosition } from "@/lib/entityUtils";
import EditableText from "@/components/shared/EditableText";
import EditableTitle from "@/components/shared/EditableTitle";
import CardCustomFields from "@/components/shared/CardCustomFields";
import ProjectsGrid from "@/components/shared/ProjectsGrid";
import TaskStatistics from "@/components/shared/TaskStatistics";
import ProductCardShell from "@/components/products/ProductCardShell";

// Lazy: only needed once a user opens the detail view, not on the initial
// card-grid render — same reasoning as Dashboard.jsx's modal imports.
const ProductDetailModal = lazy(() => import("@/components/products/ProductDetailModal"));

function ProductCard({ product, forceFullProjects = false }) {
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const { data: allProjects = [] } = useProjects();
  const { excludedIds } = useFilter();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const { value: title, handleInput, handleBlur: handleTitleBlur, handleKeyDown: handleTitleKeyDown } = useEditableField(
    product.title,
    (value) => updateProduct.mutate({ id: product.id, data: { title: value } })
  );

  const projects = sortByPosition(allProjects.filter((p) => p.parent_product_id === product.id && !excludedIds.includes(p.id)));

  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `product-drop-${product.id}`, data: { type: "product", id: product.id } });
  // Draggable so a Product can be dragged to reorder within its Area, or
  // dropped on a Product/Area in a different one to move there — the exact
  // same mechanic Projects already have onto Products/Areas, one level up
  // (see useGlobalDragEnd.js). The whole card is both the drag source and
  // the existing drop target (a Project being reparented onto this Product),
  // same dual-ref pattern ProjectCard already uses.
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: product.id,
    data: { type: "product", id: product.id, title: product.title },
  });
  const setNodeRef = (node) => {
    setDropRef(node);
    setDragRef(node);
  };

  // Only the Product's own direct stakeholders, only the "products"
  // category — a match shouldn't cascade up from a child Project's own
  // highlight, per direct feedback that only the actual matching card
  // should visually react, not everything containing it.
  const isMatched = useHighlightMatch(product.stakeholder_ids || [], "products");

  const projectIds = projects.map((p) => p.id);
  const { data: productTasks = [] } = useTasksForProjects(projectIds);

  const handleDelete = () => {
    confirmThen(
      `Delete product "${product.title}"? This will also delete all of its projects and their tasks. This cannot be undone.`,
      () => deleteProduct.mutate(product.id)
    );
  };

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
    <ProductCardShell
      rootRef={setNodeRef}
      style={{ opacity: isDragging ? 0.4 : 1 }}
      rootProps={{ "data-product-card": product.id }}
      className={`${sizingClass} ${isMatched ? "bg-primary/10 ring-1 ring-primary/30" : ""} ${isOver ? "ring-2 ring-primary ring-offset-1" : ""}`}
      dragHandle={
        <div
          className="absolute top-1.5 left-1.5 z-20 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1.5"
          aria-label="Drag to reorder product"
          title="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-4 h-4" />
        </div>
      }
      expandButton={
        <button
          onClick={() => setIsDetailOpen(true)}
          className="text-muted-foreground hover:text-foreground hover:bg-card p-1.5 rounded-md transition-colors"
          title="Expand Product"
          aria-label="Expand product"
        >
          <Expand className="w-4 h-4" />
        </button>
      }
      deleteButton={<DeleteButton onClick={handleDelete} label="Delete product" size="md" className="p-1.5 rounded-md" />}
      title={
        <EditableTitle
          as="h3"
          value={title}
          onInput={handleInput}
          onBlur={handleTitleBlur}
          onKeyDown={handleTitleKeyDown}
          tooltip={title}
          className="font-heading font-semibold min-w-0 cursor-text"
        />
      }
      description={
        <EditableText
          value={product.description}
          onSave={(v) => updateProduct.mutate({ id: product.id, data: { description: v } })}
          placeholder="Add a description..."
          className="text-xs text-muted-foreground break-words"
        />
      }
      // No StakeholderAssigner here, deliberately — Product cards are the
      // one card type without the inline (+) assign control, per design
      // review; assignment still works by dragging a stakeholder from the
      // sidebar onto the card, or through ProductDetailModal.
      projectsGrid={
        <ProjectsGrid
          projects={projects}
          stakeholderIds={product.stakeholder_ids}
          emptyMessage="Drop a project here"
          gap={8}
          forceView={forceFullProjects ? "full" : undefined}
          // `-mx-4` cancels this card's own p-4 for just this element, so a
          // Project tile's distance to this card's edge is ProjectsGrid's own
          // p-2 (8px) alone — not p-4 + p-2 (24px) stacked. That already
          // matches the 8px `gap` above exactly, so a tile's margin to the
          // Product card's wall reads the same as its gap to its neighbor.
          className={`relative z-[1] mt-4 min-h-[80px] rounded-lg -mx-4 p-2 transition-colors ${isOver ? "bg-primary/10 ring-2 ring-primary/40" : "bg-transparent"}`}
        />
      }
      stats={<TaskStatistics tasks={productTasks} />}
      customFields={
        <CardCustomFields
          entity={product}
          onUpdateEntity={(data) => updateProduct.mutate({ id: product.id, data })}
          className="relative z-[1] mt-3 pt-3 border-t border-foreground/[0.06] flex flex-wrap gap-x-3 gap-y-1"
        />
      }
    >
      {isDetailOpen && (
        <Suspense fallback={null}>
          <ProductDetailModal product={product} onClose={() => setIsDetailOpen(false)} />
        </Suspense>
      )}
    </ProductCardShell>
  );
}

export default memo(ProductCard);
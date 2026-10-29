import { memo, useMemo } from "react";
import { Expand, GripVertical, Plus } from "lucide-react";
import { DeleteButton } from "@/components/ui/delete-button";
import { useAppStore } from "@/lib/store";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { useUpdateArea, useDeleteArea } from "@/hooks/useAreas";
import { useTasksForProjects } from "@/hooks/useTasks";
import { useEditableField } from "@/hooks/useEditableField";
import { confirmThen } from "@/lib/entityUtils";
import { useCardView } from "@/lib/CardViewContext";
import EditableText from "@/components/shared/EditableText";
import EditableTitle from "@/components/shared/EditableTitle";
import CardCustomFields from "@/components/shared/CardCustomFields";
import ProductCard from "@/components/products/ProductCard";
import AreaProductsGrid from "@/components/shared/AreaProductsGrid";
import ProjectsGrid from "@/components/shared/ProjectsGrid";
import TaskStatistics from "@/components/shared/TaskStatistics";
import AreaCardShell from "@/components/areas/AreaCardShell";

// `stakeholderIds` (the full aggregated subtree, from Dashboard.jsx) is only
// used here to pass down to orphan ProjectCards as their empty-project
// fallback — the Area card itself never tints on a highlight match. There's
// no "areas" checkbox category, and per direct feedback a match shouldn't
// cascade upward through every ancestor of the card that actually matches;
// only that one card (e.g. the specific Project) should visually react.
function AreaCard({ area, products = [], orphanProjects = [], onExpand, stakeholderIds = [] }) {
  const updateArea = useUpdateArea();
  const deleteArea = useDeleteArea();
  const openCreateModal = useAppStore((s) => s.openCreateModal);
  const { cardView } = useCardView();

  const { setNodeRef, isOver } = useDroppable({ id: area.id, data: { type: "area", id: area.id } });

  // Draggable so Areas can be dragged to reorder the whole list (their only
  // possible "rearrange" — unlike Products/Projects, there's no parent
  // level above an Area to move into). A second, whole-card droppable
  // (distinct from the "Direct Projects" box above, which stays scoped to
  // accepting a dropped Project) so dropping an Area anywhere on another
  // Area's card — not just that one small box — reorders them; it shares
  // the same { type: "area", id } shape, so useGlobalDragEnd doesn't need
  // to know which of the two actually caught the drop.
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `area-drag-${area.id}`,
    data: { type: "area", id: area.id, title: area.title },
  });
  const { setNodeRef: setCardDropRef, isOver: isCardOver } = useDroppable({
    id: `area-drop-${area.id}`,
    data: { type: "area", id: area.id },
  });
  const setCardRefs = (node) => {
    setDragRef(node);
    setCardDropRef(node);
  };

  const { value: title, handleInput, handleBlur: handleTitleBlur, handleKeyDown: handleTitleKeyDown } = useEditableField(
    area.title,
    (value) => updateArea.mutate({ id: area.id, data: { title: value } })
  );

  const handleDelete = () => {
    confirmThen(
      `Delete area "${area.title}"? This will also delete all of its products and projects. This cannot be undone.`,
      () => deleteArea.mutate(area.id)
    );
  };

  // Calculate tasks belonging to this entire Area
  const areaProjectIds = useMemo(
    () => [
      ...products.flatMap((p) => p.projects?.map((proj) => proj.id) || []),
      ...orphanProjects.map((p) => p.id),
    ],
    [products, orphanProjects]
  );
  const { data: areaTasks = [] } = useTasksForProjects(areaProjectIds);

  return (
    <AreaCardShell
      rootRef={setCardRefs}
      style={{ opacity: isDragging ? 0.4 : 1 }}
      className={isCardOver ? "ring-2 ring-primary ring-offset-1 border-primary" : "border-foreground/[0.04]"}
      dragHandle={
        <div className="absolute top-0 left-0 z-20 flex items-center">
          <div
            className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1.5"
            aria-label="Drag to reorder area"
            title="Drag to reorder"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="w-4 h-4" />
          </div>
          <button
            type="button"
            onClick={() => openCreateModal("product", { parent_area_id: area.id })}
            className="text-muted-foreground hover:text-foreground p-1.5"
            title="Add a product to this area"
            aria-label="Add a product to this area"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      }
      expandButton={
        <button
          onClick={() => onExpand(area)}
          className="text-muted-foreground hover:text-foreground hover:bg-accent p-2 rounded-md transition-colors"
          title="Expand Area"
          aria-label="Expand Area"
        >
          <Expand className="w-4 h-4" />
        </button>
      }
      deleteButton={<DeleteButton onClick={handleDelete} label="Delete area" size="md" className="p-2 rounded-md" />}
      title={
        <EditableTitle
          as="h3"
          value={title}
          onInput={handleInput}
          onBlur={handleTitleBlur}
          onKeyDown={handleTitleKeyDown}
          tooltip={title}
          className="font-heading font-semibold text-lg pl-14 pr-16 min-w-0"
        />
      }
      description={
        <EditableText
          value={area.description}
          onSave={(v) => updateArea.mutate({ id: area.id, data: { description: v } })}
          placeholder="Add a description..."
          className="text-sm text-muted-foreground"
        />
      }
      productsGrid={
        products.length > 0 && (
        <AreaProductsGrid cardView={cardView}>
          {products.map((product) =>
            cardView === "full" ? (
              <div key={product.id} style={{ breakInside: "avoid", marginBottom: "16px" }}>
                <ProductCard product={product} />
              </div>
            ) : (
              <ProductCard key={product.id} product={product} />
            )
          )}
        </AreaProductsGrid>
        )
      }
      directProjects={
        <div
          ref={setNodeRef}
          className={`mt-2 p-4 rounded-xl transition-all ${isOver ? "bg-primary/10 shadow-[inset_0_0_0_2px_hsl(var(--primary)/0.6)]" : "bg-muted/40 shadow-[inset_0_0_0_1px_hsl(var(--foreground)/0.035)]"}`}
        >
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Projects not in a product
          </h4>
          <ProjectsGrid
            projects={orphanProjects}
            stakeholderIds={stakeholderIds}
            emptyMessage="Drop a project here to remove it from a product"
            gap={8}
            className="min-h-[50px]"
          />
        </div>
      }
      stats={<TaskStatistics tasks={areaTasks} />}
      customFields={
        <CardCustomFields
          entity={area}
          onUpdateEntity={(data) => updateArea.mutate({ id: area.id, data })}
          className="flex flex-wrap gap-x-3 gap-y-1"
        />
      }
    />
  );
}

export default memo(AreaCard);
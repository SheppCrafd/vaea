import { Trash2, Expand, GripVertical } from "lucide-react";
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
import ProjectsGrid from "@/components/shared/ProjectsGrid";
import TaskStatistics from "@/components/shared/TaskStatistics";

// `stakeholderIds` (the full aggregated subtree, from Dashboard.jsx) is only
// used here to pass down to orphan ProjectCards as their empty-project
// fallback — the Area card itself never tints on a highlight match. There's
// no "areas" checkbox category, and per direct feedback a match shouldn't
// cascade upward through every ancestor of the card that actually matches;
// only that one card (e.g. the specific Project) should visually react.
export default function AreaCard({ area, products = [], orphanProjects = [], onExpand, stakeholderIds = [] }) {
  const updateArea = useUpdateArea();
  const deleteArea = useDeleteArea();
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
  const areaProjectIds = [
    ...products.flatMap((p) => p.projects?.map((proj) => proj.id) || []),
    ...orphanProjects.map((p) => p.id),
  ];
  const { data: areaTasks = [] } = useTasksForProjects(areaProjectIds);

  return (
    <article
      ref={setCardRefs}
      style={{ opacity: isDragging ? 0.4 : 1 }}
      className={`relative z-10 bg-card border rounded-2xl shadow-md p-5 break-inside-avoid flex flex-col gap-4 transition-colors ${isCardOver ? "ring-2 ring-primary ring-offset-1 border-primary" : "border-foreground/[0.04]"}`}
    >

      <div className="relative">
        <div
          className="absolute top-0 left-0 z-20 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1.5"
          aria-label="Drag to reorder area"
          title="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-4 h-4" />
        </div>
        <div className="absolute top-0 right-0 flex items-center gap-1 z-20">
          <button
            onClick={onExpand}
            className="text-muted-foreground hover:text-foreground hover:bg-accent p-2 rounded-md transition-colors"
            title="Expand Area"
            aria-label="Expand Area"
          >
            <Expand className="w-4 h-4" />
          </button>
          <button
            onClick={handleDelete}
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 p-2 rounded-md transition-colors"
            title="Delete Area"
            aria-label="Delete Area"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <EditableTitle
          as="h3"
          value={title}
          onInput={handleInput}
          onBlur={handleTitleBlur}
          onKeyDown={handleTitleKeyDown}
          tooltip={title}
          className="font-heading font-semibold text-lg pl-6 pr-16 min-w-0"
        />
        <div className="mt-1 min-w-0">
          <EditableText
            value={area.description}
            onSave={(v) => updateArea.mutate({ id: area.id, data: { description: v } })}
            placeholder="Add a description..."
            className="text-sm text-muted-foreground"
          />
        </div>
      </div>

      {products.length > 0 && (
        <div
          className={`mt-2 grid items-start ${cardView === "mini" ? "-mx-5" : "gap-4"}`}
          // Full Cards' project card is a fixed 420px, and a Product needs
          // room for at least one without clipping it (420 + this card's
          // own p-4 padding ≈ 452px) — a 460px floor for Full mode. Full
          // mode keeps the old auto-fill/1fr growth: leftover row width
          // grows each Product's own column.
          //
          // Mini mode is a fixed 241px, never wider — 39px narrower than
          // the old 280px (which fit two 112px project tiles side by side
          // with zero slack). At 241px a Product only has room for one
          // 112px tile per row; a second tile wraps to the row below
          // instead of sitting beside the first. A Mini Product is always
          // exactly 241px regardless of how much row width is available.
          //
          // Since the card itself can't absorb leftover row width, that
          // width has to go somewhere else instead of vanishing or
          // recentering the block as a whole: `auto-fit` collapses any
          // trailing column no row actually uses (so the math below isn't
          // thrown off by phantom empty tracks), and `justify-content:
          // space-evenly` (Mini only, `gap` left at its default 0) splits
          // whatever's left into equal-size slices everywhere — left edge to
          // first Product, between each pair, and last Product to right edge
          // — so for N products there are N+1 identical gaps.
          //
          // The `-mx-5` (Mini only) is what makes that math come out even:
          // it cancels this Area card's own p-5 so the row's box spans the
          // card's full inner width instead of the padding-narrowed content
          // width. Without it, the left/right edges get p-5's fixed 20px
          // *plus* their space-evenly slice while the middle gaps only get
          // the slice — same slice size, but the edges come out ~20px
          // bigger, which reads as uneven even though the distribution math
          // was technically working. Bleeding the row out to the border and
          // letting space-evenly own 100% of the edge spacing keeps all N+1
          // gaps literally the same number, not just proportioned the same.
          //
          // Grid columns are shared across every row (not recomputed per
          // row), which is what makes row 2+ line up under row 1's columns
          // instead of re-centering as their own subset.
          style={{
            gridTemplateColumns:
              cardView === "full"
                ? `repeat(auto-fill, minmax(460px, 1fr))`
                : `repeat(auto-fit, 241px)`,
            ...(cardView === "mini" ? { justifyContent: "space-evenly" } : {}),
          }}
        >
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      <div 
        ref={setNodeRef}
        className={`mt-2 p-4 rounded-xl transition-all ${isOver ? "bg-primary/10 shadow-[inset_0_0_0_2px_hsl(var(--primary)/0.6)]" : "bg-muted/40 shadow-[inset_0_0_0_1px_hsl(var(--foreground)/0.035)]"}`}
      >
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Direct Projects
        </h4>
        <ProjectsGrid
          projects={orphanProjects}
          stakeholderIds={stakeholderIds}
          emptyMessage="Drop a project here to remove it from a product"
          gap={8}
          className="min-h-[50px]"
        />
      </div>

      <TaskStatistics tasks={areaTasks} />

      <CardCustomFields
        entity={area}
        onUpdateEntity={(data) => updateArea.mutate({ id: area.id, data })}
        className="flex flex-wrap gap-x-3 gap-y-1"
      />

    </article>
  );
}
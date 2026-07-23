import { Trash2, Expand } from "lucide-react";
import { useDroppable } from "@dnd-kit/core";
import { useUpdateArea, useDeleteArea } from "@/hooks/useAreas";
import { useAllTasks } from "@/hooks/useTasks";
import { useEditableField } from "@/hooks/useEditableField";
import { confirmThen } from "@/lib/entityUtils";
import { useCardView } from "@/lib/CardViewContext";
import EditableText from "@/components/shared/EditableText";
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

  const { data: allTasks = [] } = useAllTasks();

  const { setNodeRef, isOver } = useDroppable({ id: area.id, data: { type: "area", id: area.id } });

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
  const areaTasks = allTasks.filter((t) => areaProjectIds.includes(t.project_id));

  return (
    <article className="relative z-10 bg-card border border-border rounded-xl shadow-md p-5 break-inside-avoid flex flex-col gap-4">

      <div className="relative">
        <div className="absolute top-0 right-0 flex items-center gap-1 z-20">
          <button
            onClick={onExpand}
            className="text-muted-foreground hover:text-foreground hover:bg-accent p-1.5 rounded-md transition-colors"
            title="Expand Area"
            aria-label="Expand Area"
          >
            <Expand className="w-4 h-4" />
          </button>
          <button
            onClick={handleDelete}
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 p-1.5 rounded-md transition-colors"
            title="Delete Area"
            aria-label="Delete Area"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <h3
          className="font-heading font-semibold text-lg pr-16 outline-none focus:ring-1 focus:ring-primary/40 rounded break-words min-w-0"
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onBlur={handleTitleBlur}
          onKeyDown={handleTitleKeyDown}
        >
          {title}
        </h3>
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
          className="mt-2 grid items-start gap-4"
          // Full Cards' project card is a fixed 420px, and a Product needs
          // room for at least one without clipping it (420 + this card's
          // own p-4 padding ≈ 452px) — a 240px floor (fine for Mini Cards'
          // small tiles) can hand a Product a column too narrow for that in
          // Full mode, and the card's overflow-hidden clips the rest.
          //
          // auto-fill, not auto-fit: same reasoning as ProjectsGrid's Full
          // mode — auto-fit stretches a lone Product to consume the entire
          // row's width, wasting space where a sibling could otherwise land.
          // auto-fill reserves as many floor-width tracks as the row has
          // room for and splits leftover space across all of them (occupied
          // or not), so an existing Product only grows to roughly one
          // track's share. Areas deliberately don't get this — they're
          // always a single full-width column, never sharing a row with a
          // sibling Area to begin with.
          style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${cardView === "full" ? 460 : 240}px, 1fr))` }}
        >
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      <div 
        ref={setNodeRef}
        className={`mt-2 p-4 border rounded-lg transition-colors ${isOver ? "bg-primary/10 border-primary" : "border-border bg-muted/30"}`}
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
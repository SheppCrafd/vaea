import { Trash2, Expand } from "lucide-react";
import { useDroppable } from "@dnd-kit/core";
import { useUpdateArea, useDeleteArea } from "@/hooks/useAreas";
import { useAllTasks } from "@/hooks/useTasks";
import { useEditableField } from "@/hooks/useEditableField";
import { useHighlightDim } from "@/hooks/useHighlightDim";
import { confirmThen } from "@/lib/entityUtils";
import EditableText from "@/components/shared/EditableText";
import ProductCard from "@/components/products/ProductCard";
import ProjectCard from "@/components/projects/ProjectCard";
import TaskStatistics from "@/components/shared/TaskStatistics";

export default function AreaCard({ area, products = [], orphanProjects = [], productCount, onExpand, stakeholderIds = [] }) {
  const isDimmed = useHighlightDim(stakeholderIds, ["projects", "products"]);
  const updateArea = useUpdateArea();
  const deleteArea = useDeleteArea();

  const { data: allTasks = [] } = useAllTasks();

  const { setNodeRef, isOver } = useDroppable({ id: area.id, data: { type: "area", id: area.id } });

  const { value: title, handleInput } = useEditableField(
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
    <article className={`relative z-10 bg-card border border-border rounded-xl p-5 break-inside-avoid flex flex-col gap-4 ${isDimmed ? "opacity-30" : ""}`}>
      
      <div className="relative">
        <div className="absolute top-0 right-0 flex items-center gap-1 z-20">
          <button
            onClick={onExpand}
            className="text-muted-foreground hover:text-foreground p-1 transition-colors"
            title="Expand Area"
            aria-label="Expand Area"
          >
            <Expand className="w-4 h-4" />
          </button>
          <button
            onClick={handleDelete}
            className="text-muted-foreground hover:text-destructive p-1 transition-colors"
            title="Delete Area"
            aria-label="Delete Area"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <h3
          className="font-heading font-semibold text-lg pr-14 outline-none focus:ring-1 focus:ring-primary/40 rounded break-words min-w-0"
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
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
        <div className="flex flex-col gap-4 mt-2">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      <div 
        ref={setNodeRef}
        className={`mt-2 p-4 border border-dashed rounded-lg transition-colors ${isOver ? "bg-primary/10 border-primary" : "border-border bg-muted/30"}`}
      >
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Direct Projects
        </h4>
        <div className="flex flex-col gap-3 min-h-[50px]">
          {orphanProjects.length === 0 ? (
             <p className="text-xs text-muted-foreground text-center py-4">Drop a project here to remove it from a product</p>
          ) : (
            orphanProjects.map((project) => (
              <ProjectCard key={project.id} project={project} stakeholderIds={stakeholderIds} />
            ))
          )}
        </div>
      </div>

      <TaskStatistics tasks={areaTasks} />

      <div className="relative z-[1] mt-auto flex items-center justify-between border-t border-border pt-3 px-1">
        <div className="flex flex-col">
          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Products</span>
          <span className="text-sm font-bold text-primary">{productCount}</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Direct Projects</span>
          <span className="text-sm font-semibold text-foreground">{orphanProjects.length}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Total Projects</span>
          <span className="text-sm font-semibold text-foreground">
            {products.reduce((acc, p) => acc + (p.projects?.length || 0), 0) + orphanProjects.length}
          </span>
        </div>
      </div>

      {(area.display_on_card_fields || []).length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {(area.display_on_card_fields || []).map((key) => {
            const field = area.custom_data?.[key];
            if (!field) return null;
            return (
              <span key={key} className="text-[10px] text-muted-foreground">
                <span className="font-medium text-foreground">{field.label}:</span> {field.value || "—"}
              </span>
            );
          })}
        </div>
      )}

    </article>
  );
}
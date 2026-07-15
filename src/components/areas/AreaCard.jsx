import { useState, useEffect } from "react";
import { Trash2 } from "lucide-react"; 
import { useDroppable } from "@dnd-kit/core"; 
import { useHighlight } from "@/lib/HighlightContext";
import { useUpdateArea, useDeleteArea } from "@/hooks/useAreas";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import EditableText from "@/components/shared/EditableText";
import ProductCard from "@/components/products/ProductCard"; 
import ProjectCard from "@/components/projects/ProjectCard"; 

export default function AreaCard({ area, products = [], orphanProjects = [], productCount, onExpand, stakeholderIds = [] }) {
  const { highlightedIds } = useHighlight();
  const isDimmed = highlightedIds.length > 0 && !stakeholderIds.some((id) => highlightedIds.includes(id));
  const updateArea = useUpdateArea();
  const deleteArea = useDeleteArea();
  const [title, setTitle] = useState(area.title);

  // Setup the drop zone for the Area (to catch projects dragged OUT of products)
  const { setNodeRef, isOver } = useDroppable({ id: area.id });

  useEffect(() => setTitle(area.title), [area.title]);

  const debouncedSave = useDebouncedCallback(
    (value) => updateArea.mutate({ id: area.id, data: { title: value } }),
    500
  );

  const handleInput = (e) => {
    const value = e.currentTarget.textContent;
    setTitle(value);
    debouncedSave(value);
  };

  const handleDelete = () => {
    if (window.confirm(`Delete area "${area.title}"? This will also delete all of its products and projects. This cannot be undone.`)) {
      deleteArea.mutate(area.id);
    }
  };

  return (
    <article className={`relative z-10 bg-card border border-border rounded-xl p-5 break-inside-avoid flex flex-col gap-4 ${isDimmed ? "opacity-30" : ""}`}>
      
      {/* Header Section */}
      <div className="relative">
        <div className="absolute top-0 right-0 flex items-center gap-1 z-20">
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
          className="font-heading font-semibold text-lg pr-8 outline-none focus:ring-1 focus:ring-primary/40 rounded break-words min-w-0"
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

      {/* VISUAL NESTING: Render Products */}
      {products.length > 0 && (
        <div className="flex flex-col gap-4 mt-2">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {/* VISUAL NESTING: Render Orphan Projects (Direct Zone / Drop Target) */}
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

      {/* --- STATS ON CARD (Moved to bottom, matching Product/Project Layout) --- */}
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

    </article>
  );
}
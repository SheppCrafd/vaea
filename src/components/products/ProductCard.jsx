import { useDroppable } from "@dnd-kit/core";
import { useAppStore } from "@/lib/store";
import { useHighlight } from "@/lib/HighlightContext";
import AvatarStack from "@/components/products/AvatarStack";
import ConnectionLines from "@/components/products/ConnectionLines";
import ProjectCard from "@/components/projects/ProjectCard";

export default function ProductCard({ product }) {
  const stakeholders = useAppStore((s) => s.stakeholders.filter((st) => product.stakeholderIds.includes(st.id)));
  const projects = useAppStore((s) => s.projects.filter((p) => product.projectIds.includes(p.id)));
  const { setNodeRef, isOver } = useDroppable({ id: product.id });
  const { highlightedIds } = useHighlight();
  const isDimmed = highlightedIds.length > 0 && !product.stakeholderIds.some((id) => highlightedIds.includes(id));

  return (
    <div className={`relative bg-card border border-border rounded-xl p-4 overflow-hidden ${isDimmed ? "opacity-30" : ""}`}>
      <ConnectionLines />
      <div className="relative flex items-center justify-between" style={{ zIndex: 1 }}>
        <h3 className="font-heading font-semibold">{product.name}</h3>
        <AvatarStack stakeholders={stakeholders} />
      </div>

      <div
        ref={setNodeRef}
        className={`relative mt-4 space-y-2 min-h-[80px] rounded-lg p-2 transition-colors ${isOver ? "bg-primary/10 ring-2 ring-primary/40" : "bg-transparent"}`}
        style={{ zIndex: 1 }}
      >
        {projects.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">Drop a project here</p>
        ) : (
          projects.map((project) => (
            <ProjectCard key={project.id} project={project} stakeholderIds={product.stakeholderIds} />
          ))
        )}
      </div>

      <p className="relative text-xs text-muted-foreground mt-3" style={{ zIndex: 1 }}>
        {product.completionPct}% complete
      </p>
    </div>
  );
}
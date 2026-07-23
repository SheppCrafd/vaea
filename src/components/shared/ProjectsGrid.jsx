import { useCardView } from "@/lib/CardViewContext";
import ProjectCard from "@/components/projects/ProjectCard";
import ProjectCardFull from "@/components/projects/ProjectCardFull";

// Projects fill whatever space their parent (a Product, or an Area's own
// "Direct Projects" zone) gives them — same CSS grid (auto-fit/minmax)
// approach at both card-view sizes, just a different floor: Full Cards'
// real, editable card floors at 420px (its old fixed width); Mini Cards'
// small square tile floors at 112px (its old fixed w-28/h-28). Either way,
// existing tiles grow via 1fr before a new row starts, rather than the grid
// leaving leftover space unused. Shared here rather than duplicated in
// ProductCard/AreaCard, since both need the exact same Full-vs-Mini
// branching.
export default function ProjectsGrid({ projects, stakeholderIds, emptyMessage, gap, className = "" }) {
  const { cardView } = useCardView();

  if (projects.length === 0) {
    return emptyMessage ? (
      <p className={`w-full text-xs text-muted-foreground text-center py-4 ${className}`}>{emptyMessage}</p>
    ) : (
      <div className={className} />
    );
  }

  if (cardView === "full") {
    return (
      <div
        className={className}
        style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(420px, 1fr))`, alignItems: "start", gap: `${gap}px` }}
      >
        {projects.map((project) => (
          <ProjectCardFull key={project.id} project={project} stakeholderIds={stakeholderIds} />
        ))}
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(112px, 1fr))`, alignItems: "start", gap: `${gap}px` }}
    >
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} stakeholderIds={stakeholderIds} />
      ))}
    </div>
  );
}

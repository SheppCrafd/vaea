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
//
// Full mode uses `auto-fill`, not `auto-fit`: with `auto-fit`, a row with
// fewer cards than could physically fit stretches those cards to consume
// 100% of the row (a single 420px-floor Full card in a 1600px-wide row
// balloons to fill all 1600px, mostly empty space). `auto-fill` reserves
// as many 420px-floor tracks as the row has room for and splits the
// leftover width evenly across all of them — including the empty ones —
// so an existing card only grows to roughly one track's share, leaving
// room for a sibling to land in the same row instead of stretching alone.
// Mini mode deliberately keeps `auto-fit`: its tiles are meant to grow to
// fill the row when there's nothing else to show yet.
//
// `forceView`, when set, overrides the dashboard's Mini/Full toggle —
// AreaModal passes "full" down through a Product's own ProjectsGrid so an
// expanded Area always shows full project cards underneath it, regardless
// of what the dashboard behind it is currently toggled to.
export default function ProjectsGrid({ projects, stakeholderIds, emptyMessage, gap, className = "", forceView }) {
  const { cardView: dashboardCardView } = useCardView();
  const cardView = forceView || dashboardCardView;

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
        style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(420px, 1fr))`, alignItems: "start", gap: `${gap}px` }}
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

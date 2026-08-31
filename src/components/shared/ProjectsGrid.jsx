import { useCardView } from "@/lib/CardViewContext";
import ProjectCard from "@/components/projects/ProjectCard";
import ProjectCardFull from "@/components/projects/ProjectCardFull";

// Projects fill whatever space their parent (a Product, or an Area's own
// "Direct Projects" zone) gives them, but the two card views want opposite
// things from that space: Full Cards are real, editable cards meant to grow
// (floors at 420px, its old fixed width, then shares leftover row width via
// 1fr). Mini Cards are a small square tile sized to its own content — grip,
// title, the 2x2 quadrant grid, the flag icons, the stats bar — not to
// whatever the grid track happens to be, so it stays a fixed 112px (its old
// w-28/h-28 size) instead of ballooning into mostly-empty space when a row
// has few cards. `auto-fill` (not `auto-fit`) is what makes the fixed-width
// case work at all: it reserves as many 112px tracks as the row has room
// for, so cards land side by side instead of one card centering itself
// alone in the whole row. Shared here rather than duplicated in
// ProductCard/AreaCard, since both need the exact same Full-vs-Mini
// branching.
//
// Full mode's `auto-fill`-with-`1fr` combination exists for a different
// reason than Mini's: with `auto-fit`, a row with fewer cards than could
// physically fit stretches those cards to consume 100% of the row (a single
// 420px-floor Full card in a 1600px-wide row balloons to fill all 1600px).
// `auto-fill` reserves as many 420px-floor tracks as the row has room for
// and splits the leftover width evenly across all of them — including the
// empty ones — so an existing card only grows to roughly one track's share.
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
    // Masonry, not a strict grid: a strict grid makes every row as tall as
    // its tallest card and leaves dead space under the short ones. CSS
    // multi-column packs each card straight up under the one above it in
    // its column (`break-inside: avoid` keeps a card whole), and
    // `column-width` still adds/removes columns responsively. Reading order
    // becomes column-major — the trade the backlog's "tuck under the cards
    // above" note accepts.
    return (
      <div
        className={className}
        style={{ columnWidth: "420px", columnGap: `${gap}px` }}
      >
        {projects.map((project) => (
          <div key={project.id} style={{ breakInside: "avoid", marginBottom: `${gap}px` }}>
            <ProjectCardFull project={project} stakeholderIds={stakeholderIds} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, 112px)`, alignItems: "start", gap: `${gap}px` }}
    >
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} stakeholderIds={stakeholderIds} />
      ))}
    </div>
  );
}

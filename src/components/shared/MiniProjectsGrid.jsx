import SmoothHeight from "@/components/shared/SmoothHeight";

// The Mini Cards grid of project tiles: fixed 112px tiles, `auto-fill` so
// tiles sit side by side instead of one tile centring alone in a row (see
// ProjectsGrid.jsx for the full reasoning). It grows smoothly when a tile
// is added (SmoothHeight).
//
// Its own module so the app (ProjectsGrid, with real ProjectCards) and the
// marketing board demo (with sample tiles) render this exact component,
// never a copy of its markup.
export default function MiniProjectsGrid({ className = "", gap, children }) {
  return (
    <SmoothHeight>
      <div
        className={className}
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, 112px)", alignItems: "start", gap: `${gap}px` }}
      >
        {children}
      </div>
    </SmoothHeight>
  );
}

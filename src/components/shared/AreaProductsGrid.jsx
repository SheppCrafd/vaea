// An Area card's row of Product cards. Its own module so the app (AreaCard,
// with real ProductCards) and the marketing board demo (with sample
// products) render this exact component, never a copy of its markup.
export default function AreaProductsGrid({ cardView, ref, children }) {
  return (
    <div
      ref={ref}
      className={`mt-2 ${cardView === "mini" ? "grid items-start -mx-5" : ""}`}
      // Full Cards' project card is a fixed 420px, and a Product needs
      // room for at least one without clipping it (420 + this card's
      // own p-4 padding ≈ 452px) — a 460px floor for Full mode. Full
      // mode keeps the old auto-fill/1fr growth: leftover row width
      // grows each Product's own column.
      //
      // Mini mode is a fixed 248px, never wider. Was 280px, restored
      // from an earlier 241px on direct instruction to bring back the
      // two-tile guarantee below — but measured against the real
      // rendered DOM (getBoundingClientRect, not hand math), 280px
      // actually left a genuine 40px of dead space after the second
      // tile: ProjectsGrid's own p-2 (8px) is applied on top of this
      // card's `-mx-4`-cancelled padding, so the true zero-slack width
      // is 112 + 112 (two tiles) + 8 (inter-tile gap) + 16 (the grid's
      // own 8px padding each side) = 248, not 280. A third tile still
      // wraps to the row below at 248 (three tiles would need 352). A
      // Mini Product is always exactly 248px regardless of how much row
      // width is available.
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
      style={
        cardView === "full"
          ? // Masonry (see ProjectsGrid.jsx): short products let the next
            // one slide straight up underneath instead of waiting for the
            // whole row, so "Measurement/Insights" no longer leaves dead
            // space under it next to a tall "Team Management".
            { columnWidth: "460px", columnGap: "16px" }
          : {
              gridTemplateColumns: `repeat(auto-fit, 248px)`,
              justifyContent: "space-evenly",
            }
      }
    >
      {children}
    </div>
  );
}

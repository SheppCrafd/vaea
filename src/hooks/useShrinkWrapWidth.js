import { useLayoutEffect } from "react";

// Plain CSS can't make a wrapping flex container hug its own tightest
// possible (post-wrap) footprint — `width: fit-content` is defined as the
// sum of all children's widths as if nothing wrapped, so the instant a
// row's worth of children exceeds the available space, fit-content just
// gives up and the box falls back to filling all available width instead
// of the (usually much narrower) width its actual multi-row layout needs.
//
// This hook re-runs the same greedy line-breaking algorithm flex-wrap
// itself uses, against each child's own already-intrinsic width (a flex
// item's width doesn't change based on whether it currently sits in a
// wrapped or unwrapped row, so no measurement trick is needed to read it),
// and sets the container's explicit width to the widest resulting row —
// the narrowest width that reproduces the *exact same wrap*, so nothing
// about the visible layout changes, only the box's own footprint shrinks
// to match it. Applied directly to a `flex flex-wrap` container; the CSS
// `w-fit` on its own ancestor card then naturally hugs this now-definite
// width, no JS needed at that level.
//
// Re-runs on every render (deliberately no dependency array) since content
// changing — a task added, a project created — is exactly when the
// wrapping needs to be re-evaluated; it's cheap (a handful of
// getBoundingClientRect calls) and idempotent (mutates DOM style directly,
// never triggers React state, so it can't loop).
export function useShrinkWrapWidth(containerRef, { gap = 0 } = {}) {
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const recompute = () => {
      const parent = container.parentElement;
      if (!parent) return;

      // Release any previously-set width before measuring "available" —
      // otherwise, if this container's own prior width was what was
      // constraining its parent's size, that stale value would be read
      // back as the available space, potentially under-counting room that
      // actually opened up (e.g. a sibling shrank, a new child was added
      // and the parent's true CSS-computed width is wider than last time).
      container.style.width = "";
      const available = parent.getBoundingClientRect().width;
      const children = Array.from(container.children);
      if (children.length === 0) {
        return;
      }

      // `width` (with the project's global border-box sizing) covers
      // padding+border too, not just the content area the children's own
      // widths occupy — a container with e.g. `p-2` needs its own padding
      // added back on top of the children's summed width, or the content
      // box ends up a few px too narrow to fit what should just barely fit,
      // wrapping one item that shouldn't have needed to.
      const style = getComputedStyle(container);
      const boxExtra =
        parseFloat(style.paddingLeft || "0") +
        parseFloat(style.paddingRight || "0") +
        parseFloat(style.borderLeftWidth || "0") +
        parseFloat(style.borderRightWidth || "0");
      const availableContent = available - boxExtra;

      const widths = children.map((c) => c.getBoundingClientRect().width);
      let rowWidth = 0;
      let maxRowWidth = 0;
      for (const w of widths) {
        if (rowWidth === 0) {
          rowWidth = w;
        } else if (rowWidth + gap + w <= availableContent) {
          rowWidth += gap + w;
        } else {
          maxRowWidth = Math.max(maxRowWidth, rowWidth);
          rowWidth = w;
        }
      }
      // NOT clamped to `availableContent`: maxRowWidth is already <= it by
      // construction whenever more than one item shares a row, but a single
      // item wider than the available content area legitimately needs its
      // own full width — clamping that down (e.g. during an early pass
      // before an ancestor has grown to its real size, when `available` is
      // transiently too small) would shrink the container below what its
      // own content needs.
      maxRowWidth = Math.max(maxRowWidth, rowWidth);

      // Convert the content-box result back to the border-box `width` the
      // style property actually sets, adding the container's own
      // padding/border back on.
      container.style.width = `${maxRowWidth + boxExtra}px`;
    };

    recompute();

    // Re-measure on parent resize (sidebar toggle, window resize, a
    // sibling card changing size) and on any child resizing (its own
    // content changing height/width) — either can change how many fit per
    // row.
    const resizeObserver = new ResizeObserver(recompute);
    resizeObserver.observe(container.parentElement);
    Array.from(container.children).forEach((child) => resizeObserver.observe(child));

    return () => resizeObserver.disconnect();
  });
}

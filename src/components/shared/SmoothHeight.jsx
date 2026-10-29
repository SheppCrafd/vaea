import { useLayoutEffect, useRef } from "react";

// Grows or shrinks to fit its content over about half a second instead of
// jumping: a Product card extends smoothly when a project is added to it.
//
// Height and clipping are written straight to the DOM from a ResizeObserver
// callback, which runs after layout and before paint, so the new content
// never shows outside the old height for a frame. While the height animates,
// only the top and bottom are clipped (clip-path with huge side insets): the
// project grid deliberately bleeds past its parent's sides (-mx-4), and its
// tiles must never be cut. At rest nothing is clipped. Reduced motion: the
// height changes at once.
export default function SmoothHeight({ children }) {
  const outer = useRef(null);
  const inner = useRef(null);

  useLayoutEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i || typeof ResizeObserver === "undefined") return;
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let last = i.offsetHeight;
    o.style.height = `${last}px`;
    if (!still) o.style.transition = "height 520ms cubic-bezier(0.22, 1, 0.36, 1)";

    const ro = new ResizeObserver(() => {
      const h = i.offsetHeight;
      if (h === last) return;
      last = h;
      if (!still) o.style.clipPath = "inset(0 -100vmax)";
      o.style.height = `${h}px`;
    });
    const settled = (e) => {
      if (e.target === o && e.propertyName === "height") o.style.clipPath = "";
    };
    o.addEventListener("transitionend", settled);
    ro.observe(i);
    return () => {
      ro.disconnect();
      o.removeEventListener("transitionend", settled);
      o.style.height = "";
      o.style.transition = "";
      o.style.clipPath = "";
    };
  }, []);

  return (
    <div ref={outer}>
      <div ref={inner}>{children}</div>
    </div>
  );
}

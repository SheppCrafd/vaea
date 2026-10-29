import { useEffect } from "react";

// One pointer listener for the whole marketing site. It writes the cursor's
// position as two CSS custom properties on the page's lead figure (the main
// item in the top panel, <Float lead>), smoothed with a spring-like ease so
// nothing snaps:
//   --mx  -1 (left edge) … 0 (centre) … +1 (right edge)
//   --my  -1 (top edge)  … 0 (centre) … +1 (bottom edge)
// Only that figure reads these (marketing.css); nothing else on the page
// moves with the mouse. The loop stops as soon as the values settle, so an
// idle page costs nothing.
//
// Only for a real mouse: touch and pen never set it, and neither does
// prefers-reduced-motion. Without it the vars are unset, every consumer falls
// back to 0, and the page is exactly the still layout. `data-pointer="on"` on
// the root is what switches the CSS transforms on at all.
export function usePointerField(ref) {
  useEffect(() => {
    const root = ref.current;
    if (!root || typeof window === "undefined" || !window.matchMedia) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let tx = 0;
    let ty = 0;
    let x = 0;
    let y = 0;
    let frame = 0;
    let last = 0;

    // Written only onto the layers that move, never the root: --mx/--my are
    // registered as non-inheriting (@property in marketing.css), so a write
    // restyles that one element instead of every element on the page. And
    // only onto layers on (or near) the screen — every restyle costs real
    // frame time, and a long page has dozens of layers below the fold. A
    // layer that scrolls into view is caught up at once, so it never shows
    // a stale lean.
    const setVars = (el) => {
      el.style.setProperty("--mx", x.toFixed(4));
      el.style.setProperty("--my", y.toFixed(4));
    };
    const visible = new Set();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            visible.add(e.target);
            setVars(e.target);
          } else {
            visible.delete(e.target);
          }
        }
      },
      { rootMargin: "20% 0px" },
    );
    // observe() is a no-op for an element it already watches, so rescanning
    // at the start of each burst of motion just picks up layers a route
    // change added.
    const scan = () => root.querySelectorAll(LAYERS).forEach((el) => io.observe(el));
    const write = () => {
      for (const el of visible) {
        if (el.isConnected) setVars(el);
        else visible.delete(el);
      }
    };
    const tick = (now) => {
      // Frame-rate independent ease: ~90% of the way there in ~400ms.
      const dt = last ? Math.min(64, now - last) : 16.7;
      last = now;
      const k = 1 - Math.pow(0.9, dt / 16.7);
      x += (tx - x) * k;
      y += (ty - y) * k;
      if (Math.abs(tx - x) < 0.0008 && Math.abs(ty - y) < 0.0008) {
        x = tx;
        y = ty;
        frame = 0;
        last = 0;
      } else {
        frame = requestAnimationFrame(tick);
      }
      write();
    };
    const kick = () => {
      if (frame) return;
      scan();
      frame = requestAnimationFrame(tick);
    };
    const onMove = (e) => {
      if (e.pointerType && e.pointerType !== "mouse") return;
      tx = Math.max(-1, Math.min(1, (e.clientX / window.innerWidth) * 2 - 1));
      ty = Math.max(-1, Math.min(1, (e.clientY / window.innerHeight) * 2 - 1));
      kick();
    };
    // Cursor left the window (or the window lost focus): ease back to rest.
    const settle = () => {
      tx = 0;
      ty = 0;
      kick();
    };
    const onOut = (e) => {
      if (!e.relatedTarget) settle();
    };

    root.dataset.pointer = "on";
    scan();
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("mouseout", onOut);
    window.addEventListener("blur", settle);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("mouseout", onOut);
      window.removeEventListener("blur", settle);
      delete root.dataset.pointer;
      for (const el of root.querySelectorAll(LAYERS)) {
        el.style.removeProperty("--mx");
        el.style.removeProperty("--my");
      }
    };
  }, [ref]);
}

// The only element that reads --mx/--my (marketing.css).
const LAYERS = ".mkt-float[data-lead]";

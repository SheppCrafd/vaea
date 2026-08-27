import { useEffect, useRef, useState } from "react";

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Fire once when the element scrolls ~15% into view. Returns [ref, shown].
// Guarantees:
//  - SSR/prerender renders with shown=false, so the static HTML is the
//    pre-reveal state; the reveal transition is a CSS concern (marketing.css)
//    and reduced-motion users just get the final state with no transform.
//  - reduced motion → shown=true immediately, no observer.
//  - a fallback timer forces shown=true after `fallback`ms in case the
//    observer never fires (a permanently-hidden section is a real bug).
export function useReveal({ fallback = 1400 } = {}) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion() || typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(node);

    const timer = setTimeout(() => {
      setShown(true);
      observer.disconnect();
    }, fallback);

    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [fallback]);

  return [ref, shown];
}

export { prefersReducedMotion };

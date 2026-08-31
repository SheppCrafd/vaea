import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

// A section background: one real photograph, held behind the content, that
// drifts slowly against the scroll (a gentle counter-parallax — the image
// eases up as the page moves down). The photo is over-sized just enough
// that the drift never exposes an edge — 180% (40% bleed each side), down
// from an over-cropped 280%, so the scene reads at close to its real
// framing instead of a hard zoom. A scrim in the page's own --background
// colour keeps foreground text readable in both themes.
//
// SSR-safe: no window access at module or render time, and the markup is
// complete without JS (the photo and scrim are plain CSS). The drift is set
// up in an effect and is skipped entirely under prefers-reduced-motion — the
// image just sits still. Decorative only: aria-hidden, not focusable.
//
//   <ParallaxBackdrop src="/img/marketing/lagoon.jpg" strength={48}>
//     <Container> … </Container>
//   </ParallaxBackdrop>
export default function ParallaxBackdrop({
  as: Tag = "div",
  src,
  srcSet,
  sizes,
  position = "50% 50%",
  // Peak drift in px as the section travels through the viewport.
  strength = 144,
  // 0–1: how strongly the scrim hides the photo. Higher = text-safe, flatter.
  scrim = 0.72,
  // Set on a backdrop that's above the fold so its photo isn't lazy-loaded.
  eager = false,
  className,
  children,
}) {
  const wrapRef = useRef(null);
  const imgRef = useRef(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const img = imgRef.current;
    if (!wrap || !img) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = wrap.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      // -1 (section still below the viewport) → +1 (section above it), 0 at centre.
      const progress = (rect.top + rect.height / 2 - vh / 2) / (vh / 2 + rect.height / 2);
      const clamped = Math.max(-1, Math.min(1, progress));
      img.style.transform = `translate3d(0, ${(-clamped * strength).toFixed(2)}px, 0)`;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [strength]);

  const mid = Math.max(0, scrim - 0.22).toFixed(2);

  return (
    <Tag ref={wrapRef} className={cn("relative isolate overflow-hidden", className)}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <img
          ref={imgRef}
          src={src}
          srcSet={srcSet}
          sizes={sizes}
          alt=""
          decoding="async"
          loading={eager ? "eager" : "lazy"}
          style={{ objectPosition: position }}
          className="absolute inset-x-0 -inset-y-[40%] h-[180%] w-full object-cover will-change-transform"
        />
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(180deg,
              hsl(var(--background)/${scrim}) 0%,
              hsl(var(--background)/${mid}) 42%,
              hsl(var(--background)/${mid}) 58%,
              hsl(var(--background)/${scrim}) 100%)`,
          }}
        />
      </div>
      {children}
    </Tag>
  );
}

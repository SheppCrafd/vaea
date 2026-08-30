import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

// A section background: one real photograph, held behind the content, that
// drifts slowly against the scroll (a gentle counter-parallax — the image
// eases up as the page moves down). The photo is over-sized so the drift
// never exposes an edge.
//
// By default nothing sits between the copy and the image — the photo shows
// at full strength and the text carries its own small glow (see
// `.mkt-on-photo` in marketing.css). `scrim` (an even wash) and `textScrim`
// ("left" | "center" — a veil only where the copy sits) are available if a
// particular photo needs help, but both default to off.
//
// SSR-safe: no window access at module or render time; the markup is complete
// without JS. The drift is set up in an effect and skipped under
// prefers-reduced-motion. Decorative only: aria-hidden, not focusable.
export default function ParallaxBackdrop({
  as: Tag = "div",
  src,
  srcSet,
  sizes,
  position = "50% 50%",
  strength = 48,
  scrim = 0,
  textScrim = false,
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

  const wash =
    scrim > 0
      ? `linear-gradient(180deg,
          hsl(var(--background)/${(scrim + 0.14).toFixed(2)}) 0%,
          hsl(var(--background)/${scrim}) 30%,
          hsl(var(--background)/${scrim}) 70%,
          hsl(var(--background)/${(scrim + 0.14).toFixed(2)}) 100%)`
      : null;

  const textVeil =
    textScrim === "left"
      ? `linear-gradient(97deg,
          hsl(var(--background)/0.86) 0%,
          hsl(var(--background)/0.82) 40%,
          hsl(var(--background)/0.5) 54%,
          hsl(var(--background)/0.12) 64%,
          hsl(var(--background)/0) 74%)`
      : textScrim === "center"
        ? `radial-gradient(125% 96% at 50% 50%,
            hsl(var(--background)/0.84) 0%,
            hsl(var(--background)/0.8) 34%,
            hsl(var(--background)/0.4) 62%,
            hsl(var(--background)/0) 88%)`
        : null;

  return (
    <Tag ref={wrapRef} className={cn("mkt-on-photo relative isolate overflow-hidden", className)}>
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
          className="absolute inset-x-0 -inset-y-[13%] h-[126%] w-full object-cover will-change-transform"
        />
        {wash && <div className="absolute inset-0" style={{ background: wash }} />}
        {textVeil && <div className="absolute inset-0" style={{ background: textVeil }} />}
      </div>
      {children}
    </Tag>
  );
}

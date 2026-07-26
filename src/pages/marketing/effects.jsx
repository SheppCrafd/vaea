import { useEffect, useRef, useState } from "react";

// Fades a section up into place the first time it scrolls into view — the
// one motion device this page uses, applied consistently rather than a
// different animation per section. Skips straight to visible for
// prefers-reduced-motion. A fallback timer also forces visible after 1.2s
// regardless of the observer — this exact codebase has shipped one
// permanently-stuck-invisible mount animation before (a rAF fade that never
// resolved, see Vaea - Public Marketing Site and App Route Migration), so
// content here is never allowed to depend on the observer firing at all.
export function useReveal() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }
    const fallback = setTimeout(() => setVisible(true), 1200);
    const el = ref.current;
    if (!el) return () => clearTimeout(fallback);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
          clearTimeout(fallback);
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      clearTimeout(fallback);
    };
  }, []);

  return { ref, visible };
}

export function Reveal({ as: Tag = "div", className = "", delay = 0, children }) {
  const { ref, visible } = useReveal();
  return (
    <Tag
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      } ${className}`}
      style={{ transitionDelay: visible ? `${delay}ms` : "0ms" }}
    >
      {children}
    </Tag>
  );
}

// A soft blurred glow blob — the recurring "light pool" every product
// mockup sits in on a dark section, standing in for the studio lighting
// Apple's real product photography relies on. Positioned per-use via
// className; kept to three uses total across the whole site on purpose.
export function GlowOrb({ className = "" }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute rounded-full blur-[110px] opacity-[0.35] bg-[#46BAD1] ${className}`}
    />
  );
}

import { useEffect, useRef, useState } from "react";

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Fires when the element enters the viewport. A fallback timer also forces
// it on after 1.2s regardless of the observer — this codebase has shipped
// one permanently-stuck-invisible mount animation before (a rAF fade that
// never resolved, see Vaea - Public Marketing Site and App Route Migration),
// so nothing here is ever allowed to depend on the observer firing at all.
//
// `once: false` keeps reporting as the element leaves and re-enters — the
// demo films use that to pause off-screen and restart from the top when you
// scroll back, rather than running invisibly forever.
export function useInView({ threshold = 0.15, once = true } = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const fallback = setTimeout(() => setInView(true), 1200);
    const el = ref.current;
    if (!el) return () => clearTimeout(fallback);
    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
        if (entry.isIntersecting && once) {
          observer.disconnect();
          clearTimeout(fallback);
        }
      },
      { threshold }
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      clearTimeout(fallback);
    };
  }, [threshold, once]);

  return { ref, inView };
}

// Fades a section up into place the first time it scrolls into view — the
// one entrance motion on the page, applied consistently rather than a
// different animation per section.
export function Reveal({ as: Tag = "div", className = "", delay = 0, children }) {
  const { ref, inView } = useInView();
  return (
    <Tag
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      } ${className}`}
      style={{ transitionDelay: inView ? `${delay}ms` : "0ms" }}
    >
      {children}
    </Tag>
  );
}

// Drives a demo film through numbered phases, each held for its own
// duration, looping after a pause. Every animated demo on this site reads
// its visual state off the returned `step` — one clock per film, so a
// caption list and the mockup it describes can never drift apart.
//
// Durations live in a ref rather than the dependency array: callers pass a
// plain array literal, whose identity changes every render, which as a dep
// would restart the film on every parent re-render.
//
// Reduced motion jumps straight to the final phase and never loops — the
// demo still reads correctly as a finished still, which is the whole point
// of building each film so its last phase is the complete picture.
export function useTimeline(phaseDurations, { loop = true, restartPauseMs = 2400 } = {}) {
  const { ref, inView } = useInView({ threshold: 0.25, once: false });
  const [step, setStep] = useState(0);
  const durationsRef = useRef(phaseDurations);
  durationsRef.current = phaseDurations;

  useEffect(() => {
    if (!inView) return;
    if (prefersReducedMotion()) {
      setStep(durationsRef.current.length);
      return;
    }
    let timer;
    let i = 0;
    setStep(0);
    const run = () => {
      const durations = durationsRef.current;
      if (i >= durations.length) {
        if (!loop) return;
        timer = setTimeout(() => {
          i = 0;
          setStep(0);
          run();
        }, restartPauseMs);
        return;
      }
      timer = setTimeout(() => {
        i += 1;
        setStep(i);
        run();
      }, durations[i]);
    };
    run();
    return () => clearTimeout(timer);
  }, [inView, loop, restartPauseMs]);

  return { ref, step };
}

// Types `text` out character by character while `play` is true; snaps to the
// full string once `complete` is true (or immediately, under reduced
// motion). Driven off elapsed time rather than a per-character interval, so
// a backgrounded tab that drops frames resumes at the right position
// instead of falling behind.
export function Typed({ text, play, complete, cps = 45, className = "" }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (complete || prefersReducedMotion()) {
      setCount(text.length);
      return;
    }
    if (!play) {
      setCount(0);
      return;
    }
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const chars = Math.floor(((now - start) / 1000) * cps);
      setCount(Math.min(chars, text.length));
      if (chars < text.length) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, play, complete, cps]);

  return <span className={className}>{text.slice(0, count)}</span>;
}

// The blinking block cursor — reuses .chat-cursor-blink, the same keyframe
// the real in-app chat uses for its own thinking indicator, so the marketing
// films and the product blink identically.
export function Caret({ className = "bg-[#46BAD1]/70" }) {
  return <span className={`inline-block w-[7px] h-[13px] align-middle ml-0.5 chat-cursor-blink ${className}`} />;
}

// Light-from-above plus an edge vignette. A dark section only reads as a lit
// stage — the thing that makes product photography feel expensive — if the
// light has a direction and the corners fall off. A single centered blur
// blob has neither, which is what makes it read as generic.
export function StageLight({ className = "" }) {
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <div
        className="absolute inset-x-0 -top-1/4 h-[80%]"
        style={{
          background:
            "radial-gradient(58% 52% at 50% 38%, rgba(70,186,209,0.22), rgba(70,186,209,0.07) 44%, transparent 72%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(115% 85% at 50% 42%, transparent 52%, rgba(0,0,0,0.6))" }}
      />
    </div>
  );
}

// Fine film grain over the dark sections. Two jobs, both real: it breaks up
// the visible banding a large low-contrast gradient produces on 8-bit
// displays, and it gives the black a physical, lacquered texture instead of
// a flat digital fill.
const GRAIN_URL =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

export function Grain({ opacity = 0.035 }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 mix-blend-overlay"
      style={{ backgroundImage: GRAIN_URL, opacity }}
    />
  );
}

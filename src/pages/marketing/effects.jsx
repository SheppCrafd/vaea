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
    const el = ref.current;
    // Only sections already inside (or within one viewport height of) the
    // initial scroll position get the fast 1.2s fallback — that's the
    // safety net for the hero and anything else visible without scrolling.
    // Everything further down the page only needs the fallback as
    // protection against a stuck IntersectionObserver (see the comment
    // above), not as a way to force-start dozens of below-the-fold demo
    // films competing with the hero for the main thread during initial
    // load/hydration — those get a much longer delay and normally start
    // for real, off the observer, once the visitor actually scrolls near
    // them.
    const nearInitialViewport =
      el && typeof window !== "undefined" ? el.getBoundingClientRect().top < window.innerHeight * 2 : true;
    const fallback = setTimeout(() => setInView(true), nearInitialViewport ? 1200 : 6000);
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
  // Under reduced motion, skip the translate/opacity transition entirely —
  // content should just be there, not merely faster. motion-reduce: (a
  // Tailwind variant, not a runtime check) is used here rather than a JS
  // prefersReducedMotion() branch so this stays a pure CSS decision with no
  // hydration/first-paint flash of the animated state.
  return (
    <Tag
      ref={ref}
      className={`transition-all duration-700 ease-out motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:translate-y-0 ${
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
//
// The hero's own instance of this is also the page's LCP element, and a
// rAF loop calling setState every frame — starting the instant this mounts,
// which for the hero is before first paint — is exactly what was thrashing
// the main thread during initial load/hydration and delaying LCP: the
// browser never got to treat the hero text as "final" because it kept
// changing. `armed` gates the actual character-by-character animation
// behind a post-mount requestIdleCallback (a plain setTimeout fallback
// where that API doesn't exist): before it fires, `play` still shows the
// complete text immediately rather than animating, so first paint renders
// the finished string. Once armed, subsequent `play` transitions (the
// timeline's own loop restarting) animate normally — the typing effect
// still plays, just never as part of the initial render.
export function Typed({ text, play, complete, cps = 45, className = "" }) {
  const [count, setCount] = useState(text.length);
  const armedRef = useRef(false);

  useEffect(() => {
    let idleId;
    let timeoutId;
    const arm = () => {
      armedRef.current = true;
    };
    if (typeof requestIdleCallback === "function") {
      idleId = requestIdleCallback(arm, { timeout: 500 });
    } else {
      timeoutId = setTimeout(arm, 300);
    }
    return () => {
      if (idleId !== undefined && typeof cancelIdleCallback === "function") cancelIdleCallback(idleId);
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (complete || prefersReducedMotion()) {
      setCount(text.length);
      return;
    }
    if (!play) {
      setCount(0);
      return;
    }
    if (!armedRef.current) {
      // Not armed yet (first paint / still hydrating): show the finished
      // string instead of animating it in.
      setCount(text.length);
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

// Light-from-above: a single directional glow, off-center-high rather than a
// centered blur blob, which is what makes it read as generic. Used to have a
// second layer darkening the corners into a vignette — looked right when the
// band underneath was always near-black (the darkening was invisible against
// black), but once bands started using a light tone in light theme, that
// same dark radial showed up as a visible gray smudge in the corners. Cut
// rather than patched again.
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
    </div>
  );
}

// Sets document.title and a per-route <link rel="canonical"> together —
// every marketing page needs both, and the SEO audit that flagged missing
// canonical tags found title-setting already wired up per page via this
// same useEffect-on-mount pattern, so canonical rides along with it rather
// than becoming its own thing to forget on the next new route. The <link>
// element is created once and reused (not appended again) across client-side
// route changes, since react-router navigation between marketing pages never
// reloads index.html.
const SITE_ORIGIN = "https://vaea.base44.app";

export function useDocumentMeta(title, path) {
  useEffect(() => {
    document.title = title;
    let link = document.head.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.setAttribute("rel", "canonical");
      document.head.appendChild(link);
    }
    link.setAttribute("href", `${SITE_ORIGIN}${path}`);
  }, [title, path]);
}

// Injects a JSON-LD <script> block into <head> for the given schema object,
// and removes it when the component unmounts. Used for per-page structured
// data that lives outside index.html (e.g. FAQPage schema on the home page).
export function usePageSchema(schema) {
  useEffect(() => {
    const script = document.createElement("script");
    script.setAttribute("type", "application/ld+json");
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);
    return () => {
      document.head.removeChild(script);
    };
  }, []); // schema is a module-level constant on every caller — safe to omit
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

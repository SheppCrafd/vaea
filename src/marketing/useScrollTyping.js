import { useEffect, useState } from "react";
import { prefersReducedMotion } from "./useReveal";

// Scroll-driven typing for the marketing demos below each page's hero (the
// heroes keep their own timed loop). A demo types as the visitor scrolls
// toward it and finishes exactly when its top edge reaches 25% from the top
// of the screen; scrolling back up un-types it.
//
// One coordinator for the page, so only one demo types at a time, in scroll
// order: a demo stays at zero until every demo above it has finished.
//
// The text chases the scroll-set target at typing speed instead of jumping,
// so a fast scroll still reads as typing. Reduced motion: the finished text.

const END = 0.25; // fraction of the viewport from the top where typing completes
const START_MAX = 0.9; // a demo far down the page starts once its top is 90% down the screen
const TYPE_PER_SEC = 110; // characters per second when catching up
const UNTYPE_PER_SEC = 420;

const entries = new Set();
let frame = 0;
let listening = false;

const clamp01 = (n) => Math.max(0, Math.min(1, n));
const viewport = () => window.innerHeight || document.documentElement.clientHeight || 1;

// Where this demo starts: 90% down the screen, or higher for a demo that's
// already on screen when the page opens, so it starts at zero and types only
// once the visitor scrolls.
function startLine(el) {
  const docTop = el.getBoundingClientRect().top + window.scrollY;
  return Math.max(END + 0.15, Math.min(START_MAX, docTop / viewport()));
}

// Exported for tests: progress 0..1 for a demo whose top sits `top` px from
// the top of a `vh`-high viewport, starting at `start` (a fraction of vh).
export function progressAt(top, vh, start) {
  return clamp01((start - top / vh) / (start - END));
}

function update() {
  frame = 0;
  const vh = viewport();
  const list = [...entries]
    .filter((e) => e.el.isConnected)
    .map((e) => ({ e, top: e.el.getBoundingClientRect().top }))
    .sort((a, b) => a.top - b.top);
  let aboveDone = true;
  for (const { e, top } of list) {
    const p = aboveDone ? progressAt(top, vh, e.start) : 0;
    e.setTarget(p);
    aboveDone = p >= 1;
  }
}

const schedule = () => {
  if (!frame) frame = requestAnimationFrame(update);
};

function register(entry) {
  entries.add(entry);
  if (!listening) {
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    listening = true;
  }
  schedule();
}

function unregister(entry) {
  entries.delete(entry);
  if (!entries.size && listening) {
    window.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", schedule);
    listening = false;
  }
}

// -> how many of `total` characters to show right now.
export function useScrollTyping(ref, total) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) {
      setCount(total);
      return;
    }
    let target = 0;
    let shown = 0;
    let raf = 0;
    let last = 0;
    const chase = (now) => {
      const dt = last ? Math.min(64, now - last) / 1000 : 1 / 60;
      last = now;
      const rate = target > shown ? TYPE_PER_SEC : UNTYPE_PER_SEC;
      const step = Math.max(1, rate * dt);
      shown = target > shown ? Math.min(target, shown + step) : Math.max(target, shown - step);
      setCount(Math.round(shown));
      if (Math.round(shown) !== target) raf = requestAnimationFrame(chase);
      else {
        raf = 0;
        last = 0;
      }
    };
    const entry = {
      el,
      start: startLine(el),
      setTarget: (p) => {
        target = Math.round(p * total);
        if (!raf && Math.round(shown) !== target) raf = requestAnimationFrame(chase);
      },
    };
    register(entry);
    return () => {
      unregister(entry);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ref, total]);

  return count;
}

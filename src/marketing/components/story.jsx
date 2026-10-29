import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { cn } from "@/lib/utils";
import { Container, Reveal } from "./ui";

// The marketing site tells one sample user's day: Juan Morales, head of
// product at Harborline (see fixtures.js). Each page is one part of that
// day and stands on its own; the pages link to each other in no set order.
// Every beat pairs a moment in Juan's day with the real feature beside it.
export const CHAPTERS = [
  { path: "/", time: "8:40 AM", title: "Juan sets it all down", line: "Three products, six projects, and a launch nobody has planned yet." },
  { path: "/vaea-chat", time: "12:10 PM", title: "Lee asks how the changes happened", line: "What happens between Juan's request and his yes, and where it runs." },
  { path: "/workplace", time: "1:00 PM", title: "The review, the quote, the 1:1", line: "Dana's designs, Priya's quote and Lee's PR, in one view." },
  { path: "/brain", time: "6:10 PM", title: "Juan writes down why", line: "Why the launch moved to Nov 14, kept where his notes already are." },
];

import { toMinutes, timeAtLine, hourLabel } from "./storyTime";

const PX_PER_MIN = 4; // one hour = 240px of ruler
const READ_LINE = 0.45; // where on the screen the reader is: the "now" line

// Wraps a page's story. While the visitor reads it, a thin timeline runs
// down the left edge: a tick every minute, longer ones every 15 and 30
// minutes, the longest every hour with its label. A "now" line sits at the
// reading height, and the timeline slides under it as the visitor scrolls,
// so Juan's day passes beat by beat. Beats are elements carrying
// data-story-time. Outside the story the timeline isn't shown.
//
// The scroll handler writes the timeline's position straight to the DOM
// instead of through React state, so scrolling never re-renders the page.
export function StoryRegion({ children }) {
  const ref = useRef(null);
  const columnRef = useRef(null);
  const rulerRef = useRef(null);
  const nowRef = useRef(null);
  const [range, setRange] = useState(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const nodes = [...root.querySelectorAll("[data-story-time]")]
      .map((el) => ({ el, minutes: toMinutes(el.dataset.storyTime) }))
      .filter((b) => b.minutes !== null);
    if (!nodes.length) return;
    const first = nodes[0].minutes;
    const last = nodes[nodes.length - 1].minutes;
    const start = Math.floor(first / 60) * 60 - 60;
    const end = Math.ceil(last / 60) * 60 + 60;
    setRange({ start, end });

    let frame = 0;
    const update = () => {
      frame = 0;
      const column = columnRef.current;
      const ruler = rulerRef.current;
      if (!column || !ruler) return;
      const height = column.clientHeight;
      const lineInColumn = height * READ_LINE;
      const lineOnScreen = column.getBoundingClientRect().top + lineInColumn;
      const t = timeAtLine(nodes.map((b) => ({ minutes: b.minutes, top: b.el.getBoundingClientRect().top })), lineOnScreen);
      ruler.style.transform = `translate3d(0, ${(lineInColumn - (t - start) * PX_PER_MIN).toFixed(1)}px, 0)`;
      if (nowRef.current) {
        const h = Math.floor(t / 60);
        const m = Math.floor(t % 60);
        nowRef.current.textContent = `${h % 12 || 12}:${String(m).padStart(2, "0")}`;
      }
      const r = root.getBoundingClientRect();
      const inside = r.top < lineOnScreen && r.bottom > lineOnScreen * 0.6;
      column.style.opacity = inside ? "1" : "0";
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const ticks = [];
  if (range) {
    for (let m = range.start; m <= range.end; m++) {
      const kind = m % 60 === 0 ? "hour" : m % 30 === 0 ? "half" : m % 15 === 0 ? "quarter" : "minute";
      ticks.push({ m, kind });
    }
  }

  return (
    <div ref={ref} className="relative">
      <div
        ref={columnRef}
        aria-hidden="true"
        style={{ opacity: 0 }}
        className="pointer-events-none fixed bottom-0 left-0 top-16 z-20 w-[22px] overflow-hidden border-r border-foreground/[0.07] bg-background/70 backdrop-blur-sm transition-opacity duration-300 motion-reduce:transition-none sm:w-12"
      >
        <div ref={rulerRef} className="absolute inset-x-0 top-0 will-change-transform">
          {ticks.map(({ m, kind }) => (
            <div key={m} className="absolute right-0" style={{ top: (m - range.start) * PX_PER_MIN }}>
              <div
                className={cn(
                  "h-px",
                  kind === "hour" && "w-3.5 bg-foreground/60 sm:w-4",
                  kind === "half" && "w-2.5 bg-foreground/40",
                  kind === "quarter" && "w-[7px] bg-foreground/30",
                  kind === "minute" && "w-[3px] bg-foreground/[0.18]",
                )}
              />
              {kind === "hour" && (
                <span className="absolute right-[18px] top-0 -translate-y-1/2 whitespace-nowrap font-mono text-[0.56rem] tabular-nums text-muted-foreground sm:right-5">
                  <span className="sm:hidden">{hourLabel(m, true)}</span>
                  <span className="hidden sm:inline">{hourLabel(m, false)}</span>
                </span>
              )}
            </div>
          ))}
        </div>
        {/* The "now" line at the reading height, with the exact time. */}
        <div className="absolute inset-x-0" style={{ top: `${READ_LINE * 100}%` }}>
          <div className="h-[2px] -translate-y-1/2 bg-[hsl(var(--signal))]" />
          <span
            ref={nowRef}
            className="absolute left-0.5 top-1.5 rounded-sm bg-background/90 px-0.5 font-mono text-[0.56rem] tabular-nums text-[hsl(var(--signal))] sm:left-1"
          />
        </div>
      </div>
      {children}
    </div>
  );
}

// The opening beat of a page's part of the day: where Juan is, in a couple
// of sentences. `note` says plainly that Juan is an example.
export function StoryIntro({ time, children, note = true }) {
  return (
    <section data-story-time={time} className="scroll-mt-24 pt-[calc(var(--mkt-section-y)*0.75)] pb-[calc(var(--mkt-section-y)*0.35)]">
      <Container>
        <Reveal className="max-w-[46rem]">
          <p className="font-mono text-[0.78rem] tabular-nums text-muted-foreground">{time}</p>
          <p className="mt-3 text-balance font-display text-[clamp(1.5rem,2.8vw,2.15rem)] font-medium leading-[1.2] tracking-[-0.02em] text-foreground">
            {children}
          </p>
          {note && (
            <p className="mt-4 text-[0.92rem] text-muted-foreground">
              Juan is an example. Everything he does on these pages is the real Vaea.
            </p>
          )}
        </Reveal>
      </Container>
    </section>
  );
}

// The rest of Juan's day, linked in any order. Plain page content, not app
// UI: a list of moments.
export function Elsewhere({ current }) {
  const others = CHAPTERS.filter((c) => c.path !== current);
  return (
    <section className="py-[calc(var(--mkt-section-y)*0.6)]">
      <Container>
        <Reveal>
          <h2 className="font-display text-[clamp(1.4rem,2.4vw,1.8rem)] font-semibold tracking-[-0.02em] text-foreground">
            Elsewhere in Juan’s day
          </h2>
          <ul className="mt-6 divide-y divide-foreground/[0.08] border-y border-foreground/[0.08]">
            {others.map((c) => (
              <li key={c.path}>
                <Link to={c.path} className="group grid gap-1 py-4 sm:grid-cols-[7rem_1fr_auto] sm:items-baseline sm:gap-6">
                  <span className="font-mono text-[0.8rem] tabular-nums text-muted-foreground">{c.time}</span>
                  <span>
                    <span className="block text-[1.02rem] font-medium text-foreground">{c.title}</span>
                    <span className="mt-0.5 block text-[0.95rem] text-muted-foreground">{c.line}</span>
                  </span>
                  <span aria-hidden="true" className="hidden text-muted-foreground transition-transform group-hover:translate-x-0.5 sm:block">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </Reveal>
      </Container>
    </section>
  );
}

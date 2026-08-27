import { useEffect, useState } from "react";
import { GripVertical, Expand } from "lucide-react";
import { cn } from "@/lib/utils";
import ProjectMiniStats from "@/components/projects/ProjectMiniStats";
import { prefersReducedMotion } from "../useReveal";
import { BOARD, CHAT_PROMPT } from "../fixtures";

// The nested board, built from the app's REAL ProjectMiniStats component
// (quadrant grid + risk/question flags + status bar) with fixture data run
// through the app's own getQuadrantCounts / getMiniStatusCounts. The
// area/product/project card frames match ProjectCard.jsx's real classes.
// Non-interactive: aria-hidden + pointer-events-none, so the cursor stays an
// arrow and nothing is clickable — the meaning is in the copy beside it.
//
// hero=true adds the assistant prompt line and drops the "Q3 launch" card
// into Marketing mid-demo. Reduced motion → the final state, static.
//
// NOTE: a dashed connector line between related project cards was removed
// (looked bad). Re-add later — a curve from the newly-added card to its
// related project in the other product, drawn on after the drop.

// 112px = the fixed grid track ProjectsGrid gives every Mini card in-app.
const CARD = "h-[112px] w-[112px]";

// Class-for-class the outer shell + header row of the real ProjectCard
// Mini view (src/components/projects/ProjectCard.jsx) — the live card is
// bound to @dnd-kit + mutation hooks so it can't mount on a static page,
// but ProjectMiniStats below IS the exact same component the app renders,
// fed data from the app's own getQuadrantCounts / getMiniStatusCounts.
function MiniCard({ p, justAdded, delay = 0 }) {
  return (
    <div
      style={!justAdded ? { "--piece-delay": `${delay}ms` } : undefined}
      className={cn(
        "relative bg-card border border-border rounded-xl p-2 w-full aspect-square flex flex-col items-center shadow-sm",
        CARD,
        justAdded ? "mkt-just-added" : "mkt-board-piece",
      )}
    >
      <div className="w-full flex items-start gap-0.5 z-20 text-muted-foreground">
        <GripVertical className="w-3 h-3 shrink-0" />
        <h4 className="flex-1 min-w-0 font-heading font-semibold text-[11px] leading-tight text-center line-clamp-2 text-foreground">
          {p.title}
        </h4>
        <Expand className="w-3 h-3 shrink-0" />
      </div>
      <ProjectMiniStats
        quadrants={p.quadrants}
        riskNotes={p.riskNotes}
        questionNotes={p.questionNotes}
        miniStats={p.miniStats}
        miniTotal={p.miniTotal}
        onOpenTable={() => {}}
      />
    </div>
  );
}

function ProductFrame({ name, count, delay, children }) {
  return (
    <div className="mkt-board-piece rounded-2xl border border-border bg-muted/40 p-3" style={{ "--piece-delay": `${delay}ms` }}>
      <div className="mb-2.5 flex items-center justify-between gap-6 px-1">
        <span className="font-heading text-[0.82rem] font-semibold text-foreground">{name}</span>
        <span className="font-mono text-[0.64rem] text-muted-foreground">{count} projects</span>
      </div>
      <div className="flex flex-wrap gap-2.5">{children}</div>
    </div>
  );
}

export default function BoardDemo({ hero = false, className }) {
  const [typed, setTyped] = useState("");
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (!hero) return;
    if (prefersReducedMotion()) {
      setTyped(CHAT_PROMPT);
      setAdded(true);
      return;
    }
    let cancelled = false;
    const timers = [];
    timers.push(
      setTimeout(function step(i = 0) {
        if (cancelled) return;
        setTyped(CHAT_PROMPT.slice(0, i));
        if (i <= CHAT_PROMPT.length) timers.push(setTimeout(() => step(i + 1), 26));
        else timers.push(setTimeout(() => setAdded(true), 300));
      }, 1100),
    );
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [hero]);

  return (
    <div
      aria-hidden="true"
      className={cn(
        "mkt-demo pointer-events-none mx-auto w-fit max-w-full select-none rounded-[1.5rem] border border-foreground/[0.08] bg-card/50 p-4 shadow-[0_1px_3px_0_hsl(200_30%_12%/0.1),0_44px_90px_-36px_hsl(200_30%_12%/0.4)] backdrop-blur-xl sm:p-5",
        className,
      )}
    >
      <div className="rounded-[1.15rem] border border-border bg-background/50 p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between px-1">
          <span className="font-heading text-sm font-semibold text-foreground">{BOARD.area}</span>
          <span className="font-mono text-[0.64rem] text-muted-foreground">area of responsibility</span>
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          {BOARD.products.map((prod, pi) => {
            const isMarketing = pi === 0;
            return (
              <ProductFrame
                key={prod.name}
                name={prod.name}
                count={prod.projects.length + (isMarketing && added ? 1 : 0)}
                delay={80 + pi * 60}
              >
                {prod.projects.map((proj, j) => (
                  <MiniCard key={proj.title} p={proj} delay={140 + (pi * 2 + j) * 55} />
                ))}
                {isMarketing &&
                  (added ? (
                    <MiniCard p={BOARD.added} justAdded />
                  ) : (
                    <div
                      className={cn(
                        "mkt-board-piece flex flex-col items-center justify-center rounded-xl border border-dashed border-foreground/20 text-[0.7rem] text-muted-foreground",
                        CARD,
                      )}
                      style={{ "--piece-delay": "260ms" }}
                    >
                      <span className="font-mono text-lg leading-none">+</span>
                      new
                    </div>
                  ))}
              </ProductFrame>
            );
          })}
        </div>
      </div>

      {hero && (
        <div className="mt-4 flex items-center gap-2.5 rounded-full border border-foreground/[0.08] bg-background/50 px-4 py-2.5">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--signal-rgb))]" />
          <span className="min-w-0 flex-1 truncate font-mono text-[0.78rem] text-foreground">
            {typed}
            {!added && <span className="mkt-caret" style={{ height: "1em" }} />}
          </span>
          <span className="hidden shrink-0 font-mono text-[0.64rem] uppercase tracking-wider text-muted-foreground sm:inline">
            {added ? "1 change · applied" : "Assistant"}
          </span>
        </div>
      )}
    </div>
  );
}

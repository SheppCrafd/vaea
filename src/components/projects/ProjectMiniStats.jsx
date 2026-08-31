import { AlertTriangle, HelpCircle } from "lucide-react";
import { STATUS_COLORS } from "@/lib/taskUtils";

// The real mini-card's quadrant grid + risk/question flags + status bar —
// split out of ProjectCard.jsx (the rest of that card is wired to
// @dnd-kit's useDraggable/useDroppable and live mutation hooks, which
// aren't safe to force into a static marketing page) so demos.jsx's
// NestFilm can render this exact piece with fixed sample data instead of
// a hand-drawn recreation. Purely presentational — no hooks, no drag
// context, no live data of its own.
export default function ProjectMiniStats({ quadrants, riskNotes = [], questionNotes = [], miniStats, miniTotal, onOpenTable }) {
  const hasRisks = riskNotes.length > 0;
  const hasQuestions = questionNotes.length > 0;

  return (
    <>
      <div className="flex-1 flex items-center justify-center gap-1 w-full min-h-0">
        <button
          onClick={onOpenTable}
          className="shrink-0 grid grid-cols-2 gap-0.5 border border-border rounded overflow-hidden w-11 h-11 text-xs z-20 select-none"
          title="Open Task Table"
          aria-label={`Open Task Table${
            quadrants.some((q) => q.hasFocus) || quadrants.some((q) => q.hasHighlightedStakeholder)
              ? ` — ${[
                  quadrants.some((q) => q.hasFocus) && "includes this week's focus",
                  quadrants.some((q) => q.hasHighlightedStakeholder) && "includes the highlighted stakeholder",
                ]
                  .filter(Boolean)
                  .join(", ")}`
              : ""
          }`}
        >
          {quadrants.map((q) => (
            <div
              key={q.quadrant}
              title={
                q.hasHighlightedStakeholder
                  ? "Includes the highlighted stakeholder"
                  : q.hasFocus
                  ? "Includes this week's focus"
                  : undefined
              }
              className={`relative flex items-center justify-center transition-colors ${
                q.hasHighlightedStakeholder
                  ? "text-foreground font-bold"
                  : q.hasFocus
                  ? "bg-green-800 text-white font-bold"
                  : "bg-muted/40 text-muted-foreground"
              }`}
              style={q.hasHighlightedStakeholder ? { backgroundColor: STATUS_COLORS.DONE } : undefined}
            >
              {q.count}
            </div>
          ))}
        </button>

        {/* Both flag icons render always, so the tile's composition never
            shifts as notes come and go — greyed out while there's nothing
            behind them, risk-orange / question-blue the moment there is. The
            full note text on hover rides on a wrapping <span title> rather than
            an SVG <title> child, which doesn't reliably surface as a tooltip. */}
        <div className="flex flex-col gap-0.5 shrink-0">
          <span title={hasRisks ? riskNotes.map((n) => n.content).join("\n") : "No risks"} className="inline-flex">
            <AlertTriangle
              className={`w-3.5 h-3.5 ${hasRisks ? "" : "text-muted-foreground/35"}`}
              style={hasRisks ? { color: "#FDBA74" } : undefined}
              aria-label={hasRisks ? `${riskNotes.length} risk${riskNotes.length === 1 ? "" : "s"}` : "No risks"}
            />
          </span>
          <span title={hasQuestions ? questionNotes.map((n) => n.content).join("\n") : "No open questions"} className="inline-flex">
            <HelpCircle
              className={`w-3.5 h-3.5 ${hasQuestions ? "" : "text-muted-foreground/35"}`}
              style={hasQuestions ? { color: "#93C5FD" } : undefined}
              aria-label={hasQuestions ? `${questionNotes.length} question${questionNotes.length === 1 ? "" : "s"}` : "No open questions"}
            />
          </span>
        </div>
      </div>

      {miniTotal > 0 ? (
        <div className="w-full flex h-1.5 rounded-full overflow-hidden shrink-0 mb-0.5">
          {miniStats
            .filter((s) => s.count > 0)
            .map((s) => (
              <div
                key={s.key}
                className="h-full"
                style={{ width: `${(s.count / miniTotal) * 100}%`, backgroundColor: s.color }}
                title={`${s.label}: ${s.count}`}
              />
            ))}
        </div>
      ) : (
        <div
          className="w-full h-1.5 rounded-full shrink-0 mb-0.5 bg-background border border-foreground"
          title="No tasks yet"
        />
      )}
    </>
  );
}

import { QUADRANTS } from "@/lib/quadrants";
import { STATUS_COLORS } from "@/lib/taskUtils";

// The 2x2 Eisenhower count grid on project cards (mini and full). One button
// that opens the task table; each cell names its quadrant on hover, and the
// button's label reads the whole grid out, so the numbers are never a puzzle.
// Cell colors: green = holds a task in this week's focus; mint = holds a task
// of the stakeholder currently highlighted in the sidebar.
const SIZES = {
  mini: "w-10 h-10 gap-px text-[11px] leading-none",
  full: "w-16 h-16 gap-1 text-sm grid-rows-2",
};

function cellTitle(def, q) {
  const tasks = `${q.count} task${q.count === 1 ? "" : "s"}`;
  const extra = q.hasHighlightedStakeholder
    ? " · includes the highlighted stakeholder"
    : q.hasFocus
    ? " · includes this week's focus"
    : "";
  return `${def.value} · ${def.name} (${def.meaning.toLowerCase()}): ${tasks}${extra}`;
}

export default function QuadrantGrid({ quadrants, onOpen, size = "mini", className = "" }) {
  const summary = quadrants
    .map((q, i) => `${q.count} ${QUADRANTS[i].name.toLowerCase()}`)
    .join(", ");
  const flags = [
    quadrants.some((q) => q.hasFocus) && "includes this week's focus",
    quadrants.some((q) => q.hasHighlightedStakeholder) && "includes the highlighted stakeholder",
  ].filter(Boolean);

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`shrink-0 grid grid-cols-2 border border-border rounded overflow-hidden z-20 select-none hover:border-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors ${SIZES[size]} ${className}`}
      title={`Tasks by priority: ${summary}. Click to open the task list.`}
      aria-label={`Open task list. Tasks by priority: ${summary}${flags.length ? `; ${flags.join(", ")}` : ""}`}
    >
      {quadrants.map((q, i) => (
        <div
          key={q.quadrant}
          title={cellTitle(QUADRANTS[i], q)}
          className={`relative flex items-center justify-center tabular-nums transition-colors ${
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
  );
}

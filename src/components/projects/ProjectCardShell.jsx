import ProjectMiniStats from "@/components/projects/ProjectMiniStats";

// The presentational shell of the Mini project card — the exact outer
// element, header row (grip · title · expand · delete), and ProjectMiniStats
// block, with every interactive part passed in as a slot. ProjectCard.jsx
// fills the slots with its real dnd handle / EditableTitle / expand button /
// DeleteButton and its hook-derived stats; the marketing board demo
// (src/marketing/components/BoardDemo.jsx) fills them with inert stand-ins
// carrying the same classes and the same fixture-derived stats. Both render
// this identical markup, so the demo is the real card's DOM, not a
// hand-drawn lookalike.
export const PROJECT_CARD_SHELL_CLASS =
  "relative bg-card border border-border rounded-xl p-2 w-full aspect-square flex flex-col items-center transition-colors";

export default function ProjectCardShell({
  rootRef,
  style,
  rootProps,
  className = "",
  dragHandle,
  title,
  expandButton,
  deleteButton,
  quadrants,
  riskNotes,
  questionNotes,
  miniStats,
  miniTotal,
  onOpenTable,
  children,
}) {
  return (
    <div
      ref={rootRef}
      style={style}
      {...rootProps}
      className={`${PROJECT_CARD_SHELL_CLASS} ${className}`}
    >
      <div className="w-full flex items-start gap-0.5 z-20">
        {dragHandle}
        {title}
        <div className="shrink-0 flex items-center gap-0.5">
          {expandButton}
          {deleteButton}
        </div>
      </div>

      <ProjectMiniStats
        quadrants={quadrants}
        riskNotes={riskNotes}
        questionNotes={questionNotes}
        miniStats={miniStats}
        miniTotal={miniTotal}
        onOpenTable={onOpenTable}
      />

      {children}
    </div>
  );
}

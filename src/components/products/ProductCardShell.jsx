// The presentational shell of a Product card — the recessed inset surface,
// the absolutely-positioned grip / expand / delete cluster, the title +
// description block, and the slots for the projects grid, the task-stats
// bar, and the custom-fields row. ProductCard.jsx fills the slots with its
// real dnd handle / EditableTitle / EditableText / DeleteButton / ProjectsGrid
// and hook-derived data; the marketing board demo fills them with inert
// stand-ins (same classes) and fixture data, so the demo renders this exact
// markup rather than a hand-drawn lookalike.
export const PRODUCT_CARD_SHELL_CLASS =
  "relative z-10 bg-muted/50 rounded-xl p-4 overflow-hidden transition-colors shadow-[inset_0_0_0_1px_hsl(var(--foreground)/0.04)] flex flex-col";

export default function ProductCardShell({
  rootRef,
  style,
  rootProps,
  className = "",
  dragHandle,
  expandButton,
  deleteButton,
  title,
  description,
  projectsGrid,
  stats,
  customFields,
  children,
}) {
  return (
    <div
      ref={rootRef}
      style={style}
      {...rootProps}
      className={`${PRODUCT_CARD_SHELL_CLASS} ${className}`}
    >
      {dragHandle}
      <div className="absolute top-1.5 right-1.5 flex items-center gap-1 z-20">
        {expandButton}
        {deleteButton}
      </div>

      <div className="relative z-[1] min-w-0 pr-12 pl-6">
        {title}
        <div className="mt-0.5 min-w-0">{description}</div>
      </div>

      {projectsGrid}
      {stats}
      {customFields}
      {children}
    </div>
  );
}

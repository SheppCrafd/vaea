// The presentational shell of an Area card — the elevated rounded surface,
// the absolutely-positioned grip / expand / delete cluster, the title +
// description block, and the slots for the products grid, the "Direct
// Projects" drop zone, the task-stats bar, and the custom-fields row.
// AreaCard.jsx fills the slots with its real dnd handle / EditableTitle /
// EditableText / DeleteButton / ProjectsGrid and hook-derived data; the
// marketing board demo fills them with inert stand-ins (same classes) and
// fixture data, so the demo renders this exact markup rather than a
// hand-drawn lookalike.
export const AREA_CARD_SHELL_CLASS =
  "card-enter relative z-10 bg-card border rounded-2xl shadow-md p-5 break-inside-avoid flex flex-col gap-4 transition-colors duration-[time:var(--motion-fast)]";

export default function AreaCardShell({
  rootRef,
  style,
  className = "",
  dragHandle,
  expandButton,
  deleteButton,
  title,
  description,
  productsGrid,
  directProjects,
  stats,
  customFields,
}) {
  return (
    <article
      ref={rootRef}
      style={style}
      className={`${AREA_CARD_SHELL_CLASS} ${className}`}
    >
      <div className="relative">
        {dragHandle}
        <div className="absolute top-0 right-0 flex items-center gap-1 z-20">
          {expandButton}
          {deleteButton}
        </div>
        {title}
        <div className="mt-1 min-w-0">{description}</div>
      </div>

      {productsGrid}
      {directProjects}
      {stats}
      {customFields}
    </article>
  );
}

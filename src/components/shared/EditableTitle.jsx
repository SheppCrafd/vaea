import { titleWithBreakHints } from "@/lib/entityUtils";

// The contentEditable title wiring shared by AreaCard, ProductCard,
// ProjectCard, and ProjectCardFull — useEditableField already centralizes
// the state logic, but the JSX prop wiring (contentEditable,
// suppressContentEditableWarning, the onInput/onBlur/onKeyDown trio, and the
// focus-ring classes) was re-typed at each of the four call sites. Each
// caller still supplies its own tag (h3 vs h4) and the rest of its own
// styling — only the editable-title mechanics are shared.
export default function EditableTitle({ as: Tag = "h3", value, onInput, onBlur, onKeyDown, className = "", tooltip }) {
  return (
    <Tag
      // Long titles stop at three lines (the full title shows on hover) and
      // break anywhere, so one long name can't push the whole board down.
      // Editing lifts the limit.
      className={`outline-none focus:ring-1 focus:ring-primary/40 rounded ${className.includes("line-clamp") ? "" : "line-clamp-3 focus:line-clamp-none"} [overflow-wrap:anywhere] ${className}`}
      contentEditable
      suppressContentEditableWarning
      onInput={onInput}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      title={tooltip ?? (typeof value === "string" ? value : undefined)}
    >
      {titleWithBreakHints(value)}
    </Tag>
  );
}

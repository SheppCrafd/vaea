import { GripVertical, Expand, Plus } from "lucide-react";

// The drag handle, add button and expand button on the board's area,
// product and project cards. One copy, used by the cards themselves
// (AreaCard, ProductCard, ProjectCard) and by the marketing board demo, so
// the demo renders exactly the app's controls. `dragProps` is @dnd-kit's
// attributes and listeners; the demo has no drag context and leaves it out.

const KINDS = {
  area: {
    corner: "absolute top-0 left-0 z-20 flex items-center",
    dragLabel: "Drag to reorder area",
    addLabel: "Add a product to this area",
    expand: "text-muted-foreground hover:text-foreground hover:bg-accent p-2 rounded-md transition-colors",
    expandTitle: "Expand Area",
    expandLabel: "Expand Area",
  },
  product: {
    corner: "absolute top-1.5 left-1.5 z-20 flex items-center",
    dragLabel: "Drag to reorder product",
    addLabel: "Add a project to this product",
    expand: "text-muted-foreground hover:text-foreground hover:bg-card p-1.5 rounded-md transition-colors",
    expandTitle: "Expand Product",
    expandLabel: "Expand product",
  },
  project: {
    dragLabel: "Drag to reorder project",
    expand: "text-muted-foreground hover:text-foreground p-0.5 rounded hover:bg-muted transition-colors",
    expandTitle: "Expand Project",
    expandLabel: "Expand project",
  },
};

// Area and product cards: grip plus "add a child" in the top-left corner.
export function CornerHandle({ kind, dragProps, onAdd }) {
  const k = KINDS[kind];
  return (
    <div className={k.corner}>
      <div
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1.5"
        aria-label={k.dragLabel}
        title="Drag to reorder"
        {...dragProps}
      >
        <GripVertical className="w-4 h-4" />
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="text-muted-foreground hover:text-foreground p-1.5"
        title={k.addLabel}
        aria-label={k.addLabel}
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// Project tiles: a small grip beside the title.
export function ProjectDragHandle({ dragProps }) {
  return (
    <div
      {...dragProps}
      aria-label={KINDS.project.dragLabel}
      title="Drag to reorder"
      className="shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-0.5"
    >
      <GripVertical className="w-3 h-3" />
    </div>
  );
}

export function ExpandButton({ kind, onClick }) {
  const k = KINDS[kind];
  return (
    <button onClick={onClick} className={k.expand} title={k.expandTitle} aria-label={k.expandLabel}>
      <Expand className={kind === "project" ? "w-3 h-3" : "w-4 h-4"} />
    </button>
  );
}

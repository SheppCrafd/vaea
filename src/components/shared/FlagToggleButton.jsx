// The H/Q ("highly important" / "quick task") flag toggle button shared by
// TaskTable's row and its new-task row — was duplicated once per flag,
// twice per flag (row + new-row), with identical conditional className
// logic each time. `color` picks which flag's active-state color to use.
const COLOR_CLASSES = {
  red: "bg-red-500 text-white border-red-500",
  blue: "bg-blue-500 text-white border-blue-500",
};

export default function FlagToggleButton({ active, onToggle, label, title, ariaLabel, color }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={ariaLabel}
      aria-pressed={active}
      title={title}
      className={`w-4 h-4 text-[9px] font-bold rounded border ${active ? COLOR_CLASSES[color] : "text-muted-foreground border-border"}`}
    >
      {label}
    </button>
  );
}

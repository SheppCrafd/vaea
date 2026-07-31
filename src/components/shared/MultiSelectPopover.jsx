import { Check } from "lucide-react";
import PositionedPopover from "@/components/shared/PositionedPopover";

// The toggle-array-in-onSave popover shared by ProductAssigner and
// StakeholderAssigner — both were the same trigger+PositionedPopover+
// Check-row list with identical "toggle id in/out of an array, call onSave"
// logic. Each caller still owns its own trigger visual (avatar stack vs
// plain pill button) and row label — only the popover itself is shared.
export default function MultiSelectPopover({
  isOpen,
  coords,
  close,
  className,
  headerLabel,
  items,
  getId,
  getLabel,
  selectedIds,
  onSave,
  emptyMessage,
}) {
  const toggle = (id) => {
    const newIds = selectedIds.includes(id)
      ? selectedIds.filter((existingId) => existingId !== id)
      : [...selectedIds, id];
    onSave(newIds);
  };

  return (
    <PositionedPopover
      isOpen={isOpen}
      coords={coords}
      close={close}
      panelClassName={`fixed max-h-64 overflow-y-auto bg-card border border-border rounded-md shadow-2xl p-1 animate-in fade-in zoom-in-95 duration-100 ${className}`}
    >
      <p className="text-[10px] font-bold uppercase text-muted-foreground px-2 py-1.5 border-b border-border mb-1">
        {headerLabel}
      </p>
      {items.length === 0 && emptyMessage ? (
        <p className="text-xs text-muted-foreground px-2 py-2">{emptyMessage}</p>
      ) : (
        items.map((item) => {
          const id = getId(item);
          const isSelected = selectedIds.includes(id);
          return (
            <button
              key={id}
              onClick={() => toggle(id)}
              className="w-full text-left px-2 py-1.5 text-xs flex items-center justify-between hover:bg-secondary rounded-sm transition-colors"
            >
              {getLabel(item)}
              {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
            </button>
          );
        })
      )}
    </PositionedPopover>
  );
}

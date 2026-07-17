import { Filter } from "lucide-react";
import { usePositionedMenu } from "@/hooks/usePositionedMenu";
import PositionedPopover from "@/components/shared/PositionedPopover";

// Per-column filter popover for data tables — a small funnel trigger next to
// a column header that opens a Portal-rendered menu, mirroring the
// trigger+portal pattern used by StakeholderAssigner/TaskAttachments. Three
// interchangeable modes cover every column shape a table tends to have:
// "checklist" (multi-select over a fixed or present-value vocabulary),
// "text" (contains-search), and "triState" (All/Yes/No for booleans).
export default function ColumnFilterMenu({
  mode,
  options = [],
  selected = [],
  onToggleOption,
  onClearOptions,
  text = "",
  onTextChange,
  triState = "all",
  onTriStateChange,
}) {
  const { isOpen, coords, triggerRef, toggle, close } = usePositionedMenu({ closeOnScroll: true });

  const isActive =
    mode === "checklist" ? selected.length > 0 : mode === "text" ? !!text : triState !== "all";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
        aria-label="Filter column"
        className={`inline-flex items-center shrink-0 ${isActive ? "text-primary" : "text-muted-foreground/40 hover:text-muted-foreground"}`}
      >
        <Filter className="w-2.5 h-2.5" fill={isActive ? "currentColor" : "none"} />
      </button>
      <PositionedPopover
        isOpen={isOpen}
        coords={coords}
        close={close}
        panelClassName="fixed w-48 max-h-64 overflow-y-auto bg-card border border-border rounded-md shadow-2xl p-2 animate-in fade-in zoom-in-95 duration-100 font-normal normal-case text-left"
      >
        {mode === "text" && (
          <input
            autoFocus
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder="Contains..."
            className="w-full text-xs px-2 py-1.5 bg-background border border-input rounded outline-none"
          />
        )}
        {mode === "triState" && (
          <div className="flex flex-col gap-0.5">
            {["all", "yes", "no"].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => onTriStateChange(v)}
                className={`text-left text-xs px-2 py-1.5 rounded-sm hover:bg-secondary capitalize ${triState === v ? "bg-secondary font-medium" : ""}`}
              >
                {v}
              </button>
            ))}
          </div>
        )}
        {mode === "checklist" && (
          <div className="flex flex-col gap-0.5">
            {options.length === 0 && <p className="text-xs text-muted-foreground px-2 py-1">No values</p>}
            {options.map((opt) => (
              <label key={opt.value} className="flex items-center gap-1.5 text-xs px-2 py-1 hover:bg-secondary rounded-sm cursor-pointer">
                <input type="checkbox" checked={selected.includes(opt.value)} onChange={() => onToggleOption(opt.value)} />
                {opt.label}
              </label>
            ))}
            {selected.length > 0 && (
              <button type="button" onClick={onClearOptions} className="text-[10px] text-muted-foreground hover:text-foreground text-left px-2 pt-1">
                Clear
              </button>
            )}
          </div>
        )}
      </PositionedPopover>
    </>
  );
}

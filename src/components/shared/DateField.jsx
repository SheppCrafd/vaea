import { useEffect, useRef, useState } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function parseISO(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatMDY(date) {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${m}/${d}/${date.getFullYear()}`;
}

function isSameDay(a, b) {
  return !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function buildMonthGrid(viewDate) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const startOffset = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Array(startOffset).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  return cells;
}

// A fully app-rendered date picker — deliberately NOT a native
// <input type="date"> — so the trigger and calendar look pixel-identical
// across every browser engine. The cross-browser audit found the native
// control rendering three different ways (spaced vs unspaced mm/dd/yyyy,
// different calendar icon styles, and WebKit showing a blank field with no
// placeholder until focus); this replaces all of that with one owned
// implementation. The one place date-picking looks and behaves the same
// everywhere in the app — see useDateSelector's old role, now folded in here
// since nothing else consumed that hook.
export default function DateField({ value, onSave, className = "", unstyled = false, placeholder = "mm/dd/yyyy", id, "aria-label": ariaLabel }) {
  const [open, setOpen] = useState(false);
  const selected = parseISO(value);
  const [viewDate, setViewDate] = useState(selected || new Date());
  const rootRef = useRef(null);

  useEffect(() => {
    if (open) setViewDate(selected || new Date());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const pick = (day) => {
    onSave(toISO(day));
    setOpen(false);
  };

  const clear = () => {
    onSave(null);
    setOpen(false);
  };

  const base = unstyled
    ? "outline-none focus-visible:ring-1 focus-visible:ring-ring rounded"
    : "text-sm px-2 py-1.5 bg-background border border-input rounded-md outline-none focus-visible:ring-1 focus-visible:ring-ring";

  const today = new Date();

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        id={id}
        aria-label={ariaLabel}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`${base} inline-flex items-center justify-between gap-1.5 ${!selected ? "text-muted-foreground" : ""} ${className}`}
      >
        <span>{selected ? formatMDY(selected) : placeholder}</span>
        <CalendarIcon className="w-3.5 h-3.5 shrink-0 opacity-70" />
      </button>

      {open && (
        <div
          className={`absolute z-50 mt-1 w-60 bg-popover border border-border rounded-lg shadow-md p-3 text-sm ${
            unstyled ? "right-0" : "left-0"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}
              className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-medium">{viewDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
            <button
              type="button"
              onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}
              className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 mb-1 text-center text-[11px] text-muted-foreground">
            {WEEKDAY_LABELS.map((label, i) => (
              <div key={i}>{label}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {buildMonthGrid(viewDate).map((day, i) =>
              day ? (
                <button
                  type="button"
                  key={i}
                  onClick={() => pick(day)}
                  className={`w-7 h-7 rounded-md text-xs transition-colors ${
                    isSameDay(day, selected)
                      ? "bg-primary text-primary-foreground"
                      : isSameDay(day, today)
                        ? "border border-primary/50 hover:bg-accent"
                        : "hover:bg-accent"
                  }`}
                >
                  {day.getDate()}
                </button>
              ) : (
                <div key={i} />
              )
            )}
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
            <button type="button" onClick={() => pick(today)} className="text-xs text-primary hover:underline">
              Today
            </button>
            {selected && (
              <button type="button" onClick={clear} className="text-xs text-muted-foreground hover:text-foreground">
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

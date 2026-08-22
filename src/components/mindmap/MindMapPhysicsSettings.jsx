import { useRef, useState } from "react";
import { SlidersHorizontal, RotateCcw } from "lucide-react";
import { FOCUSABLE_SELECTOR } from "@/hooks/useDialogA11y";
import { PHYSICS_FIELDS, DEFAULT_PHYSICS } from "@/lib/mindMapPhysics";

// A small popover, separate from the app's main Settings page on purpose —
// these are per-graph display tuning (how the simulation settles), not an
// account/data preference, the same distinction the real app already draws
// between e.g. chat icon choice and AI Preferences. Positioned top-right of
// the Vault tab, closest to the canvas it actually affects.
export default function MindMapPhysicsSettings({ physics, onChange }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  const handleKeyDown = (e) => {
    if (e.key === "Escape") { setOpen(false); return; }
    if (e.key !== "Tab" || !panelRef.current) return;
    const focusable = [...panelRef.current.querySelectorAll(FOCUSABLE_SELECTOR)];
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  return (
    <div className="absolute top-2 right-2 z-10">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Graph physics settings"
        aria-expanded={open}
        title="Graph physics"
        className="w-7 h-7 flex items-center justify-center rounded-md bg-card/90 border border-border text-muted-foreground hover:text-foreground shadow-sm backdrop-blur-sm transition-colors"
      >
        <SlidersHorizontal className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Graph physics settings"
          onKeyDown={handleKeyDown}
          className="absolute right-0 mt-2 w-64 rounded-xl border border-border bg-card shadow-[0_16px_40px_-12px_rgb(0_0_0/0.25)] dark:shadow-[0_0_0_1px_hsl(var(--foreground)/0.08),0_16px_40px_-12px_hsl(0_0%_0%/0.5)] p-3 text-left"
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium">Graph physics</p>
            <button
              type="button"
              onClick={() => onChange(DEFAULT_PHYSICS)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <RotateCcw className="w-2.5 h-2.5" /> Reset
            </button>
          </div>

          <div className="space-y-2.5">
            {PHYSICS_FIELDS.map(({ key, label, min, max, step }) => (
              <label key={key} className="block">
                <span className="flex items-center justify-between text-[11px] text-muted-foreground mb-0.5">
                  <span>{label}</span>
                  <span className="font-terminal">{physics[key]}</span>
                </span>
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={physics[key]}
                  onChange={(e) => onChange({ ...physics, [key]: Number(e.target.value) })}
                  className="w-full accent-primary"
                />
              </label>
            ))}

            <label className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-muted-foreground">Group by tag</span>
              <button
                type="button"
                role="switch"
                aria-checked={physics.groupByTag}
                onClick={() => onChange({ ...physics, groupByTag: !physics.groupByTag })}
                className={`relative w-8 h-4.5 rounded-full transition-colors ${physics.groupByTag ? "bg-primary" : "bg-muted"}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-background shadow-sm transition-transform ${physics.groupByTag ? "translate-x-3.5" : ""}`} />
              </button>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

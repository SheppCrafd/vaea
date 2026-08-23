import * as React from "react";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

// The one checkbox used everywhere in the app. Used to be ~6 independently
// hand-rolled native `<input type="checkbox">` elements — most with zero
// styling at all, so they rendered as the browser's own default checkbox
// instead of matching the rest of the app's design language. Supports
// `indeterminate` (a third, "mixed" visual state) so a tri-state checkbox
// doesn't need its own separate implementation.
const Checkbox = React.forwardRef(
  ({ checked, indeterminate, onCheckedChange, disabled, className, id, "aria-label": ariaLabel, ...props }, ref) => {
    return (
      <button
        ref={ref}
        id={id}
        type="button"
        role="checkbox"
        aria-checked={indeterminate ? "mixed" : checked}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors disabled:opacity-50 disabled:pointer-events-none",
          checked || indeterminate ? "bg-primary border-primary text-primary-foreground" : "bg-background border-input",
          className
        )}
        {...props}
      >
        {indeterminate ? <Minus className="w-3 h-3" /> : checked ? <Check className="w-3 h-3" /> : null}
      </button>
    );
  }
);
Checkbox.displayName = "Checkbox";

export { Checkbox };

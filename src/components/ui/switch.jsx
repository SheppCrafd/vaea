import * as React from "react";
import { cn } from "@/lib/utils";

// The one on/off switch used everywhere in the app — Settings toggles, the
// Mind Map physics popover, anywhere else that needs one. Three hand-rolled
// `role="switch"` buttons used to exist independently (different sizes,
// slightly different colors) before this was pulled out; new toggles should
// use this instead of hand-rolling another one.
const Switch = React.forwardRef(
  ({ checked, onCheckedChange, disabled, size = "default", className, id, "aria-labelledby": ariaLabelledBy, ...props }, ref) => {
    const dims = size === "sm" ? { track: "w-8 h-4.5", thumb: "w-3.5 h-3.5", on: "translate-x-3.5" } : { track: "w-9 h-5", thumb: "w-4 h-4", on: "translate-x-4" };
    return (
      <button
        ref={ref}
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={ariaLabelledBy}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "shrink-0 relative rounded-full transition-colors disabled:opacity-50 disabled:pointer-events-none",
          dims.track,
          checked ? "bg-primary" : "bg-muted",
          className
        )}
        {...props}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 rounded-full bg-background shadow-sm transition-transform",
            dims.thumb,
            checked && dims.on
          )}
        />
      </button>
    );
  }
);
Switch.displayName = "Switch";

export { Switch };

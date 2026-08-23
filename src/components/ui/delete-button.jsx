import * as React from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

// The one delete button used everywhere in the app — icon-only on cards and
// table/list rows, icon+label inside detail modals. Used to be ~13
// independently hand-rolled buttons across the app (different paddings,
// icon sizes, hover colors); new delete actions should use this instead of
// hand-rolling another one.
const DeleteButton = React.forwardRef(
  ({ onClick, label = "Delete", showLabel = false, size = "sm", className, ...props }, ref) => {
    const iconSize = size === "md" ? "w-4 h-4" : "w-3.5 h-3.5";
    return (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        aria-label={label}
        title={label}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors",
          showLabel ? "text-xs px-3 py-1.5" : "p-1",
          className
        )}
        {...props}
      >
        <Trash2 className={iconSize} />
        {showLabel && label}
      </button>
    );
  }
);
DeleteButton.displayName = "DeleteButton";

export { DeleteButton };

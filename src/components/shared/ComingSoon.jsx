import { useId } from "react";
import { cn } from "@/lib/utils";

// Greys out something that isn't available yet (a connector whose sign-in
// app isn't registered) without removing it. Hovering or focusing it shows
// "Coming soon". The content is `inert`, so nothing inside can be clicked,
// focused or typed into; the wrapper itself takes focus so keyboard users
// still hear why it's unavailable.
//
// `placement="corner"` pins the note to the top-right corner (for a whole
// card); the default shows it just above the wrapped control.
export default function ComingSoon({ children, className, placement = "above", label = "Coming soon" }) {
  const id = useId();
  return (
    <div
      tabIndex={0}
      aria-disabled="true"
      aria-describedby={id}
      className={cn(
        "group/soon relative cursor-not-allowed rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring",
        placement === "above" && "inline-block rounded-md",
        className
      )}
    >
      <div inert className="opacity-50 grayscale select-none transition-opacity group-hover/soon:opacity-60">
        {children}
      </div>
      <span
        role="tooltip"
        id={id}
        className={cn(
          "pointer-events-none absolute z-30 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[11px] font-medium text-background shadow-md",
          "opacity-0 translate-y-0.5 transition-[opacity,transform] duration-150",
          "group-hover/soon:opacity-100 group-hover/soon:translate-y-0 group-focus-visible/soon:opacity-100 group-focus-visible/soon:translate-y-0",
          placement === "corner" ? "right-4 top-4" : "left-0 bottom-full mb-1.5"
        )}
      >
        {label}
      </span>
    </div>
  );
}

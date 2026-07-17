import Portal from "@/lib/Portal";
import { clampPositionToViewport } from "@/lib/viewportClamp";

const WIDTH = 224; // w-56
const MAX_HEIGHT = 224; // max-h-56

// "/" command autocomplete dropdown — anchored above the composer input via
// a fixed-position Portal (same reasoning as ChatIconPicker/ChatSessionList:
// the floating widget's panel clips overflow, so anything meant to hang
// outside it has to render outside its DOM subtree).
export default function ChatCommandMenu({ inputRef, matches, activeIndex, onHover, onSelect }) {
  if (!inputRef.current) return null;
  const rect = inputRef.current.getBoundingClientRect();

  // Rendered with `bottom` (grows upward, anchored to the input) so it
  // doesn't need to re-measure as matches change — clamp via an equivalent
  // top-based position using the tallest the menu can possibly be
  // (max-h-56), then convert back to the `bottom` offset it's rendered
  // with, so it can never end up off the top or side of the screen either.
  const { top, left } = clampPositionToViewport({
    top: rect.top - MAX_HEIGHT - 6,
    left: rect.left,
    width: WIDTH,
    height: MAX_HEIGHT,
  });
  const bottom = window.innerHeight - (top + MAX_HEIGHT);

  return (
    <Portal>
      <div
        className="fixed z-[9999] w-56 bg-card border border-border rounded-lg shadow-2xl py-1 max-h-56 overflow-y-auto"
        style={{ left, bottom }}
      >
        {matches.map((cmd, i) => (
          <button
            key={cmd.name}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={() => onHover(i)}
            onClick={() => onSelect(cmd.name)}
            className={`w-full flex items-baseline gap-2 px-3 py-1.5 text-left text-xs ${i === activeIndex ? "bg-secondary" : ""}`}
          >
            <span className="font-mono font-semibold text-foreground">/{cmd.name}</span>
            <span className="text-muted-foreground truncate">{cmd.description}</span>
          </button>
        ))}
      </div>
    </Portal>
  );
}

import { usePositionedMenu } from "@/hooks/usePositionedMenu";
import PositionedPopover from "@/components/shared/PositionedPopover";
import { STATUS_COLORS } from "@/lib/taskUtils";

export const DEFAULT_STATUSES = ["NOT_STARTED", "PENDING_FEEDBACK", "DELEGATED", "IN_PROGRESS", "ON_HOLD", "BLOCKED", "DONE", "DELEGATED_DONE"];

// Shared swatch lookup — DELEGATED_DONE has no colour of its own, it reads
// as Done.
export const statusColor = (status) =>
  STATUS_COLORS[status === "DELEGATED_DONE" ? "DONE" : status || "NOT_STARTED"] || STATUS_COLORS.NOT_STARTED;

// Status dropdown rendered via Portal at document.body, positioned with fixed
// coordinates from the trigger button so table rows can't clip it.
// `variant="dot"` swaps the text pill for a bare colour dot (used in the
// FocusFeed rows, where the description needs every pixel of width).
export default function StatusDropdown({ task, onStatusChange, statusOptions = DEFAULT_STATUSES, variant = "pill" }) {
  const { isOpen, coords, triggerRef, toggle, close } = usePositionedMenu();

  const handleSelect = (status) => {
    onStatusChange(status);
    close();
  };

  // Falls back for tasks created before createTask started defaulting status
  // to NOT_STARTED — those existing records can still have status ===
  // undefined, and .replace() on that crashed the whole app (no error
  // boundary existed until this same investigation).
  const label = (task.status || "NOT_STARTED").replace(/_/g, " ");

  return (
    <>
      {variant === "dot" ? (
        <button
          ref={triggerRef}
          onClick={toggle}
          aria-label={`Status: ${label} — click to change`}
          title={label}
          className="shrink-0 w-3 h-3 rounded-full border border-black/10 dark:border-white/20"
          style={{ backgroundColor: statusColor(task.status) }}
        />
      ) : (
        <button
          ref={triggerRef}
          onClick={toggle}
          className="text-[10px] px-2 py-1 rounded-full bg-secondary text-secondary-foreground border border-border capitalize whitespace-nowrap"
        >
          {label}
        </button>
      )}
      {/* Rendered above full-screen modals (z-50) so the dropdown is never
          clipped by the table's scroll container or hidden behind the modal. */}
      <PositionedPopover
        isOpen={isOpen}
        coords={coords}
        close={close}
        overlayClassName="fixed inset-0 z-[60]"
        panelClassName="absolute bg-card border border-border rounded-md shadow-lg py-1 w-40"
      >
        {statusOptions.map((status) => (
          <button
            key={status}
            onClick={() => handleSelect(status)}
            className="w-full flex items-center gap-2 text-left px-3 py-1.5 text-xs capitalize hover:bg-accent transition-colors"
          >
            <span
              className="shrink-0 w-2.5 h-2.5 rounded-full border border-black/10 dark:border-white/20"
              style={{ backgroundColor: statusColor(status) }}
            />
            {status.replace(/_/g, " ")}
          </button>
        ))}
      </PositionedPopover>
    </>
  );
}

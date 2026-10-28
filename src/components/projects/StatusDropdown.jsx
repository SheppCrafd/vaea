import { usePositionedMenu } from "@/hooks/usePositionedMenu";
import PositionedPopover from "@/components/shared/PositionedPopover";
import { STATUS_COLORS, statusLabel } from "@/lib/taskUtils";

export const DEFAULT_STATUSES = ["NOT_STARTED", "PENDING_FEEDBACK", "DELEGATED", "IN_PROGRESS", "ON_HOLD", "BLOCKED", "DONE", "DELEGATED_DONE"];

// Shared swatch lookup — DELEGATED_DONE has no colour of its own, it reads
// as Done.
export const statusColor = (status) =>
  STATUS_COLORS[status === "DELEGATED_DONE" ? "DONE" : status || "NOT_STARTED"] || STATUS_COLORS.NOT_STARTED;

// Status dropdown rendered via Portal at document.body, positioned with fixed
// coordinates from the trigger button so table rows can't clip it.
// `variant`: "pill" (neutral text pill, the table default) · "dot" (bare
// colour dot, the collapsed FocusFeed row) · "chip" (colour dot + label in
// a tinted pill, the expanded FocusFeed editor).
export default function StatusDropdown({ task, onStatusChange, statusOptions = DEFAULT_STATUSES, variant = "pill" }) {
  const { isOpen, coords, triggerRef, toggle, close } = usePositionedMenu();

  const handleSelect = (status) => {
    onStatusChange(status);
    close();
  };

  // statusLabel falls back to "Not Started" for records created before
  // createTask defaulted a status (status === undefined).
  const label = statusLabel(task.status);
  const ariaLabel = `Status: ${label}. Change status`;

  return (
    <>
      {variant === "dot" ? (
        <button
          ref={triggerRef}
          onClick={toggle}
          aria-label={ariaLabel}
          title={label}
          className="shrink-0 w-3 h-3 rounded-full border border-black/10 dark:border-white/20"
          style={{ backgroundColor: statusColor(task.status) }}
        />
      ) : variant === "chip" ? (
        <button
          ref={triggerRef}
          onClick={toggle}
          aria-label={ariaLabel}
          className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide px-2 py-1 rounded-full border border-border/60 capitalize whitespace-nowrap"
          style={{ backgroundColor: `${statusColor(task.status)}22` }}
        >
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: statusColor(task.status) }} />
          {label}
        </button>
      ) : (
        <button
          ref={triggerRef}
          onClick={toggle}
          aria-label={ariaLabel}
          className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full bg-secondary text-secondary-foreground border border-border whitespace-nowrap hover:bg-accent transition-colors"
        >
          <span
            aria-hidden="true"
            className="w-2 h-2 rounded-full shrink-0 border border-black/10 dark:border-white/20"
            style={{ backgroundColor: statusColor(task.status) }}
          />
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
            {statusLabel(status)}
          </button>
        ))}
      </PositionedPopover>
    </>
  );
}

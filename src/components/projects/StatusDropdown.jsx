import { usePositionedMenu } from "@/hooks/usePositionedMenu";
import PositionedPopover from "@/components/shared/PositionedPopover";

export const DEFAULT_STATUSES = ["NOT_STARTED", "PENDING_FEEDBACK", "DELEGATED", "IN_PROGRESS", "ON_HOLD", "BLOCKED", "DONE", "DELEGATED_DONE"];

// Status dropdown rendered via Portal at document.body, positioned with fixed
// coordinates from the trigger button so table rows can't clip it.
export default function StatusDropdown({ task, onStatusChange, statusOptions = DEFAULT_STATUSES }) {
  const { isOpen, coords, triggerRef, toggle, close } = usePositionedMenu();

  const handleSelect = (status) => {
    onStatusChange(status);
    close();
  };

  return (
    <>
      <button
        ref={triggerRef}
        onClick={toggle}
        className="text-[10px] px-2 py-1 rounded-full bg-secondary text-secondary-foreground border border-border capitalize whitespace-nowrap"
      >
        {/* Falls back for tasks created before createTask started defaulting
            status to NOT_STARTED — those existing records can still have
            status === undefined, and .replace() on that crashed the whole
            app (no error boundary existed until this same investigation). */}
        {(task.status || "NOT_STARTED").replace(/_/g, " ")}
      </button>
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
            className="w-full text-left px-3 py-1.5 text-xs capitalize hover:bg-accent"
          >
            {status.replace(/_/g, " ")}
          </button>
        ))}
      </PositionedPopover>
    </>
  );
}

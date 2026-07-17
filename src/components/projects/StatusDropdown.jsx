import Portal from "@/lib/Portal";
import { usePositionedMenu } from "@/hooks/usePositionedMenu";

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
        className="text-[10px] px-2 py-1 rounded-full bg-secondary text-secondary-foreground capitalize whitespace-nowrap"
      >
        {task.status.replace(/_/g, " ")}
      </button>
      {isOpen && (
        // Rendered above full-screen modals (z-50) so the dropdown is never
        // clipped by the table's scroll container or hidden behind the modal.
        <Portal>
          <div className="fixed inset-0 z-[60]" onClick={close}>
            <div
              className="absolute bg-card border border-border rounded-md shadow-lg py-1 w-40"
              style={{ top: coords.top, left: coords.left }}
              onClick={(e) => e.stopPropagation()}
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
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}

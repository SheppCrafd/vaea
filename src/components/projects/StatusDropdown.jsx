import { useState, useRef } from "react";
import Portal from "@/lib/Portal";

const DEFAULT_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "DELEGATED", "PENDING_FEEDBACK", "ON_HOLD", "BLOCKED", "DONE", "DELEGATED_DONE"];

// Status dropdown rendered via Portal at document.body, positioned with fixed
// coordinates from the trigger button so table rows can't clip it.
export default function StatusDropdown({ task, onStatusChange, statusOptions = DEFAULT_STATUSES }) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const buttonRef = useRef(null);

  const handleToggle = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setCoords({ top: rect.bottom + 4, left: rect.left });
    }
    setIsOpen((prev) => !prev);
  };

  const handleSelect = (status) => {
    onStatusChange(status);
    setIsOpen(false);
  };

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className="text-[10px] px-2 py-1 rounded-full bg-secondary text-secondary-foreground capitalize whitespace-nowrap"
      >
        {task.status.replace(/_/g, " ")}
      </button>
      {isOpen && (
        // Rendered above full-screen modals (z-50) so the dropdown is never
        // clipped by the table's scroll container or hidden behind the modal.
        <Portal>
          <div className="fixed inset-0 z-[60]" onClick={() => setIsOpen(false)}>
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
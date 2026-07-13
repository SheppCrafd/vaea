import { useState, useRef } from "react";
import Portal from "@/lib/Portal";
import { useAppStore } from "@/lib/store";

const STATUSES = ["todo", "in_progress", "done"];

// Status dropdown rendered via Portal at document.body, positioned with fixed
// coordinates from the trigger button so table rows can't clip it.
export default function StatusDropdown({ task }) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const buttonRef = useRef(null);
  const updateTaskStatus = useAppStore((s) => s.updateTaskStatus);

  const handleToggle = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setCoords({ top: rect.bottom + 4, left: rect.left });
    }
    setIsOpen((prev) => !prev);
  };

  const handleSelect = (status) => {
    updateTaskStatus(task.id, status);
    setIsOpen(false);
  };

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className="text-xs px-2 py-1 rounded-full bg-secondary text-secondary-foreground capitalize"
      >
        {task.status.replace("_", " ")}
      </button>
      {isOpen && (
        <Portal>
          <div className="fixed inset-0 z-[60]" onClick={() => setIsOpen(false)}>
            <div
              className="absolute bg-card border border-border rounded-md shadow-lg py-1 w-32"
              style={{ top: coords.top, left: coords.left }}
              onClick={(e) => e.stopPropagation()}
            >
              {STATUSES.map((status) => (
                <button
                  key={status}
                  onClick={() => handleSelect(status)}
                  className="w-full text-left px-3 py-1.5 text-xs capitalize hover:bg-accent"
                >
                  {status.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}
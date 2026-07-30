import { useEffect } from "react";
import { X } from "lucide-react";
import Modal from "@/components/shared/Modal";
import TaskTable from "@/components/projects/TaskTable";

export default function TaskTableModal({ project, onClose }) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <Modal
      isOpen
      onClose={onClose}
      label={project.title}
      overlayClassName="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6"
      // Width tracks the viewport (94vw, capped at 1400px on very wide
      // screens) instead of the old max-w-4xl — the task table has nine
      // dense columns and earns the horizontal room.
      panelClassName="bg-card rounded-xl shadow-xl w-full max-w-[min(1400px,94vw)] max-h-[85vh] flex flex-col"
    >
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="font-heading font-semibold">{project.title}</h2>
        <button onClick={onClose} aria-label="Close"><X className="w-4 h-4" /></button>
      </div>
      <div className="overflow-y-auto p-2">
        <TaskTable project={project} />
      </div>
    </Modal>
  );
}
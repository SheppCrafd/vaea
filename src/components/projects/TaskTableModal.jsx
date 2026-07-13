import { useEffect } from "react";
import { X } from "lucide-react";
import Portal from "@/lib/Portal";
import { useAppStore } from "@/lib/store";

const MAX_ROWS = 20;

// Static task table modal — capped at 20 rows to mock DOM virtualization.
export default function TaskTableModal({ project, onClose }) {
  const tasks = useAppStore((s) => s.tasks.filter((t) => t.projectId === project.id));

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <Portal>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6" onClick={onClose}>
        <div className="bg-card rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="font-heading font-semibold">{project.title}</h2>
            <button onClick={onClose}><X className="w-4 h-4" /></button>
          </div>
          <div className="overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="p-3 font-medium">Description</th>
                  <th className="p-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {tasks.slice(0, MAX_ROWS).map((task) => (
                  <tr key={task.id} className="border-b border-border last:border-0">
                    <td className="p-3">{task.description}</td>
                    <td className="p-3 capitalize">{task.status.replace("_", " ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Portal>
  );
}
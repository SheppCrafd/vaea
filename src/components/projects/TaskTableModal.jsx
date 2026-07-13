import { useState, useRef, useMemo, useEffect } from "react";
import { X } from "lucide-react";
import Portal from "@/lib/Portal";
import { useAppStore } from "@/lib/store";
import StatusDropdown from "@/components/projects/StatusDropdown";

const MAX_ROWS = 20;

// Static task table modal — capped at 20 rows to mock DOM virtualization,
// with clickable sort headers, a rapid-entry row, and portal-based status dropdowns.
export default function TaskTableModal({ project, onClose }) {
  const tasks = useAppStore((s) => s.tasks.filter((t) => t.projectId === project.id));
  const addTask = useAppStore((s) => s.addTask);
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState("asc");
  const [newDescription, setNewDescription] = useState("");
  const newRowInputRef = useRef(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const sortedTasks = useMemo(() => {
    if (!sortColumn) return tasks;
    const sorted = [...tasks].sort((a, b) => a[sortColumn].localeCompare(b[sortColumn]));
    return sortDirection === "asc" ? sorted : sorted.reverse();
  }, [tasks, sortColumn, sortDirection]);

  const handleNewTaskKeyDown = (e) => {
    if (e.key === "Enter" && newDescription.trim()) {
      addTask({ id: `task-${Date.now()}`, projectId: project.id, description: newDescription, status: "todo" });
      setNewDescription("");
      // Simulate rapid entry: refocus the blank input for the next row
      requestAnimationFrame(() => newRowInputRef.current?.focus());
    }
  };

  const SortHeader = ({ column, label }) => (
    <th className="p-3 font-medium cursor-pointer select-none" onClick={() => handleSort(column)}>
      {label}{sortColumn === column ? (sortDirection === "asc" ? " ▲" : " ▼") : ""}
    </th>
  );

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
                  <SortHeader column="description" label="Description" />
                  <SortHeader column="status" label="Status" />
                </tr>
              </thead>
              <tbody>
                {sortedTasks.slice(0, MAX_ROWS).map((task) => (
                  <tr key={task.id} className="border-b border-border last:border-0">
                    <td className="p-3">{task.description}</td>
                    <td className="p-3"><StatusDropdown task={task} /></td>
                  </tr>
                ))}
                <tr>
                  <td className="p-2" colSpan={2}>
                    <input
                      ref={newRowInputRef}
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      onKeyDown={handleNewTaskKeyDown}
                      placeholder="Type a task and press Enter..."
                      className="w-full text-sm px-2 py-1.5 bg-transparent border border-dashed border-border rounded outline-none"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Portal>
  );
}
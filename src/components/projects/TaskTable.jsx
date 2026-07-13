import { useState, useRef, useMemo } from "react";
import { Star, Trash2, Plus, Archive } from "lucide-react";
import { useTasks, useCreateTask, useUpdateTask, useToggleTopThree, useDeleteTask } from "@/hooks/useTasks";
import { useToast } from "@/components/ui/use-toast";
import { useHighlight } from "@/lib/HighlightContext";
import StatusDropdown from "@/components/projects/StatusDropdown";
import EditableText from "@/components/shared/EditableText";

const MAX_ROWS = 20;
const TYPE_OPTIONS = ["COMMUNICATION", "OPEN_QUESTIONS", "SCRUM_NEEDS", "EMPLOYEE_NEEDS", "OTHER"];

function quadrantLabel(task) {
  const q = task.quadrant || 4;
  let suffix = "";
  if (task.is_highly_important) suffix += "H";
  if (task.is_quick_task) suffix += "Q";
  return `${q}${suffix}`;
}

// Presentational task grid — reused both inside the popup TaskTableModal and
// inline within ProjectDetailModal.
export default function TaskTable({ project }) {
  const { data: tasks = [] } = useTasks(project.id);
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const toggleTopThree = useToggleTopThree();
  const deleteTask = useDeleteTask();
  const { toast } = useToast();
  const { highlightedIds } = useHighlight();

  const handleDelete = (task) => {
    if (window.confirm(`Delete task "${task.description}"? This cannot be undone.`)) {
      deleteTask.mutate(task.id);
    }
  };

  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState("asc");
  const [newDescription, setNewDescription] = useState("");
  const [newQuadrant, setNewQuadrant] = useState("");
  const newRowInputRef = useRef(null);

  const handleSort = (column) => {
    if (sortColumn === column) setSortDirection((p) => (p === "asc" ? "desc" : "asc"));
    else { setSortColumn(column); setSortDirection("asc"); }
  };

  const sortedTasks = useMemo(() => {
    if (!sortColumn) return tasks;
    const sorted = [...tasks].sort((a, b) => String(a[sortColumn]).localeCompare(String(b[sortColumn])));
    return sortDirection === "asc" ? sorted : sorted.reverse();
  }, [tasks, sortColumn, sortDirection]);

  const handleNewTaskKeyDown = (e) => {
    if (e.key === "Enter" && (newDescription.trim() || newQuadrant)) {
      const payload = { project_id: project.id };
      if (newDescription.trim()) payload.description = newDescription.trim();
      if (newQuadrant !== "") payload.quadrant = newQuadrant === "" ? null : Number(newQuadrant);
      createTask.mutate(payload);
      setNewDescription("");
      setNewQuadrant("");
      requestAnimationFrame(() => newRowInputRef.current?.focus());
    }
  };

  const handleCreateButton = () => {
    if (newDescription.trim() || newQuadrant) {
      const payload = { project_id: project.id };
      if (newDescription.trim()) payload.description = newDescription.trim();
      if (newQuadrant !== "") payload.quadrant = newQuadrant === "" ? null : Number(newQuadrant);
      createTask.mutate(payload);
      setNewDescription("");
      setNewQuadrant("");
      requestAnimationFrame(() => newRowInputRef.current?.focus());
    }
  };

  const handleToggleTopThree = (task) => {
    toggleTopThree.mutate(
      { id: task.id, project_id: project.id },
      {
        onError: (err) => {
          toast({
            variant: "destructive",
            title: "Can't add to Top 3",
            description: err?.response?.data?.error || "Only 3 top-three tasks are allowed per project.",
          });
        },
      }
    );
  };

  const isDimmed = (task) =>
    highlightedIds.length > 0 && !(task.stakeholder_ids || []).some((id) => highlightedIds.includes(id));

  const SortHeader = ({ column, label }) => (
    <th className="p-2 font-medium cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort(column)}>
      {label}{sortColumn === column ? (sortDirection === "asc" ? " ▲" : " ▼") : ""}
    </th>
  );

  return (
    <table className="w-full text-xs">
      <thead className="sticky top-0 bg-card">
        <tr className="text-left text-muted-foreground border-b border-border">
          <SortHeader column="description" label="Description" />
          <th className="p-2 font-medium">Status</th>
          <th className="p-2 font-medium">Quad.</th>
          <th className="p-2 font-medium">Type</th>
          <th className="p-2 font-medium">Notes</th>
          <th className="p-2 font-medium">Weekly</th>
          <th className="p-2 font-medium">Top 3</th>
          <th className="p-2 font-medium">Actions</th>
        </tr>
      </thead>
      <tbody>
        {sortedTasks.length === 0 && (
          <tr>
            <td className="p-2 text-muted-foreground text-center" colSpan={8}>No active tasks</td>
          </tr>
        )}
        {sortedTasks.slice(0, MAX_ROWS).map((task) => (
          <tr key={task.id} className={`border-b border-border last:border-0 ${isDimmed(task) ? "opacity-30" : ""}`}>
            <td className="p-2 min-w-0 max-w-[220px]">
              <EditableText
                value={task.description}
                onSave={(v) => updateTask.mutate({ id: task.id, data: { description: v } })}
                className="text-xs"
              />
            </td>
            <td className="p-2">
              <StatusDropdown task={task} onStatusChange={(status) => updateTask.mutate({ id: task.id, data: { status } })} />
            </td>
            <td className="p-2 text-center whitespace-nowrap">
              {/* Quadrant selector: allows user to change quadrant in-place */}
              <select
                value={task.quadrant ?? ""}
                onChange={(e) => updateTask.mutate({ id: task.id, data: { quadrant: e.target.value === "" ? null : Number(e.target.value) } })}
                className="text-[10px] bg-transparent border border-border rounded px-1 py-0.5"
                aria-label={`Quadrant for task ${task.id}`}
              >
                <option value="">Unassigned</option>
                <option value="1">Q1</option>
                <option value="2">Q2</option>
                <option value="3">Q3</option>
                <option value="4">Q4</option>
              </select>
            </td>
            <td className="p-2">
              <select
                value={task.type || "OTHER"}
                onChange={(e) => updateTask.mutate({ id: task.id, data: { type: e.target.value } })}
                className="text-[10px] bg-transparent border border-border rounded px-1 py-0.5"
              >
                {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
              </select>
            </td>
            <td className="p-2 min-w-0 max-w-[160px]">
              <EditableText
                value={task.notes}
                onSave={(v) => updateTask.mutate({ id: task.id, data: { notes: v } })}
                placeholder="Add notes..."
                className="text-[11px]"
              />
            </td>
            <td className="p-2 text-center">
              <input
                type="checkbox"
                checked={!!task.is_weekly_focus}
                onChange={(e) => updateTask.mutate({ id: task.id, data: { is_weekly_focus: e.target.checked } })}
              />
            </td>
            <td className="p-2 text-center">
              <button onClick={() => handleToggleTopThree(task)} aria-label="Toggle top 3">
                <Star className={`w-4 h-4 ${task.is_today_top_three ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
              </button>
            </td>
            <td className="p-2 text-center flex items-center justify-center gap-2">
              <button onClick={() => updateTask.mutate({ id: task.id, data: { archived_at: new Date().toISOString() } })} aria-label="Archive task" className="text-muted-foreground hover:text-foreground">
                <Archive className="w-4 h-4" />
              </button>
              <button onClick={() => handleDelete(task)} aria-label="Delete task" className="text-muted-foreground hover:text-destructive">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </td>
          </tr>
        ))}
        <tr>
          <td className="p-2 flex items-center gap-2" colSpan={6}>
            <button onClick={handleCreateButton} aria-label="New task" className="text-primary/90 bg-primary/10 p-1 rounded">
              <Plus className="w-4 h-4" />
            </button>
            <input
              ref={newRowInputRef}
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              onKeyDown={handleNewTaskKeyDown}
              placeholder="Type a task and press Enter (or click +)"
              className="w-full text-xs px-2 py-1.5 bg-transparent border border-dashed border-border rounded outline-none"
            />
          </td>
          <td className="p-2">
            <select
              value={newQuadrant}
              onChange={(e) => setNewQuadrant(e.target.value)}
              className="text-[10px] bg-transparent border border-border rounded px-1 py-0.5"
              aria-label="Quadrant for new task"
            >
              <option value="">Unassigned</option>
              <option value="1">Q1</option>
              <option value="2">Q2</option>
              <option value="3">Q3</option>
              <option value="4">Q4</option>
            </select>
          </td>
          <td className="p-2" colSpan={2}></td>
        </tr>
      </tbody>
    </table>
  );
}

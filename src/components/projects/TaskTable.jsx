import { useState, useRef, useMemo } from "react";
import { useDroppable } from "@dnd-kit/core";
import { Star, Trash2, Plus, Archive } from "lucide-react";
import { useTasks, useCreateTask, useUpdateTask, useToggleTopThree, useDeleteTask } from "@/hooks/useTasks";
import { useStakeholders } from "@/hooks/useStakeholders";
import { useToast } from "@/components/ui/use-toast";
import { useHighlight } from "@/lib/HighlightContext";
import { isDimmedByHighlight } from "@/hooks/useHighlightDim";
import { confirmThen } from "@/lib/entityUtils";
import StatusDropdown from "@/components/projects/StatusDropdown";
import TaskAttachments from "@/components/projects/TaskAttachments";
import EditableText from "@/components/shared/EditableText";
import StakeholderAssigner from "@/components/shared/StakeholderAssigner";

const MAX_ROWS = 20;
const TYPE_OPTIONS = ["COMMUNICATION", "OPEN_QUESTIONS", "SCRUM_NEEDS", "EMPLOYEE_NEEDS", "OTHER"];

// Own component (not just a mapped <tr>) so it can be a stakeholder-drop
// target — dragging a stakeholder from the sidebar onto a task row assigns
// them to it.
function TaskRow({ task, allStakeholders, isDimmed, updateTask, onToggleTopThree, onDelete }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `task-drop-${task.id}`,
    data: { type: "task", id: task.id },
  });

  return (
    <tr
      ref={setNodeRef}
      className={`border-b border-border last:border-0 transition-opacity ${isDimmed ? "opacity-30" : ""} ${isOver ? "ring-2 ring-inset ring-primary bg-primary/5" : ""}`}
    >
      <td className="p-2 min-w-0 max-w-[200px]">
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
        <div className="flex items-center justify-center gap-1">
          {/* The spec's actual display format — "1H", "2HQ", etc — combined
              into one label; the select + toggle buttons below are what edit
              those same two underlying fields (quadrant, H/Q flags). */}
          <span className="text-[10px] font-semibold tabular-nums w-6 shrink-0" title="Quadrant notation">
            {task.quadrant ?? "—"}
            {task.is_highly_important ? "H" : ""}
            {task.is_quick_task ? "Q" : ""}
          </span>
          <select
            value={task.quadrant ?? ""}
            onChange={(e) => updateTask.mutate({ id: task.id, data: { quadrant: e.target.value === "" ? null : Number(e.target.value) } })}
            className="text-[10px] bg-transparent border border-border rounded px-1 py-0.5"
            aria-label={`Quadrant for task ${task.id}`}
          >
            <option value="">—</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
          </select>
          <button
            onClick={() => updateTask.mutate({ id: task.id, data: { is_highly_important: !task.is_highly_important } })}
            aria-label="Toggle highly important"
            title="Highly important"
            className={`w-4 h-4 text-[9px] font-bold rounded border ${task.is_highly_important ? "bg-red-500 text-white border-red-500" : "text-muted-foreground border-border"}`}
          >
            H
          </button>
          <button
            onClick={() => updateTask.mutate({ id: task.id, data: { is_quick_task: !task.is_quick_task } })}
            aria-label="Toggle quick task"
            title="Quick task"
            className={`w-4 h-4 text-[9px] font-bold rounded border ${task.is_quick_task ? "bg-blue-500 text-white border-blue-500" : "text-muted-foreground border-border"}`}
          >
            Q
          </button>
        </div>
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
      <td className="p-2 whitespace-nowrap">
        <StakeholderAssigner
          currentStakeholderIds={task.stakeholder_ids || []}
          allStakeholders={allStakeholders}
          onSave={(newIds) => updateTask.mutate({ id: task.id, data: { stakeholder_ids: newIds } })}
        />
      </td>
      <td className="p-2 text-center whitespace-nowrap">
        <TaskAttachments
          attachments={task.attachments || []}
          onSave={(newAttachments) => updateTask.mutate({ id: task.id, data: { attachments: newAttachments } })}
        />
      </td>
      <td className="p-2 min-w-0 max-w-[140px]">
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
        <button onClick={() => onToggleTopThree(task)} aria-label="Toggle top 3">
          <Star className={`w-4 h-4 ${task.is_today_top_three ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
        </button>
      </td>
      <td className="p-2 text-center flex items-center justify-center gap-2">
        <button onClick={() => updateTask.mutate({ id: task.id, data: { archived_at: new Date().toISOString() } })} aria-label="Archive task" className="text-muted-foreground hover:text-foreground">
          <Archive className="w-4 h-4" />
        </button>
        <button onClick={() => onDelete(task)} aria-label="Delete task" className="text-muted-foreground hover:text-destructive">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  );
}

export default function TaskTable({ project }) {
  const { data: tasks = [] } = useTasks(project.id);
  const { data: allStakeholders = [] } = useStakeholders();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const toggleTopThree = useToggleTopThree();
  const deleteTask = useDeleteTask();
  const { toast } = useToast();
  const { highlights } = useHighlight();

  const handleDelete = (task) => {
    confirmThen(`Delete task "${task.description}"? This cannot be undone.`, () => deleteTask.mutate(task.id));
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

  // Description is the one required field ("a task can be created with any
  // field [blank] but description") — every other field, including
  // quadrant, is optional at creation time and can be set later from the row.
  const createNewTask = () => {
    if (!newDescription.trim()) return;
    const payload = { project_id: project.id, description: newDescription.trim() };
    if (newQuadrant !== "") payload.quadrant = Number(newQuadrant);
    createTask.mutate(payload);
    setNewDescription("");
    setNewQuadrant("");
    requestAnimationFrame(() => newRowInputRef.current?.focus());
  };

  const handleNewTaskKeyDown = (e) => {
    if (e.key === "Enter") createNewTask();
  };

  const handleCreateButton = () => createNewTask();

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

  const isDimmed = (task) => isDimmedByHighlight(highlights, "tasks", task.stakeholder_ids || []);

  const SortHeader = ({ column, label }) => (
    <th className="p-2 font-medium cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort(column)}>
      {label}{sortColumn === column ? (sortDirection === "asc" ? " ▲" : " ▼") : ""}
    </th>
  );

  return (
    <table className="w-full text-xs">
      <thead className="sticky top-0 bg-card z-10">
        <tr className="text-left text-muted-foreground border-b border-border">
          <SortHeader column="description" label="Description" />
          <th className="p-2 font-medium">Status</th>
          <th className="p-2 font-medium">Quad.</th>
          <th className="p-2 font-medium">Type</th>
          <th className="p-2 font-medium">Stakeholders</th>
          <th className="p-2 font-medium">Files</th>
          <th className="p-2 font-medium">Notes</th>
          <th className="p-2 font-medium">Weekly</th>
          <th className="p-2 font-medium">Top 3</th>
          <th className="p-2 font-medium">Actions</th>
        </tr>
      </thead>
      <tbody>
        {sortedTasks.length === 0 && (
          <tr>
            <td className="p-2 text-muted-foreground text-center" colSpan={10}>No active tasks</td>
          </tr>
        )}
        {sortedTasks.slice(0, MAX_ROWS).map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            allStakeholders={allStakeholders}
            isDimmed={isDimmed(task)}
            updateTask={updateTask}
            onToggleTopThree={handleToggleTopThree}
            onDelete={handleDelete}
          />
        ))}
        <tr className="bg-blue-500/10">
          <td className="p-2 flex items-center gap-2" colSpan={2}>
            <button onClick={handleCreateButton} aria-label="New task" className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 shrink-0">
              <Plus className="w-4 h-4" />
              New Task
            </button>
            <input
              ref={newRowInputRef}
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              onKeyDown={handleNewTaskKeyDown}
              placeholder="Type a task and press Enter (or click +)"
              className="w-full text-xs px-2 py-1.5 bg-background border border-dashed border-border rounded outline-none"
            />
          </td>
          <td className="p-2">
            <select
              value={newQuadrant}
              onChange={(e) => setNewQuadrant(e.target.value)}
              className="text-[10px] bg-background border border-border rounded px-1 py-0.5"
              aria-label="Quadrant for new task"
            >
              <option value="">—</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
            </select>
          </td>
          <td className="p-2" colSpan={7}></td>
        </tr>
      </tbody>
    </table>
  );
}

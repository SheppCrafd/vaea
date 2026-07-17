import { useState, useRef, useMemo } from "react";
import { useDroppable } from "@dnd-kit/core";
import { Star, Trash2, Plus, Archive } from "lucide-react";
import { useTasks, useCreateTask, useUpdateTask, useToggleTopThree, useDeleteTask } from "@/hooks/useTasks";
import { useStakeholders } from "@/hooks/useStakeholders";
import { useToast } from "@/components/ui/use-toast";
import { useHighlight } from "@/lib/HighlightContext";
import { isHighlightMatch } from "@/hooks/useHighlightDim";
import { confirmThen } from "@/lib/entityUtils";
import { isTaskDone } from "@/lib/taskUtils";
import StatusDropdown, { DEFAULT_STATUSES } from "@/components/projects/StatusDropdown";
import TaskAttachments from "@/components/projects/TaskAttachments";
import EditableText from "@/components/shared/EditableText";
import StakeholderAssigner from "@/components/shared/StakeholderAssigner";
import ColumnFilterMenu from "@/components/shared/ColumnFilterMenu";

const MAX_ROWS = 20;
const TYPE_OPTIONS = ["COMMUNICATION", "OPEN_QUESTIONS", "SCRUM_NEEDS", "EMPLOYEE_NEEDS", "OTHER"];
const QUADRANT_OPTIONS = [
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "4", label: "4" },
  { value: "unassigned", label: "Unassigned" },
];
const STATUS_FILTER_OPTIONS = DEFAULT_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, " ") }));
const TYPE_FILTER_OPTIONS = TYPE_OPTIONS.map((t) => ({ value: t, label: t.replace(/_/g, " ") }));

const EMPTY_FILTERS = {
  description: "",
  status: [],
  quadrant: [],
  type: [],
  stakeholders: [],
  notes: "",
  files: "all",
  weekly: "all",
  top3: "all",
};

function taskMatchesFilters(task, filters) {
  if (filters.description && !(task.description || "").toLowerCase().includes(filters.description.toLowerCase())) return false;
  if (filters.status.length && !filters.status.includes(task.status || "NOT_STARTED")) return false;
  if (filters.quadrant.length) {
    const q = task.quadrant ? String(task.quadrant) : "unassigned";
    if (!filters.quadrant.includes(q)) return false;
  }
  if (filters.type.length && !filters.type.includes(task.type || "OTHER")) return false;
  if (filters.stakeholders.length && !(task.stakeholder_ids || []).some((id) => filters.stakeholders.includes(id))) return false;
  if (filters.notes && !(task.notes || "").toLowerCase().includes(filters.notes.toLowerCase())) return false;
  if (filters.files !== "all") {
    const hasFiles = (task.attachments || []).length > 0;
    if ((filters.files === "yes") !== hasFiles) return false;
  }
  if (filters.weekly !== "all" && (filters.weekly === "yes") !== !!task.is_weekly_focus) return false;
  if (filters.top3 !== "all" && (filters.top3 === "yes") !== !!task.is_today_top_three) return false;
  return true;
}

function getSortValue(task, column) {
  switch (column) {
    case "quadrant":
      return task.quadrant ?? 5;
    case "status": {
      const i = DEFAULT_STATUSES.indexOf(task.status || "NOT_STARTED");
      return i === -1 ? DEFAULT_STATUSES.length : i;
    }
    case "weekly":
      return task.is_weekly_focus ? 1 : 0;
    case "top3":
      return task.is_today_top_three ? 1 : 0;
    case "stakeholders":
      return (task.stakeholder_ids || []).length;
    case "files":
      return (task.attachments || []).length;
    default:
      return (task[column] ?? "").toString().toLowerCase();
  }
}

// Sortable + filterable column header — a label (click to sort, with an
// arrow indicating direction) plus a ColumnFilterMenu funnel trigger.
function ColumnHeader({ column, label, sortColumn, sortDirection, onSort, children }) {
  return (
    <th className="p-2 font-medium whitespace-nowrap">
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => onSort(column)} className="flex items-center gap-0.5 select-none">
          {label}{sortColumn === column ? (sortDirection === "asc" ? " ▲" : " ▼") : ""}
        </button>
        {children}
      </div>
    </th>
  );
}

// Own component (not just a mapped <tr>) so it can be a stakeholder-drop
// target — dragging a stakeholder from the sidebar onto a task row assigns
// them to it.
function TaskRow({ task, allStakeholders, isMatched, updateTask, onToggleTopThree, onDelete }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `task-drop-${task.id}`,
    data: { type: "task", id: task.id },
  });

  return (
    <tr
      ref={setNodeRef}
      className={`border-b border-border last:border-0 transition-colors ${isMatched ? "bg-primary/5" : ""} ${isOver ? "ring-2 ring-inset ring-primary bg-primary/5" : ""}`}
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
          <span className="text-xs font-semibold tabular-nums w-6 shrink-0" title="Quadrant notation">
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

  // Default view is sorted by Quadrant, per direct user request.
  const [sortColumn, setSortColumn] = useState("quadrant");
  const [sortDirection, setSortDirection] = useState("asc");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [newDescription, setNewDescription] = useState("");
  const [newQuadrant, setNewQuadrant] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [newType, setNewType] = useState("");
  const [newStakeholderIds, setNewStakeholderIds] = useState([]);
  const [newNotes, setNewNotes] = useState("");
  const [newWeekly, setNewWeekly] = useState(false);
  const newRowInputRef = useRef(null);

  const handleSort = (column) => {
    if (sortColumn === column) setSortDirection((p) => (p === "asc" ? "desc" : "asc"));
    else { setSortColumn(column); setSortDirection("asc"); }
  };

  const setTextFilter = (column, value) => setFilters((f) => ({ ...f, [column]: value }));
  const setTriStateFilter = (column, value) => setFilters((f) => ({ ...f, [column]: value }));
  const toggleChecklistFilter = (column, value) =>
    setFilters((f) => ({
      ...f,
      [column]: f[column].includes(value) ? f[column].filter((v) => v !== value) : [...f[column], value],
    }));
  const clearChecklistFilter = (column) => setFilters((f) => ({ ...f, [column]: [] }));

  const filteredTasks = useMemo(() => tasks.filter((t) => taskMatchesFilters(t, filters)), [tasks, filters]);

  const sortedTasks = useMemo(() => {
    if (!sortColumn) return filteredTasks;
    const sorted = [...filteredTasks].sort((a, b) => {
      const av = getSortValue(a, sortColumn);
      const bv = getSortValue(b, sortColumn);
      if (typeof av === "number" && typeof bv === "number") return av - bv;
      return String(av).localeCompare(String(bv));
    });
    return sortDirection === "asc" ? sorted : sorted.reverse();
  }, [filteredTasks, sortColumn, sortDirection]);

  // Description is the one required field ("a task can be created with any
  // field [blank] but description") — every other field is optional at
  // creation time and can also be set later from the row; these just let the
  // user fill them in up front instead of always needing a second pass.
  const createNewTask = () => {
    if (!newDescription.trim()) return;
    const payload = { project_id: project.id, description: newDescription.trim() };
    if (newQuadrant !== "") payload.quadrant = Number(newQuadrant);
    if (newStatus !== "") payload.status = newStatus;
    if (newType !== "") payload.type = newType;
    if (newStakeholderIds.length) payload.stakeholder_ids = newStakeholderIds;
    if (newNotes.trim()) payload.notes = newNotes.trim();
    if (newWeekly) payload.is_weekly_focus = true;
    createTask.mutate(payload);
    setNewDescription("");
    setNewQuadrant("");
    setNewStatus("");
    setNewType("");
    setNewStakeholderIds([]);
    setNewNotes("");
    setNewWeekly(false);
    requestAnimationFrame(() => newRowInputRef.current?.focus());
  };

  const handleNewTaskKeyDown = (e) => {
    if (e.key === "Enter") createNewTask();
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

  const isMatched = (task) => isHighlightMatch(highlights, "tasks", task.stakeholder_ids || []);

  const doneTasks = tasks.filter((t) => isTaskDone(t) && !t.archived_at);
  const handleClearDone = () => {
    if (doneTasks.length === 0) return;
    confirmThen(`Archive ${doneTasks.length} done task${doneTasks.length === 1 ? "" : "s"}? They'll still be viewable (and restorable) from Archived tasks.`, () => {
      doneTasks.forEach((t) => updateTask.mutate({ id: t.id, data: { archived_at: new Date().toISOString() } }));
    });
  };

  return (
    <div>
      <div className="flex items-center justify-end mb-1.5">
        <button
          onClick={handleClearDone}
          disabled={doneTasks.length === 0}
          className="text-xs px-2.5 py-1 rounded-md bg-secondary text-secondary-foreground hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Clear Done
        </button>
      </div>
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-card z-10">
          <tr className="text-left text-muted-foreground border-b border-border">
            <ColumnHeader column="description" label="Description" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>
              <ColumnFilterMenu mode="text" text={filters.description} onTextChange={(v) => setTextFilter("description", v)} />
            </ColumnHeader>
            <ColumnHeader column="status" label="Status" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>
              <ColumnFilterMenu
                mode="checklist"
                options={STATUS_FILTER_OPTIONS}
                selected={filters.status}
                onToggleOption={(v) => toggleChecklistFilter("status", v)}
                onClearOptions={() => clearChecklistFilter("status")}
              />
            </ColumnHeader>
            <ColumnHeader column="quadrant" label="Quadrant" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>
              <ColumnFilterMenu
                mode="checklist"
                options={QUADRANT_OPTIONS}
                selected={filters.quadrant}
                onToggleOption={(v) => toggleChecklistFilter("quadrant", v)}
                onClearOptions={() => clearChecklistFilter("quadrant")}
              />
            </ColumnHeader>
            <ColumnHeader column="type" label="Type" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>
              <ColumnFilterMenu
                mode="checklist"
                options={TYPE_FILTER_OPTIONS}
                selected={filters.type}
                onToggleOption={(v) => toggleChecklistFilter("type", v)}
                onClearOptions={() => clearChecklistFilter("type")}
              />
            </ColumnHeader>
            <ColumnHeader column="stakeholders" label="Stakeholders" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>
              <ColumnFilterMenu
                mode="checklist"
                options={allStakeholders.map((s) => ({ value: s.id, label: s.name }))}
                selected={filters.stakeholders}
                onToggleOption={(v) => toggleChecklistFilter("stakeholders", v)}
                onClearOptions={() => clearChecklistFilter("stakeholders")}
              />
            </ColumnHeader>
            <ColumnHeader column="files" label="Files" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>
              <ColumnFilterMenu mode="triState" triState={filters.files} onTriStateChange={(v) => setTriStateFilter("files", v)} />
            </ColumnHeader>
            <ColumnHeader column="notes" label="Notes" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>
              <ColumnFilterMenu mode="text" text={filters.notes} onTextChange={(v) => setTextFilter("notes", v)} />
            </ColumnHeader>
            <ColumnHeader column="weekly" label="Weekly" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>
              <ColumnFilterMenu mode="triState" triState={filters.weekly} onTriStateChange={(v) => setTriStateFilter("weekly", v)} />
            </ColumnHeader>
            <ColumnHeader column="top3" label="Top 3" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>
              <ColumnFilterMenu mode="triState" triState={filters.top3} onTriStateChange={(v) => setTriStateFilter("top3", v)} />
            </ColumnHeader>
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
              isMatched={isMatched(task)}
              updateTask={updateTask}
              onToggleTopThree={handleToggleTopThree}
              onDelete={handleDelete}
            />
          ))}
          <tr className="bg-blue-500/10">
            <td className="p-2 min-w-0">
              <div className="flex items-center gap-1.5">
                <button onClick={createNewTask} aria-label="New task" className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 shrink-0">
                  <Plus className="w-4 h-4" />
                  New Task
                </button>
                <input
                  ref={newRowInputRef}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  onKeyDown={handleNewTaskKeyDown}
                  placeholder="Type a task and press Enter (or click +)"
                  className="w-full min-w-0 text-xs px-2 py-1.5 bg-background border border-dashed border-border rounded outline-none"
                />
              </div>
            </td>
            <td className="p-2">
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="text-[10px] bg-background border border-border rounded px-1 py-0.5"
                aria-label="Status for new task"
              >
                <option value="">—</option>
                {DEFAULT_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
              </select>
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
            <td className="p-2">
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="text-[10px] bg-background border border-border rounded px-1 py-0.5"
                aria-label="Type for new task"
              >
                <option value="">—</option>
                {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
              </select>
            </td>
            <td className="p-2 whitespace-nowrap">
              <StakeholderAssigner
                currentStakeholderIds={newStakeholderIds}
                allStakeholders={allStakeholders}
                onSave={setNewStakeholderIds}
              />
            </td>
            <td className="p-2"></td>
            <td className="p-2 min-w-0 max-w-[140px]">
              <input
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                onKeyDown={handleNewTaskKeyDown}
                placeholder="Notes..."
                className="w-full min-w-0 text-[11px] px-1.5 py-1 bg-background border border-dashed border-border rounded outline-none"
              />
            </td>
            <td className="p-2 text-center">
              <input type="checkbox" checked={newWeekly} onChange={(e) => setNewWeekly(e.target.checked)} aria-label="Weekly focus for new task" />
            </td>
            <td className="p-2" colSpan={2}></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

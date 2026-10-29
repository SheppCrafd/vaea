import { useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router";
import { useDroppable } from "@dnd-kit/core";
import { Star, Plus, Archive, Sparkles } from "lucide-react";
import { DeleteButton } from "@/components/ui/delete-button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select } from "@/components/ui/select";
import { useTasks, useCreateTask, useUpdateTask, useToggleTopThree, useDeleteTask } from "@/hooks/useTasks";
import { useStakeholders } from "@/hooks/useStakeholders";
import { useToast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useHighlight } from "@/lib/HighlightContext";
import { isHighlightMatch } from "@/hooks/useHighlightDim";
import { confirmThen } from "@/lib/entityUtils";
import { isTaskDone, STATUS_COLORS, statusLabel } from "@/lib/taskUtils";
import StatusDropdown, { DEFAULT_STATUSES } from "@/components/projects/StatusDropdown";
import TaskAttachments from "@/components/projects/TaskAttachments";
import EditableText from "@/components/shared/EditableText";
import StakeholderAssigner from "@/components/shared/StakeholderAssigner";
import ColumnFilterMenu from "@/components/shared/ColumnFilterMenu";
import QuadrantSelect from "@/components/shared/QuadrantSelect";
import { QUADRANTS, quadrantLabel, TASK_FLAGS } from "@/lib/quadrants";
import FlagToggleButton from "@/components/shared/FlagToggleButton";

const MAX_ROWS = 20;
const QUADRANT_OPTIONS = [
  ...QUADRANTS.map((q) => ({ value: String(q.value), label: quadrantLabel(q.value) })),
  { value: "unassigned", label: "No quadrant" },
];
const STATUS_FILTER_OPTIONS = DEFAULT_STATUSES.map((s) => ({ value: s, label: statusLabel(s) }));

const EMPTY_FILTERS = {
  description: "",
  status: [],
  quadrant: [],
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
// Wraps task description with a focused-state AI sparkle that opens Vaea
// Chat with the task context pre-filled — closest Vaea has to inline AI
// editing without a full command palette refactor. The button only appears
// when the input is actually focused (not on hover) so it doesn't clutter
// the table in its resting state.
function TaskDescriptionField({ task, navigate, updateTask }) {
  const [focused, setFocused] = useState(false);
  return (
    <div className="relative group/desc">
      <EditableText
        value={task.description}
        onSave={(v) => updateTask.mutate({ id: task.id, data: { description: v } })}
        className={`text-xs pr-5 ${isTaskDone(task) ? "line-through text-muted-foreground/70" : ""}`}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {focused && (
        <button
          type="button"
          onMouseDown={(e) => {
            // mousedown fires before the input's blur; prevent blur so the
            // navigate doesn't race with the commit's setState call.
            e.preventDefault();
            navigate("/app/chat", {
              state: { initialMessage: `/break-down "${task.description}"` },
            });
          }}
          title="Ask Vaea to break this down"
          className="absolute right-0.5 top-0.5 p-0.5 rounded text-primary/60 hover:text-primary hover:bg-primary/10 transition-colors"
        >
          <Sparkles className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

function TaskRow({ task, allStakeholders, isMatched, updateTask, onToggleTopThree, onDelete, onArchive }) {
  const navigate = useNavigate();
  const { setNodeRef, isOver } = useDroppable({
    id: `task-drop-${task.id}`,
    data: { type: "task", id: task.id },
  });

  return (
    <tr
      ref={setNodeRef}
      className={`row-enter border-b border-border last:border-0 transition-colors ${isOver ? "ring-2 ring-inset ring-primary bg-primary/5" : ""}`}
      style={isMatched && !isOver ? { backgroundColor: STATUS_COLORS.DONE } : undefined}
    >
      <td className="p-2 min-w-0 max-w-[200px]">
        <TaskDescriptionField task={task} navigate={navigate} updateTask={updateTask} />
      </td>
      <td className="p-2">
        <StatusDropdown task={task} onStatusChange={(status) => updateTask.mutate({ id: task.id, data: { status } })} />
      </td>
      <td className="p-2 text-center whitespace-nowrap">
        <div className="flex items-center justify-center gap-1">
          {/* The spec's actual display format — "1H", "2HQ", etc — combined
              into one label; the select + toggle buttons below are what edit
              those same two underlying fields (quadrant, H/Q flags). */}
          <span className="text-xs font-semibold tabular-nums w-6 shrink-0" title={`${quadrantLabel(task.quadrant)}${task.is_highly_important ? " · H = high importance" : ""}${task.is_quick_task ? " · Q = quick task" : ""}`}>
            {/* Blank, not "—", when unset: the select beside it already says "No quadrant". */}
            {task.quadrant ?? ""}
            {task.is_highly_important ? "H" : ""}
            {task.is_quick_task ? "Q" : ""}
          </span>
          <QuadrantSelect
            value={task.quadrant ?? ""}
            onChange={(v) => updateTask.mutate({ id: task.id, data: { quadrant: v === "" ? null : Number(v) } })}
            className="bg-transparent"
            ariaLabel={`Quadrant for "${task.description || "untitled task"}"`}
          />
          <FlagToggleButton
            active={task.is_highly_important}
            onToggle={() => updateTask.mutate({ id: task.id, data: { is_highly_important: !task.is_highly_important } })}
            label="H"
            title={`H: ${TASK_FLAGS.H.name}. ${TASK_FLAGS.H.hint}`}
            ariaLabel="Mark as high importance"
            color="red"
          />
          <FlagToggleButton
            active={task.is_quick_task}
            onToggle={() => updateTask.mutate({ id: task.id, data: { is_quick_task: !task.is_quick_task } })}
            label="Q"
            title={`Q: ${TASK_FLAGS.Q.name}. ${TASK_FLAGS.Q.hint}`}
            ariaLabel="Mark as a quick task"
            color="blue"
          />
        </div>
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
        <Checkbox
          checked={!!task.is_weekly_focus}
          onCheckedChange={(v) => updateTask.mutate({ id: task.id, data: { is_weekly_focus: v } })}
          aria-label="This Week"
          title="Show on This Week in the focus list"
        />
      </td>
      <td className="p-2 text-center">
        <button
          onClick={() => onToggleTopThree(task)}
          aria-label={task.is_today_top_three ? "Remove from Top 3" : "Add to Top 3"}
          aria-pressed={!!task.is_today_top_three}
          title={task.is_today_top_three ? "Remove from Top 3" : "Add to Top 3"}
          className="p-1 -m-1 rounded hover:bg-accent transition-colors">
          <Star className={`w-4 h-4 ${task.is_today_top_three ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
        </button>
      </td>
      <td className="p-2 text-center flex items-center justify-center gap-2">
        <button
          type="button"
          title="Break this task down into subtasks"
          aria-label="Break down task with AI"
          onClick={() => navigate("/app/chat", { state: { initialMessage: `/break-down "${task.description}"` } })}
          className="p-1 -m-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => onArchive(task)} aria-label="Archive task" title="Archive task (restore it from View Archive)" className="p-1 -m-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
          <Archive className="w-4 h-4" />
        </button>
        <DeleteButton onClick={() => onDelete(task)} label="Delete task" className="-m-1" />
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

  // Archiving takes the row out of the table, so say where it went and
  // offer the one-click way back. Without this the row just vanished.
  const archiveTasks = (list) => {
    const at = new Date().toISOString();
    list.forEach((t) => updateTask.mutate({ id: t.id, data: { archived_at: at } }));
    toast({
      title: list.length === 1 ? "Task archived" : `${list.length} tasks archived`,
      description: list.length === 1 ? list[0].description : "Find them in View Archive.",
      action: (
        <ToastAction
          altText={list.length === 1 ? "Undo archiving this task" : "Undo archiving these tasks"}
          onClick={() => list.forEach((t) => updateTask.mutate({ id: t.id, data: { archived_at: null } }))}
        >
          Undo
        </ToastAction>
      ),
    });
  };
  const handleArchive = (task) => archiveTasks([task]);

  // Default view is sorted by Quadrant, per direct user request.
  const [sortColumn, setSortColumn] = useState("quadrant");
  const [sortDirection, setSortDirection] = useState("asc");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [showAllRows, setShowAllRows] = useState(false);
  const [newDescription, setNewDescription] = useState("");
  const [newQuadrant, setNewQuadrant] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [newStakeholderIds, setNewStakeholderIds] = useState([]);
  const [newNotes, setNewNotes] = useState("");
  const [newWeekly, setNewWeekly] = useState(false);
  const [newHighlyImportant, setNewHighlyImportant] = useState(false);
  const [newQuickTask, setNewQuickTask] = useState(false);
  const [newTopThree, setNewTopThree] = useState(false);
  const [newAttachments, setNewAttachments] = useState([]);
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
    if (newStakeholderIds.length) payload.stakeholder_ids = newStakeholderIds;
    if (newNotes.trim()) payload.notes = newNotes.trim();
    if (newWeekly) payload.is_weekly_focus = true;
    if (newHighlyImportant) payload.is_highly_important = true;
    if (newQuickTask) payload.is_quick_task = true;
    if (newAttachments.length) payload.attachments = newAttachments;
    if (newTopThree) payload.is_today_top_three = true;
    createTask.mutate(payload);
    // Past MAX_ROWS the new row would land behind "Show N more" and look
    // like nothing happened; show everything once you're adding.
    setShowAllRows(true);
    setNewDescription("");
    setNewQuadrant("");
    setNewStatus("");
    setNewStakeholderIds([]);
    setNewNotes("");
    setNewWeekly(false);
    setNewHighlyImportant(false);
    setNewQuickTask(false);
    setNewTopThree(false);
    setNewAttachments([]);
    requestAnimationFrame(() => newRowInputRef.current?.focus());
  };

  const handleNewTaskKeyDown = (e) => {
    if (e.key === "Enter") createNewTask();
  };

  const handleToggleTopThree = (task) => {
    toggleTopThree.mutate({ id: task.id, project_id: project.id });
  };

  const isMatched = (task) => isHighlightMatch(highlights, "tasks", task.stakeholder_ids || []);

  const doneTasks = tasks.filter((t) => isTaskDone(t) && !t.archived_at);
  const handleClearDone = () => {
    if (doneTasks.length === 0) return;
    confirmThen(`Archive ${doneTasks.length} done task${doneTasks.length === 1 ? "" : "s"}? You can restore them from View Archive.`, () =>
      archiveTasks(doneTasks),
    );
  };

  return (
    <div>
      <div className="flex items-center justify-end mb-1.5">
        <button
          onClick={handleClearDone}
          disabled={doneTasks.length === 0}
          className="text-xs px-2.5 py-1 rounded-md bg-secondary text-secondary-foreground border border-border hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
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
            <ColumnHeader column="weekly" label="This Week"sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>
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
              <td className="p-2 text-muted-foreground text-center" colSpan={9}>
                {tasks.length > 0
                  ? "No tasks match these filters. Clear a filter in the column headers to see them."
                  : "No tasks yet. Type one in the row below and press Enter."}
              </td>
            </tr>
          )}
          {(showAllRows ? sortedTasks : sortedTasks.slice(0, MAX_ROWS)).map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              allStakeholders={allStakeholders}
              isMatched={isMatched(task)}
              updateTask={updateTask}
              onToggleTopThree={handleToggleTopThree}
              onDelete={handleDelete}
              onArchive={handleArchive}
            />
          ))}
          {!showAllRows && sortedTasks.length > MAX_ROWS && (
            <tr>
              <td className="p-2 text-center" colSpan={9}>
                <button
                  onClick={() => setShowAllRows(true)}
                  className="text-xs text-primary hover:underline"
                >
                  Show {sortedTasks.length - MAX_ROWS} more task{sortedTasks.length - MAX_ROWS === 1 ? "" : "s"}
                </button>
              </td>
            </tr>
          )}
          <tr className="bg-primary/10">
            <td className="p-2 min-w-0">
              <div className="flex items-center gap-1.5">
                <button onClick={createNewTask} aria-label="New task" title="New task" className="flex items-center shrink-0 text-primary">
                  <Plus className="w-4 h-4" />
                </button>
                <input
                  ref={newRowInputRef}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  onKeyDown={handleNewTaskKeyDown}
                  placeholder="Type a task and press Enter (or click +)"
                  aria-label="New task description"
                  className="w-full min-w-0 text-xs px-2 py-1.5 bg-background border border-border rounded outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </td>
            <td className="p-2">
              <Select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="text-[10px] px-1 py-0.5"
                aria-label="Status for new task"
                // Left empty, a new task starts as Not Started (createTask).
                placeholder={statusLabel("NOT_STARTED")}
                options={DEFAULT_STATUSES.map((s) => ({ value: s, label: statusLabel(s) }))}
              />
            </td>
            <td className="p-2">
              {/* Same layout as the rows above, including the code chip's
                  w-6 slot, so the select and H/Q line up with theirs. */}
              <div className="flex items-center justify-center gap-1">
                <span className="w-6 shrink-0" aria-hidden="true" />
                <QuadrantSelect
                  value={newQuadrant}
                  onChange={setNewQuadrant}
                  className="bg-background"
                  ariaLabel="Quadrant for new task"
                />
                <FlagToggleButton
                  active={newHighlyImportant}
                  onToggle={() => setNewHighlyImportant((v) => !v)}
                  label="H"
                  title={`H: ${TASK_FLAGS.H.name}. ${TASK_FLAGS.H.hint}`}
                  ariaLabel="Mark new task as high importance"
                  color="red"
                />
                <FlagToggleButton
                  active={newQuickTask}
                  onToggle={() => setNewQuickTask((v) => !v)}
                  label="Q"
                  title={`Q: ${TASK_FLAGS.Q.name}. ${TASK_FLAGS.Q.hint}`}
                  ariaLabel="Mark new task as a quick task"
                  color="blue"
                />
              </div>
            </td>
            <td className="p-2 whitespace-nowrap">
              <StakeholderAssigner
                currentStakeholderIds={newStakeholderIds}
                allStakeholders={allStakeholders}
                onSave={setNewStakeholderIds}
              />
            </td>
            <td className="p-2 text-center whitespace-nowrap">
              <TaskAttachments
                attachments={newAttachments}
                onSave={setNewAttachments}
              />
            </td>
            <td className="p-2 min-w-0 max-w-[140px]">
              <input
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                onKeyDown={handleNewTaskKeyDown}
                placeholder="Notes..."
                aria-label="Notes for new task"
                className="w-full min-w-0 text-[11px] px-1.5 py-1 bg-background border border-border rounded outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </td>
            <td className="p-2 text-center">
              <Checkbox checked={newWeekly} onCheckedChange={setNewWeekly} aria-label="This Week for new task" />
            </td>
            <td className="p-2 text-center">
              <button
                type="button"
                onClick={() => setNewTopThree((v) => !v)}
                aria-label="Top 3 for new task"
                aria-pressed={newTopThree}
              >
                <Star className={`w-4 h-4 ${newTopThree ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
              </button>
            </td>
            <td className="p-2"></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

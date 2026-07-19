// Shared helpers for deriving display data from Task records. Centralizing
// these means quadrant counts, "is this done", and status categorization are
// computed identically everywhere a task list is rendered.

export function isTaskArchived(task) {
  return !!task.archived_at;
}

export function isTaskDeleted(task) {
  return !!task.deleted_at;
}

export function isTaskDone(task) {
  return task.status === "DONE" || task.status === "DELEGATED_DONE";
}

export function filterActiveTasks(tasks = []) {
  return tasks.filter((t) => !isTaskArchived(t) && !isTaskDeleted(t));
}

// Eisenhower-matrix quadrant counts for the 2x2 badge on a project card.
// Quadrant 4 also absorbs tasks with no quadrant assigned. A quadrant is
// flagged `hasFocus` (rendered dark green) when one of its tasks is marked
// as this week's focus, and `hasHighlightedStakeholder` when the "tasks"
// checkbox is active for a stakeholder who has a task in that quadrant —
// the spec calls for highlighting the specific quadrant a stakeholder's task
// lives in, not just dimming/undimming the whole card. Only the "tasks"
// category applies here, not "projects"/"products" — those are a different
// checkbox tied to a different object type.
export function getQuadrantCounts(tasks = [], highlights = []) {
  const activeTasks = filterActiveTasks(tasks);
  const highlightedTaskStakeholderIds = highlights.filter((h) => h.category === "tasks").map((h) => h.stakeholderId);

  return [1, 2, 3, 4].map((quadrant) => {
    const quadTasks = activeTasks.filter((t) =>
      quadrant === 4 ? t.quadrant === 4 || !t.quadrant : t.quadrant === quadrant
    );
    return {
      quadrant,
      count: quadTasks.length,
      hasFocus: quadTasks.some((t) => t.is_weekly_focus),
      hasHighlightedStakeholder:
        highlightedTaskStakeholderIds.length > 0 &&
        quadTasks.some((t) => (t.stakeholder_ids || []).some((id) => highlightedTaskStakeholderIds.includes(id))),
    };
  });
}

// Single source of truth for the 7-way status breakdown used by both the
// project-card stacked bar and the sidebar status chart. Each consumer owns
// its own rendering; this only owns the categorization and display order.
// Ordered Not Started (left) through Done (right) — a left-to-right progress
// reading — per direct user request.
export const STATUS_BUCKETS = [
  { key: "NOT_STARTED", label: "Not Started", match: (s) => !s || s === "NOT_STARTED" },
  { key: "ON_HOLD", label: "On Hold", match: (s) => s === "ON_HOLD" },
  { key: "IN_PROGRESS", label: "In Progress", match: (s) => s === "IN_PROGRESS" },
  { key: "BLOCKED", label: "Blocked", match: (s) => s === "BLOCKED" },
  { key: "PENDING_FEEDBACK", label: "Pending Feedback", match: (s) => s === "PENDING_FEEDBACK" },
  { key: "DELEGATED", label: "Delegated", match: (s) => s === "DELEGATED" },
  { key: "DONE", label: "Done", match: (s) => s === "DONE" || s === "DELEGATED_DONE" },
];

// Literal, theme-independent colors — the spec calls for specific colors per
// status ("dark grey" for Blocked, black for No-status), not
// surface-adaptive theme tokens. Shared so any consumer needing the same
// color (e.g. a card face echoing "pending feedback" orange) has one source
// of truth instead of a duplicated hex.
// NOT_STARTED is the one exception: literal black is invisible against a
// dark-mode card background, so it's the one bucket that does flip with the
// theme, via the --status-not-started CSS var (black in :root, white in
// .dark — see index.css) rather than a hardcoded hex.
export const STATUS_COLORS = {
  DONE: "#86E7B0",
  DELEGATED: "#93C5FD",
  IN_PROGRESS: "#FEF08A",
  BLOCKED: "#4B5563",
  PENDING_FEEDBACK: "#FDBA74",
  ON_HOLD: "#FCA5A5",
  NOT_STARTED: "var(--status-not-started)",
};

// Single source for the task Type enum (TaskTable's row + new-row selects,
// TaskForm's quick-create form all need the exact same list).
export const TYPE_OPTIONS = ["COMMUNICATION", "OPEN_QUESTIONS", "SCRUM_NEEDS", "EMPLOYEE_NEEDS", "OTHER"];

export function getStatusCounts(tasks = []) {
  const activeTasks = filterActiveTasks(tasks);
  return STATUS_BUCKETS.map((bucket) => ({
    ...bucket,
    count: activeTasks.filter((t) => bucket.match(t.status)).length,
  }));
}

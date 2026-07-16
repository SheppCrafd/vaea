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
// its own color palette/rendering; this only owns the categorization.
export const STATUS_BUCKETS = [
  { key: "DONE", label: "Done", match: (s) => s === "DONE" || s === "DELEGATED_DONE" },
  { key: "DELEGATED", label: "Delegated", match: (s) => s === "DELEGATED" },
  { key: "IN_PROGRESS", label: "In Progress", match: (s) => s === "IN_PROGRESS" },
  { key: "BLOCKED", label: "Blocked", match: (s) => s === "BLOCKED" },
  { key: "PENDING_FEEDBACK", label: "Pending Feedback", match: (s) => s === "PENDING_FEEDBACK" },
  { key: "ON_HOLD", label: "On Hold", match: (s) => s === "ON_HOLD" },
  { key: "NOT_STARTED", label: "Not Started", match: (s) => !s || s === "NOT_STARTED" },
];

export function getStatusCounts(tasks = []) {
  const activeTasks = filterActiveTasks(tasks);
  return STATUS_BUCKETS.map((bucket) => ({
    ...bucket,
    count: activeTasks.filter((t) => bucket.match(t.status)).length,
  }));
}

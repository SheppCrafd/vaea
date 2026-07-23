export const DUE_DATE_STATUS_OPTIONS = ["ESTIMATED", "COMMITTED"];

export const METRIC_FIELDS = [
  { key: "impact_forecast", label: "Impact (Forecast)" },
  { key: "impact_measured", label: "Impact (Measured)" },
  { key: "outcome_forecast", label: "Outcome (Forecast)" },
  { key: "outcome_measured", label: "Outcome (Measured)" },
];

export function getProjectOwner(project) {
  return project.owner_name || null;
}

export function getProjectDueDate(project) {
  return project.due_date || null;
}

export function getProjectDueStatus(project) {
  return project.due_date_status || "ESTIMATED";
}

export function getProjectArchiveStatus(project) {
  return !!project.is_archived;
}

const AT_RISK_WINDOW_DAYS = 7;

// Text color for the due-date badge on a project card. Blue always wins once
// every active task is done. Otherwise, ESTIMATED projects are always the
// neutral default color, and COMMITTED projects derive on-track/at-risk/missed
// from how close the due date is — there's no separate stored risk field, so
// this is computed fresh every render and updates itself as time passes.
export function getDueDateColorClass(project, allDone = false) {
  if (allDone) return "text-blue-500 font-bold";
  // text-foreground, not a literal text-black — this renders directly onto
  // a native <input type="date"> (ProjectCardFull.jsx), and an explicit
  // `color` on the element always wins over color-scheme's own default
  // form-control text color. A literal black was invisible against a dark
  // background regardless of that fix, per direct feedback.
  if (getProjectDueStatus(project) !== "COMMITTED") return "text-foreground";

  const dueDate = getProjectDueDate(project);
  if (!dueDate) return "text-foreground";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const daysUntilDue = Math.round((due - today) / (1000 * 60 * 60 * 24));

  if (daysUntilDue < 0) return "text-red-600 font-bold"; // committed + overdue = missed
  if (daysUntilDue <= AT_RISK_WINDOW_DAYS) return "text-orange-500 font-bold"; // committed + due soon = at risk
  return "text-green-600 font-bold"; // committed + comfortable runway = on track
}

export function formatDueDate(project) {
  const dueDate = getProjectDueDate(project);
  if (!dueDate) return "No due date";
  return new Date(dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
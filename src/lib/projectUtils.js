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

const AT_RISK_WINDOW_DAYS = 7;

// Single source of truth for "is this project in trouble" — used by the
// due-date badge color below, and by Notifications' deadline digest / the
// Agents sidebar card's predictive risk flagging, so there's one risk
// computation in the app, not three copies that can drift out of sync.
// Blue/"done" always wins once every active task is done. Otherwise,
// ESTIMATED projects carry no risk signal at all (nothing was promised), and
// COMMITTED projects derive on-track/at-risk/overdue from how close the due
// date is — there's no separate stored risk field, so this is computed fresh
// every call and updates itself as time passes.
export function getProjectRiskLevel(project, allDone = false) {
  if (allDone) return "done";
  if (getProjectDueStatus(project) !== "COMMITTED") return "none";

  const dueDate = getProjectDueDate(project);
  if (!dueDate) return "none";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const daysUntilDue = Math.round((due - today) / (1000 * 60 * 60 * 24));

  if (daysUntilDue < 0) return "overdue";
  if (daysUntilDue <= AT_RISK_WINDOW_DAYS) return "at_risk";
  return "on_track";
}

// Text color for the due-date badge on a project card.
export function getDueDateColorClass(project, allDone = false) {
  const risk = getProjectRiskLevel(project, allDone);
  if (risk === "done") return "text-blue-500 font-bold";
  // text-foreground, not a literal text-black — this renders directly onto
  // a native <input type="date"> (ProjectCardFull.jsx), and an explicit
  // `color` on the element always wins over color-scheme's own default
  // form-control text color. A literal black was invisible against a dark
  // background regardless of that fix, per direct feedback.
  if (risk === "none") return "text-foreground";
  if (risk === "overdue") return "text-red-600 font-bold";
  if (risk === "at_risk") return "text-orange-500 font-bold";
  return "text-green-600 font-bold"; // on_track
}

export function formatDueDate(project) {
  const dueDate = getProjectDueDate(project);
  if (!dueDate) return "No due date";
  return new Date(dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
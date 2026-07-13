import { differenceInHours } from "date-fns";

// Due Date Time-Delta Engine: blue if all tasks done, black if estimated,
// otherwise green/orange/red based on hours remaining vs a 48h "at risk" threshold.
export default function DueDateBadge({ project, allDone }) {
  let colorClass = "text-foreground font-semibold";
  const label = project.due_date ? project.due_date.slice(0, 10) : "No due date";

  if (allDone) {
    colorClass = "text-blue-600 font-semibold";
  } else if (project.due_date_status === "COMMITTED" && project.due_date) {
    const diffHours = differenceInHours(new Date(project.due_date), new Date());
    if (diffHours < 0) colorClass = "text-red-600 font-semibold";
    else if (diffHours < 48) colorClass = "text-orange-500 font-semibold";
    else colorClass = "text-green-600 font-semibold";
  }

  return (
    <div className="text-right text-[11px] shrink-0 max-w-[90px]">
      <p className="text-muted-foreground truncate">{project.owner_name || "Unassigned"}</p>
      <p className={`${colorClass} whitespace-nowrap`}>{label}</p>
    </div>
  );
}
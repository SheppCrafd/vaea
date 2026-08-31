import { useAllTasks, useUpdateTask, useToggleTopThree, useDeleteTask } from "@/hooks/useTasks";
import { useProjects } from "@/hooks/useProjects";
import { useToast } from "@/components/ui/use-toast";
import { useHighlight } from "@/lib/HighlightContext";
import { isHighlightMatch } from "@/hooks/useHighlightDim";
import { confirmThen } from "@/lib/entityUtils";
import { isTaskDone, getStatusCounts } from "@/lib/taskUtils";
import QueryError from "@/components/shared/QueryError";
import FocusTaskRow from "@/components/sidebar/FocusTaskRow";

// The focus rail's list: what's on for Today (your Top 3), then This Week,
// as one flat ruled list — never sub-divided by project, since the rail is
// narrow and the project already reads as each row's sub-label. A single
// slim progress meter sits on top; the full status breakdown lives in the
// separate Task Statistics chart below it, not doubled here.
function SectionHead({ label, count }) {
  return (
    <div className="flex items-baseline justify-between px-2 mb-1">
      <h3 className="font-heading text-[13px] font-semibold tracking-tight text-foreground">{label}</h3>
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider tabular-nums">{count}</span>
    </div>
  );
}

export default function FocusFeed() {
  const { data: tasks = [], isError: tasksError, error: tasksErrorObj, refetch: refetchTasks } = useAllTasks();
  const { data: projects = [] } = useProjects();
  const updateTask = useUpdateTask();
  const toggleTopThree = useToggleTopThree();
  const deleteTask = useDeleteTask();
  const { toast } = useToast();
  const { highlights } = useHighlight();

  if (tasksError) {
    return <QueryError error={tasksErrorObj} onRetry={refetchTasks} label="Couldn't load tasks." />;
  }

  const projectTitle = (id) => projects.find((p) => p.id === id)?.title || "";
  const topThree = tasks.filter((t) => t.is_today_top_three);
  const weeklyFocus = tasks.filter((t) => t.is_weekly_focus && !t.is_today_top_three);
  const focusTasks = [...topThree, ...weeklyFocus];

  const doneCount = focusTasks.filter(isTaskDone).length;
  const pct = focusTasks.length ? Math.round((doneCount / focusTasks.length) * 100) : 0;
  const breakdown = getStatusCounts(focusTasks)
    .filter((c) => c.count > 0)
    .map((c) => `${c.label ?? c.key}: ${c.count}`)
    .join(" · ");

  const rowMatched = (task) => isHighlightMatch(highlights, "tasks", task.stakeholder_ids || []);
  const setField = (task, data) => updateTask.mutate({ id: task.id, data });
  const handleArchive = (task) => setField(task, { archived_at: new Date().toISOString() });
  const handleDelete = (task) =>
    confirmThen(`Delete task "${task.description}"? This cannot be undone.`, () => deleteTask.mutate(task.id));

  // Demote: off Today, kept for the week (it lands in the list below).
  const moveToWeekly = (task) => setField(task, { is_today_top_three: false, is_weekly_focus: true });

  // Promote: through the cap-aware toggle, so the 3-per-project limit holds
  // here the same as in the task table. The weekly flag stays set — if the
  // task later leaves Today, it falls back into This Week on its own.
  const moveToToday = (task) =>
    toggleTopThree.mutate(
      { id: task.id, project_id: task.project_id },
      {
        onError: (err) =>
          toast({
            variant: "destructive",
            title: "Can't add to Today",
            description: err?.response?.data?.error || "Only 3 tasks can be pinned per project.",
          }),
      }
    );

  const rowProps = (task) => ({
    task,
    isMatched: rowMatched(task),
    onStatusChange: (status) => setField(task, { status }),
    onFieldChange: (data) => setField(task, data),
    onArchive: () => handleArchive(task),
    onDelete: () => handleDelete(task),
  });

  return (
    <div className="space-y-5">
      {focusTasks.length > 0 && (
        <div className="px-2" title={breakdown || undefined}>
          <div className="flex items-center gap-2.5">
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
              {doneCount} / {focusTasks.length} <span className="text-muted-foreground/60">done</span>
            </span>
          </div>
        </div>
      )}

      <div>
        <SectionHead label="Today" count={topThree.length} />
        {topThree.length === 0 ? (
          <p className="px-2 text-xs text-muted-foreground">Nothing pinned for today. Move something up from This Week.</p>
        ) : (
          <ul>
            {topThree.map((task) => (
              <FocusTaskRow
                key={task.id}
                {...rowProps(task)}
                projectTitle={projectTitle(task.project_id)}
                direction="demote"
                onMove={() => moveToWeekly(task)}
              />
            ))}
          </ul>
        )}
      </div>

      <div>
        <SectionHead label="This Week" count={weeklyFocus.length} />
        {weeklyFocus.length === 0 ? (
          <p className="px-2 text-xs text-muted-foreground">No focus set for the week yet.</p>
        ) : (
          <ul>
            {weeklyFocus.map((task) => (
              <FocusTaskRow
                key={task.id}
                {...rowProps(task)}
                projectTitle={projectTitle(task.project_id)}
                direction="promote"
                onMove={() => moveToToday(task)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

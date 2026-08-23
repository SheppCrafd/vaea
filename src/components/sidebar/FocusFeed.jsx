import { Archive, ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { useAllTasks, useUpdateTask, useToggleTopThree, useDeleteTask } from "@/hooks/useTasks";
import { useProjects } from "@/hooks/useProjects";
import { useToast } from "@/components/ui/use-toast";
import { useHighlight } from "@/lib/HighlightContext";
import { isHighlightMatch } from "@/hooks/useHighlightDim";
import { confirmThen } from "@/lib/entityUtils";
import QueryError from "@/components/shared/QueryError";

const STATUS_OPTIONS = ["NOT_STARTED", "PENDING_FEEDBACK", "DELEGATED", "IN_PROGRESS", "ON_HOLD", "BLOCKED", "DONE", "DELEGATED_DONE"];

// Live feed: today's Top 3 first, then this week's focus items grouped by
// project. The two lists are mutually exclusive — a task promoted to Top 3
// surfaces only there, even if it's still flagged for the week — and each
// row can move between them with the arrow button.
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

  const projectTitle = (id) => projects.find((p) => p.id === id)?.title || "Untitled";
  const topThree = tasks.filter((t) => t.is_today_top_three);
  const weeklyFocus = tasks.filter((t) => t.is_weekly_focus && !t.is_today_top_three);

  const groupedWeekly = weeklyFocus.reduce((acc, t) => {
    acc[t.project_id] = acc[t.project_id] || [];
    acc[t.project_id].push(t);
    return acc;
  }, {});

  const isMatched = (task) => isHighlightMatch(highlights, "tasks", task.stakeholder_ids || []);

  const handleArchive = (task) => updateTask.mutate({ id: task.id, data: { archived_at: new Date().toISOString() } });
  const handleDelete = (task) =>
    confirmThen(`Delete task "${task.description}"? This cannot be undone.`, () => deleteTask.mutate(task.id));

  // Demote: off Top 3, kept for the week (it lands in the list below).
  const moveToWeekly = (task) =>
    updateTask.mutate({ id: task.id, data: { is_today_top_three: false, is_weekly_focus: true } });

  // Promote: through the cap-aware toggle, so the 3-per-project limit holds
  // here the same as in the task table. The weekly flag stays set — if the
  // task later leaves Top 3, it falls back into Weekly Focus on its own.
  const moveToTopThree = (task) =>
    toggleTopThree.mutate(
      { id: task.id, project_id: task.project_id },
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

  const renderRow = (task, move) => (
    <div key={task.id} className={`flex items-center justify-between gap-1.5 text-xs bg-muted rounded p-2 ${isMatched(task) ? "bg-primary/10" : ""}`}>
      <span className="truncate flex-1" title={task.description}>{task.description}</span>
      <select
        value={task.status}
        onChange={(e) => updateTask.mutate({ id: task.id, data: { status: e.target.value } })}
        className="text-[10px] bg-background border border-border rounded px-1 py-0.5 shrink-0"
      >
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
        ))}
      </select>
      <button onClick={() => move.onClick(task)} aria-label={move.label} title={move.label} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
        <move.Icon className="w-3.5 h-3.5" />
      </button>
      <button onClick={() => handleArchive(task)} aria-label="Archive task" className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
        <Archive className="w-3.5 h-3.5" />
      </button>
      <button onClick={() => handleDelete(task)} aria-label="Delete task" className="shrink-0 text-muted-foreground hover:text-destructive transition-colors">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );

  const demote = { Icon: ArrowDown, label: "Move to Weekly Focus", onClick: moveToWeekly };
  const promote = { Icon: ArrowUp, label: "Move to Today's Top 3", onClick: moveToTopThree };

  return (
    <div className="space-y-4">
      <div>
        <p className="font-heading font-semibold text-sm mb-2">Today's Top 3</p>
        <div className="space-y-1.5">
          {topThree.length === 0 ? <p className="text-xs text-muted-foreground">None set</p> : topThree.map((t) => renderRow(t, demote))}
        </div>
      </div>
      <div>
        <p className="font-heading font-semibold text-sm mb-2">Weekly Focus</p>
        <div className="space-y-3">
          {Object.entries(groupedWeekly).map(([projectId, projectTasks]) => (
            <div key={projectId}>
              <p className="text-[11px] font-medium text-muted-foreground mb-1">{projectTitle(projectId)}</p>
              <div className="space-y-1.5">{projectTasks.map((t) => renderRow(t, promote))}</div>
            </div>
          ))}
          {weeklyFocus.length === 0 && <p className="text-xs text-muted-foreground">None set</p>}
        </div>
      </div>
    </div>
  );
}

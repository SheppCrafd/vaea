import { Archive, Trash2 } from "lucide-react";
import { useAllTasks, useUpdateTask, useDeleteTask } from "@/hooks/useTasks";
import { useProjects } from "@/hooks/useProjects";
import { useHighlight } from "@/lib/HighlightContext";
import { isDimmedByHighlight } from "@/hooks/useHighlightDim";
import { confirmThen } from "@/lib/entityUtils";

const STATUS_OPTIONS = ["NOT_STARTED", "IN_PROGRESS", "DELEGATED", "PENDING_FEEDBACK", "ON_HOLD", "BLOCKED", "DONE", "DELEGATED_DONE"];

// Live feed: today's Top 3 first, then this week's focus items grouped by
// project and, within each project, by task type.
export default function FocusFeed() {
  const { data: tasks = [] } = useAllTasks();
  const { data: projects = [] } = useProjects();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const { highlights } = useHighlight();

  const projectTitle = (id) => projects.find((p) => p.id === id)?.title || "Untitled";
  const topThree = tasks.filter((t) => t.is_today_top_three);
  const weeklyFocus = tasks.filter((t) => t.is_weekly_focus);

  const groupedWeekly = weeklyFocus.reduce((acc, t) => {
    const type = t.type || "OTHER";
    acc[t.project_id] = acc[t.project_id] || {};
    acc[t.project_id][type] = acc[t.project_id][type] || [];
    acc[t.project_id][type].push(t);
    return acc;
  }, {});

  const isDimmed = (task) => isDimmedByHighlight(highlights, "tasks", task.stakeholder_ids || []);

  const handleArchive = (task) => updateTask.mutate({ id: task.id, data: { archived_at: new Date().toISOString() } });
  const handleDelete = (task) =>
    confirmThen(`Delete task "${task.description}"? This cannot be undone.`, () => deleteTask.mutate(task.id));

  const renderRow = (task) => (
    <div key={task.id} className={`flex items-center justify-between gap-1.5 text-xs bg-muted rounded p-2 ${isDimmed(task) ? "opacity-30" : ""}`}>
      <span className="truncate flex-1">{task.description}</span>
      <select
        value={task.status}
        onChange={(e) => updateTask.mutate({ id: task.id, data: { status: e.target.value } })}
        className="text-[10px] bg-background border border-border rounded px-1 py-0.5 shrink-0"
      >
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
        ))}
      </select>
      <button onClick={() => handleArchive(task)} aria-label="Archive task" className="shrink-0 text-muted-foreground hover:text-foreground">
        <Archive className="w-3.5 h-3.5" />
      </button>
      <button onClick={() => handleDelete(task)} aria-label="Delete task" className="shrink-0 text-muted-foreground hover:text-destructive">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div>
        <p className="font-heading font-semibold text-sm mb-2">Today's Top 3</p>
        <div className="space-y-1.5">
          {topThree.length === 0 ? <p className="text-xs text-muted-foreground">None set</p> : topThree.map(renderRow)}
        </div>
      </div>
      <div>
        <p className="font-heading font-semibold text-sm mb-2">Weekly Focus</p>
        <div className="space-y-3">
          {Object.entries(groupedWeekly).map(([projectId, byType]) => (
            <div key={projectId}>
              <p className="text-[11px] font-medium text-muted-foreground mb-1">{projectTitle(projectId)}</p>
              <div className="space-y-2">
                {Object.entries(byType).map(([type, typeTasks]) => (
                  <div key={type}>
                    <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wide mb-1">{type.replace(/_/g, " ")}</p>
                    <div className="space-y-1.5">{typeTasks.map(renderRow)}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {weeklyFocus.length === 0 && <p className="text-xs text-muted-foreground">None set</p>}
        </div>
      </div>
    </div>
  );
}

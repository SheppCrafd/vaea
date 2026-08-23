import { RotateCcw } from "lucide-react";
import { DeleteButton } from "@/components/ui/delete-button";
import { useArchivedTasks, useUpdateTask, useDeleteTask } from "@/hooks/useTasks";
import { useStakeholders } from "@/hooks/useStakeholders";
import { confirmThen } from "@/lib/entityUtils";
import StatusDropdown from "@/components/projects/StatusDropdown";
import StakeholderAssigner from "@/components/shared/StakeholderAssigner";
import TaskAttachments from "@/components/projects/TaskAttachments";
import EditableText from "@/components/shared/EditableText";
import QuadrantSelect from "@/components/shared/QuadrantSelect";
import Spinner from "@/components/shared/Spinner";

// A project's archived tasks — a secondary, occasionally-visited view, but
// per spec "archived objects can be edited just like active objects", so
// every field TaskTable exposes for a live task is editable here too, just
// laid out as a compact card list instead of a wide table (there's no
// project-scoped "New Task" row here — creating belongs to the live table).
export default function ArchivedTaskList({ projectId }) {
  const { data: tasks = [], isLoading } = useArchivedTasks(projectId);
  const { data: allStakeholders = [] } = useStakeholders();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  if (isLoading) return <div className="flex justify-center p-4"><Spinner className="w-5 h-5" /></div>;
  if (tasks.length === 0) return <p className="text-xs text-muted-foreground p-2">No archived tasks.</p>;

  const handleDelete = (task) => {
    confirmThen(`Delete task "${task.description}"? This cannot be undone.`, () => deleteTask.mutate(task.id));
  };

  return (
    <ul className="divide-y divide-border border border-border rounded-lg overflow-hidden">
      {tasks.map((task) => (
        <li key={task.id} className="flex flex-col gap-2 p-2 text-xs bg-card">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <EditableText
                value={task.description}
                onSave={(v) => updateTask.mutate({ id: task.id, data: { description: v } })}
                className="text-xs"
              />
            </div>
            <div className="shrink-0 flex items-center gap-1.5">
              <button
                onClick={() => updateTask.mutate({ id: task.id, data: { archived_at: null, project_id: projectId } })}
                className="flex items-center gap-1.5 text-[11px] px-2 py-1 bg-secondary text-secondary-foreground border border-border rounded-md hover:opacity-80"
              >
                <RotateCcw className="w-3 h-3" />
                Restore
              </button>
              <DeleteButton onClick={() => handleDelete(task)} label="Delete task" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusDropdown task={task} onStatusChange={(status) => updateTask.mutate({ id: task.id, data: { status } })} />
            <QuadrantSelect
              value={task.quadrant ?? ""}
              onChange={(v) => updateTask.mutate({ id: task.id, data: { quadrant: v === "" ? null : Number(v) } })}
              className="bg-transparent"
              ariaLabel={`Quadrant for task ${task.id}`}
            />
            <StakeholderAssigner
              currentStakeholderIds={task.stakeholder_ids || []}
              allStakeholders={allStakeholders}
              onSave={(newIds) => updateTask.mutate({ id: task.id, data: { stakeholder_ids: newIds } })}
            />
            <TaskAttachments
              attachments={task.attachments || []}
              onSave={(newAttachments) => updateTask.mutate({ id: task.id, data: { attachments: newAttachments } })}
            />
          </div>
          <EditableText
            value={task.notes}
            onSave={(v) => updateTask.mutate({ id: task.id, data: { notes: v } })}
            placeholder="Notes..."
            className="text-[11px] text-muted-foreground"
          />
        </li>
      ))}
    </ul>
  );
}

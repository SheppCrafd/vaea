import { useRef, useState } from "react";
import { useDraft, clearDraft } from "@/lib/formDrafts";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useProjects } from "@/hooks/useProjects";
import { useCreateTask } from "@/hooks/useTasks";
import { useStakeholders } from "@/hooks/useStakeholders";
import StakeholderAssigner from "@/components/shared/StakeholderAssigner";
import QuadrantOptions from "@/components/shared/QuadrantOptions";
import FormField from "@/components/shared/FormField";
import { Select } from "@/components/ui/select";

export default function TaskForm({ onDone, prefill = null }) {
  // description is seeded when the modal is opened from a Notepad row's
  // "create a task"; project from the (+) on a project card. Both editable.
  const [description, setDescription] = useDraft("task.description", prefill?.description || "");
  const [projectId, setProjectId] = useState(prefill?.project_id || "");
  const [quadrant, setQuadrant] = useState("");
  const [stakeholderIds, setStakeholderIds] = useState([]);
  const { data: projects = [] } = useProjects();
  const { data: allStakeholders = [] } = useStakeholders();
  const createTask = useCreateTask();

  // isPending only updates after a re-render, so clicks in the same tick
  // (a double-click) all passed it and created duplicates. The ref blocks
  // a second submit until this one settles.
  const submitting = useRef(false);
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!description.trim() || !projectId || createTask.isPending) return;
    if (submitting.current) return;
    submitting.current = true;
    const payload = { project_id: projectId, description };
    if (quadrant !== "") payload.quadrant = Number(quadrant);
    if (stakeholderIds.length) payload.stakeholder_ids = stakeholderIds;
    // A failure is shown by the global mutation toast (query-client.js).
    createTask.mutate(payload, { onSuccess: () => { clearDraft("task.description"); onDone?.(); }, onSettled: () => { submitting.current = false; } });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField label="Project" htmlFor="task-project">
        <Select
          id="task-project"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          placeholder="Select a project..."
          options={projects.map((p) => ({ value: p.id, label: p.title }))}
        />
      </FormField>
      <FormField label="Task description" htmlFor="task-description">
        <Input id="task-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Write API docs" autoFocus />
      </FormField>
      <FormField label="Quadrant (optional)" htmlFor="task-quadrant">
        <Select id="task-quadrant" value={quadrant} onChange={(e) => setQuadrant(e.target.value)}>
          <QuadrantOptions />
        </Select>
      </FormField>
      <FormField label="Stakeholders (optional)">
        <StakeholderAssigner
          label="Add Stakeholders"
          currentStakeholderIds={stakeholderIds}
          allStakeholders={allStakeholders}
          onSave={setStakeholderIds}
        />
      </FormField>
      <Button type="submit" className="w-full" disabled={!projectId || !description.trim() || createTask.isPending}>
        {createTask.isPending ? "Adding…" : "Add Task"}
      </Button>
    </form>
  );
}

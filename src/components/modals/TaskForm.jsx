import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useProjects } from "@/hooks/useProjects";
import { useCreateTask } from "@/hooks/useTasks";
import { useStakeholders } from "@/hooks/useStakeholders";
import { useToast } from "@/components/ui/use-toast";
import StakeholderAssigner from "@/components/shared/StakeholderAssigner";
import QuadrantOptions from "@/components/shared/QuadrantOptions";
import FormField from "@/components/shared/FormField";
import { Select } from "@/components/ui/select";

export default function TaskForm({ onDone }) {
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState("");
  const [quadrant, setQuadrant] = useState("");
  const [stakeholderIds, setStakeholderIds] = useState([]);
  const { data: projects = [] } = useProjects();
  const { data: allStakeholders = [] } = useStakeholders();
  const createTask = useCreateTask();
  const { toast } = useToast();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!description.trim() || !projectId || createTask.isPending) return;
    const payload = { project_id: projectId, description };
    if (quadrant !== "") payload.quadrant = Number(quadrant);
    if (stakeholderIds.length) payload.stakeholder_ids = stakeholderIds;
    createTask.mutate(payload, {
      onSuccess: () => onDone?.(),
      onError: (err) => {
        toast({
          variant: "destructive",
          title: "Couldn't add task",
          description: err?.message || "Something went wrong — try again.",
        });
      },
    });
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

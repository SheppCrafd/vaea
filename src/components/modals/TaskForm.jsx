import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useProjects } from "@/hooks/useProjects";
import { useCreateTask } from "@/hooks/useTasks";
import { useStakeholders } from "@/hooks/useStakeholders";
import StakeholderAssigner from "@/components/shared/StakeholderAssigner";
import QuadrantOptions from "@/components/shared/QuadrantOptions";

export default function TaskForm({ onDone }) {
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState("");
  const [quadrant, setQuadrant] = useState("");
  const [stakeholderIds, setStakeholderIds] = useState([]);
  const { data: projects = [] } = useProjects();
  const { data: allStakeholders = [] } = useStakeholders();
  const createTask = useCreateTask();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!description.trim() || !projectId) return;
    const payload = { project_id: projectId, description };
    if (quadrant !== "") payload.quadrant = Number(quadrant);
    if (stakeholderIds.length) payload.stakeholder_ids = stakeholderIds;
    createTask.mutate(payload);
    onDone?.();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium block mb-1">Project</label>
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="w-full text-sm px-3 py-2 bg-background border border-input rounded-md"
        >
          <option value="">Select a project...</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">Task description</label>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Write API docs" autoFocus />
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">Quadrant (optional)</label>
        <select
          value={quadrant}
          onChange={(e) => setQuadrant(e.target.value)}
          className="w-full text-sm px-3 py-2 bg-background border border-input rounded-md"
        >
          <QuadrantOptions />
        </select>
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">Stakeholders (optional)</label>
        <StakeholderAssigner
          currentStakeholderIds={stakeholderIds}
          allStakeholders={allStakeholders}
          onSave={setStakeholderIds}
        />
      </div>
      <Button type="submit" className="w-full" disabled={!projectId || !description.trim()}>Add Task</Button>
    </form>
  );
}

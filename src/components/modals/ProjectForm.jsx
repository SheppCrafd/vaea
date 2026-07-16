import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAreas } from "@/hooks/useAreas";
import { useProducts } from "@/hooks/useProducts";
import { useCreateProject } from "@/hooks/useProjects";
import { useStakeholders } from "@/hooks/useStakeholders";
import StakeholderAssigner from "@/components/shared/StakeholderAssigner";

export default function ProjectForm({ onDone }) {
  const [title, setTitle] = useState("");
  const [areaId, setAreaId] = useState("");
  const [productId, setProductId] = useState("");
  const [objective, setObjective] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [stakeholderIds, setStakeholderIds] = useState([]);
  const { data: areas = [] } = useAreas();
  const { data: products = [] } = useProducts();
  const { data: allStakeholders = [] } = useStakeholders();
  const createProject = useCreateProject();

  const availableProducts = products.filter((p) => p.parent_area_id === areaId);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim() || !areaId) return;
    const payload = {
      title,
      parent_area_id: areaId,
      parent_product_id: productId || null,
      is_archived: false,
    };
    if (objective.trim()) payload.objective = objective.trim();
    if (ownerName.trim()) payload.owner_name = ownerName.trim();
    if (dueDate) payload.due_date = dueDate;
    if (stakeholderIds.length) payload.stakeholder_ids = stakeholderIds;
    createProject.mutate(payload);
    onDone?.();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium block mb-1">Area</label>
        <select
          value={areaId}
          onChange={(e) => { setAreaId(e.target.value); setProductId(""); }}
          className="w-full text-sm px-3 py-2 bg-background border border-input rounded-md"
        >
          <option value="">Select an area...</option>
          {areas.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
        </select>
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">Product (optional — leave blank for standalone)</label>
        <select
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          className="w-full text-sm px-3 py-2 bg-background border border-input rounded-md"
          disabled={!areaId}
        >
          <option value="">No product (standalone)</option>
          {availableProducts.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">Project title</label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Admin Tasks" autoFocus />
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">Objective (optional)</label>
        <Input value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="What this project delivers" />
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-sm font-medium block mb-1">Owner (optional)</label>
          <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="e.g. Jordan" />
        </div>
        <div className="flex-1">
          <label className="text-sm font-medium block mb-1">Due date (optional)</label>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">Stakeholders (optional)</label>
        <StakeholderAssigner
          currentStakeholderIds={stakeholderIds}
          allStakeholders={allStakeholders}
          onSave={setStakeholderIds}
        />
      </div>
      <Button type="submit" className="w-full" disabled={!areaId || !title.trim()}>Create Project</Button>
    </form>
  );
}

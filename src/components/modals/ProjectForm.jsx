import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAreas } from "@/hooks/useAreas";
import { useProducts } from "@/hooks/useProducts";
import { useCreateProject } from "@/hooks/useProjects";
import { useStakeholders } from "@/hooks/useStakeholders";
import { useToast } from "@/components/ui/use-toast";
import StakeholderAssigner from "@/components/shared/StakeholderAssigner";
import DateField from "@/components/shared/DateField";
import FormField from "@/components/shared/FormField";
import { Select } from "@/components/ui/select";
import { useLastUsedValue } from "@/hooks/useLastUsedValue";

export default function ProjectForm({ onDone }) {
  const [title, setTitle] = useState("");
  const [areaId, setAreaId] = useState("");
  const [productId, setProductId] = useState("");
  const [objective, setObjective] = useState("");
  const [ownerName, setOwnerName] = useLastUsedValue("project_owner_name");
  const [dueDate, setDueDate] = useState("");
  const [stakeholderIds, setStakeholderIds] = useState([]);
  const { data: areas = [] } = useAreas();
  const { data: products = [] } = useProducts();
  const { data: allStakeholders = [] } = useStakeholders();
  const createProject = useCreateProject();
  const { toast } = useToast();

  const availableProducts = products.filter((p) => p.parent_area_id === areaId);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim() || !areaId || createProject.isPending) return;
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
    createProject.mutate(payload, {
      onSuccess: () => onDone?.(),
      onError: (err) => {
        toast({
          variant: "destructive",
          title: "Couldn't create project",
          description: err?.message || "Something went wrong — try again.",
        });
      },
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField label="Area" htmlFor="project-area">
        <Select
          id="project-area"
          value={areaId}
          onChange={(e) => { setAreaId(e.target.value); setProductId(""); }}
          placeholder="Select an area..."
          options={areas.map((a) => ({ value: a.id, label: a.title }))}
        />
      </FormField>
      <FormField label="Product (optional — leave blank for standalone)" htmlFor="project-product">
        <Select
          id="project-product"
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          disabled={!areaId}
          placeholder="No product (standalone)"
          options={availableProducts.map((p) => ({ value: p.id, label: p.title }))}
        />
      </FormField>
      <FormField label="Project title" htmlFor="project-title">
        <Input id="project-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Admin Tasks" autoFocus />
      </FormField>
      <FormField label="Objective (optional)" htmlFor="project-objective">
        <Input id="project-objective" value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="What this project delivers" />
      </FormField>
      <div className="flex gap-3">
        <div className="flex-1">
          <FormField label="Owner (optional)" htmlFor="project-owner">
            <Input id="project-owner" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="e.g. Jordan" />
          </FormField>
        </div>
        <div className="flex-1">
          <FormField label="Due date (optional)" htmlFor="project-due-date">
            <DateField id="project-due-date" value={dueDate} onSave={(v) => setDueDate(v || "")} className="w-full" />
          </FormField>
        </div>
      </div>
      <FormField label="Stakeholders (optional)">
        <StakeholderAssigner
          currentStakeholderIds={stakeholderIds}
          allStakeholders={allStakeholders}
          onSave={setStakeholderIds}
        />
      </FormField>
      <Button type="submit" className="w-full" disabled={!areaId || !title.trim() || createProject.isPending}>
        {createProject.isPending ? "Creating…" : "Create Project"}
      </Button>
    </form>
  );
}

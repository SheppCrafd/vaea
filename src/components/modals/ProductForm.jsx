import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAreas } from "@/hooks/useAreas";
import { useCreateProduct } from "@/hooks/useProducts";
import FormField from "@/components/shared/FormField";
import EntitySelect from "@/components/shared/EntitySelect";

export default function ProductForm({ onDone }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [areaId, setAreaId] = useState("");
  const { data: areas = [] } = useAreas();
  const createProduct = useCreateProduct();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim() || !areaId) return;
    createProduct.mutate({ parent_area_id: areaId, title, description });
    onDone?.();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField label="Area" htmlFor="new-product-area">
        <EntitySelect
          id="new-product-area"
          value={areaId}
          onChange={(e) => setAreaId(e.target.value)}
          placeholder="Select an area..."
          options={areas.map((a) => ({ value: a.id, label: a.title }))}
        />
      </FormField>
      <FormField label="Product title" htmlFor="new-product-title">
        <Input id="new-product-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Workspace Core" autoFocus />
      </FormField>
      <FormField label="Description" htmlFor="new-product-description">
        <Input id="new-product-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" />
      </FormField>
      <Button type="submit" className="w-full" disabled={!areaId || !title.trim()}>Create Product</Button>
    </form>
  );
}

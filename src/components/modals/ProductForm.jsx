import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAreas } from "@/hooks/useAreas";
import { useCreateProduct } from "@/hooks/useProducts";

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
      <div>
        <label htmlFor="new-product-area" className="text-sm font-medium block mb-1">Area</label>
        <select id="new-product-area" value={areaId} onChange={(e) => setAreaId(e.target.value)} className="w-full text-sm px-3 py-2 bg-background border border-input rounded-md">
          <option value="">Select an area...</option>
          {areas.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="new-product-title" className="text-sm font-medium block mb-1">Product title</label>
        <Input id="new-product-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Workspace Core" autoFocus />
      </div>
      <div>
        <label htmlFor="new-product-description" className="text-sm font-medium block mb-1">Description</label>
        <Input id="new-product-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" />
      </div>
      <Button type="submit" className="w-full" disabled={!areaId || !title.trim()}>Create Product</Button>
    </form>
  );
}
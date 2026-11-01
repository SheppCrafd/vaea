import { useRef, useState } from "react";
import { useDraft, clearDraft } from "@/lib/formDrafts";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAreas } from "@/hooks/useAreas";
import { useCreateProduct } from "@/hooks/useProducts";
import FormField from "@/components/shared/FormField";
import { Select } from "@/components/ui/select";

export default function ProductForm({ onDone, prefill = null }) {
  const [title, setTitle] = useDraft("product.title");
  const [description, setDescription] = useDraft("product.description");
  // Seeded from the card that opened this modal (the (+) on an area card).
  const [areaId, setAreaId] = useState(prefill?.parent_area_id || "");
  const { data: areas = [] } = useAreas();
  const createProduct = useCreateProduct();

  // isPending only updates after a re-render, so clicks in the same tick
  // (a double-click) all passed it and created duplicates. The ref blocks
  // a second submit until this one settles.
  const submitting = useRef(false);
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim() || !areaId || createProduct.isPending) return;
    if (submitting.current) return;
    submitting.current = true;
    createProduct.mutate(
      { parent_area_id: areaId, title, description },
      // A failure is shown by the global mutation toast (query-client.js).
      { onSuccess: () => { clearDraft("product.title", "product.description"); onDone?.(); }, onSettled: () => { submitting.current = false; } }
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField label="Area" htmlFor="new-product-area">
        <Select
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
      <Button type="submit" className="w-full" disabled={!areaId || !title.trim() || createProduct.isPending}>
        {createProduct.isPending ? "Creating…" : "Create Product"}
      </Button>
    </form>
  );
}

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCreateArea } from "@/hooks/useAreas";
import FormField from "@/components/shared/FormField";

export default function AreaForm({ onDone }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const createArea = useCreateArea();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    createArea.mutate({ title, description });
    onDone?.();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField label="Area title" htmlFor="area-title">
        <Input id="area-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Home" autoFocus />
      </FormField>
      <FormField label="Description" htmlFor="area-description">
        <Input id="area-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" />
      </FormField>
      <Button type="submit" className="w-full" disabled={!title.trim()}>Create Area</Button>
    </form>
  );
}

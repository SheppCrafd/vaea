import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCreateArea } from "@/hooks/useAreas";

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
      <div>
        <label htmlFor="area-title" className="text-sm font-medium block mb-1">Area title</label>
        <Input id="area-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Home" autoFocus />
      </div>
      <div>
        <label htmlFor="area-description" className="text-sm font-medium block mb-1">Description</label>
        <Input id="area-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" />
      </div>
      <Button type="submit" className="w-full" disabled={!title.trim()}>Create Area</Button>
    </form>
  );
}
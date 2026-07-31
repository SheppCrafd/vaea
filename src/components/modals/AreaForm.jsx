import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCreateArea } from "@/hooks/useAreas";
import { useToast } from "@/components/ui/use-toast";
import FormField from "@/components/shared/FormField";

export default function AreaForm({ onDone }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const createArea = useCreateArea();
  const { toast } = useToast();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim() || createArea.isPending) return;
    createArea.mutate(
      { title, description },
      {
        onSuccess: () => onDone?.(),
        onError: (err) => {
          toast({
            variant: "destructive",
            title: "Couldn't create area",
            description: err?.message || "Something went wrong — try again.",
          });
        },
      }
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField label="Area title" htmlFor="area-title">
        <Input id="area-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Home" autoFocus />
      </FormField>
      <FormField label="Description" htmlFor="area-description">
        <Input id="area-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" />
      </FormField>
      <Button type="submit" className="w-full" disabled={!title.trim() || createArea.isPending}>
        {createArea.isPending ? "Creating…" : "Create Area"}
      </Button>
    </form>
  );
}

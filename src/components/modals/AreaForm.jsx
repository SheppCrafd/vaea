import { useRef } from "react";
import { useDraft, clearDraft } from "@/lib/formDrafts";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCreateArea } from "@/hooks/useAreas";
import FormField from "@/components/shared/FormField";

export default function AreaForm({ onDone }) {
  const [title, setTitle] = useDraft("area.title");
  const [description, setDescription] = useDraft("area.description");
  const createArea = useCreateArea();

  // isPending only updates after a re-render, so clicks in the same tick
  // (a double-click) all passed it and created duplicates. The ref blocks
  // a second submit until this one settles.
  const submitting = useRef(false);
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim() || createArea.isPending) return;
    if (submitting.current) return;
    submitting.current = true;
    createArea.mutate(
      { title, description },
      // A failure is shown by the global mutation toast (query-client.js).
      { onSuccess: () => { clearDraft("area.title", "area.description"); onDone?.(); }, onSettled: () => { submitting.current = false; } }
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

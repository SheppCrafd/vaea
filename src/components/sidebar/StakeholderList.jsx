import { useState } from "react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Plus, X } from "lucide-react";
import { useStakeholders, useDeleteStakeholder } from "@/hooks/useStakeholders";
import { useProducts } from "@/hooks/useProducts";
import { useProjects } from "@/hooks/useProjects";
import { useAllTasks } from "@/hooks/useTasks";
import { useAllProjectNotes } from "@/hooks/useProjectNotes";
import { useHighlight } from "@/lib/HighlightContext";
import CanvasAvatar from "@/components/sidebar/CanvasAvatar";
import AddStakeholderModal from "@/components/sidebar/AddStakeholderModal";

// Stakeholders grouped by department, each with a relational metrics grid
// (live counts of Tasks/Notes/Projects/Products referencing them) and a
// checkbox that drives the global highlight context.
export default function StakeholderList() {
  const { data: stakeholders = [] } = useStakeholders();
  const { data: products = [] } = useProducts();
  const { data: projects = [] } = useProjects();
  const { data: tasks = [] } = useAllTasks();
  const { data: notes = [] } = useAllProjectNotes();
  const { highlightedIds, toggleHighlight } = useHighlight();
  const deleteStakeholder = useDeleteStakeholder();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const departments = [...new Set(stakeholders.map((s) => s.department))];

  const handleRemove = (stakeholder) => {
    if (window.confirm(`Remove stakeholder? "${stakeholder.name}" will be removed from the stakeholder list.`)) {
      deleteStakeholder.mutate(stakeholder.id);
    }
  };

  const countFor = (list, id) => list.filter((item) => (item.stakeholder_ids || []).includes(id)).length;

  return (
    <div>
      <button
        onClick={() => setIsAddOpen(true)}
        className="w-full mb-3 text-xs flex items-center justify-center gap-1.5 px-3 py-1.5 bg-secondary text-secondary-foreground rounded-md"
      >
        <Plus className="w-3.5 h-3.5" />
        Add Stakeholder
      </button>

      <Accordion type="multiple" className="w-full">
        {departments.map((dept) => (
          <AccordionItem key={dept} value={dept}>
            <AccordionTrigger className="text-sm">{dept}</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3">
                {stakeholders.filter((s) => s.department === dept).map((s) => (
                  <div key={s.id} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={highlightedIds.includes(s.id)}
                        onChange={() => toggleHighlight(s.id)}
                      />
                      <CanvasAvatar name={s.name} avatarUrl={s.avatar_url} />
                      <span className="text-xs flex-1 truncate min-w-0">{s.name}</span>
                      <button
                        onClick={() => handleRemove(s)}
                        className="text-muted-foreground hover:text-destructive shrink-0"
                        aria-label="Remove stakeholder"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex gap-1.5 pl-6 flex-wrap">
                      <span className="text-[10px] px-1.5 py-0.5 bg-muted rounded">Tasks {countFor(tasks, s.id)}</span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-muted rounded">Notes {countFor(notes, s.id)}</span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-muted rounded">Projects {countFor(projects, s.id)}</span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-muted rounded">Products {countFor(products, s.id)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {isAddOpen && <AddStakeholderModal onClose={() => setIsAddOpen(false)} />}
    </div>
  );
}
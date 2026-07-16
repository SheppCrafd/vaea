import { useState } from "react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Plus, X } from "lucide-react";
import { useStakeholders, useDeleteStakeholder, useUpdateStakeholder } from "@/hooks/useStakeholders";
import { useProducts } from "@/hooks/useProducts";
import { useProjects } from "@/hooks/useProjects";
import { useAllTasks } from "@/hooks/useTasks";
import { useAllProjectNotes } from "@/hooks/useProjectNotes";
import { useHighlight } from "@/lib/HighlightContext";
import { useEditableField } from "@/hooks/useEditableField";
import { confirmThen } from "@/lib/entityUtils";
import { base44 } from "@/api/base44Client";
import Avatar from "@/components/shared/Avatar";
import AddStakeholderModal from "@/components/sidebar/AddStakeholderModal";

function StakeholderRow({ stakeholder, isHighlighted, onToggleHighlight, onRemove, counts }) {
  const updateStakeholder = useUpdateStakeholder();

  const { value: name, handleInput: handleNameInput } = useEditableField(
    stakeholder.name,
    (value) => updateStakeholder.mutate({ id: stakeholder.id, data: { name: value } })
  );
  const { value: department, handleInput: handleDepartmentInput } = useEditableField(
    stakeholder.department,
    (value) => updateStakeholder.mutate({ id: stakeholder.id, data: { department: value } })
  );

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    updateStakeholder.mutate({ id: stakeholder.id, data: { avatar_url: file_url } });
    e.target.value = "";
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <input type="checkbox" checked={isHighlighted} onChange={onToggleHighlight} />
        <label className="cursor-pointer shrink-0" title="Click to change photo">
          <Avatar name={stakeholder.name} avatarUrl={stakeholder.avatar_url} />
          <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
        </label>
        <div className="flex-1 min-w-0">
          <span
            contentEditable
            suppressContentEditableWarning
            onInput={handleNameInput}
            className="text-xs block truncate outline-none focus:ring-1 focus:ring-primary/40 rounded cursor-text"
          >
            {name}
          </span>
          <span
            contentEditable
            suppressContentEditableWarning
            onInput={handleDepartmentInput}
            className="text-[9px] text-muted-foreground block truncate outline-none focus:ring-1 focus:ring-primary/40 rounded cursor-text"
          >
            {department}
          </span>
        </div>
        <button
          onClick={onRemove}
          className="text-muted-foreground hover:text-destructive shrink-0"
          aria-label="Remove stakeholder"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex gap-1.5 pl-6 flex-wrap">
        <span className="text-[10px] px-1.5 py-0.5 bg-muted rounded">Tasks {counts.tasks}</span>
        <span className="text-[10px] px-1.5 py-0.5 bg-muted rounded">Notes {counts.notes}</span>
        <span className="text-[10px] px-1.5 py-0.5 bg-muted rounded">Projects {counts.projects}</span>
        <span className="text-[10px] px-1.5 py-0.5 bg-muted rounded">Products {counts.products}</span>
      </div>
    </div>
  );
}

// Stakeholders grouped by department, each with a relational metrics grid
// (live counts of Tasks/Notes/Projects/Products referencing them), inline
// editing of name/department/photo, and a checkbox that drives the global
// highlight context.
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
    confirmThen(`Remove stakeholder? "${stakeholder.name}" will be removed from the stakeholder list.`, () =>
      deleteStakeholder.mutate(stakeholder.id)
    );
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

      {departments.length === 0 && (
        <p className="text-xs text-muted-foreground">No stakeholders added.</p>
      )}
      <Accordion type="multiple" className="w-full">
        {departments.map((dept) => (
          <AccordionItem key={dept} value={dept}>
            <AccordionTrigger className="text-sm">{dept}</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3">
                {stakeholders.filter((s) => s.department === dept).map((s) => (
                  <StakeholderRow
                    key={s.id}
                    stakeholder={s}
                    isHighlighted={highlightedIds.includes(s.id)}
                    onToggleHighlight={() => toggleHighlight(s.id)}
                    onRemove={() => handleRemove(s)}
                    counts={{
                      tasks: countFor(tasks, s.id),
                      notes: countFor(notes, s.id),
                      projects: countFor(projects, s.id),
                      products: countFor(products, s.id),
                    }}
                  />
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

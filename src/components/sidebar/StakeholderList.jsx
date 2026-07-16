import { useState } from "react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Plus, X, Trash2 } from "lucide-react";
import { useStakeholders, useDeleteStakeholder, useUpdateStakeholder } from "@/hooks/useStakeholders";
import { useDepartments, useCreateDepartment, useRenameDepartment, useDeleteDepartment } from "@/hooks/useDepartments";
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

function StakeholderRow({ stakeholder, departmentNames, isHighlighted, onToggleHighlight, onRemove, counts }) {
  const updateStakeholder = useUpdateStakeholder();

  const { value: name, handleInput: handleNameInput } = useEditableField(
    stakeholder.name,
    (value) => updateStakeholder.mutate({ id: stakeholder.id, data: { name: value } })
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
          <select
            value={stakeholder.department || ""}
            onChange={(e) => updateStakeholder.mutate({ id: stakeholder.id, data: { department: e.target.value } })}
            className="text-[9px] text-muted-foreground bg-transparent outline-none w-full truncate"
          >
            <option value="">Unassigned</option>
            {departmentNames.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
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

// Rename/delete toolbar for a real Department record — kept out of the
// AccordionTrigger (which is itself a <button>) so the inline-editable name
// and the delete <button> here aren't invalid nested-interactive-content.
function DepartmentToolbar({ department, memberCount }) {
  const renameDepartment = useRenameDepartment();
  const deleteDepartment = useDeleteDepartment();

  const { value: name, handleInput } = useEditableField(
    department.name,
    (value) => value.trim() && renameDepartment.mutate({ id: department.id, name: value.trim() })
  );

  const handleDelete = () => {
    confirmThen(
      `Delete department "${department.name}"? ${memberCount} stakeholder${memberCount === 1 ? "" : "s"} will become Unassigned. This cannot be undone.`,
      () => deleteDepartment.mutate(department.id)
    );
  };

  return (
    <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-border">
      <span
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        className="text-xs font-medium outline-none focus:ring-1 focus:ring-primary/40 rounded cursor-text flex-1 min-w-0 truncate"
      >
        {name}
      </span>
      <button onClick={handleDelete} aria-label="Delete department" className="shrink-0 text-muted-foreground hover:text-destructive">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// Stakeholders grouped by department. Departments are a real, managed list
// (create/rename/delete, all cascading to their members) rather than just
// whatever strings happen to be set on existing stakeholders — so an empty
// department can exist ready for people to be added to it, and stakeholders
// whose department was deleted (or never set) fall into a synthetic
// "Unassigned" bucket instead of disappearing.
export default function StakeholderList() {
  const { data: stakeholders = [] } = useStakeholders();
  const { data: departments = [] } = useDepartments();
  const { data: products = [] } = useProducts();
  const { data: projects = [] } = useProjects();
  const { data: tasks = [] } = useAllTasks();
  const { data: notes = [] } = useAllProjectNotes();
  const { highlightedIds, toggleHighlight } = useHighlight();
  const deleteStakeholder = useDeleteStakeholder();
  const createDepartment = useCreateDepartment();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isAddingDept, setIsAddingDept] = useState(false);
  const [newDeptName, setNewDeptName] = useState("");

  const departmentNames = departments.map((d) => d.name);
  const unassignedStakeholders = stakeholders.filter((s) => !departmentNames.includes(s.department));

  const handleRemove = (stakeholder) => {
    confirmThen(`Remove stakeholder? "${stakeholder.name}" will be removed from the stakeholder list.`, () =>
      deleteStakeholder.mutate(stakeholder.id)
    );
  };

  const handleAddDepartment = (e) => {
    e.preventDefault();
    if (!newDeptName.trim()) return;
    createDepartment.mutate({ name: newDeptName.trim() });
    setNewDeptName("");
    setIsAddingDept(false);
  };

  const countFor = (list, id) => list.filter((item) => (item.stakeholder_ids || []).includes(id)).length;

  const renderRow = (s) => (
    <StakeholderRow
      key={s.id}
      stakeholder={s}
      departmentNames={departmentNames}
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
  );

  return (
    <div>
      <button
        onClick={() => setIsAddOpen(true)}
        className="w-full mb-2 text-xs flex items-center justify-center gap-1.5 px-3 py-1.5 bg-secondary text-secondary-foreground rounded-md"
      >
        <Plus className="w-3.5 h-3.5" />
        Add Stakeholder
      </button>

      {isAddingDept ? (
        <form onSubmit={handleAddDepartment} className="flex items-center gap-1.5 mb-3">
          <input
            value={newDeptName}
            onChange={(e) => setNewDeptName(e.target.value)}
            placeholder="Department name"
            autoFocus
            className="flex-1 text-xs px-2 py-1.5 bg-background border border-input rounded outline-none"
          />
          <button type="submit" disabled={!newDeptName.trim()} className="text-xs px-2 py-1.5 bg-primary text-primary-foreground rounded-md disabled:opacity-50">
            Add
          </button>
          <button type="button" onClick={() => setIsAddingDept(false)} className="text-xs px-2 py-1.5 text-muted-foreground hover:text-foreground">
            Cancel
          </button>
        </form>
      ) : (
        <button
          onClick={() => setIsAddingDept(true)}
          className="w-full mb-3 text-xs flex items-center justify-center gap-1.5 px-3 py-1.5 bg-secondary/50 text-secondary-foreground rounded-md border border-dashed border-border"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Department
        </button>
      )}

      {departments.length === 0 && unassignedStakeholders.length === 0 && (
        <p className="text-xs text-muted-foreground">No stakeholders added.</p>
      )}

      <Accordion type="multiple" className="w-full">
        {departments.map((dept) => {
          const members = stakeholders.filter((s) => s.department === dept.name);
          return (
            <AccordionItem key={dept.id} value={dept.id}>
              <AccordionTrigger className="text-sm">{dept.name}</AccordionTrigger>
              <AccordionContent>
                <DepartmentToolbar department={dept} memberCount={members.length} />
                <div className="space-y-3">
                  {members.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No stakeholders in this department yet.</p>
                  ) : (
                    members.map(renderRow)
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
        {unassignedStakeholders.length > 0 && (
          <AccordionItem value="__unassigned__">
            <AccordionTrigger className="text-sm">Unassigned</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3">{unassignedStakeholders.map(renderRow)}</div>
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>

      {isAddOpen && <AddStakeholderModal onClose={() => setIsAddOpen(false)} />}
    </div>
  );
}

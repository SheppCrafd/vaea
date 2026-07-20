import { useState } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Plus, X, Trash2, GripVertical, Pencil } from "lucide-react";
import { useStakeholders, useDeleteStakeholder, useUpdateStakeholder } from "@/hooks/useStakeholders";
import { useDepartments, useCreateDepartment, useRenameDepartment, useDeleteDepartment } from "@/hooks/useDepartments";
import { useProducts } from "@/hooks/useProducts";
import { useProjects } from "@/hooks/useProjects";
import { useAllTasks } from "@/hooks/useTasks";
import { useAllProjectNotes } from "@/hooks/useProjectNotes";
import { useHighlight, HIGHLIGHT_CATEGORIES } from "@/lib/HighlightContext";
import { useEditableField } from "@/hooks/useEditableField";
import { confirmThen } from "@/lib/entityUtils";
import { useFileUpload } from "@/hooks/useFileUpload";
import Avatar from "@/components/shared/Avatar";
import AddStakeholderModal from "@/components/sidebar/AddStakeholderModal";
import QueryError from "@/components/shared/QueryError";

// One checkbox per object type (tasks/notes/projects/products), each showing
// that type's live count and independently toggleable — checking "tasks"
// must only highlight tasks, not this stakeholder's projects too.
function HighlightCheckbox({ category, count, isChecked, onToggle, stakeholderName }) {
  const label = category.charAt(0).toUpperCase() + category.slice(1);
  return (
    <label
      className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border cursor-pointer select-none transition-colors ${
        isChecked ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border"
      }`}
      title={`Highlight ${category} ${stakeholderName} is on`}
    >
      <input type="checkbox" checked={isChecked} onChange={onToggle} className="sr-only" />
      {label}: {count}
    </label>
  );
}

function StakeholderRow({ stakeholder, isHighlighted, onToggleHighlight, onRemove, counts }) {
  const updateStakeholder = useUpdateStakeholder();
  const { upload } = useFileUpload();

  const { value: name, handleInput: handleNameInput, handleBlur: handleNameBlur, handleKeyDown: handleNameKeyDown } = useEditableField(
    stakeholder.name,
    (value) => updateStakeholder.mutate({ id: stakeholder.id, data: { name: value } })
  );

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const file_url = await upload(file);
    updateStakeholder.mutate({ id: stakeholder.id, data: { avatar_url: file_url } });
    e.target.value = "";
  };

  // Draggable onto a project/product/task card (to assign) or a department
  // section (to reassign — the department select was removed once dragging
  // onto a department became the way to do that). A dedicated grip handle,
  // not the whole row, since the row is already full of its own click
  // targets (checkbox, avatar upload, inline-editable name, delete).
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `stakeholder-${stakeholder.id}`,
    data: { type: "stakeholder", stakeholderId: stakeholder.id, name: stakeholder.name, avatarUrl: stakeholder.avatar_url },
  });
  // The row itself stays put as a faded "ghost" while dragging — it's
  // nested inside the accordion's clipped, scrollable sidebar, so no
  // z-index on this element could ever escape that. The actual moving
  // visual under the cursor is AppShell's <DragOverlay>, which portals
  // straight to document.body and is unaffected by any of that.
  const style = {
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="space-y-1">
      <div className="flex items-center gap-1.5">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-foreground shrink-0"
          aria-label="Drag to assign or move"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
        <label className="cursor-pointer shrink-0" title="Click to change photo">
          <Avatar name={stakeholder.name} avatarUrl={stakeholder.avatar_url} />
          <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
        </label>
        <div className="flex-1 min-w-0">
          <span
            contentEditable
            suppressContentEditableWarning
            onInput={handleNameInput}
            onBlur={handleNameBlur}
            onKeyDown={handleNameKeyDown}
            className="text-xs block truncate outline-none focus:ring-1 focus:ring-primary/40 rounded cursor-text"
          >
            {name}
          </span>
          <span className="text-[9px] text-muted-foreground truncate block">
            {stakeholder.department || "Unassigned"}
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
        {HIGHLIGHT_CATEGORIES.map((category) => (
          <HighlightCheckbox
            key={category}
            category={category}
            count={counts[category]}
            isChecked={isHighlighted(category)}
            onToggle={() => onToggleHighlight(category)}
            stakeholderName={stakeholder.name}
          />
        ))}
      </div>
    </div>
  );
}

// Rename/delete toolbar for a real Department record — kept out of the
// AccordionTrigger (which is itself a <button>, and already shows the
// department name) so the delete <button> here isn't invalid
// nested-interactive-content, and so the name isn't shown a second time.
// Renaming is click-to-reveal, matching ChatSessionList's session rename.
function DepartmentToolbar({ department, memberCount }) {
  const renameDepartment = useRenameDepartment();
  const deleteDepartment = useDeleteDepartment();
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(department.name);

  const startRenaming = () => {
    setRenameValue(department.name);
    setIsRenaming(true);
  };

  const commitRename = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== department.name) {
      renameDepartment.mutate({ id: department.id, name: trimmed });
    }
    setIsRenaming(false);
  };

  const handleDelete = () => {
    confirmThen(
      `Delete department "${department.name}"? ${memberCount} stakeholder${memberCount === 1 ? "" : "s"} will become Unassigned. This cannot be undone.`,
      () => deleteDepartment.mutate(department.id)
    );
  };

  if (isRenaming) {
    return (
      <div className="flex items-center gap-2 pb-2 mb-2 border-b border-border">
        <input
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") setIsRenaming(false);
          }}
          autoFocus
          className="flex-1 min-w-0 text-xs px-2 py-1 bg-background border border-input rounded outline-none"
        />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-3 pb-2 mb-2 border-b border-border">
      <button onClick={startRenaming} aria-label="Rename department" className="text-muted-foreground hover:text-foreground">
        <Pencil className="w-3.5 h-3.5" />
      </button>
      <button onClick={handleDelete} aria-label="Delete department" className="text-muted-foreground hover:text-destructive">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// Wraps a whole department's AccordionItem so it's a stakeholder-drop target
// (reassigns their department) whether the section is expanded or
// collapsed — the drop zone can't just live inside AccordionContent, since
// that unmounts when collapsed.
function DepartmentSection({ id, name, children }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `department-drop-${id ?? "unassigned"}`,
    data: { type: "department", id, name: name || "" },
  });

  return (
    <div ref={setNodeRef} className={`rounded-md transition-colors ${isOver ? "bg-primary/10 ring-2 ring-primary/40" : ""}`}>
      <AccordionItem value={id ?? "__unassigned__"}>
        <AccordionTrigger className="text-sm">{name || "Unassigned"}</AccordionTrigger>
        <AccordionContent>{children}</AccordionContent>
      </AccordionItem>
    </div>
  );
}

// Stakeholders grouped by department. Departments are a real, managed list
// (create/rename/delete, all cascading to their members) rather than just
// whatever strings happen to be set on existing stakeholders — so an empty
// department can exist ready for people to be added to it, and stakeholders
// whose department was deleted (or never set) fall into a synthetic
// "Unassigned" bucket instead of disappearing. Every stakeholder row is also
// draggable, onto a department section (reassign) or a project/product/task
// card elsewhere in the app (assign).
export default function StakeholderList() {
  const { data: stakeholders = [], isError: stakeholdersError, error: stakeholdersErrorObj, refetch: refetchStakeholders } = useStakeholders();
  const { data: departments = [] } = useDepartments();
  const { data: products = [] } = useProducts();
  const { data: projects = [] } = useProjects();
  const { data: tasks = [] } = useAllTasks();
  const { data: notes = [] } = useAllProjectNotes();
  const { toggleHighlight, isHighlighted } = useHighlight();
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
      isHighlighted={(category) => isHighlighted(s.id, category)}
      onToggleHighlight={(category) => toggleHighlight(s.id, category)}
      onRemove={() => handleRemove(s)}
      counts={{
        tasks: countFor(tasks, s.id),
        notes: countFor(notes, s.id),
        projects: countFor(projects, s.id),
        products: countFor(products, s.id),
      }}
    />
  );

  if (stakeholdersError) {
    return <QueryError error={stakeholdersErrorObj} onRetry={refetchStakeholders} label="Couldn't load stakeholders." />;
  }

  return (
    <div>
      <button
        onClick={() => setIsAddOpen(true)}
        className="w-full mb-2 text-xs flex items-center justify-center gap-1.5 px-3 py-1.5 bg-secondary text-secondary-foreground border border-border rounded-md"
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
          <button type="submit" disabled={!newDeptName.trim()} className="text-xs px-2 py-1.5 bg-primary text-primary-foreground border border-border rounded-md disabled:opacity-50">
            Add
          </button>
          <button type="button" onClick={() => setIsAddingDept(false)} className="text-xs px-2 py-1.5 text-muted-foreground hover:text-foreground">
            Cancel
          </button>
        </form>
      ) : (
        <button
          onClick={() => setIsAddingDept(true)}
          className="w-full mb-3 text-xs flex items-center justify-center gap-1.5 px-3 py-1.5 bg-secondary/50 text-secondary-foreground rounded-md border border-border"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Department
        </button>
      )}

      {departments.length === 0 && unassignedStakeholders.length === 0 && (
        <p className="text-xs text-muted-foreground">No stakeholders added.</p>
      )}

      <Accordion type="multiple" className="w-full space-y-1">
        {departments.map((dept) => {
          const members = stakeholders.filter((s) => s.department === dept.name);
          return (
            <DepartmentSection key={dept.id} id={dept.id} name={dept.name}>
              <DepartmentToolbar department={dept} memberCount={members.length} />
              <div className="space-y-3">
                {members.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No stakeholders in this department yet.</p>
                ) : (
                  members.map(renderRow)
                )}
              </div>
            </DepartmentSection>
          );
        })}
        {unassignedStakeholders.length > 0 && (
          <DepartmentSection id={null} name="">
            <div className="space-y-3">{unassignedStakeholders.map(renderRow)}</div>
          </DepartmentSection>
        )}
      </Accordion>

      {isAddOpen && <AddStakeholderModal onClose={() => setIsAddOpen(false)} />}
    </div>
  );
}

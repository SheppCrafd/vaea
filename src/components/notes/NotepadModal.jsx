import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Sparkles, ListPlus } from "lucide-react";
import Modal from "@/components/shared/Modal";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/ui/delete-button";
import EditableText from "@/components/shared/EditableText";
import DateField from "@/components/shared/DateField";
import MultiSelectPopover from "@/components/shared/MultiSelectPopover";
import { usePositionedMenu } from "@/hooks/usePositionedMenu";
import { useNotes, useCreateNote, useUpdateNote, useDeleteNote } from "@/hooks/useNotes";
import { useStakeholders } from "@/hooks/useStakeholders";
import { useProducts } from "@/hooks/useProducts";
import { useProjects } from "@/hooks/useProjects";
import { useAppStore } from "@/lib/store";
import { confirmThen } from "@/lib/entityUtils";

// One multi-select cell (Stakeholders / Products / Projects) — a summary
// button that opens the shared MultiSelectPopover.
function TagCell({ label, items, getId, getLabel, selectedIds, onSave }) {
  const { isOpen, coords, triggerRef, toggle, close } = usePositionedMenu({ closeOnScroll: true });
  const names = selectedIds
    .map((id) => { const it = items.find((x) => getId(x) === id); return it ? getLabel(it) : null; })
    .filter(Boolean);
  return (
    <>
      <button
        ref={triggerRef}
        onClick={toggle}
        className="w-full text-left text-[11px] px-1.5 py-1 rounded hover:bg-secondary transition-colors min-h-[24px] text-muted-foreground"
        title={names.join(", ") || `Add ${label.toLowerCase()}`}
      >
        {names.length ? <span className="text-foreground">{names.join(", ")}</span> : <span className="opacity-50">{label}</span>}
      </button>
      <MultiSelectPopover
        isOpen={isOpen}
        coords={coords}
        close={close}
        className="w-56"
        headerLabel={label}
        items={items}
        getId={getId}
        getLabel={getLabel}
        selectedIds={selectedIds}
        onSave={onSave}
        emptyMessage={`No ${label.toLowerCase()} yet`}
      />
    </>
  );
}

function NoteRow({ note, stakeholders, products, projects, onUpdate, onDelete, onCreateTask, onProcess }) {
  const set = (data) => onUpdate({ id: note.id, data });
  return (
    <tr className="border-b border-border/60 align-top">
      <td className="p-1.5 w-[34%]">
        <EditableText
          value={note.content}
          onSave={(v) => set({ content: v })}
          placeholder="Write a note…"
          className="text-xs"
          multiline
        />
      </td>
      <td className="p-1 w-[13%]">
        <TagCell
          label="Stakeholders" items={stakeholders} getId={(s) => s.id} getLabel={(s) => s.name}
          selectedIds={note.stakeholder_ids || []} onSave={(ids) => set({ stakeholder_ids: ids })}
        />
      </td>
      <td className="p-1 w-[13%]">
        <TagCell
          label="Products" items={products} getId={(p) => p.id} getLabel={(p) => p.title}
          selectedIds={note.product_ids || []} onSave={(ids) => set({ product_ids: ids })}
        />
      </td>
      <td className="p-1 w-[13%]">
        <TagCell
          label="Projects" items={projects} getId={(p) => p.id} getLabel={(p) => p.title}
          selectedIds={note.project_ids || []} onSave={(ids) => set({ project_ids: ids })}
        />
      </td>
      <td className="p-1 w-[10%]">
        <DateField value={note.date} onSave={(v) => set({ date: v || "" })} unstyled className="text-[11px] bg-transparent" aria-label="Note date" />
      </td>
      <td className="p-1 w-[10%]">
        <DateField value={note.due_date} onSave={(v) => set({ due_date: v || "" })} unstyled className="text-[11px] bg-transparent" aria-label="Due date" />
      </td>
      <td className="p-1 whitespace-nowrap">
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => onCreateTask(note)}
            title="Create a task from this note"
            aria-label="Create a task from this note"
            className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-secondary"
          >
            <ListPlus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onProcess(note)}
            title="Have Vaea process this note"
            aria-label="Have Vaea process this note"
            className="text-muted-foreground hover:text-primary p-1 rounded hover:bg-secondary"
          >
            <Sparkles className="w-3.5 h-3.5" />
          </button>
          <DeleteButton onClick={() => onDelete(note)} label="Delete note" />
        </div>
      </td>
    </tr>
  );
}

export default function NotepadModal({ onClose }) {
  const navigate = useNavigate();
  const { data: notes = [] } = useNotes();
  const { data: stakeholders = [] } = useStakeholders();
  const { data: products = [] } = useProducts();
  const { data: projects = [] } = useProjects();
  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const openCreateModal = useAppStore((s) => s.openCreateModal);
  const [draft, setDraft] = useState("");

  const addNote = () => {
    const content = draft.trim();
    if (!content) return;
    createNote.mutate({ content });
    setDraft("");
  };

  const handleCreateTask = (note) => {
    openCreateModal("task", {
      description: note.content,
      project_id: (note.project_ids || [])[0] || "",
    });
    onClose();
  };

  const handleProcess = (note) => {
    onClose();
    navigate("/app/chat", {
      state: {
        initialMessage:
          `Process this note — pull out any tasks, decisions, open questions, and follow-ups, ` +
          `and propose where each should go:\n\n"""\n${note.content}\n"""`,
      },
    });
  };

  const sorted = [...notes].sort((a, b) => (b.created_date || "").localeCompare(a.created_date || ""));

  return (
    <Modal
      isOpen
      onClose={onClose}
      label="Notepad"
      overlayClassName="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-start justify-center p-4 sm:p-8"
      panelClassName="bg-card border border-border rounded-xl shadow-2xl w-full max-w-5xl max-h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
    >
      <div className="flex items-center gap-3 p-4 border-b border-border bg-muted/30">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4 text-primary-foreground" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-bold font-heading leading-none">Notepad</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Quick notes with stakeholders, products, projects, and dates — turn any row into a task or hand it to Vaea.</p>
        </div>
      </div>

      <div className="p-4 border-b border-border flex items-start gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) addNote(); }}
          placeholder="Jot something down… (⌘/Ctrl + Enter to add)"
          rows={2}
          className="flex-1 text-sm bg-background border border-input rounded-md px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
        />
        <Button onClick={addNote} disabled={!draft.trim()} className="gap-1.5 shrink-0">
          <Plus className="w-4 h-4" /> Add
        </Button>
      </div>

      <div className="flex-1 overflow-auto">
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-16">No notes yet.</p>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-card z-10">
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="p-2 font-medium">Note</th>
                <th className="p-2 font-medium">Stakeholders</th>
                <th className="p-2 font-medium">Products</th>
                <th className="p-2 font-medium">Projects</th>
                <th className="p-2 font-medium">Date</th>
                <th className="p-2 font-medium">Due</th>
                <th className="p-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((note) => (
                <NoteRow
                  key={note.id}
                  note={note}
                  stakeholders={stakeholders}
                  products={products}
                  projects={projects}
                  onUpdate={updateNote.mutate}
                  onDelete={(n) => confirmThen("Delete this note? This cannot be undone.", () => deleteNote.mutate(n.id))}
                  onCreateTask={handleCreateTask}
                  onProcess={handleProcess}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Modal>
  );
}

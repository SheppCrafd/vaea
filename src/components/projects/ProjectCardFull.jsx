import { useState } from "react";
import { Expand, GripVertical, Link2, Plus, X } from "lucide-react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { usePositionedMenu } from "@/hooks/usePositionedMenu";
import PositionedPopover from "@/components/shared/PositionedPopover";
import ProjectNotes from "@/components/projects/ProjectNotes";
import TaskTableModal from "@/components/projects/TaskTableModal";
import ProjectDetailModal from "@/components/projects/ProjectDetailModal";
import TaskStatistics from "@/components/shared/TaskStatistics";
import EditableText from "@/components/shared/EditableText";
import CardCustomFields from "@/components/shared/CardCustomFields";
import DateField from "@/components/shared/DateField";
import StakeholderAssigner from "@/components/shared/StakeholderAssigner";
import { useTasks } from "@/hooks/useTasks";
import { useProjectNotes, useCreateProjectNote } from "@/hooks/useProjectNotes";
import { useStakeholders } from "@/hooks/useStakeholders";
import { useUpdateProject } from "@/hooks/useProjects";
import { useEditableField } from "@/hooks/useEditableField";
import { useHighlightMatch } from "@/hooks/useHighlightDim";
import { useHighlight } from "@/lib/HighlightContext";
import { sanitizeHttpUrl } from "@/lib/entityUtils";
import { filterActiveTasks, getQuadrantCounts, isTaskDone, STATUS_COLORS } from "@/lib/taskUtils";
import { getDueDateColorClass, DUE_DATE_STATUS_OPTIONS } from "@/lib/projectUtils";

// The original always-visible, always-editable project card — kept alongside
// the mini-card default (ProjectCard.jsx) as a toggle-able view (see
// CardViewContext.jsx), not a replacement for it. Restored verbatim from the
// pre-mini-cards history (identical at both 2fa991e, before this repo's
// original base44 fork, and 082c378, the commit right before mini-cards
// replaced it as the default — the localStorage migration between those two
// points never touched this file's UI, only the hooks underneath it), with
// one addition: the LinksCorner render now sanitizes hrefs the same way
// AttachmentsAndLinks.jsx does, since that fix landed after this file was
// last in use and shouldn't be reintroduced-missing just by bringing this
// view back.

// Small quick-add box for a single ProjectNote type (Risk / Open Question /
// Notes) — tints once populated instead of always, and the type selector is
// gone entirely since each box is already typed by which box it is. Submits
// on Enter; the "+" button is only shown when `showButton` is set (Risks and
// Open Questions rely on Enter alone — the general Notes box keeps a click
// affordance too, matching AddNoteForm's modal equivalent).
function NoteBox({ title, notes, allStakeholders, tintStyle, placeholder, onAdd, showButton = false }) {
  const [text, setText] = useState("");
  const submit = () => {
    if (!text.trim()) return;
    onAdd(text.trim());
    setText("");
  };
  return (
    <div
      className="w-full rounded px-2 py-1 border border-border/60 transition-colors z-20"
      style={notes.length > 0 ? tintStyle : undefined}
    >
      <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider text-left mb-0.5">{title}</p>
      <div className="flex items-center gap-1">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder={placeholder}
          className="flex-1 min-w-0 text-[10px] bg-transparent outline-none text-left placeholder:text-muted-foreground/60"
        />
        {showButton && (
          <button type="button" onClick={submit} aria-label={`Add ${title}`} className="shrink-0 text-muted-foreground hover:text-primary">
            <Plus className="w-3 h-3" />
          </button>
        )}
      </div>
      <ProjectNotes notes={notes} allStakeholders={allStakeholders} />
    </div>
  );
}

// Populated links render directly in the card's lower-right corner (not
// hidden behind a click), with a compact "+" trigger — mirrors
// TaskAttachments' Portal+usePositionedMenu popover pattern for adding one.
function LinksCorner({ links, onSave }) {
  const { isOpen, coords, triggerRef, toggle, close } = usePositionedMenu({ closeOnScroll: true });
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");

  const addLink = (e) => {
    e.preventDefault();
    const trimmed = sanitizeHttpUrl(url);
    if (!trimmed) return;
    onSave([...links, { label: label.trim() || trimmed, url: trimmed }]);
    setLabel("");
    setUrl("");
  };

  const removeLink = (index) => onSave(links.filter((_, i) => i !== index));

  return (
    <div className="absolute bottom-1.5 right-1.5 z-20 flex flex-wrap items-center justify-end gap-1 max-w-[95%]">
      {links.map((l, i) => (
        <a
          key={i}
          href={sanitizeHttpUrl(l.url) || "#"}
          target="_blank"
          rel="noreferrer"
          title={l.url}
          className="flex items-center gap-1 max-w-[120px] text-[10px] text-primary hover:underline bg-secondary/40 rounded px-1.5 py-0.5"
        >
          <Link2 className="w-2.5 h-2.5 shrink-0" />
          <span className="truncate">{l.label}</span>
        </a>
      ))}
      <button ref={triggerRef} type="button" onClick={toggle} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary shrink-0">
        <Plus className="w-3 h-3" />
        Add Links
      </button>
      <PositionedPopover
        isOpen={isOpen}
        coords={coords}
        close={close}
        panelClassName="fixed w-56 max-h-64 overflow-y-auto bg-card border border-border rounded-md shadow-2xl p-2 animate-in fade-in zoom-in-95 duration-100"
      >
        <p className="text-[10px] font-bold uppercase text-muted-foreground px-1 py-1 border-b border-border mb-1">Links</p>
        <div className="flex flex-col gap-1 mb-1">
          {links.map((l, i) => (
            <div key={i} className="flex items-center justify-between gap-1 text-xs px-1 py-1 hover:bg-secondary rounded-sm">
              <a href={sanitizeHttpUrl(l.url) || "#"} target="_blank" rel="noreferrer" className="truncate text-primary hover:underline min-w-0">
                {l.label}
              </a>
              <button onClick={() => removeLink(i)} aria-label="Remove link" className="shrink-0 text-muted-foreground hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
        <form onSubmit={addLink} className="flex flex-col gap-1">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (optional)"
            className="text-xs px-2 py-1 bg-background border border-input rounded outline-none"
          />
          <div className="flex items-center gap-1">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="flex-1 min-w-0 text-xs px-2 py-1 bg-background border border-input rounded outline-none"
            />
            <button type="submit" disabled={!url.trim()} className="text-xs px-2 py-1 bg-primary text-primary-foreground border border-border rounded disabled:opacity-50 shrink-0">
              Add
            </button>
          </div>
        </form>
      </PositionedPopover>
    </div>
  );
}

export default function ProjectCardFull({ project, stakeholderIds = [] }) {
  const [isTableOpen, setIsTableOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // `project.stakeholder_ids || stakeholderIds` looks like a reasonable
  // "fall back to the parent product/area's stakeholders" chain, but an
  // empty array is truthy in JS — `[] || x` always evaluates to `[]`, so
  // that fallback silently never fired for the common case of a project
  // with no stakeholders of its own, and the card dimmed unconditionally
  // whenever any stakeholder was selected instead of reflecting whether its
  // parent product/area actually included them. Fall back on empty length
  // instead of truthiness.
  const cardStakeholderIds = (project.stakeholder_ids?.length ? project.stakeholder_ids : stakeholderIds) || [];
  // Only the "projects" category — a Product-level highlight match should
  // not also light up the projects inside it, per direct feedback that only
  // the actual matching card should visually react, not its ancestors.
  const isMatched = useHighlightMatch(cardStakeholderIds, "projects");
  const { highlights } = useHighlight();

  const { data: tasks = [] } = useTasks(project.id);
  const { data: notes = [] } = useProjectNotes(project.id);
  const riskNotes = notes.filter((n) => n.type === "RISK");
  const questionNotes = notes.filter((n) => n.type === "QUESTION");
  const { data: allStakeholders = [] } = useStakeholders();
  const updateProject = useUpdateProject();
  const createProjectNote = useCreateProjectNote();

  const { value: title, handleInput: handleTitleInput, handleBlur: handleTitleBlur, handleKeyDown: handleTitleKeyDown } = useEditableField(
    project.title,
    (value) => updateProject.mutate({ id: project.id, data: { title: value } })
  );

  const addNote = (type, content) => createProjectNote.mutate({ project_id: project.id, type, content });

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: project.id,
    data: { type: "project", id: project.id, title: project.title },
  });
  // Also a stakeholder-drop target: dragging a stakeholder from the sidebar
  // onto this card assigns them to the project.
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `project-drop-${project.id}`,
    data: { type: "project", id: project.id },
  });
  const setRefs = (node) => {
    setDragRef(node);
    setDropRef(node);
  };

  // The card itself stays put as a faded "ghost" while dragging — it's
  // nested inside ProductCard/AreaCard's own stacking contexts and the
  // scrollable main pane, so no z-index on this element could ever lift it
  // above sibling cards or escape the scroll clipping. The actual moving
  // visual under the cursor is AppShell's <DragOverlay>, which portals
  // straight to document.body and is unaffected by any of that.
  const style = {
    opacity: isDragging ? 0.4 : 1,
  };

  const quadrants = getQuadrantCounts(tasks, highlights);

  const activeTasks = filterActiveTasks(tasks);
  const allDone = activeTasks.length > 0 && activeTasks.every(isTaskDone);

  const dateColorClass = getDueDateColorClass(project, allDone);

  return (
    <div
      ref={setRefs}
      style={style}
      data-project-card={project.id}
      className={`relative bg-card border border-border rounded-xl p-3 pb-6 transition-colors ${isMatched ? "bg-primary/10 ring-1 ring-primary/30" : ""} ${isDragging ? "shadow-2xl scale-105 border-primary" : "shadow-sm"} ${isOver ? "ring-2 ring-primary ring-offset-1" : ""}`}
    >
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 left-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1 z-20"
      >
        <GripVertical className="w-4 h-4" />
      </div>

      <button
        onClick={() => setIsDetailOpen(true)}
        className="absolute top-2 right-2 z-20 text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted transition-colors"
        aria-label="Expand project"
      >
        <Expand className="w-3.5 h-3.5" />
      </button>

      <div className="flex items-start gap-3 pr-5 pl-5">
        <button
          onClick={() => setIsTableOpen(true)}
          className="shrink-0 mt-1 grid grid-cols-2 gap-1 border border-border rounded overflow-hidden w-16 h-16 text-sm z-20 select-none"
          title="Open Task Table"
        >
          {quadrants.map((q) => (
            <div
              key={q.quadrant}
              className={`flex items-center justify-center transition-colors ${
                q.hasHighlightedStakeholder
                  ? "text-foreground font-bold"
                  : q.hasFocus
                  ? "bg-green-800 text-white font-bold"
                  : "bg-muted/40 text-muted-foreground"
              }`}
              style={q.hasHighlightedStakeholder ? { backgroundColor: STATUS_COLORS.DONE } : undefined}
            >
              {q.count}
            </div>
          ))}
        </button>

        <div className="flex-1 text-center px-1 min-w-0 flex flex-col items-center gap-1">
          <h4
            className="font-heading font-semibold text-sm break-words outline-none focus:ring-1 focus:ring-primary/40 rounded cursor-text w-full px-1"
            contentEditable
            suppressContentEditableWarning
            onInput={handleTitleInput}
            onBlur={handleTitleBlur}
            onKeyDown={handleTitleKeyDown}
          >
            {title}
          </h4>
          <EditableText
            value={project.objective}
            onSave={(v) => updateProject.mutate({ id: project.id, data: { objective: v } })}
            placeholder="No objective set"
            className="text-[11px] text-muted-foreground text-center"
          />

          <NoteBox
            title="Risks"
            notes={riskNotes}
            allStakeholders={allStakeholders}
            tintStyle={{ backgroundColor: "rgba(239,68,68,0.05)", borderColor: "rgba(239,68,68,0.15)" }}
            placeholder="Add a risk and press Enter..."
            onAdd={(text) => addNote("RISK", text)}
          />
          <NoteBox
            title="Open Questions"
            notes={questionNotes}
            allStakeholders={allStakeholders}
            tintStyle={{ backgroundColor: `${STATUS_COLORS.PENDING_FEEDBACK}1A`, borderColor: `${STATUS_COLORS.PENDING_FEEDBACK}4D` }}
            placeholder="Add a question and press Enter..."
            onAdd={(text) => addNote("QUESTION", text)}
          />
        </div>

        <div className="text-right shrink-0 min-w-[85px] select-none mt-0.5 flex flex-col items-end gap-1">
          <EditableText
            value={project.owner_name}
            onSave={(v) => updateProject.mutate({ id: project.id, data: { owner_name: v } })}
            placeholder="Unassigned"
            className="text-[10px] font-semibold text-muted-foreground text-right"
          />
          <div className="flex items-center gap-1">
            <DateField
              value={project.due_date}
              onSave={(v) => updateProject.mutate({ id: project.id, data: { due_date: v } })}
              unstyled
              className={`text-[10px] bg-transparent text-right ${dateColorClass}`}
            />
          </div>
          <select
            value={project.due_date_status || "ESTIMATED"}
            onChange={(e) => updateProject.mutate({ id: project.id, data: { due_date_status: e.target.value } })}
            className="text-[9px] bg-transparent border border-border rounded px-1 py-0.5 outline-none"
          >
            {DUE_DATE_STATUS_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
          </select>
          <StakeholderAssigner
            currentStakeholderIds={project.stakeholder_ids || []}
            allStakeholders={allStakeholders}
            onSave={(newIds) => updateProject.mutate({ id: project.id, data: { stakeholder_ids: newIds } })}
            label="Add Stakeholders"
          />
        </div>
      </div>

      <div className="pl-5 pr-1 mt-2">
        <TaskStatistics tasks={tasks} />
      </div>

      <div className="pl-5 pr-1 mt-2">
        <EditableText
          value={project.problem_statement}
          onSave={(v) => updateProject.mutate({ id: project.id, data: { problem_statement: v } })}
          placeholder="No problem statement set"
          className="text-[10px] text-muted-foreground"
          multiline
        />
      </div>

      <CardCustomFields
        entity={project}
        onUpdateEntity={(data) => updateProject.mutate({ id: project.id, data })}
        className="mt-2 pl-5 flex flex-wrap gap-x-3 gap-y-1"
      />

      <LinksCorner
        links={project.links || []}
        onSave={(newLinks) => updateProject.mutate({ id: project.id, data: { links: newLinks } })}
      />

      {isTableOpen && (
        <TaskTableModal project={project} onClose={() => setIsTableOpen(false)} />
      )}
      {isDetailOpen && (
        <ProjectDetailModal project={project} onClose={() => setIsDetailOpen(false)} />
      )}
    </div>
  );
}

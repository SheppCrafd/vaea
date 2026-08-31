import { memo, useState, lazy, Suspense } from "react";
import { Expand, GripVertical, Link2, Plus, X } from "lucide-react";
import { DeleteButton } from "@/components/ui/delete-button";
import { Select } from "@/components/ui/select";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { usePositionedMenu } from "@/hooks/usePositionedMenu";
import PositionedPopover from "@/components/shared/PositionedPopover";
import ProjectNotes from "@/components/projects/ProjectNotes";
import TaskStatistics from "@/components/shared/TaskStatistics";
import EditableText from "@/components/shared/EditableText";
import CardCustomFields from "@/components/shared/CardCustomFields";
import CardBuiltinFields from "@/components/projects/CardBuiltinFields";
import DateField from "@/components/shared/DateField";
import StakeholderAssigner from "@/components/shared/StakeholderAssigner";
import { useTasks } from "@/hooks/useTasks";
import { useProjectNotes, useCreateProjectNote } from "@/hooks/useProjectNotes";
import { useStakeholders } from "@/hooks/useStakeholders";
import { useUpdateProject, useDeleteProject } from "@/hooks/useProjects";
import { useEditableField } from "@/hooks/useEditableField";
import { useHighlightMatch } from "@/hooks/useHighlightDim";
import { useHighlight } from "@/lib/HighlightContext";
import { useAppStore } from "@/lib/store";
import { confirmThen, sanitizeHttpUrl } from "@/lib/entityUtils";
import EditableTitle from "@/components/shared/EditableTitle";
import { filterActiveTasks, getQuadrantCounts, isTaskDone, STATUS_COLORS } from "@/lib/taskUtils";
import { getDueDateColorClass, DUE_DATE_STATUS_OPTIONS } from "@/lib/projectUtils";

// Lazy: neither modal is needed until a user opens it from this card.
const TaskTableModal = lazy(() => import("@/components/projects/TaskTableModal"));
const ProjectDetailModal = lazy(() => import("@/components/projects/ProjectDetailModal"));

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
function NoteBox({ title, notes, allStakeholders, tintStyle, placeholder, onAdd, showButton = false, className = "" }) {
  const [text, setText] = useState("");
  const submit = () => {
    if (!text.trim()) return;
    onAdd(text.trim());
    setText("");
  };
  return (
    <div
      className={`w-full rounded px-2 py-1 border border-border/60 transition-colors z-20 ${className}`}
      style={notes.length > 0 ? tintStyle : undefined}
    >
      <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider text-left mb-0.5">{title}</p>
      <div className="flex items-center gap-1">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder={placeholder}
          aria-label={title}
          className="flex-1 min-w-0 text-[10px] bg-transparent outline-none focus-visible:ring-1 focus-visible:ring-ring text-left placeholder:text-muted-foreground/60"
        />
        {showButton && (
          <button type="button" onClick={submit} aria-label={`Add ${title}`} className="shrink-0 text-muted-foreground hover:text-primary">
            <Plus className="w-3 h-3" />
          </button>
        )}
      </div>
      <ProjectNotes notes={notes} allStakeholders={allStakeholders} compact />
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
          title={l.label && l.label !== l.url ? `${l.label} — ${l.url}` : l.url}
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
              <a
                href={sanitizeHttpUrl(l.url) || "#"}
                target="_blank"
                rel="noreferrer"
                title={l.label && l.label !== l.url ? `${l.label} — ${l.url}` : l.url}
                className="truncate text-primary hover:underline min-w-0"
              >
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
            aria-label="Link label"
            className="text-xs px-2 py-1 bg-background border border-input rounded outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="flex items-center gap-1">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              aria-label="Link URL"
              className="flex-1 min-w-0 text-xs px-2 py-1 bg-background border border-input rounded outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

function ProjectCardFull({ project, stakeholderIds = [] }) {
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

  const openCreateModal = useAppStore((s) => s.openCreateModal);

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

  const deleteProject = useDeleteProject();
  const handleDelete = () => {
    confirmThen(
      `Delete project "${project.title}"? This cannot be undone.`,
      () => deleteProject.mutate(project.id)
    );
  };

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
      // No explicit width: this card is only ever rendered inside
      // ProjectsGrid's Full-mode CSS grid branch (auto-fit/minmax(420px,
      // 1fr)), which sets a 420px floor and grows this card via 1fr when
      // there's leftover space — a grid item stretches to fill its column
      // by default with no width class needed. The middle content column
      // below is `flex-1`, so extra width goes there (more breathing room
      // for the title/objective/notes), not to the fixed-size quadrant
      // button or the content-sized right-hand column.
      className={`relative bg-card border border-border rounded-xl p-3 pb-6 transition-colors ${isMatched ? "bg-primary/10 ring-1 ring-primary/30" : ""} ${isDragging ? "shadow-2xl scale-105 border-primary" : "shadow-sm"} ${isOver ? "ring-2 ring-primary ring-offset-1" : ""}`}
    >
      <div className="absolute top-1.5 left-0.5 z-20 flex items-center">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground hover:bg-accent p-1.5 rounded-md transition-colors"
        >
          <GripVertical className="w-4 h-4" />
        </div>
        <button
          type="button"
          onClick={() => openCreateModal("task", { project_id: project.id })}
          className="text-muted-foreground hover:text-foreground hover:bg-accent p-1.5 rounded-md transition-colors"
          title="Add a task to this project"
          aria-label="Add a task to this project"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 z-20">
        <button
          onClick={() => setIsDetailOpen(true)}
          className="text-muted-foreground hover:text-foreground p-1.5 rounded hover:bg-muted transition-colors"
          title="Expand Project"
          aria-label="Expand project"
        >
          <Expand className="w-3.5 h-3.5" />
        </button>
        <DeleteButton onClick={handleDelete} label="Delete project" className="p-1.5 rounded" />
      </div>

      {/* Card header: Title and Objective span nearly the full card width — the
          only reserved margins are the corner icons' own footprints (grip left,
          expand/delete right). Problem Statement is deliberately NOT on the card
          face; it's edited in the expanded view (ProjectDetailModal) only. */}
      <div className="pl-14 pr-14 flex flex-col items-center gap-1">
        <EditableTitle
          as="h4"
          value={title}
          onInput={handleTitleInput}
          onBlur={handleTitleBlur}
          onKeyDown={handleTitleKeyDown}
          tooltip={title}
          className="font-heading font-semibold text-sm text-center cursor-text w-full px-1"
        />
        <EditableText
          value={project.objective}
          onSave={(v) => updateProject.mutate({ id: project.id, data: { objective: v } })}
          placeholder="No objective set"
          className="text-[11px] text-muted-foreground text-center"
        />
      </div>

      {/* Hairline under the title + objective so the top of the card reads
          as a header band, distinct from the quadrant / notes body below.
          Full-bleed: -mx-3 cancels the card's own p-3. */}
      <div className="border-b border-border/60 -mx-3 mt-2" />

      {/* items-end bottom-aligns all three columns onto one shared edge — the
          quadrant grid, the Open Questions box, and the meta group all sit on
          the row's baseline. The quadrant box keeps its natural 64px square
          size rather than stretching to a tall rectangle: bottom-aligned only,
          never top-pinned (see the backlog regression note). */}
      <div className="mt-2 flex items-end gap-3 pl-5 pr-1">
        <button
          onClick={() => setIsTableOpen(true)}
          className="shrink-0 grid grid-cols-2 grid-rows-2 gap-1 border border-border rounded overflow-hidden w-16 h-16 text-sm z-20 select-none"
          title="Open Task Table"
          // The per-cell color coding (this week's focus vs. a highlighted
          // stakeholder's task) has no other way to reach a screen reader —
          // the whole quadrant grid is one button, not four — so its meaning
          // gets folded into this one label rather than only living in color.
          aria-label={`Open Task Table${
            quadrants.some((q) => q.hasFocus) || quadrants.some((q) => q.hasHighlightedStakeholder)
              ? ` — ${[
                  quadrants.some((q) => q.hasFocus) && "includes this week's focus",
                  quadrants.some((q) => q.hasHighlightedStakeholder) && "includes the highlighted stakeholder",
                ]
                  .filter(Boolean)
                  .join(", ")}`
              : ""
          }`}
        >
          {quadrants.map((q) => (
            <div
              key={q.quadrant}
              title={
                q.hasHighlightedStakeholder
                  ? "Includes the highlighted stakeholder"
                  : q.hasFocus
                  ? "Includes this week's focus"
                  : undefined
              }
              className={`relative flex items-center justify-center transition-colors ${
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

        <div className="flex-1 text-center min-w-0 flex flex-col gap-1">
          <NoteBox
            title="Risks"
            notes={riskNotes}
            allStakeholders={allStakeholders}
            tintStyle={{ backgroundColor: "rgba(249,115,22,0.06)", borderColor: "rgba(249,115,22,0.18)" }}
            placeholder="Add a risk…"
            onAdd={(text) => addNote("RISK", text)}
          />
          <div className="min-h-0">
            <NoteBox
              title="Open Questions"
              notes={questionNotes}
              allStakeholders={allStakeholders}
              tintStyle={{ backgroundColor: "rgba(59,130,246,0.06)", borderColor: "rgba(59,130,246,0.18)" }}
              placeholder="Add a question…"
              onAdd={(text) => addNote("QUESTION", text)}
            />
          </div>
        </div>

        <div className="text-right shrink-0 min-w-[85px] select-none flex flex-col items-end justify-end gap-1">
          <EditableText
            value={project.owner_name}
            onSave={(v) => updateProject.mutate({ id: project.id, data: { owner_name: v } })}
            placeholder="Unassigned"
            aria-label="Owner"
            className="text-[10px] font-semibold text-muted-foreground text-right"
          />
          <div className="flex items-center gap-1">
            <DateField
              value={project.due_date}
              onSave={(v) => updateProject.mutate({ id: project.id, data: { due_date: v } })}
              unstyled
              aria-label="Due date"
              className={`text-[10px] bg-transparent text-right ${dateColorClass}`}
            />
          </div>
          <Select
            value={project.due_date_status || "ESTIMATED"}
            onChange={(e) => updateProject.mutate({ id: project.id, data: { due_date_status: e.target.value } })}
            aria-label="Due date status"
            className="text-[9px] bg-transparent px-1 py-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            options={DUE_DATE_STATUS_OPTIONS.map((opt) => ({ value: opt, label: opt }))}
          />
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

      <CardBuiltinFields
        project={project}
        onUpdate={(data) => updateProject.mutate({ id: project.id, data })}
        className="mt-2 pl-5 pr-1"
      />

      <CardCustomFields
        entity={project}
        onUpdateEntity={(data) => updateProject.mutate({ id: project.id, data })}
        className="mt-2 pl-5 flex flex-wrap gap-x-3 gap-y-1"
      />

      <LinksCorner
        links={project.links || []}
        onSave={(newLinks) => updateProject.mutate({ id: project.id, data: { links: newLinks } })}
      />

      <Suspense fallback={null}>
        {isTableOpen && (
          <TaskTableModal project={project} onClose={() => setIsTableOpen(false)} />
        )}
        {isDetailOpen && (
          <ProjectDetailModal project={project} onClose={() => setIsDetailOpen(false)} />
        )}
      </Suspense>
    </div>
  );
}

export default memo(ProjectCardFull);

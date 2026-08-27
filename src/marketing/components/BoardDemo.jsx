import { useEffect, useState } from "react";
import { GripVertical, Expand } from "lucide-react";
import { cn } from "@/lib/utils";
import { DeleteButton } from "@/components/ui/delete-button";
import AreaCardShell from "@/components/areas/AreaCardShell";
import ProductCardShell from "@/components/products/ProductCardShell";
import ProjectCardShell from "@/components/projects/ProjectCardShell";
import TaskStatistics from "@/components/shared/TaskStatistics";
import CardCustomFields from "@/components/shared/CardCustomFields";
import EditableText from "@/components/shared/EditableText";
import EditableTitle from "@/components/shared/EditableTitle";
import { prefersReducedMotion } from "../useReveal";
import { BOARD, CHAT_PROMPT, tasksOfProduct, tasksOfBoard } from "../fixtures";

// The board demo renders the REAL dashboard cards — the exact markup
// ProjectCard / ProductCard / AreaCard render, via the shared *CardShell
// components those cards themselves use, plus the real TaskStatistics,
// ProjectMiniStats (inside the shell), CardCustomFields, EditableText and
// EditableTitle. The only things not passed straight through are the drag
// handle and the expand button: the real drag handle spreads @dnd-kit
// listeners (needs a DndContext) and the real expand button's onClick opens
// a modal — neither can exist in an inert demo. Their stand-ins here carry
// the *identical* class list, title and aria-label as the real elements, so
// the rendered DOM matches; they just omit the listeners / onClick. The
// whole thing is pointer-events:none + aria-hidden and marketing.css forces
// cursor:default on every descendant, so nothing is hoverable or clickable
// and the pointer stays an arrow.
//
// hero=true types the assistant prompt line and drops the "Q3 launch" card
// into Marketing mid-demo. Reduced motion → the final state, static.

const noop = () => {};

// Inert copy of a real card's dnd grip — same classes as the source card's
// handle, minus the @dnd-kit attributes/listeners.
function InertGrip({ className, iconClass = "w-4 h-4", label }) {
  return (
    <div
      className={cn("cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground", className)}
      aria-label={label}
      title="Drag to reorder"
    >
      <GripVertical className={iconClass} />
    </div>
  );
}

// Inert copy of a real card's expand button — same <button>, classes, title
// and aria-label as the source card's, minus the onClick that opens a modal.
function InertExpand({ className, iconClass = "w-4 h-4", title, label }) {
  return (
    <button type="button" className={className} title={title} aria-label={label}>
      <Expand className={iconClass} />
    </button>
  );
}

// One project tile — the real ProjectCardShell, fed fixture-derived stats.
function DemoProject({ p, justAdded, delay = 0 }) {
  return (
    <ProjectCardShell
      style={!justAdded ? { "--piece-delay": `${delay}ms` } : undefined}
      className={cn("shadow-sm", justAdded ? "mkt-just-added" : "mkt-board-piece")}
      dragHandle={<InertGrip className="shrink-0 p-0.5" iconClass="w-3 h-3" label="Drag to reorder project" />}
      title={
        <EditableTitle
          as="h4"
          value={p.title}
          className="flex-1 min-w-0 font-heading font-semibold text-[11px] leading-tight text-center cursor-text line-clamp-2"
          tooltip={p.title}
        />
      }
      expandButton={
        <InertExpand
          className="text-muted-foreground hover:text-foreground p-0.5 rounded hover:bg-muted transition-colors"
          iconClass="w-3 h-3"
          title="Expand Project"
          label="Expand project"
        />
      }
      deleteButton={<DeleteButton onClick={noop} label="Delete project" />}
      quadrants={p.quadrants}
      riskNotes={p.riskNotes}
      questionNotes={p.questionNotes}
      miniStats={p.miniStats}
      miniTotal={p.miniTotal}
      onOpenTable={noop}
    />
  );
}

// One product — the real ProductCardShell, its project grid replicating
// ProjectsGrid's Mini-mode CSS grid exactly.
function DemoProduct({ product, added, delay }) {
  const projects = added ? [...product.projects, BOARD.added] : product.projects;
  return (
    <div className="mkt-board-piece" style={{ "--piece-delay": `${delay}ms` }}>
      <ProductCardShell
        dragHandle={
          <InertGrip className="absolute top-1.5 left-1.5 z-20 p-1.5" label="Drag to reorder product" />
        }
        expandButton={
          <InertExpand
            className="text-muted-foreground hover:text-foreground hover:bg-card p-1.5 rounded-md transition-colors"
            title="Expand Product"
            label="Expand product"
          />
        }
        deleteButton={<DeleteButton onClick={noop} label="Delete product" size="md" className="p-1.5 rounded-md" />}
        title={
          <EditableTitle
            as="h3"
            value={product.name}
            className="font-heading font-semibold min-w-0 cursor-text"
            tooltip={product.name}
          />
        }
        description={
          <EditableText
            value={product.description}
            onSave={noop}
            placeholder="Add a description..."
            className="text-xs text-muted-foreground break-words"
          />
        }
        projectsGrid={
          <div
            className="relative z-[1] mt-4 min-h-[80px] rounded-lg -mx-4 p-2 transition-colors bg-transparent"
            style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, 112px)", alignItems: "start", gap: "8px" }}
          >
            {projects.map((proj, j) => (
              <DemoProject
                key={proj.id}
                p={proj}
                justAdded={added && proj === BOARD.added}
                delay={140 + j * 55}
              />
            ))}
          </div>
        }
        stats={<TaskStatistics tasks={tasksOfProduct(product, added)} />}
        customFields={
          <CardCustomFields
            entity={product}
            onUpdateEntity={noop}
            className="relative z-[1] mt-3 pt-3 border-t border-foreground/[0.06] flex flex-wrap gap-x-3 gap-y-1"
          />
        }
      />
    </div>
  );
}

export default function BoardDemo({ hero = false, className }) {
  const [typed, setTyped] = useState("");
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (!hero) return;
    if (prefersReducedMotion()) {
      setTyped(CHAT_PROMPT);
      setAdded(true);
      return;
    }
    let cancelled = false;
    const timers = [];
    timers.push(
      setTimeout(function step(i = 0) {
        if (cancelled) return;
        setTyped(CHAT_PROMPT.slice(0, i));
        if (i <= CHAT_PROMPT.length) timers.push(setTimeout(() => step(i + 1), 26));
        else timers.push(setTimeout(() => setAdded(true), 300));
      }, 1100),
    );
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [hero]);

  return (
    <div
      aria-hidden="true"
      className={cn(
        "mkt-demo pointer-events-none mx-auto w-full max-w-[560px] select-none",
        className,
      )}
    >
      <AreaCardShell
        className="border-foreground/[0.04]"
        dragHandle={<InertGrip className="absolute top-0 left-0 z-20 p-1.5" label="Drag to reorder area" />}
        expandButton={
          <InertExpand
            className="text-muted-foreground hover:text-foreground hover:bg-accent p-2 rounded-md transition-colors"
            title="Expand Area"
            label="Expand Area"
          />
        }
        deleteButton={<DeleteButton onClick={noop} label="Delete area" size="md" className="p-2 rounded-md" />}
        title={
          <EditableTitle
            as="h3"
            value={BOARD.area}
            className="font-heading font-semibold text-lg pl-6 pr-16 min-w-0"
            tooltip={BOARD.area}
          />
        }
        description={
          <EditableText
            value={BOARD.description}
            onSave={noop}
            placeholder="Add a description..."
            className="text-sm text-muted-foreground"
          />
        }
        productsGrid={
          <div
            className="mt-2 grid items-start -mx-5"
            style={{ gridTemplateColumns: "repeat(auto-fit, 248px)", justifyContent: "space-evenly" }}
          >
            {BOARD.products.map((prod, pi) => (
              <DemoProduct
                key={prod.id}
                product={prod}
                added={added && prod === BOARD.products[0]}
                delay={80 + pi * 60}
              />
            ))}
          </div>
        }
        directProjects={
          <div className="mt-2 p-4 rounded-xl transition-all bg-muted/40 shadow-[inset_0_0_0_1px_hsl(var(--foreground)/0.035)]">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Direct Projects
            </h4>
            <p className="w-full text-xs text-muted-foreground text-center py-4 min-h-[50px]">
              Drop a project here to remove it from a product
            </p>
          </div>
        }
        stats={<TaskStatistics tasks={tasksOfBoard(added)} />}
        customFields={
          <CardCustomFields
            entity={BOARD}
            onUpdateEntity={noop}
            className="flex flex-wrap gap-x-3 gap-y-1"
          />
        }
      />

      {hero && (
        <div className="mt-4 flex items-center gap-2.5 rounded-full border border-foreground/[0.08] bg-background/50 px-4 py-2.5">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--signal-rgb))]" />
          <span className="min-w-0 flex-1 truncate font-mono text-[0.78rem] text-foreground">
            {typed}
            {!added && <span className="mkt-caret" style={{ height: "1em" }} />}
          </span>
          <span className="hidden shrink-0 font-mono text-[0.64rem] uppercase tracking-wider text-muted-foreground sm:inline">
            {added ? "1 change · applied" : "Assistant"}
          </span>
        </div>
      )}
    </div>
  );
}

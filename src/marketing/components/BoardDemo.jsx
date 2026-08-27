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
import { prefersReducedMotion } from "../useReveal";
import { BOARD, CHAT_PROMPT, tasksOfProduct, tasksOfBoard } from "../fixtures";

// The board demo renders the REAL dashboard card shells — AreaCardShell,
// ProductCardShell, ProjectCardShell (the exact markup ProjectCard/
// ProductCard/AreaCard render), plus the real TaskStatistics, ProjectMiniStats
// (inside the shell), CardCustomFields and EditableText. The only stand-ins
// are for the parts that carry live behavior on the dashboard: the drag
// handle (real one spreads @dnd-kit listeners), the expand button (real one
// opens a modal) and the title (real one is contentEditable). Those are
// inert elements here, class-for-class from the source components — see the
// EDITABLE_TITLE_CLASS note below. Everything is wrapped pointer-events:none
// + aria-hidden so the cursor stays an arrow and nothing is clickable.
//
// hero=true types the assistant prompt line and drops the "Q3 launch" card
// into Marketing mid-demo. Reduced motion → the final state, static.

const noop = () => {};

// The base classes EditableTitle.jsx wraps every card title in, before the
// caller's own styling. Kept in step with that file by hand (same discipline
// as the shells): if EditableTitle's wrapper classes change, change this.
const EDITABLE_TITLE_CLASS = "outline-none focus:ring-1 focus:ring-primary/40 rounded";

function InertGrip({ className }) {
  // The real handle is a <div> that spreads @dnd-kit's attributes/listeners;
  // inert here, same classes minus the cursor-grab affordance.
  return (
    <div className={cn(className, "text-muted-foreground")}>
      <GripVertical className="w-4 h-4" />
    </div>
  );
}

function InertExpand({ className }) {
  return (
    <span className={cn(className)}>
      <Expand className="w-4 h-4" />
    </span>
  );
}

// One project tile — the real ProjectCardShell, fed fixture-derived stats.
function DemoProject({ p, justAdded, delay = 0 }) {
  return (
    <ProjectCardShell
      style={!justAdded ? { "--piece-delay": `${delay}ms` } : undefined}
      className={cn("shadow-sm", justAdded ? "mkt-just-added" : "mkt-board-piece")}
      dragHandle={
        <div className="shrink-0 text-muted-foreground p-0.5">
          <GripVertical className="w-3 h-3" />
        </div>
      }
      title={
        <h4
          className={cn(
            EDITABLE_TITLE_CLASS,
            "flex-1 min-w-0 font-heading font-semibold text-[11px] leading-tight text-center line-clamp-2",
          )}
        >
          {p.title}
        </h4>
      }
      expandButton={
        <span className="text-muted-foreground p-0.5 rounded">
          <Expand className="w-3 h-3" />
        </span>
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
          <InertGrip className="absolute top-1.5 left-1.5 z-20 p-1.5" />
        }
        expandButton={<InertExpand className="text-muted-foreground p-1.5 rounded-md" />}
        deleteButton={<DeleteButton onClick={noop} label="Delete product" size="md" className="p-1.5 rounded-md" />}
        title={
          <h3 className={cn(EDITABLE_TITLE_CLASS, "font-heading font-semibold min-w-0")}>{product.name}</h3>
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
        dragHandle={<InertGrip className="absolute top-0 left-0 z-20 p-1.5" />}
        expandButton={<InertExpand className="text-muted-foreground p-2 rounded-md" />}
        deleteButton={<DeleteButton onClick={noop} label="Delete area" size="md" className="p-2 rounded-md" />}
        title={
          <h3 className={cn(EDITABLE_TITLE_CLASS, "font-heading font-semibold text-lg pl-6 pr-16 min-w-0")}>
            {BOARD.area}
          </h3>
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

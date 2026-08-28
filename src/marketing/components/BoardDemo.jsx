import { useEffect, useState } from "react";
import { GripVertical, Expand, Plus } from "lucide-react";
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
// `addedCard` marks the "Q3 launch" tile the assistant drops mid-demo; while
// `pending` it's rendered but held at opacity 0 so its grid cell always
// occupies space — the board never changes height across the loop.
function DemoProject({ p, addedCard = false, pending = false, delay = 0 }) {
  return (
    <ProjectCardShell
      style={!addedCard ? { "--piece-delay": `${delay}ms` } : undefined}
      className={cn(
        "shadow-sm",
        addedCard ? (pending ? "opacity-0" : "mkt-just-added") : "mkt-board-piece",
      )}
      dragHandle={<InertGrip className="shrink-0 p-0.5" iconClass="w-3 h-3" label="Drag to reorder project" />}
      title={
        <EditableTitle
          // as="div" not "h4": this whole demo is aria-hidden decoration, so
          // its card titles must not inject headings into the page outline
          // (that was skipping the page from <h1> straight to <h3>/<h4>).
          // Class list is unchanged, so the rendered pixels are identical.
          as="div"
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
function DemoProduct({ product, hero, showAdded, cycle, delay }) {
  // Only the first product ever gets the assistant's added card. In the hero
  // demo its cell is always present (invisible until `showAdded`) so the
  // layout height is identical whether or not the card has "arrived".
  const withCard = hero && product === BOARD.products[0];
  const projects = withCard ? [...product.projects, BOARD.added] : product.projects;
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
            as="div"
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
            {projects.map((proj, j) => {
              const isAdded = proj === BOARD.added;
              return (
                <DemoProject
                  key={isAdded ? `added-${cycle}` : proj.id}
                  p={proj}
                  addedCard={isAdded}
                  pending={isAdded && !showAdded}
                  delay={140 + j * 55}
                />
              );
            })}
          </div>
        }
        stats={<TaskStatistics tasks={tasksOfProduct(product, withCard && showAdded)} />}
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
  // Bumped once per loop; keys the product grid so every piece re-drops.
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    if (!hero) return;
    if (prefersReducedMotion()) {
      setTyped(CHAT_PROMPT);
      setAdded(true);
      return;
    }
    let cancelled = false;
    const timers = [];
    const at = (fn, ms) => timers.push(setTimeout(fn, ms));

    // One loop: rebuild the board, type the instruction, drop the card,
    // hold on the finished state, then start over. Opacity/translate only —
    // nothing resizes across the cycle.
    const runCycle = () => {
      if (cancelled) return;
      setTyped("");
      setAdded(false);
      setCycle((c) => c + 1);
      at(() => {
        const step = (i = 0) => {
          if (cancelled) return;
          setTyped(CHAT_PROMPT.slice(0, i));
          if (i < CHAT_PROMPT.length) return at(() => step(i + 1), 26);
          at(() => !cancelled && setAdded(true), 420);
          at(runCycle, 420 + 4200);
        };
        step();
      }, 1100);
    };

    runCycle();
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [hero]);

  return (
    <div
      aria-hidden="true"
      className={cn(
        "mkt-demo pointer-events-none mx-auto w-full select-none",
        // The hero demo carries the first screen — give it real width so it
        // reads as the product, not a narrow strip floating in the margin.
        hero ? "max-w-[920px]" : "max-w-[560px]",
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
            as="div"
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
            key={hero ? cycle : "static"}
            className="mt-2 grid items-start -mx-5"
            style={{ gridTemplateColumns: "repeat(auto-fit, 248px)", justifyContent: "space-evenly" }}
          >
            {BOARD.products.map((prod, pi) => (
              <DemoProduct
                key={prod.id}
                product={prod}
                hero={hero}
                showAdded={added}
                cycle={cycle}
                delay={80 + pi * 60}
              />
            ))}
          </div>
        }
        // The real Area card has a "Direct Projects" drop zone here; it's a
        // drag target with instructional text ("Drop a project here…") that
        // does nothing in an inert demo and just adds dead vertical height,
        // so the demo omits that one slot.
        stats={<TaskStatistics tasks={tasksOfBoard(added)} />}
        customFields={
          <CardCustomFields
            entity={BOARD}
            onUpdateEntity={noop}
            className="flex flex-wrap gap-x-3 gap-y-1"
          />
        }
      />

      {/* The assistant's composer row, receiving the typed instruction.
          ChatBox.jsx (the real widget) can't mount here — it's wired to
          ChatControllerContext, the app store and window-geometry hooks — so
          this is its input row reconstructed CLASS-FOR-CLASS from
          ChatBox.jsx's <form> (the `+` button, the inset `bg-muted/50
          rounded-xl` field with the `>` prompt, the `Send` button). Only the
          outer wrapper differs: a rounded card edge instead of the full
          panel's `border-t`, since there's no panel above it here. Inert
          like the rest of the demo — the text types on a timer, nothing is
          focusable or clickable. */}
      {hero && (
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-foreground/[0.06] bg-card p-3 shadow-sm">
          <span
            aria-hidden="true"
            className="shrink-0 p-2 text-muted-foreground rounded-md"
          >
            <Plus className="w-4 h-4" />
          </span>
          <div className="flex-1 flex items-center gap-1.5 bg-muted/50 rounded-xl px-3 py-2 shadow-[inset_0_0_0_1px_hsl(var(--foreground)/0.04)]">
            <span className="font-terminal text-primary text-sm select-none">{'>'}</span>
            <span className="flex-1 min-w-0 truncate font-terminal text-sm text-foreground">
              {typed || <span className="text-muted-foreground">Ask Vaea to change the board…</span>}
              {!added && typed && <span className="mkt-caret" style={{ height: "1em" }} />}
            </span>
          </div>
          <span className="shrink-0 text-sm px-4 py-2 bg-primary text-primary-foreground font-medium rounded-md shadow-sm">
            Send
          </span>
        </div>
      )}
    </div>
  );
}

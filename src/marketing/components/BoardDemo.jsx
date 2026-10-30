import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { DeleteButton } from "@/components/ui/delete-button";
import AreaCardShell from "@/components/areas/AreaCardShell";
import ProductCardShell from "@/components/products/ProductCardShell";
import ProjectCardShell from "@/components/projects/ProjectCardShell";
import TaskStatistics from "@/components/shared/TaskStatistics";
import MiniProjectsGrid from "@/components/shared/MiniProjectsGrid";
import AreaProductsGrid from "@/components/shared/AreaProductsGrid";
import CardCustomFields from "@/components/shared/CardCustomFields";
import EditableText from "@/components/shared/EditableText";
import EditableTitle from "@/components/shared/EditableTitle";
import ChatComposer from "@/components/ai/ChatComposer";
import { CornerHandle, ProjectDragHandle, ExpandButton } from "@/components/shared/CardControls";
import { prefersReducedMotion } from "../useReveal";
import { useDemoLock } from "../useDemoLock";
import { BOARD, CHAT_PROMPT, tasksOfProduct, tasksOfBoard } from "../fixtures";

// The board demo renders the REAL dashboard cards — the exact markup
// ProjectCard / ProductCard / AreaCard render, via the shared *CardShell
// components those cards themselves use, plus the real TaskStatistics,
// ProjectMiniStats (inside the shell), CardCustomFields, EditableText and
// EditableTitle, and the cards' own drag handles, add buttons and expand
// buttons (CardControls.jsx). The drag handles get no @dnd-kit listeners
// (there's no drag context here) and the buttons do nothing. Visitors can
// hover the board (the cards' hover states, the risk and question flags'
// hover text) but can't change
// it: titles aren't editable// it: titles aren't editable and nothing saves (useDemoLock.js).
//
// hero=true types the assistant prompt line and drops the "Harbor 2.0 launch" card
// into Marketing mid-demo. Reduced motion → the final state, static.

const noop = () => {};

// One project tile — the real ProjectCardShell, fed fixture-derived stats.
// `addedCard` marks the "Harbor 2.0 launch" tile the assistant drops mid-demo.
function DemoProject({ p, addedCard = false, delay = 0 }) {
  return (
    <ProjectCardShell
      style={!addedCard ? { "--piece-delay": `${delay}ms` } : undefined}
      className={cn(
        "shadow-sm",
        addedCard ? "mkt-just-added" : "mkt-board-piece",
      )}
      dragHandle={<ProjectDragHandle />}
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
      expandButton={<ExpandButton kind="project" onClick={noop} />}
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

// One product — the real ProductCardShell, with the app's own
// MiniProjectsGrid (the component ProjectsGrid renders), so the tiles and
// their spacing are the app's code, not a copy of it.
function DemoProduct({ product, hero, showAdded, cycle, delay }) {
  // Only the first product (Marketing) gets the assistant's added card. It
  // exists only once it has arrived; MiniProjectsGrid grows the card to fit
  // it, as it does in the app. BoardDemo reserves the extra height on its
  // own frame, so the page around the hero never moves.
  const withCard = hero && product === BOARD.products[0];
  const projects = withCard && showAdded ? [...product.projects, BOARD.added] : product.projects;
  return (
    <ProductCardShell
      className="mkt-board-piece"
      style={{ "--piece-delay": `${delay}ms` }}
      dragHandle={<CornerHandle kind="product" onAdd={noop} />}
      expandButton={<ExpandButton kind="product" onClick={noop} />}
      deleteButton={<DeleteButton onClick={noop} label="Delete product" size="md" className="p-1.5 rounded-md" />}
      title={
        <EditableTitle
          as="div"
          value={product.name}
          className="font-heading font-semibold min-w-0 cursor-text pl-7"
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
        // ProductCard's own className for this grid, at rest (not a drop target).
        <MiniProjectsGrid gap={8} className="relative z-[1] mt-4 min-h-[80px] rounded-lg -mx-4 p-2 transition-colors bg-transparent">
          {projects.map((proj, j) => {
            const isAdded = proj === BOARD.added;
            return <DemoProject key={isAdded ? `added-${cycle}` : proj.id} p={proj} addedCard={isAdded} delay={140 + j * 55} />;
          })}
        </MiniProjectsGrid>
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
  );
}

export default function BoardDemo({ hero = false, className }) {
  const [typed, setTyped] = useState("");
  const [added, setAdded] = useState(false);
  // Bumped once per loop; keys the product grid so every piece re-drops.
  const [cycle, setCycle] = useState(0);
  // Hero only: the demo frame keeps a minimum height that already includes
  // the row Marketing gains, so the card growing to fit the added project
  // never moves the page. Set on the demo's own frame, not on app markup.
  // Measured at the start of every loop, before the card arrives.
  const frameRef = useRef(null);
  const productsRef = useRef(null);
  useLayoutEffect(() => {
    const frame = frameRef.current;
    const grid = productsRef.current;
    if (!hero || !frame || !grid || added) return;
    frame.style.minHeight = "";
    const cards = [...grid.children];
    const tile = grid.querySelector("[style*='112px'] > *");
    if (!cards.length || !tile) return;
    // Marketing's row is as tall as its tallest card, so if another card in
    // that row is already taller, less (or nothing) needs reserving.
    const rowTop = cards[0].offsetTop;
    const rowHeight = Math.max(...cards.filter((c) => c.offsetTop === rowTop).map((c) => c.offsetHeight));
    const grown = cards[0].offsetHeight + tile.offsetHeight + 8;
    frame.style.minHeight = `${frame.offsetHeight + Math.max(0, grown - rowHeight)}px`;
    // `added` is read only to skip measuring the grown state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hero, cycle]);

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

  useDemoLock(frameRef);
  return (
    <div
      ref={frameRef}
      aria-hidden="true"
      className={cn(
        "mkt-demo mx-auto w-full",
        // The hero demo carries the first screen — give it real width so it
        // reads as the product, not a narrow strip floating in the margin.
        hero ? "max-w-[920px]" : "max-w-[560px]",
        className,
      )}
    >
      <AreaCardShell
        className="border-foreground/[0.04]"
        dragHandle={<CornerHandle kind="area" onAdd={noop} />}
        expandButton={<ExpandButton kind="area" onClick={noop} />}
        deleteButton={<DeleteButton onClick={noop} label="Delete area" size="md" className="p-2 rounded-md" />}
        title={
          <EditableTitle
            as="div"
            value={BOARD.area}
            className="font-heading font-semibold text-lg pl-14 pr-16 min-w-0"
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
          <AreaProductsGrid key={hero ? cycle : "static"} ref={productsRef} cardView="mini">
            {BOARD.products.map((prod, pi) => (
              <DemoProduct key={prod.id} product={prod} hero={hero} showAdded={added} cycle={cycle} delay={80 + pi * 60} />
            ))}
          </AreaProductsGrid>
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

      {/* The assistant's input row, receiving the typed instruction: the
          real ChatComposer (the chat panel's own row), with the typed text
          as a read-only value. Only the outer wrapper differs: a rounded
          card edge instead of the panel's top border, since there's no
          panel above it here. */}
      {hero && (
        <ChatComposer
          className="mt-4 flex items-center gap-2 rounded-2xl border border-foreground/[0.06] bg-card p-3 shadow-sm"
          onSubmit={(e) => e.preventDefault()}
          onAttach={noop}
          value={typed}
          readOnly
          placeholder="Ask Vaea to change the board…"
          ariaLabel="Message Vaea Chat"
        />
      )}
    </div>
  );
}

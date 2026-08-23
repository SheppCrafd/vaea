import { useEffect, useRef, useState } from "react";
import { X, ZoomIn, ZoomOut, Maximize } from "lucide-react";
import { loadWorkflowCards, saveWorkflowCards } from "@/lib/workflowCanvasStore";

// A genuine freeform diagram surface — sticky-note-style cards you place and
// drag anywhere on an open, zoomable/pannable canvas (same zoom-toward-
// cursor + drag-to-pan feel as the Vault tab's graph — see VaultGraph.jsx).
// Real (drag, add, delete, persisted per-device, pan/zoom persisted too),
// but not bound to automation yet. Lives as the second tab of Mind Map
// (MindMapPage.jsx) rather than its own page — folded in on request, since a
// top-level tab per freeform surface was judged one tab too many. Cards live
// in workflowCanvasStore.js (deviceStorage) so the AI chat tools (CREATE/
// UPDATE/DELETE_WORKFLOW_CARD) read and write the exact same cards a user
// places by hand.
//
// demo: renders this exact component, fixed sample cards, dragging/editing/
// persistence/pan/zoom all disabled — for the marketing page (src/pages/
// marketing/MindMapPage.jsx) to show the real UI animated rather than a
// hand-drawn recreation of it.
const CARD_W = 200;
const CARD_H = 110;
const MIN_SCALE = 0.3;
const MAX_SCALE = 2.5;
const DRAG_THRESHOLD_PX = 4;

const DEMO_CARDS = [
  { id: "d1", text: "Client sends brief", x: 40, y: 30 },
  { id: "d2", text: "Draft outline", x: 280, y: 70 },
  { id: "d3", text: "Review call", x: 160, y: 190 },
];

export default function WorkflowCanvas({ addTrigger, demo = false }) {
  const [cards, setCards] = useState(demo ? DEMO_CARDS : []);
  const [loaded, setLoaded] = useState(demo);
  // Pan/zoom, same shape as VaultGraph.jsx's own view state — { scale, x, y }
  // where x/y is the top-left, canvas-space point currently under the
  // viewport's own top-left corner (cards' left/top are already top-left
  // anchored, unlike VaultGraph's center-anchored nodes, so this offset
  // convention is simpler here: screen = (canvasPoint - view) * scale).
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const dragRef = useRef(null); // { kind: "card"|"pan", id?, offsetX, offsetY, startClientX, startClientY, startView, moved }
  const canvasRef = useRef(null);

  useEffect(() => {
    if (demo) return;
    loadWorkflowCards().then((c) => {
      setCards(c);
      setLoaded(true);
    });
  }, [demo]);

  useEffect(() => {
    if (loaded && !demo) saveWorkflowCards(cards);
  }, [cards, loaded, demo]);

  const toCanvasSpace = (clientX, clientY) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: (clientX - rect.left) / view.scale + view.x, y: (clientY - rect.top) / view.scale + view.y };
  };

  const addCard = () => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const center = rect ? toCanvasSpace(rect.left + rect.width / 2, rect.top + rect.height / 3) : { x: 40, y: 40 };
    const x = center.x - CARD_W / 2 + (Math.random() * 60 - 30);
    const y = center.y + (Math.random() * 60 - 30);
    setCards((prev) => [...prev, { id: crypto.randomUUID(), text: "", x, y }]);
  };

  // Header.jsx-style action buttons live in the parent's own header row (one
  // shared header for both Mind Map tabs) — addTrigger lets that button
  // reach into whichever tab is actually active right now.
  useEffect(() => {
    if (!demo && addTrigger > 0) addCard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addTrigger]);

  const updateCard = (id, patch) => setCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const deleteCard = (id) => setCards((prev) => prev.filter((c) => c.id !== id));

  const handleCardPointerDown = (e, id) => {
    if (demo || e.target.tagName === "TEXTAREA" || e.target.closest("button")) return;
    const card = cards.find((c) => c.id === id);
    const { x, y } = toCanvasSpace(e.clientX, e.clientY);
    dragRef.current = { kind: "card", id, offsetX: x - card.x, offsetY: y - card.y, moved: false, startClientX: e.clientX, startClientY: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  // Pointerdown on the open background (not a card) pans the canvas instead
  // — same "click empty space to pan, click a real thing to drag it"
  // convention VaultGraph.jsx uses for its own nodes vs. background.
  const handleBackgroundPointerDown = (e) => {
    if (demo || dragRef.current) return;
    dragRef.current = { kind: "pan", startClientX: e.clientX, startClientY: e.clientY, startView: view, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (demo || !dragRef.current) return;
    const drag = dragRef.current;
    const dxClient = e.clientX - drag.startClientX, dyClient = e.clientY - drag.startClientY;
    if (!drag.moved && Math.hypot(dxClient, dyClient) > DRAG_THRESHOLD_PX) drag.moved = true;
    if (drag.kind === "card") {
      const { x, y } = toCanvasSpace(e.clientX, e.clientY);
      updateCard(drag.id, { x: x - drag.offsetX, y: y - drag.offsetY });
    } else if (drag.moved) {
      setView((v) => ({ ...v, x: drag.startView.x - dxClient / v.scale, y: drag.startView.y - dyClient / v.scale }));
    }
  };
  const handlePointerUp = () => {
    dragRef.current = null;
  };

  const handleWheel = (e) => {
    if (demo) return;
    e.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const cursorCanvas = toCanvasSpace(e.clientX, e.clientY);
    const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, view.scale * (1 - e.deltaY * 0.001)));
    const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
    setView({ scale: nextScale, x: cursorCanvas.x - cx / nextScale, y: cursorCanvas.y - cy / nextScale });
  };

  const zoomByFactor = (factor) => setView((v) => ({ ...v, scale: Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor)) }));
  const resetView = () => setView({ scale: 1, x: 0, y: 0 });

  return (
    <div
      ref={canvasRef}
      onPointerDown={handleBackgroundPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onWheel={handleWheel}
      style={{ backgroundPosition: `${-view.x * view.scale}px ${-view.y * view.scale}px`, backgroundSize: `${20 * view.scale}px ${20 * view.scale}px` }}
      className={`flex-1 min-h-0 relative overflow-hidden touch-none bg-[radial-gradient(hsl(var(--foreground)/0.08)_1px,transparent_1px)] ${demo ? "pointer-events-none" : "cursor-default active:cursor-grabbing"}`}
    >
      {cards.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-sm text-muted-foreground">Add a card to start sketching.</p>
        </div>
      )}
      <div style={{ transform: `translate(${-view.x * view.scale}px, ${-view.y * view.scale}px) scale(${view.scale})`, transformOrigin: "0 0" }}>
        {cards.map((card) => (
          <div
            key={card.id}
            onPointerDown={(e) => handleCardPointerDown(e, card.id)}
            style={{ left: card.x, top: card.y, width: CARD_W, minHeight: CARD_H }}
            className={`absolute card-enter bg-card border border-foreground/[0.04] rounded-2xl shadow-md p-3 touch-none ${demo ? "" : "cursor-grab active:cursor-grabbing"}`}
          >
            {!demo && (
              <div className="flex justify-end mb-1">
                <button
                  onClick={() => deleteCard(card.id)}
                  aria-label="Delete card"
                  className="text-muted-foreground hover:text-destructive p-0.5 rounded"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <textarea
              value={card.text}
              onChange={(e) => updateCard(card.id, { text: e.target.value })}
              placeholder="What happens here?"
              readOnly={demo}
              className="w-full h-16 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        ))}
      </div>

      {!demo && (
        <div className="absolute bottom-2 right-2 z-10 flex items-center gap-0.5 rounded-md bg-card/90 border border-border shadow-sm backdrop-blur-sm p-0.5">
          <button type="button" onClick={() => zoomByFactor(1 / 1.3)} aria-label="Zoom out" title="Zoom out" className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] tabular-nums text-muted-foreground w-9 text-center select-none">{Math.round(view.scale * 100)}%</span>
          <button type="button" onClick={() => zoomByFactor(1.3)} aria-label="Zoom in" title="Zoom in" className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={resetView} aria-label="Reset view" title="Reset view" className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            <Maximize className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

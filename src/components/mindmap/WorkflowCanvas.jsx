import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { loadWorkflowCards, saveWorkflowCards } from "@/lib/workflowCanvasStore";

// A genuine freeform diagram surface — sticky-note-style cards you place and
// drag anywhere on an open canvas. Real (drag, add, delete, persisted per-
// device), but not bound to automation yet. Lives as the second tab of Mind
// Map (MindMapPage.jsx) rather than its own page — folded in on request,
// since a top-level tab per freeform surface was judged one tab too many.
// Cards live in workflowCanvasStore.js (deviceStorage) so the AI chat tools
// (CREATE/UPDATE/DELETE_WORKFLOW_CARD) read and write the exact same cards
// a user places by hand.
//
// demo: renders this exact component, fixed sample cards, dragging/editing/
// persistence all disabled — for the marketing page (src/pages/marketing/
// MindMapPage.jsx) to show the real UI animated rather than a hand-drawn
// recreation of it.
const CARD_W = 200;
const CARD_H = 110;

const DEMO_CARDS = [
  { id: "d1", text: "Client sends brief", x: 40, y: 30 },
  { id: "d2", text: "Draft outline", x: 280, y: 70 },
  { id: "d3", text: "Review call", x: 160, y: 190 },
];

export default function WorkflowCanvas({ addTrigger, demo = false }) {
  const [cards, setCards] = useState(demo ? DEMO_CARDS : []);
  const [loaded, setLoaded] = useState(demo);
  const dragRef = useRef(null);
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

  const addCard = () => {
    const canvas = canvasRef.current?.getBoundingClientRect();
    const x = canvas ? canvas.width / 2 - CARD_W / 2 + (Math.random() * 60 - 30) : 40;
    const y = canvas ? 60 + Math.random() * 60 : 40;
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

  const handlePointerDown = (e, id) => {
    if (demo || e.target.tagName === "TEXTAREA" || e.target.closest("button")) return;
    const card = cards.find((c) => c.id === id);
    dragRef.current = { id, offsetX: e.clientX - card.x, offsetY: e.clientY - card.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const handlePointerMove = (e) => {
    if (demo || !dragRef.current) return;
    const { id, offsetX, offsetY } = dragRef.current;
    updateCard(id, { x: e.clientX - offsetX, y: e.clientY - offsetY });
  };
  const handlePointerUp = () => {
    dragRef.current = null;
  };

  return (
    <div
      ref={canvasRef}
      className={`flex-1 min-h-0 relative overflow-auto bg-[radial-gradient(hsl(var(--foreground)/0.08)_1px,transparent_1px)] [background-size:20px_20px] ${demo ? "pointer-events-none" : ""}`}
    >
      {cards.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-sm text-muted-foreground">Add a card to start sketching.</p>
        </div>
      )}
      {cards.map((card) => (
        <div
          key={card.id}
          onPointerDown={(e) => handlePointerDown(e, card.id)}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
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
  );
}

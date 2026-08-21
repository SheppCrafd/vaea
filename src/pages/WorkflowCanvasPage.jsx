import { useEffect, useRef, useState } from "react";
import { Workflow, Plus, X } from "lucide-react";
import StandalonePageHeader from "@/components/shared/StandalonePageHeader";

// A genuine freeform diagram surface — sticky-note-style cards you place and
// drag anywhere on an open canvas. Phase 1 is deliberately NOT bound to
// automation yet: it's real (drag, add, delete, persisted per-device), but
// wiring these cards to the trigger/automation engine (so a canvas can
// actually orchestrate something) is Phase 7, once that engine exists in
// Notifications. Promising automation before the engine is real would be
// exactly the kind of fake demo this whole pass is trying to avoid.
const STORAGE_KEY = "vaea_workflow_canvas_cards";
const CARD_W = 200;
const CARD_H = 110;

function loadCards() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export default function WorkflowCanvasPage() {
  const [cards, setCards] = useState(loadCards);
  const dragRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
  }, [cards]);

  const addCard = () => {
    const canvas = canvasRef.current?.getBoundingClientRect();
    const x = canvas ? canvas.width / 2 - CARD_W / 2 + (Math.random() * 60 - 30) : 40;
    const y = canvas ? 60 + Math.random() * 60 : 40;
    setCards((prev) => [...prev, { id: crypto.randomUUID(), text: "", x, y }]);
  };

  const updateCard = (id, patch) => setCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const deleteCard = (id) => setCards((prev) => prev.filter((c) => c.id !== id));

  const handlePointerDown = (e, id) => {
    if (e.target.tagName === "TEXTAREA" || e.target.closest("button")) return;
    const card = cards.find((c) => c.id === id);
    dragRef.current = { id, offsetX: e.clientX - card.x, offsetY: e.clientY - card.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const handlePointerMove = (e) => {
    if (!dragRef.current) return;
    const { id, offsetX, offsetY } = dragRef.current;
    updateCard(id, { x: e.clientX - offsetX, y: e.clientY - offsetY });
  };
  const handlePointerUp = () => {
    dragRef.current = null;
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <StandalonePageHeader
        Icon={Workflow}
        title="Workflows"
        subtitle="A freeform canvas for sketching out how something should work"
        action={
          <button
            onClick={addCard}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> Add card
          </button>
        }
      />
      <div
        ref={canvasRef}
        className="flex-1 min-h-0 relative overflow-auto bg-[radial-gradient(hsl(var(--foreground)/0.08)_1px,transparent_1px)] [background-size:20px_20px]"
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
            className="absolute card-enter bg-card border border-foreground/[0.04] rounded-2xl shadow-md p-3 cursor-grab active:cursor-grabbing touch-none"
          >
            <div className="flex justify-end mb-1">
              <button
                onClick={() => deleteCard(card.id)}
                aria-label="Delete card"
                className="text-muted-foreground hover:text-destructive p-0.5 rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <textarea
              value={card.text}
              onChange={(e) => updateCard(card.id, { text: e.target.value })}
              placeholder="What happens here?"
              className="w-full h-16 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

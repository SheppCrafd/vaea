import { Maximize2 } from "lucide-react";

export default function AreaCard({ area, productCount, onExpand }) {
  return (
    <article className="relative bg-card border border-border rounded-xl p-5 break-inside-avoid">
      <button
        onClick={onExpand}
        style={{ position: "absolute", top: 16, right: 16 }}
        className="text-muted-foreground hover:text-foreground"
        aria-label="Expand area"
      >
        <Maximize2 className="w-4 h-4" />
      </button>
      <h3 className="font-heading font-semibold text-lg pr-6">{area.name}</h3>
      <p className="text-sm text-muted-foreground mt-1">{productCount} products</p>
    </article>
  );
}
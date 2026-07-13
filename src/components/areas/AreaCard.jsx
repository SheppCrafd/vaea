import { useState, useEffect } from "react";
import { MoreVertical, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useHighlight } from "@/lib/HighlightContext";
import { useUpdateArea, useDeleteArea } from "@/hooks/useAreas";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import EditableText from "@/components/shared/EditableText";

export default function AreaCard({ area, productCount, onExpand, stakeholderIds = [] }) {
  const { highlightedIds } = useHighlight();
  const isDimmed = highlightedIds.length > 0 && !stakeholderIds.some((id) => highlightedIds.includes(id));
  const updateArea = useUpdateArea();
  const deleteArea = useDeleteArea();
  const [title, setTitle] = useState(area.title);

  useEffect(() => setTitle(area.title), [area.title]);

  const debouncedSave = useDebouncedCallback(
    (value) => updateArea.mutate({ id: area.id, data: { title: value } }),
    500
  );

  const handleInput = (e) => {
    const value = e.currentTarget.textContent;
    setTitle(value);
    debouncedSave(value);
  };

  const handleDelete = () => {
    if (window.confirm(`Delete area "${area.title}"? This will also delete all of its products and projects. This cannot be undone.`)) {
      deleteArea.mutate(area.id);
    }
  };

  return (
    <article className={`relative z-10 bg-card border border-border rounded-xl p-5 break-inside-avoid ${isDimmed ? "opacity-30" : ""}`}>
      <div className="absolute top-3 right-3 flex items-center gap-1 z-20">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="text-muted-foreground hover:text-foreground p-1" aria-label="Area actions">
              <MoreVertical className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onExpand}>Edit details</DropdownMenuItem>
            <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
              <Trash2 className="w-3.5 h-3.5 mr-2" />
              Delete Area
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <h3
        className="font-heading font-semibold text-lg pr-10 outline-none focus:ring-1 focus:ring-primary/40 rounded break-words min-w-0"
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
      >
        {title}
      </h3>
      <div className="mt-1 min-w-0">
        <EditableText
          value={area.description}
          onSave={(v) => updateArea.mutate({ id: area.id, data: { description: v } })}
          placeholder="Add a description..."
          className="text-sm text-muted-foreground"
        />
      </div>
      <p className="text-xs text-muted-foreground mt-1">{productCount} products</p>
    </article>
  );
}
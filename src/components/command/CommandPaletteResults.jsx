import { Search, FolderKanban, Package, Boxes, ListTodo, User } from "lucide-react";

// The real command palette's results-list + hint-row rendering, split out
// of CommandPalette.jsx so the marketing site's PaletteFilm (demos.jsx) can
// render this exact component with fixed sample data instead of a
// hand-built recreation. Purely presentational — every callback/ref is
// passed in, nothing here talks to the app's own store/router/data hooks.
export const TYPE_ICON = {
  area: Boxes,
  product: Package,
  project: FolderKanban,
  task: ListTodo,
  stakeholder: User,
};

export default function CommandPaletteResults({
  results,
  activeIndex,
  query,
  groupLabel,
  itemRefs,
  onSelect,
  onHover,
  activeHasUrl = false,
}) {
  return (
    <>
      <div className="max-h-80 overflow-y-auto py-1.5">
        {results.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">No matches for "{query}"</p>
        ) : (
          results.map((result, index) => {
            const Icon = result.Icon || TYPE_ICON[result.type] || Search;
            const isActive = index === activeIndex;
            const label = groupLabel(result);
            const showHeader = label !== groupLabel(results[index - 1]);
            return (
              <div key={result.key || `${result.type}-${result.id}`}>
                {showHeader && (
                  <p className="px-4 pt-2.5 pb-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
                )}
                <button
                  ref={(el) => { if (itemRefs) itemRefs.current[index] = el; }}
                  onClick={(e) => onSelect(index, e)}
                  onMouseEnter={() => onHover(index)}
                  className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${isActive ? "bg-secondary" : "hover:bg-secondary/60"}`}
                >
                  <Icon className="w-4 h-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium truncate">{result.title || result.label}</span>
                    {result.subtitle && <span className="block text-xs text-muted-foreground truncate">{result.subtitle}</span>}
                  </span>
                </button>
              </div>
            );
          })
        )}
      </div>

      <div className="flex items-center gap-3 px-4 py-2 border-t border-border text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><kbd className="font-mono border border-border rounded px-1 py-0.5">↑↓</kbd> navigate</span>
        <span className="flex items-center gap-1"><kbd className="font-mono border border-border rounded px-1 py-0.5">↵</kbd> open</span>
        {activeHasUrl && (
          <span className="flex items-center gap-1"><kbd className="font-mono border border-border rounded px-1 py-0.5">ctrl+↵</kbd> new tab</span>
        )}
      </div>
    </>
  );
}

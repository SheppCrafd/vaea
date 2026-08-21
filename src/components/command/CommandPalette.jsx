import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import {
  Search, FolderKanban, Package, Boxes, ListTodo, User,
  Plus, SunMoon,
} from "lucide-react";
import { highlightMatch } from "@/lib/highlightMatch";
import Portal from "@/lib/Portal";
import { useAppStore } from "@/lib/store";
import { useHighlight } from "@/lib/HighlightContext";
import { useCommandPaletteData } from "@/hooks/useCommandPaletteData";
import { FOCUSABLE_SELECTOR } from "@/hooks/useDialogA11y";

const TYPE_ICON = {
  area: Boxes,
  product: Package,
  project: FolderKanban,
  task: ListTodo,
  stakeholder: User,
};

const MAX_RESULTS = 8;

// Global Ctrl/Cmd+K quick-jump-and-act palette: search across every Area,
// Product, Project, Task, and Stakeholder in the local dataset, or run a
// handful of quick actions, without hunting through three nested card
// levels or opening a form by hand. Mounted once at the App.jsx level (not
// inside AppShell) so the shortcut works from /app/chat and /app/settings
// too, not just the dashboard route.
export default function CommandPalette() {
  const isOpen = useAppStore((s) => s.isCommandPaletteOpen);
  const openPalette = useAppStore((s) => s.openCommandPalette);
  const closePalette = useAppStore((s) => s.closeCommandPalette);
  const openCreateModal = useAppStore((s) => s.openCreateModal);
  const { toggleHighlight } = useHighlight();
  // resolvedTheme, not theme — AppearanceSection's ThemeProvider defaults to
  // defaultTheme="system", so theme is literally the string "system" for
  // most visitors; comparing that against "dark" always took the "Switch to
  // dark theme" branch even when the page was already rendering dark via OS
  // preference. resolvedTheme is next-themes' post-system-resolution value.
  const { resolvedTheme, setTheme } = useTheme();
  const navigate = useNavigate();
  const items = useCommandPaletteData();

  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const panelRef = useRef(null);
  const triggerRef = useRef(null);
  const itemRefs = useRef([]);

  // Ctrl/Cmd+K opens from anywhere in the app, including while some other
  // input has focus (e.g. mid-edit on a card field) — that's the whole
  // point of a global quick-jump shortcut. Escape closes only while open,
  // so it doesn't swallow every other component's own Escape handling.
  //
  // Ctrl+K collides with browser/OS-chrome shortcuts on some setups (Edge's
  // own search-bar handling intercepts it before any page-level
  // preventDefault() can run — that's happening below the page entirely, not
  // fixable from here). "/" is the standard fallback for exactly this
  // (GitHub, Slack, Discord, Notion all use it) since a bare, unmodified key
  // is never reserved by a browser or OS — only fires when focus isn't
  // already in an editable field, so typing a literal "/" anywhere else in
  // the app (a task description, the chat composer, an editable title)
  // still just types a slash.
  useEffect(() => {
    const isEditableTarget = (el) => {
      if (!el) return false;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
    };
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        isOpen ? closePalette() : openPalette();
      } else if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey && !isOpen && !isEditableTarget(document.activeElement)) {
        e.preventDefault();
        openPalette();
      } else if (e.key === "Escape" && isOpen) {
        closePalette();
      } else if (e.key === "Tab" && isOpen) {
        // Only the search input is ever a real Tab stop in here (results
        // are chosen with ↑↓, not Tab) — so trapping just means Tab can't
        // carry focus out into the dimmed page behind the overlay.
        const root = panelRef.current;
        const focusables = root ? Array.from(root.querySelectorAll(FOCUSABLE_SELECTOR)) : [];
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, openPalette, closePalette]);

  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement;
      setQuery("");
      setActiveIndex(0);
      // Portal content mounts after this effect's own render pass —
      // deferring focus a tick keeps it from landing before the input exists.
      const raf = requestAnimationFrame(() => inputRef.current?.focus());
      return () => {
        cancelAnimationFrame(raf);
        // Return focus to whatever opened the palette — nothing here did
        // that before; focus just landed wherever the DOM removal left it.
        triggerRef.current?.focus?.();
      };
    }
  }, [isOpen]);

  // "Open full-page chat"/"Open Settings" used to live here as their own
  // one-off entries — now redundant with the Pages group (every header tab,
  // including Chat and Settings) that's always shown alongside these below.
  const quickActions = useMemo(() => [
    { key: "create-task", label: "Create Task", Icon: Plus, run: () => { openCreateModal("task"); navigate("/app"); } },
    { key: "create-project", label: "Create Project", Icon: Plus, run: () => { openCreateModal("project"); navigate("/app"); } },
    { key: "create-product", label: "Create Product", Icon: Plus, run: () => { openCreateModal("product"); navigate("/app"); } },
    { key: "create-area", label: "Create Area", Icon: Plus, run: () => { openCreateModal("area"); navigate("/app"); } },
    { key: "toggle-theme", label: resolvedTheme === "dark" ? "Switch to light theme" : "Switch to dark theme", Icon: SunMoon, run: () => setTheme(resolvedTheme === "dark" ? "light" : "dark") },
  ], [openCreateModal, navigate, resolvedTheme, setTheme]);

  const pageItems = useMemo(() => items.filter((i) => i.type === "page"), [items]);

  // The URL a result deep-links to, when it has one — shared by the normal
  // (same-tab) jump below and the Ctrl/Cmd-modified (new-tab) path in
  // runResult. Stakeholder results have no such URL (the highlight they set
  // is ephemeral React context state, not URL-encoded, so there's nothing
  // meaningful to open in a second tab) — same-tab only, always.
  const resolveUrl = (item) => {
    switch (item.type) {
      case "page": return item.url;
      case "area": return `/app?${new URLSearchParams({ areaId: item.id })}`;
      case "product": return `/app?${new URLSearchParams({ productId: item.id })}`;
      case "project": return `/app?${new URLSearchParams({ projectId: item.id })}`;
      // No standalone task view exists — its parent project's expand modal,
      // embedding the task table, is the closest real "open" state.
      case "task": return item.projectId ? `/app?${new URLSearchParams({ projectId: item.projectId })}` : null;
      default: return null;
    }
  };

  const jumpTo = (item) => {
    if (item.type === "stakeholder") {
      // Best-effort default: light up the projects they're on, the same
      // category clicking their sidebar row's "Projects" checkbox does.
      toggleHighlight(item.id, "projects");
      navigate("/app");
      return;
    }
    const url = resolveUrl(item);
    if (url) navigate(url);
  };

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return items
      .filter((item) => item.title.toLowerCase().includes(q) || item.subtitle?.toLowerCase().includes(q))
      .slice(0, MAX_RESULTS);
  }, [items, query]);

  // Empty query: every tab, always browsable as a quick-click, plus the
  // handful of create/toggle actions. Non-empty query: whatever matched,
  // pages included (a tab's own name is searchable same as anything else).
  const results = query.trim() ? searchResults : [...pageItems, ...quickActions];

  // One header row per group, in place right above that group's first
  // result — "Pages" needs no extra "which page is this on" indicator (a
  // page result already IS the page, so it just renders as its own plain
  // labeled row, no subtitle), everything else surfaces under "Dashboard"
  // since that's the one screen areas/products/projects/tasks/stakeholders
  // all actually open on.
  const groupLabel = (result) => {
    if (!result) return null;
    if (result.type === "page") return "Pages";
    if (result.run) return "Quick actions";
    return "Dashboard";
  };

  // Ctrl/Cmd+Enter or Ctrl/Cmd+click opens the result's page in a new
  // background tab instead of navigating the current one — the standard
  // browser convention for "open this without losing where I am", extended
  // here to results that aren't real <a href> links. Only applies to
  // results with a real URL (resolveUrl/quickActions' `url`); for anything
  // else (creating something, toggling the theme, a stakeholder highlight)
  // there's nothing a second tab could meaningfully hold, so the modifier
  // is simply ignored and the action runs same-tab as usual.
  const runResult = (index, { newTab = false } = {}) => {
    const result = results[index];
    if (!result) return;
    const url = result.url || (!result.run ? resolveUrl(result) : null);
    if (newTab && url) {
      window.open(url, "_blank", "noopener,noreferrer");
    } else if (result.run) {
      result.run();
    } else {
      jumpTo(result);
    }
    closePalette();
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      runResult(activeIndex, { newTab: e.ctrlKey || e.metaKey });
    }
  };

  // ArrowUp/ArrowDown (handleKeyDown below) moves activeIndex but never
  // touched scroll position on its own — same bug as ChatCommandMenu.jsx's
  // "/" list, fixed the same way. block: "nearest" only scrolls when the
  // highlighted row is actually out of view, so mouse hover (which also
  // sets activeIndex) causes no jitter.
  useEffect(() => {
    itemRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const activeResult = results[activeIndex];
  const activeHasUrl = !!(activeResult && (activeResult.url || (!activeResult.run && resolveUrl(activeResult))));

  if (!isOpen) return null;

  return (
    <Portal>
      <div className="fixed inset-0 bg-black/40 z-[200] flex items-start justify-center pt-[15vh] px-4" onClick={closePalette}>
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
          tabIndex={-1}
          className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border">
            <span className="font-terminal text-primary text-sm shrink-0 select-none" aria-hidden="true">{'>'}</span>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); }}
              onKeyDown={handleKeyDown}
              placeholder="Search areas, products, projects, tasks, stakeholders — or run a quick action"
              aria-label="Search areas, products, projects, tasks, stakeholders — or run a quick action"
              className="flex-1 bg-transparent text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring rounded placeholder:text-muted-foreground"
              autoComplete="off"
            />
            <kbd className="shrink-0 text-[10px] font-mono text-muted-foreground border border-border rounded px-1.5 py-0.5">Esc</kbd>
          </div>

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
                      ref={(el) => { itemRefs.current[index] = el; }}
                      onClick={(e) => runResult(index, { newTab: e.ctrlKey || e.metaKey })}
                      onMouseEnter={() => setActiveIndex(index)}
                      className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${isActive ? "bg-secondary" : "hover:bg-secondary/60"}`}
                    >
                      <Icon className="w-4 h-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium truncate">{highlightMatch(result.title || result.label, query.trim())}</span>
                        {result.subtitle && <span className="block text-xs text-muted-foreground truncate">{highlightMatch(result.subtitle, query.trim())}</span>}
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
        </div>
      </div>
    </Portal>
  );
}

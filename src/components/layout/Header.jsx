import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Search, X, LayoutDashboard, MessageCircle, Settings as SettingsIcon } from "lucide-react";
import { useAppStore } from "@/lib/store";
import UserMenu from "@/components/layout/UserMenu";

const TABS = [
  { key: "dashboard", label: "Dashboard", to: "/", Icon: LayoutDashboard, isActive: (path) => path === "/" },
  { key: "chat", label: "Chat", to: "/chat", Icon: MessageCircle, isActive: (path) => path.startsWith("/chat") },
  { key: "settings", label: "Settings", to: "/settings", Icon: SettingsIcon, isActive: (path) => path.startsWith("/settings") },
];

// Rendered once, above every route (App.jsx) — purely app-level chrome:
// logo, the page tab bar, global search, the settings shortcut. Nothing
// page-specific lives here anymore, including sidebar toggles — each
// page owns its own secondary header row for that (AppShell/ChatPage/
// SettingsPage), the same "sidebar's own header, collapse button sits at
// the seam, and stays at that seam when the sidebar closes" pattern Chat
// originally had. A single toggle button living here instead (an earlier
// pass at this) lost that seam illusion entirely, per direct feedback.
export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();

  const openCommandPalette = useAppStore((s) => s.openCommandPalette);
  const openTabKeys = useAppStore((s) => s.openTabKeys);
  const closeTab = useAppStore((s) => s.closeTab);
  const ensureTabOpen = useAppStore((s) => s.ensureTabOpen);

  // Navigating to a route reopens its tab if it had been closed — same as
  // clicking a link to an already-closed browser tab's page just opens it
  // again, rather than being a dead end.
  useEffect(() => {
    const match = TABS.find((t) => t.isActive(location.pathname));
    if (match) ensureTabOpen(match.key);
  }, [location.pathname, ensureTabOpen]);

  const openTabs = TABS.filter((t) => openTabKeys.includes(t.key));

  const handleCloseTab = (e, tab, isActiveTab) => {
    e.preventDefault();
    e.stopPropagation();
    closeTab(tab.key);
    if (isActiveTab) {
      const remaining = openTabs.filter((t) => t.key !== tab.key);
      navigate(remaining[0]?.to || "/");
    }
  };

  return (
    <header className="h-16 shrink-0 flex items-center justify-between px-6 border-b border-border bg-card shadow-sm relative z-10">
      <div className="flex items-center gap-3">
        <span className="text-lg tracking-tight font-bold [font-family:'JetBrains_Mono',_monospace]">Vaea</span>

        {/* Each tab is a Link (navigate) + a separate close button, not a
            button nested inside the Link's own <a> — nesting interactive
            elements is invalid HTML and breaks focus/click semantics. */}
        <nav className="hidden md:flex items-center gap-1 ml-2">
          {openTabs.map((tab) => {
            const { key, label, to, Icon } = tab;
            const active = tab.isActive(location.pathname);
            const canClose = openTabs.length > 1;
            return (
              <div
                key={key}
                className={`flex items-center rounded-md transition-colors ${active ? "bg-secondary" : "hover:bg-secondary/60"}`}
              >
                <Link
                  to={to}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-1.5 text-sm pl-3 py-1.5 ${canClose ? "pr-1.5" : "pr-3"} ${active ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </Link>
                {canClose && (
                  <button
                    onClick={(e) => handleCloseTab(e, tab, active)}
                    aria-label={`Close ${label} tab`}
                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md p-1 mr-1 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </nav>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={openCommandPalette}
          aria-label="Search everything"
          className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground px-3 py-1.5 rounded-md border border-border bg-background hover:text-foreground hover:bg-secondary/60 transition-colors"
        >
          <Search className="w-3.5 h-3.5" />
          Search
          <kbd className="text-[10px] font-mono border border-border rounded px-1 py-0.5">/</kbd>
        </button>
        <UserMenu />
      </div>
    </header>
  );
}

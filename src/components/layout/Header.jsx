import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Plus, Filter, Search, X, PanelLeft, PanelLeftClose, PanelRight, PanelRightClose, LayoutDashboard, MessageCircle, Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import FilterModal from "@/components/modals/FilterModal";
import UserMenu from "@/components/layout/UserMenu";

const TABS = [
  { key: "dashboard", label: "Dashboard", to: "/", Icon: LayoutDashboard, isActive: (path) => path === "/" },
  { key: "chat", label: "Chat", to: "/chat", Icon: MessageCircle, isActive: (path) => path.startsWith("/chat") },
  { key: "settings", label: "Settings", to: "/settings", Icon: SettingsIcon, isActive: (path) => path.startsWith("/settings") },
];

// Every page with its own persistent left sidebar shares one toggle button
// and one visual treatment (this is the "applicable everywhere" version of
// what used to be Chat-only: a collapsible list on the left, its
// open/closed state persisted). Keyed by exact pathname, not TABS' looser
// isActive — /settings/vault-setup would otherwise inherit the Settings
// tab's match and show a toggle for a sidebar that page doesn't render.
const SIDEBAR_BY_PATH = {
  "/": { isOpenKey: "isLeftSidebarOpen", toggleKey: "toggleLeftSidebar", label: "stakeholders panel" },
  "/chat": { isOpenKey: "isChatSidebarOpen", toggleKey: "toggleChatSidebar", label: "chat history panel" },
  "/settings": { isOpenKey: "isSettingsSidebarOpen", toggleKey: "toggleSettingsSidebar", label: "settings sections panel" },
};

// Rendered once, above every route (App.jsx) rather than inside AppShell —
// Create New / Filter / the right-hand focus panel only mean anything on
// the dashboard route, so those stay gated behind isDashboard; the logo,
// tab bar, search, left-sidebar toggle, and settings shortcut are universal.
export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const isDashboard = location.pathname === "/";
  const sidebarConfig = SIDEBAR_BY_PATH[location.pathname];

  const openCreateModal = useAppStore((s) => s.openCreateModal);
  const openCommandPalette = useAppStore((s) => s.openCommandPalette);
  const isLeftSidebarOpen = useAppStore((s) => s.isLeftSidebarOpen);
  const toggleLeftSidebar = useAppStore((s) => s.toggleLeftSidebar);
  const isRightSidebarOpen = useAppStore((s) => s.isRightSidebarOpen);
  const toggleRightSidebar = useAppStore((s) => s.toggleRightSidebar);
  const isChatSidebarOpen = useAppStore((s) => s.isChatSidebarOpen);
  const toggleChatSidebar = useAppStore((s) => s.toggleChatSidebar);
  const isSettingsSidebarOpen = useAppStore((s) => s.isSettingsSidebarOpen);
  const toggleSettingsSidebar = useAppStore((s) => s.toggleSettingsSidebar);
  const openTabKeys = useAppStore((s) => s.openTabKeys);
  const closeTab = useAppStore((s) => s.closeTab);
  const ensureTabOpen = useAppStore((s) => s.ensureTabOpen);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Every page's sidebar state lives in the store under a different key —
  // this picks out the (isOpen, toggle) pair for whichever one applies to
  // the current route, so the button below stays a single implementation
  // instead of a per-page copy.
  const sidebarState = sidebarConfig && {
    isOpen: { isLeftSidebarOpen, isChatSidebarOpen, isSettingsSidebarOpen }[sidebarConfig.isOpenKey],
    toggle: { toggleLeftSidebar, toggleChatSidebar, toggleSettingsSidebar }[sidebarConfig.toggleKey],
    label: sidebarConfig.label,
  };

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
        {sidebarState && (
          <button
            onClick={sidebarState.toggle}
            aria-label={sidebarState.isOpen ? `Collapse ${sidebarState.label}` : `Expand ${sidebarState.label}`}
            className="text-muted-foreground hover:text-foreground hover:bg-accent p-1.5 -ml-1.5 rounded-md transition-colors">

            {sidebarState.isOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
          </button>
        )}
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
        {isDashboard && (
          <>
            <Button onClick={() => openCreateModal("task")} className="gap-2">
              <Plus className="w-4 h-4" />
              Create New
            </Button>
            <Button variant="outline" size="icon" onClick={() => setIsFilterOpen(true)} aria-label="Filter">
              <Filter className="w-4 h-4" />
            </Button>
            <div className="w-px h-6 bg-border mx-1" />
            <button
              onClick={toggleRightSidebar}
              aria-label={isRightSidebarOpen ? "Collapse focus panel" : "Expand focus panel"}
              className="text-muted-foreground hover:text-foreground hover:bg-accent p-1.5 rounded-md transition-colors">

              {isRightSidebarOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRight className="w-4 h-4" />}
            </button>
          </>
        )}
        <UserMenu />
      </div>
      {isFilterOpen && <FilterModal onClose={() => setIsFilterOpen(false)} />}
    </header>
  );
}

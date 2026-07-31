import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Search, X, Menu, LayoutDashboard, MessageCircle, Settings as SettingsIcon } from "lucide-react";
import { useAppStore } from "@/lib/store";
import UserMenu from "@/components/layout/UserMenu";
import Modal from "@/components/shared/Modal";

const TABS = [
  { key: "dashboard", label: "Dashboard", to: "/app", Icon: LayoutDashboard, isActive: (path) => path === "/app" },
  { key: "chat", label: "Vaea Chat", to: "/app/chat", Icon: MessageCircle, isActive: (path) => path.startsWith("/app/chat") },
  { key: "settings", label: "Settings", to: "/app/settings", Icon: SettingsIcon, isActive: (path) => path.startsWith("/app/settings") },
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  // Below md, the header collapses to logo + this one hamburger — the tab
  // nav's own browser-tab metaphor (close buttons, only-open-tabs-shown)
  // doesn't translate to a cramped dropdown, so the mobile menu just lists
  // all three destinations plainly instead of mirroring openTabs/closeTab.
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const openTabs = TABS.filter((t) => openTabKeys.includes(t.key));

  const handleCloseTab = (e, tab, isActiveTab) => {
    e.preventDefault();
    e.stopPropagation();
    closeTab(tab.key);
    if (isActiveTab) {
      const remaining = openTabs.filter((t) => t.key !== tab.key);
      navigate(remaining[0]?.to || "/app");
    }
  };

  return (
    // Same glass treatment as the marketing site's NavBar (MarketingLayout.jsx)
    // and AppShell's own inner toolbar row — frosted bg-background, heavy
    // saturated blur, hairline+glow shadow pair for light/dark. Not rounded
    // (unlike AppShell's boxed-in bar): this header runs full-bleed edge to
    // edge above the floating-panel canvas, same as NavBar does above the
    // marketing site's content.
    <header className="h-16 shrink-0 flex items-center justify-between px-6 relative z-10 bg-background/70 supports-[backdrop-filter]:bg-background/55 backdrop-blur-2xl backdrop-saturate-150 shadow-[0_1px_0_0_hsl(var(--foreground)/0.06),0_16px_32px_-24px_hsl(200_30%_12%/0.3)] dark:shadow-[0_1px_0_0_hsl(var(--foreground)/0.08),0_0_24px_-8px_hsl(var(--foreground)/0.10)]">
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
                className={`flex items-center rounded-full transition-all ${active ? "bg-card shadow-sm" : "hover:bg-card/60"}`}
              >
                <Link
                  to={to}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-1.5 text-sm pl-3 py-1.5 ${canClose ? "pr-1.5" : "pr-3"} ${active ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Icon className={`w-3.5 h-3.5 ${key === "chat" && !active ? "text-primary" : ""}`} />
                  {label}
                </Link>
                {canClose && (
                  <button
                    onClick={(e) => handleCloseTab(e, tab, active)}
                    aria-label={`Close ${label} tab`}
                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full p-1 mr-1 transition-colors"
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
        {/* Same md threshold as the tab nav above — one control shows search
            at a time: this pill at md+, the hamburger's own Search row below
            it. Used to be `sm:flex`, independent of the tab nav's own `md`
            cutoff, which left a 640-767px sliver showing both this pill and
            (once the hamburger existed) its Search row redundantly. */}
        <button
          onClick={openCommandPalette}
          aria-label="Search everything"
          className="hidden md:flex items-center gap-2 text-sm text-muted-foreground px-4 py-1.5 rounded-full bg-card/70 shadow-[0_0_0_1px_hsl(var(--foreground)/0.05),0_1px_2px_0_hsl(200_30%_12%/0.06)] hover:text-foreground hover:bg-card transition-colors"
        >
          <Search className="w-3.5 h-3.5" />
          Search
          <kbd className="text-[10px] font-mono bg-muted/80 rounded-md px-1.5 py-0.5">/</kbd>
        </button>
        <button
          type="button"
          onClick={() => setMobileMenuOpen((v) => !v)}
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileMenuOpen}
          className="md:hidden flex items-center justify-center w-9 h-9 rounded-full bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>
        <UserMenu />
      </div>

      {/* Below md, the whole tab nav + search pill above are hidden — this
          is their one shared replacement, same frosted-panel treatment as
          the header itself, anchored right under it. All three destinations
          always listed (not just openTabs) — see the comment on
          mobileMenuOpen's effect above for why.
          Built on Modal.jsx/useDialogA11y (same infra MobileSidebarDrawer
          uses), not a bare div — every other menu in the app gets outside-
          click-close, Escape-close, and a focus trap for free from shared
          infrastructure; this one used to hand-roll none of it. The overlay
          is transparent (`top-16`, not `inset-0` — starts below the header
          instead of covering it, so the hamburger button that toggles this
          stays clickable) and exists only to catch the outside click; the
          panel carries all the actual visual chrome. */}
      <Modal
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        label="Navigation menu"
        overlayClassName="md:hidden fixed inset-x-0 top-16 bottom-0 z-20"
        panelClassName="md:hidden absolute top-0 inset-x-0 bg-background/95 backdrop-blur-2xl shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.06),0_16px_32px_-24px_hsl(200_30%_12%/0.3)] px-4 py-3 flex flex-col gap-1 outline-none"
      >
        <button
          type="button"
          onClick={() => { openCommandPalette(); setMobileMenuOpen(false); }}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground px-3 py-2.5 rounded-lg hover:bg-card transition-colors text-left"
        >
          <Search className="w-4 h-4" />
          Search
        </button>
        {TABS.map(({ key, label, to, Icon, isActive }) => {
          const active = isActive(location.pathname);
          return (
            <Link
              key={key}
              to={to}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2 text-sm px-3 py-2.5 rounded-lg transition-colors ${active ? "bg-card text-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-card/60"}`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          );
        })}
      </Modal>
    </header>
  );
}

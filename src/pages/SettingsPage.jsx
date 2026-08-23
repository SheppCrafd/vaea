import { useEffect, useRef, useState } from "react";
import { PanelLeft, PanelLeftClose } from "lucide-react";
import AccountSection from "@/components/settings/AccountSection";
import AppearanceSection from "@/components/settings/AppearanceSection";
import AiPreferencesSection from "@/components/settings/AiPreferencesSection";
import AiModelSection from "@/components/settings/AiModelSection";
import BackupRestoreSection from "@/components/settings/BackupRestoreSection";
import StorageSection from "@/components/settings/StorageSection";
import ExternalVaultSection from "@/components/settings/ExternalVaultSection";
import ConnectorHealthSection from "@/components/settings/ConnectorHealthSection";
import GoogleWorkspaceSection from "@/components/settings/GoogleWorkspaceSection";
import GmailSection from "@/components/settings/GmailSection";
import MicrosoftSection from "@/components/settings/MicrosoftSection";
import OutlookSection from "@/components/settings/OutlookSection";
import AppleMailSection from "@/components/settings/AppleMailSection";
import ClickUpSection from "@/components/settings/ClickUpSection";
import SlackSection from "@/components/settings/SlackSection";
import ResourcesSection from "@/components/settings/ResourcesSection";
import { useAppStore } from "@/lib/store";
import { useIsMobile } from "@/hooks/useIsMobile";
import MobileSidebarDrawer from "@/components/shared/MobileSidebarDrawer";

const SECTIONS = [
  { key: "account", label: "Account", Component: AccountSection },
  { key: "appearance", label: "Appearance", Component: AppearanceSection },
  { key: "ai", label: "AI Preferences", Component: AiPreferencesSection },
  { key: "ai-model", label: "AI Model", Component: AiModelSection },
  { key: "storage", label: "Data Storage", Component: StorageSection },
  { key: "backup", label: "Backup & Restore", Component: BackupRestoreSection },
  { key: "connector-health", label: "Connector Health", Component: ConnectorHealthSection },
  { key: "brain", label: "Vaea Brain", Component: ExternalVaultSection },
  { key: "google-workspace", label: "Google Workspace", Component: GoogleWorkspaceSection },
  { key: "gmail", label: "Gmail", Component: GmailSection },
  { key: "microsoft", label: "Microsoft 365 Calendar", Component: MicrosoftSection },
  { key: "outlook", label: "Outlook Mail", Component: OutlookSection },
  { key: "apple-mail", label: "Apple Mail", Component: AppleMailSection },
  { key: "clickup", label: "ClickUp", Component: ClickUpSection },
  { key: "slack", label: "Slack", Component: SlackSection },
  { key: "resources", label: "Resources", Component: ResourcesSection },
];

// The section-nav list's own content — factored out so the desktop docked
// <aside> and the mobile MobileSidebarDrawer can both render it without
// duplicating the JSX.
function SectionNavContent({ activeSection, onSelect }) {
  return (
    <nav className="flex-1 min-h-0 overflow-y-auto p-2 flex flex-col gap-0.5">
      {SECTIONS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onSelect(key)}
          aria-current={activeSection === key ? "true" : undefined}
          className={`text-left text-sm px-3 py-2 rounded-md transition-colors ${activeSection === key ? "bg-secondary text-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"}`}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}

// A standalone /settings route (outside AppShell's three-column dashboard
// chrome, same treatment ChatPage gets) — a persistent section-nav sidebar
// on the left, following Chat's original header pattern: the sidebar's own
// header holds its collapse button at the seam nearest the main column,
// and the main column's own header shows the matching expand button at
// that same seam once the sidebar closes, so the button visually stays
// put. The active section highlights itself as you scroll, the same
// "which row is current" idea Chat's session list expresses via isActive —
// tracked with an IntersectionObserver rather than a scroll-position
// calculation, so it stays correct regardless of each section's height.
export default function SettingsPage() {
  const isSidebarOpen = useAppStore((s) => s.isSettingsSidebarOpen);
  const toggleSidebar = useAppStore((s) => s.toggleSettingsSidebar);
  const pendingHighlightId = useAppStore((s) => s.pendingHighlightId);
  const clearHighlight = useAppStore((s) => s.clearHighlight);
  const [activeSection, setActiveSection] = useState(SECTIONS[0].key);
  const [pulseKey, setPulseKey] = useState(null);
  const sectionRefs = useRef({});
  const scrollContainerRef = useRef(null);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    // IntersectionObserver callbacks only report entries whose intersection
    // state just changed, not "everything visible right now" — has to be
    // tracked across calls, not read off a single callback's entries.
    const intersecting = new Map(); // sectionKey -> boundingClientRect.top
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const key = entry.target.dataset.sectionKey;
          if (entry.isIntersecting) intersecting.set(key, entry.boundingClientRect.top);
          else intersecting.delete(key);
        });
        if (intersecting.size) {
          const [topmostKey] = [...intersecting.entries()].reduce((a, b) => (a[1] < b[1] ? a : b));
          setActiveSection(topmostKey);
        }
      },
      // Treat a section as "active" once its heading has scrolled into the
      // top ~30% of the visible area, not merely anywhere on screen.
      { root: container, rootMargin: "-10% 0px -70% 0px", threshold: 0 }
    );
    Object.values(sectionRefs.current).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const scrollToSection = (key) => {
    sectionRefs.current[key]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // OPEN_APP_SECTION (chatActions.js) — "where's the Outlook connector"
  // style requests land here as a "settings:<key>" pendingHighlightId.
  // Every section already renders unconditionally on this one scrollable
  // page (sectionRefs above), so there's no separate section to mount
  // first — just scroll to it and pulse a ring around it.
  useEffect(() => {
    if (!pendingHighlightId?.startsWith("settings:")) return;
    const key = pendingHighlightId.slice("settings:".length);
    if (!SECTIONS.some((s) => s.key === key)) return;
    scrollToSection(key);
    setPulseKey(key);
    const stopPulse = setTimeout(() => setPulseKey(null), 2200);
    const clear = setTimeout(() => clearHighlight(), 2300);
    return () => {
      clearTimeout(stopPulse);
      clearTimeout(clear);
    };
  }, [pendingHighlightId]);

  // Same reasoning as AppShell.jsx's mobile drawers and ChatPage.jsx's own
  // copy of this pattern: below md the aside never docks, and the drawer's
  // open state is page-local/non-persisted rather than reusing isSidebarOpen.
  const isMobile = useIsMobile();
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  const selectSectionMobile = (key) => {
    scrollToSection(key);
    setIsMobileDrawerOpen(false);
  };

  return (
    <div className="h-full flex overflow-hidden gap-3 px-3 pb-3">
      {!isMobile && isSidebarOpen && (
        <aside className="text-sidebar-foreground w-56 shrink-0 overflow-hidden rounded-2xl bg-sidebar shadow-xl flex flex-col">
          <div className="h-14 shrink-0 flex items-center justify-between pl-4 pr-3">
            <p className="text-sm font-semibold text-foreground truncate">Sections</p>
            <button
              onClick={toggleSidebar}
              aria-label="Collapse settings sections panel"
              className="text-muted-foreground hover:text-foreground hover:bg-accent p-2 rounded-md transition-colors shrink-0"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>
          <SectionNavContent activeSection={activeSection} onSelect={scrollToSection} />
        </aside>
      )}

      {isMobile && (
        <MobileSidebarDrawer
          isOpen={isMobileDrawerOpen}
          onClose={() => setIsMobileDrawerOpen(false)}
          label="Sections"
          side="left"
        >
          <SectionNavContent activeSection={activeSection} onSelect={selectSectionMobile} />
        </MobileSidebarDrawer>
      )}

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <div className="h-14 shrink-0 flex items-center gap-3 px-4">
          {(isMobile || !isSidebarOpen) && (
            <button
              onClick={() => (isMobile ? setIsMobileDrawerOpen(true) : toggleSidebar())}
              aria-label="Expand settings sections panel"
              className="text-muted-foreground hover:text-foreground hover:bg-accent p-2 -ml-2 rounded-md transition-colors shrink-0"
            >
              <PanelLeft className="w-4 h-4" />
            </button>
          )}
          <p className="font-heading text-sm font-semibold">Settings</p>
        </div>

        <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto">
          {/* pb-[60vh], not a plain py-8 — without real room to scroll past
              it, the last section (Resources, sometimes the one before it
              too) can never reach the -10%/-70% "active" band above, since
              the browser can only scroll as far as there's actual content:
              it gets stuck showing an earlier section as still active.
              Confirmed live — clicking a near-bottom section silently
              reactivated the previous one instead until this. */}
          <div className="max-w-2xl mx-auto px-6 pt-8 pb-[60vh] flex flex-col gap-6">
            {SECTIONS.map(({ key, Component }) => (
              <div
                key={key}
                data-section-key={key}
                ref={(el) => { sectionRefs.current[key] = el; }}
                className={pulseKey === key ? "ring-2 ring-primary ring-offset-2 ring-offset-background animate-pulse rounded-2xl transition-shadow" : ""}
              >
                <Component />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

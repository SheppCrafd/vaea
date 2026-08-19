import { useEffect, useRef, useState } from "react";
import { PanelLeft, PanelLeftClose } from "lucide-react";
import AccountSection from "@/components/settings/AccountSection";
import AppearanceSection from "@/components/settings/AppearanceSection";
import AiPreferencesSection from "@/components/settings/AiPreferencesSection";
import AiModelSection from "@/components/settings/AiModelSection";
import BackupRestoreSection from "@/components/settings/BackupRestoreSection";
import StorageSection from "@/components/settings/StorageSection";
import ExternalVaultSection from "@/components/settings/ExternalVaultSection";
import GoogleCalendarSection from "@/components/settings/GoogleCalendarSection";
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
  // Vaea Vault and Google Calendar are both "let the assistant reach an
  // outside account" connections — the same shape (connect/disconnect,
  // Connected badge, a live preview once linked) rather than a toggle or
  // form like everything above them. Marking the first of the two as the
  // start of a "Connections" group in the nav (see groupLabel below) makes
  // that kinship visible instead of leaving Google Calendar reading as a
  // stray extra item tacked on after Backup & Restore.
  { key: "vault", label: "Vaea Vault", Component: ExternalVaultSection, groupLabel: "Connections" },
  { key: "calendar", label: "Google Calendar", Component: GoogleCalendarSection },
  { key: "resources", label: "Resources", Component: ResourcesSection, groupLabel: "More" },
];

// The section-nav list's own content — factored out so the desktop docked
// <aside> and the mobile MobileSidebarDrawer can both render it without
// duplicating the JSX.
function SectionNavContent({ activeSection, onSelect }) {
  return (
    <nav className="flex-1 min-h-0 overflow-y-auto p-2 flex flex-col gap-0.5">
      {SECTIONS.map(({ key, label, groupLabel }) => (
        <div key={key}>
          {groupLabel && (
            <p className={`px-3 text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider ${key === SECTIONS[0].key ? "" : "mt-3"} mb-1`}>
              {groupLabel}
            </p>
          )}
          <button
            onClick={() => onSelect(key)}
            aria-current={activeSection === key ? "true" : undefined}
            className={`w-full text-left text-sm px-3 py-2 rounded-md transition-colors ${activeSection === key ? "bg-secondary text-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"}`}
          >
            {label}
          </button>
        </div>
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
  const [activeSection, setActiveSection] = useState(SECTIONS[0].key);
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
              <div key={key} data-section-key={key} ref={(el) => { sectionRefs.current[key] = el; }}>
                <Component />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import AccountSection from "@/components/settings/AccountSection";
import AppearanceSection from "@/components/settings/AppearanceSection";
import AiPreferencesSection from "@/components/settings/AiPreferencesSection";
import BackupRestoreSection from "@/components/settings/BackupRestoreSection";
import ExternalVaultSection from "@/components/settings/ExternalVaultSection";
import ResourcesSection from "@/components/settings/ResourcesSection";
import { useAppStore } from "@/lib/store";

const SECTIONS = [
  { key: "account", label: "Account", Component: AccountSection },
  { key: "appearance", label: "Appearance", Component: AppearanceSection },
  { key: "ai", label: "AI Preferences", Component: AiPreferencesSection },
  { key: "backup", label: "Backup & Restore", Component: BackupRestoreSection },
  { key: "vault", label: "External Vault", Component: ExternalVaultSection },
  { key: "resources", label: "Resources", Component: ResourcesSection },
];

// A standalone /settings route (outside AppShell's three-column dashboard
// chrome, same treatment ChatPage gets) — a persistent section-nav sidebar
// on the left, same collapsible/persisted pattern Chat's session list and
// Dashboard's stakeholders panel use (one shared toggle button, lives in
// Header/useAppStore), and a scrollable stack of section cards on the
// right. The active section highlights itself as you scroll, the same
// "which row is current" idea Chat's session list expresses via isActive —
// tracked with an IntersectionObserver rather than a scroll-position
// calculation, so it stays correct regardless of each section's height.
export default function SettingsPage() {
  const isSidebarOpen = useAppStore((s) => s.isSettingsSidebarOpen);
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

  return (
    <div className="h-full flex overflow-hidden bg-background">
      {isSidebarOpen && (
        <aside className="w-56 shrink-0 border-r border-border bg-card flex flex-col">
          <div className="p-3">
            <p className="text-[10px] font-bold uppercase text-muted-foreground px-2 py-1.5">Sections</p>
          </div>
          <nav className="flex-1 min-h-0 overflow-y-auto px-2 pb-2 flex flex-col gap-0.5">
            {SECTIONS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => scrollToSection(key)}
                aria-current={activeSection === key ? "true" : undefined}
                className={`text-left text-sm px-3 py-2 rounded-md transition-colors ${activeSection === key ? "bg-secondary text-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"}`}
              >
                {label}
              </button>
            ))}
          </nav>
        </aside>
      )}

      <div ref={scrollContainerRef} className="flex-1 min-w-0 overflow-y-auto">
        {/* pb-[60vh], not the plain py-8 every other edge is — without real
            room to scroll past it, the last section (Resources, sometimes
            the one before it too) can never reach the -10%/-70% "active"
            band below, since the browser can only scroll as far as there's
            actual content: it gets stuck showing an earlier section as
            still active. Confirmed live — clicking a near-bottom section
            silently reactivated the previous one instead until this. */}
        <div className="max-w-2xl mx-auto px-6 pt-8 pb-[60vh] flex flex-col gap-6">
          <h1 className="font-heading text-lg font-semibold">Settings</h1>
          {SECTIONS.map(({ key, Component }) => (
            <div key={key} data-section-key={key} ref={(el) => { sectionRefs.current[key] = el; }}>
              <Component />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

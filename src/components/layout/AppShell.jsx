import { useState } from "react";
import { DndContext, DragOverlay, pointerWithin } from "@dnd-kit/core";
import { Archive, Boxes, FolderKanban, NotebookPen, Package, Plus, Filter, PanelLeft, PanelLeftClose, PanelRight, PanelRightClose } from "lucide-react";
import { Button } from "@/components/ui/button";
import Sidebar from "@/components/layout/Sidebar";
import LeftSidebar from "@/components/layout/LeftSidebar";
import ArchivePanel from "@/components/archive/ArchivePanel";
import NotepadModal from "@/components/notes/NotepadModal";
import FilterModal from "@/components/modals/FilterModal";
import Avatar from "@/components/shared/Avatar";
import { useGlobalDragEnd } from "@/hooks/useGlobalDragEnd";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useAppStore } from "@/lib/store";
import { useCardView } from "@/lib/CardViewContext";
import MobileSidebarDrawer from "@/components/shared/MobileSidebarDrawer";

// Locks the dashboard into a CSS grid: stakeholders left, main content
// center, focus/stats right. Each of the three columns owns its own h-14
// header row (Chat's original pattern, generalized here rather than a
// single button living in the app-level Header): a sidebar's header holds
// its collapse button at the seam nearest the main column, and when that
// sidebar closes, the *main* column's own header shows the matching expand
// button at that same seam — the button visually stays put; only the
// sidebar around it appears/disappears. Panel open/closed state and its
// localStorage persistence live in useAppStore (Header/App.jsx render
// above this, so state can't just be local to here anymore).
//
// The single DndContext lives here (not scoped to Dashboard/AreaModal like
// it used to be) because dragging a stakeholder from the left sidebar onto a
// project/product/task card in the main content area needs both ends inside
// the same drag context. React context follows the component tree, not the
// DOM tree, so this also still reaches everything rendered into a Portal
// (AreaModal, ProjectDetailModal, ProductDetailModal, etc.).
export default function AppShell({ children }) {
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [isNotepadOpen, setIsNotepadOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeDragData, setActiveDragData] = useState(null);
  const isLeftSidebarOpen = useAppStore((s) => s.isLeftSidebarOpen);
  const toggleLeftSidebar = useAppStore((s) => s.toggleLeftSidebar);
  const isRightSidebarOpen = useAppStore((s) => s.isRightSidebarOpen);
  const toggleRightSidebar = useAppStore((s) => s.toggleRightSidebar);
  const openCreateModal = useAppStore((s) => s.openCreateModal);
  const handleDragEnd = useGlobalDragEnd();
  const { cardView, setCardView } = useCardView();

  // Below md, the grid stops reserving space for either sidebar regardless
  // of the desktop-persisted isLeftSidebarOpen/isRightSidebarOpen — a 280px+
  // 320px sidebar pair alone exceeds any phone viewport. Mobile gets its own
  // page-local, non-persisted drawer state instead (below), so a returning
  // mobile visitor never has a full-screen drawer force itself open just
  // because a previous desktop session left a sidebar open.
  const isMobile = useIsMobile();
  const [isMobileLeftDrawerOpen, setIsMobileLeftDrawerOpen] = useState(false);
  const [isMobileRightDrawerOpen, setIsMobileRightDrawerOpen] = useState(false);

  return (
    <DndContext
      // pointerWithin, not closestCenter: Area cards are now real drop
      // targets much bigger than the Product/Project cards nested inside
      // them (drag-to-reorder, see AreaCard.jsx/ProductCard.jsx) —
      // closestCenter picks whichever droppable's CENTER is numerically
      // closest to the dragged item, regardless of whether the pointer is
      // anywhere near it, which resolved a drop "on Area1" to a Product
      // nested three levels away in testing. pointerWithin only considers
      // droppables the pointer is actually over, tie-broken toward the
      // smaller/more-nested one — exactly "drop on the specific card under
      // the cursor," which is what every one of these interactions means.
      collisionDetection={pointerWithin}
      onDragStart={(e) => setActiveDragData(e.active.data.current || null)}
      onDragEnd={(e) => {
        handleDragEnd(e);
        setActiveDragData(null);
      }}
      onDragCancel={() => setActiveDragData(null)}
    >
      {/* Floating-panel canvas: the columns are separated by the canvas
          itself (grid gap + padding) rather than border-r/border-l lines —
          each sidebar is a rounded panel lifted off the dimmed background
          by its shadow alone. Both rails use the shadcn `sidebar` token pair
          (bg-sidebar/text-sidebar-foreground), which index.css already
          defines separately for :root and .dark, so the panels follow the
          app's actual light/dark setting instead of being pinned dark. */}
      <div
        className="h-full grid overflow-hidden gap-3 px-3 pb-3 transition-[grid-template-columns] duration-200 ease-in-out"
        style={{
          gridTemplateAreas: `"leftsidebar main sidebar"`,
          gridTemplateColumns: isMobile
            ? "0px 1fr 0px"
            : `${isLeftSidebarOpen ? "280px" : "0px"} 1fr ${isRightSidebarOpen ? "320px" : "0px"}`,
        }}
      >
        {/* text-foreground re-resolves inherited `color` against the dark
            token scope — without it, unclassed text inside inherits the
            page's light-mode color and vanishes on the dark panel. */}
        <aside style={{ gridArea: "leftsidebar" }} className={`text-sidebar-foreground overflow-hidden rounded-2xl flex flex-col ${!isMobile && isLeftSidebarOpen ? "bg-sidebar shadow-xl" : ""}`}>
          {!isMobile && isLeftSidebarOpen && (
            <>
              <div className="h-14 shrink-0 flex items-center justify-between pl-4 pr-3">
                <p className="text-sm font-semibold text-foreground truncate">Stakeholders</p>
                <button
                  onClick={toggleLeftSidebar}
                  aria-label="Collapse stakeholders panel"
                  className="text-muted-foreground hover:text-foreground hover:bg-accent p-2 rounded-md transition-colors shrink-0"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-4">
                <LeftSidebar />
              </div>
            </>
          )}
        </aside>

        <div style={{ gridArea: "main" }} className="flex flex-col min-w-0 overflow-hidden">
          {/* Same glass treatment as the marketing/onboarding pages' own
              sticky header (MarketingLayout.jsx's NavBar) — background
              blur/saturation plus a hairline-and-glow shadow pair, light and
              dark. Rounded here (the marketing header isn't) since this bar
              sits boxed inside the dashboard's own floating-panel canvas
              rather than running full-bleed edge to edge. */}
          <div className="h-14 shrink-0 flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 mb-2 rounded-2xl bg-background/70 supports-[backdrop-filter]:bg-background/55 backdrop-blur-2xl backdrop-saturate-150 shadow-[0_1px_0_0_hsl(var(--foreground)/0.06),0_16px_32px_-24px_hsl(200_30%_12%/0.3)] dark:shadow-[0_1px_0_0_hsl(var(--foreground)/0.08),0_0_24px_-8px_hsl(var(--foreground)/0.10)]">
            {(isMobile || !isLeftSidebarOpen) && (
              <button
                onClick={() => (isMobile ? setIsMobileLeftDrawerOpen(true) : toggleLeftSidebar())}
                aria-label="Expand stakeholders panel"
                className="text-muted-foreground hover:text-foreground hover:bg-accent p-2 -ml-2 rounded-md transition-colors shrink-0"
              >
                <PanelLeft className="w-4 h-4" />
              </button>
            )}
            {/* Icon-only below sm: the full label plus the filter, card-view
                toggle and both panel buttons overflow a phone-width bar and
                clip the rightmost control. */}
            <Button onClick={() => openCreateModal("task")} aria-label="Create new" className="shrink-0 gap-2 rounded-full px-3 sm:px-5 shadow-[0_8px_20px_-10px_hsl(var(--primary)/0.7)]">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Create New</span>
            </Button>
            <Button variant="outline" size="icon" onClick={() => setIsFilterOpen(true)} aria-label="Filter" className="rounded-full bg-card/70 shadow-[0_0_0_1px_hsl(var(--foreground)/0.05)] border-transparent">
              <Filter className="w-4 h-4" />
            </Button>
            <div className="shrink-0 inline-flex items-center rounded-full bg-card/70 shadow-[0_0_0_1px_hsl(var(--foreground)/0.05)] p-1 text-xs font-medium">
              <button
                onClick={() => setCardView("mini")}
                aria-pressed={cardView === "mini"}
                className={`px-2.5 sm:px-3.5 py-1.5 rounded-full transition-colors ${cardView === "mini" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                Mini<span className="hidden sm:inline"> Cards</span>
              </button>
              <button
                onClick={() => setCardView("full")}
                aria-pressed={cardView === "full"}
                className={`px-2.5 sm:px-3.5 py-1.5 rounded-full transition-colors ${cardView === "full" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                Full<span className="hidden sm:inline"> Cards</span>
              </button>
            </div>
            {(isMobile || !isRightSidebarOpen) && (
              <button
                onClick={() => (isMobile ? setIsMobileRightDrawerOpen(true) : toggleRightSidebar())}
                aria-label="Expand focus panel"
                className="ml-auto text-muted-foreground hover:text-foreground hover:bg-accent p-2 rounded-md transition-colors shrink-0"
              >
                <PanelRight className="w-4 h-4" />
              </button>
            )}
          </div>
          <main className="flex-1 min-h-0 overflow-y-auto px-1 pt-2 pb-6">
            {children}
          </main>
        </div>

        {/* Same treatment as the left rail (and Chat/Settings' rails) — all
            four side panels share one token-driven surface. */}
        <aside style={{ gridArea: "sidebar" }} className={`text-sidebar-foreground overflow-hidden rounded-2xl flex flex-col ${!isMobile && isRightSidebarOpen ? "bg-sidebar shadow-xl" : ""}`}>
          {!isMobile && isRightSidebarOpen && (
            <>
              <div className="h-14 shrink-0 flex items-center justify-between pl-3 pr-4">
                <button
                  onClick={toggleRightSidebar}
                  aria-label="Collapse focus panel"
                  className="text-muted-foreground hover:text-foreground hover:bg-accent p-2 rounded-md transition-colors shrink-0"
                >
                  <PanelRightClose className="w-4 h-4" />
                </button>
                <p className="text-sm font-semibold truncate">Focus &amp; Stats</p>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-4">
                <Sidebar />
              </div>
            </>
          )}
        </aside>

        {/* Mobile-only drawer equivalents of the two docked panels above —
            same inner content components (LeftSidebar/Sidebar), just
            portaled as an overlay instead of taking a grid column. */}
        {isMobile && (
          <>
            <MobileSidebarDrawer
              isOpen={isMobileLeftDrawerOpen}
              onClose={() => setIsMobileLeftDrawerOpen(false)}
              label="Stakeholders"
              side="left"
            >
              <LeftSidebar />
            </MobileSidebarDrawer>
            <MobileSidebarDrawer
              isOpen={isMobileRightDrawerOpen}
              onClose={() => setIsMobileRightDrawerOpen(false)}
              label="Focus & Stats"
              side="right"
            >
              <Sidebar />
            </MobileSidebarDrawer>
          </>
        )}

        {/* Notepad sits just above View Archive — a colourful accent pill so
            it reads as the "capture" action, not another neutral utility. */}
        <button
          onClick={() => setIsNotepadOpen(true)}
          className="fixed bottom-[5.25rem] left-6 z-40 flex items-center gap-2 px-5 py-3 rounded-full text-sm font-medium text-primary-foreground bg-gradient-to-br from-primary to-primary/70 shadow-[0_12px_32px_-12px_hsl(var(--primary)/0.7)] hover:shadow-[0_20px_44px_-14px_hsl(var(--primary)/0.8)] hover:-translate-y-1 transition-all duration-300"
        >
          <NotebookPen className="w-4 h-4" />
          Notepad
        </button>
        <button
          onClick={() => setIsArchiveOpen(true)}
          className="fixed bottom-6 left-6 z-40 flex items-center gap-2 px-5 py-3 rounded-full bg-card/85 backdrop-blur-xl shadow-[0_0_0_1px_hsl(var(--foreground)/0.06),0_12px_32px_-12px_hsl(200_30%_12%/0.35)] hover:shadow-[0_0_0_1px_hsl(var(--foreground)/0.07),0_20px_44px_-14px_hsl(200_30%_12%/0.45)] hover:-translate-y-1 transition-all duration-300 text-sm font-medium text-foreground"
        >
          <Archive className="w-4 h-4" />
          View Archive
        </button>
        {isNotepadOpen && <NotepadModal onClose={() => setIsNotepadOpen(false)} />}
        {isArchiveOpen && <ArchivePanel onClose={() => setIsArchiveOpen(false)} />}
        {isFilterOpen && <FilterModal onClose={() => setIsFilterOpen(false)} />}
      </div>

      {/* Portals straight to document.body, escaping every ancestor's own
          stacking context and scroll clipping — the only reliable way to
          keep the dragged visual above literally everything else, since a
          z-index on the in-place element can't escape its own containers
          (ProductCard/AreaCard's stacking contexts, the scrollable main
          pane, the sidebar's clipped accordion). */}
      <DragOverlay zIndex={100}>
        {activeDragData?.type === "project" && (
          <div className="flex items-center gap-2 bg-background border border-primary rounded-lg shadow-2xl px-3 py-2 text-sm font-semibold font-heading max-w-xs cursor-grabbing">
            <FolderKanban className="w-4 h-4 shrink-0 text-primary" />
            <span className="truncate">{activeDragData.title || "Project"}</span>
          </div>
        )}
        {activeDragData?.type === "product" && (
          <div className="flex items-center gap-2 bg-background border border-primary rounded-lg shadow-2xl px-3 py-2 text-sm font-semibold font-heading max-w-xs cursor-grabbing">
            <Package className="w-4 h-4 shrink-0 text-primary" />
            <span className="truncate">{activeDragData.title || "Product"}</span>
          </div>
        )}
        {activeDragData?.type === "area" && (
          <div className="flex items-center gap-2 bg-background border border-primary rounded-lg shadow-2xl px-3 py-2 text-sm font-semibold font-heading max-w-xs cursor-grabbing">
            <Boxes className="w-4 h-4 shrink-0 text-primary" />
            <span className="truncate">{activeDragData.title || "Area"}</span>
          </div>
        )}
        {activeDragData?.type === "stakeholder" && (
          <div className="flex items-center gap-2 bg-card border border-primary rounded-full shadow-2xl pl-1 pr-3 py-1 cursor-grabbing">
            <Avatar name={activeDragData.name} avatarUrl={activeDragData.avatarUrl} size="sm" />
            <span className="text-xs font-medium">{activeDragData.name}</span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

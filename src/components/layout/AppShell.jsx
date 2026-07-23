import { useState, lazy, Suspense } from "react";
import { DndContext, DragOverlay, closestCenter } from "@dnd-kit/core";
import { Archive, FolderKanban, Plus, Filter, PanelLeft, PanelLeftClose, PanelRight, PanelRightClose } from "lucide-react";
import { Button } from "@/components/ui/button";
import Sidebar from "@/components/layout/Sidebar";
import LeftSidebar from "@/components/layout/LeftSidebar";
import ArchivePanel from "@/components/archive/ArchivePanel";
import FilterModal from "@/components/modals/FilterModal";
import Avatar from "@/components/shared/Avatar";
import { useGlobalDragEnd } from "@/hooks/useGlobalDragEnd";
import { useAppStore } from "@/lib/store";

// Code-split, like /chat and /settings already are (see App.jsx) — ChatBox
// pulls in react-markdown (message rendering) and its own session/action
// machinery, none of which every dashboard visitor needs downloaded and
// parsed before first paint just because the widget happens to always be
// mounted. This alone was the main-bundle's single biggest chunk.
const ChatBox = lazy(() => import("@/components/ai/ChatBox"));

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
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeDragData, setActiveDragData] = useState(null);
  const isLeftSidebarOpen = useAppStore((s) => s.isLeftSidebarOpen);
  const toggleLeftSidebar = useAppStore((s) => s.toggleLeftSidebar);
  const isRightSidebarOpen = useAppStore((s) => s.isRightSidebarOpen);
  const toggleRightSidebar = useAppStore((s) => s.toggleRightSidebar);
  const openCreateModal = useAppStore((s) => s.openCreateModal);
  const handleDragEnd = useGlobalDragEnd();

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragStart={(e) => setActiveDragData(e.active.data.current || null)}
      onDragEnd={(e) => {
        handleDragEnd(e);
        setActiveDragData(null);
      }}
      onDragCancel={() => setActiveDragData(null)}
    >
      <div
        className="h-full grid overflow-hidden transition-[grid-template-columns] duration-200 ease-in-out"
        style={{
          gridTemplateAreas: `"leftsidebar main sidebar"`,
          gridTemplateColumns: `${isLeftSidebarOpen ? "280px" : "0px"} 1fr ${isRightSidebarOpen ? "320px" : "0px"}`,
        }}
      >
        <aside style={{ gridArea: "leftsidebar" }} className="overflow-hidden border-r border-border bg-card flex flex-col">
          {isLeftSidebarOpen && (
            <>
              <div className="h-14 shrink-0 border-b border-border flex items-center justify-between px-3">
                <p className="text-sm font-semibold truncate">Stakeholders</p>
                <button
                  onClick={toggleLeftSidebar}
                  aria-label="Collapse stakeholders panel"
                  className="text-muted-foreground hover:text-foreground hover:bg-accent p-1.5 rounded-md transition-colors shrink-0"
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
          <div className="h-14 shrink-0 border-b border-border flex items-center gap-2 px-4">
            {!isLeftSidebarOpen && (
              <button
                onClick={toggleLeftSidebar}
                aria-label="Expand stakeholders panel"
                className="text-muted-foreground hover:text-foreground hover:bg-accent p-1.5 -ml-1.5 rounded-md transition-colors shrink-0"
              >
                <PanelLeft className="w-4 h-4" />
              </button>
            )}
            <Button onClick={() => openCreateModal("task")} className="gap-2">
              <Plus className="w-4 h-4" />
              Create New
            </Button>
            <Button variant="outline" size="icon" onClick={() => setIsFilterOpen(true)} aria-label="Filter">
              <Filter className="w-4 h-4" />
            </Button>
            {!isRightSidebarOpen && (
              <button
                onClick={toggleRightSidebar}
                aria-label="Expand focus panel"
                className="ml-auto text-muted-foreground hover:text-foreground hover:bg-accent p-1.5 rounded-md transition-colors shrink-0"
              >
                <PanelRight className="w-4 h-4" />
              </button>
            )}
          </div>
          <main className="flex-1 min-h-0 overflow-y-auto p-6 bg-background">
            {children}
          </main>
        </div>

        <aside style={{ gridArea: "sidebar" }} className="overflow-hidden border-l border-border bg-card flex flex-col">
          {isRightSidebarOpen && (
            <>
              <div className="h-14 shrink-0 border-b border-border flex items-center justify-between px-3">
                <button
                  onClick={toggleRightSidebar}
                  aria-label="Collapse focus panel"
                  className="text-muted-foreground hover:text-foreground hover:bg-accent p-1.5 rounded-md transition-colors shrink-0"
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

        <Suspense fallback={null}>
          <ChatBox />
        </Suspense>

        <button
          onClick={() => setIsArchiveOpen(true)}
          className="fixed bottom-6 left-6 z-40 flex items-center gap-2 px-4 py-3 rounded-full bg-card border border-border shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 text-sm font-medium text-foreground"
        >
          <Archive className="w-4 h-4" />
          View Archive
        </button>
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

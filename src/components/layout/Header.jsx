import { useState } from "react";
import { Plus, Filter, PanelLeft, PanelLeftClose, PanelRight, PanelRightClose } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import FilterModal from "@/components/modals/FilterModal";
import UserMenu from "@/components/layout/UserMenu";

export default function Header({ isLeftSidebarOpen, onToggleLeftSidebar, isRightSidebarOpen, onToggleRightSidebar }) {
  const openCreateModal = useAppStore((s) => s.openCreateModal);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  return (
    <header className="h-16 flex items-center justify-between px-6 border-b border-border bg-card">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleLeftSidebar}
          aria-label={isLeftSidebarOpen ? "Collapse stakeholders panel" : "Expand stakeholders panel"}
          className="text-muted-foreground hover:text-foreground transition-colors">
          
          {isLeftSidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
        </button>
        <span className="text-lg tracking-tight font-bold [font-family:'JetBrains_Mono',_monospace]">Portfolio Tracker</span>
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={() => openCreateModal("task")} className="gap-2">
          <Plus className="w-4 h-4" />
          Create New
        </Button>
        <Button variant="outline" size="icon" onClick={() => setIsFilterOpen(true)} aria-label="Filter">
          <Filter className="w-4 h-4" />
        </Button>
        <div className="w-px h-6 bg-border mx-1" />
        <button
          onClick={onToggleRightSidebar}
          aria-label={isRightSidebarOpen ? "Collapse focus panel" : "Expand focus panel"}
          className="text-muted-foreground hover:text-foreground transition-colors">
          
          {isRightSidebarOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRight className="w-4 h-4" />}
        </button>
        <UserMenu />
      </div>
      {isFilterOpen && <FilterModal onClose={() => setIsFilterOpen(false)} />}
    </header>);

}
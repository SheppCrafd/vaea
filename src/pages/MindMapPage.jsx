import { useEffect, useState } from "react";
import { Network, Workflow, Plus } from "lucide-react";
import StandalonePageHeader from "@/components/shared/StandalonePageHeader";
import VaultGraph from "@/components/mindmap/VaultGraph";
import WorkflowCanvas from "@/components/mindmap/WorkflowCanvas";
import { useAppStore } from "@/lib/store";

const TABS = [
  { key: "vault", label: "Vault", Icon: Network },
  { key: "workflows", label: "Workflows", Icon: Workflow },
];

// Mind Map: two tabs, one page — a visualization of the connected Vaea
// Brain vault, and the freeform Workflows sketching canvas (folded in here
// on request rather than kept as its own top-level tab; both are "draw/see
// connections on an open canvas" surfaces, just over different data).
// OPEN_APP_SECTION (chatActions.js) can request a specific tab via a
// "mindmap:<tab>" pendingHighlightId, same pattern SettingsPage.jsx uses
// for its own sections.
export default function MindMapPage() {
  const [activeTab, setActiveTab] = useState("vault");
  const [addTrigger, setAddTrigger] = useState(0);
  const pendingHighlightId = useAppStore((s) => s.pendingHighlightId);
  const clearHighlight = useAppStore((s) => s.clearHighlight);

  useEffect(() => {
    if (!pendingHighlightId?.startsWith("mindmap:")) return;
    const tab = pendingHighlightId.slice("mindmap:".length);
    if (!TABS.some((t) => t.key === tab)) return;
    setActiveTab(tab);
    clearHighlight();
  }, [pendingHighlightId, clearHighlight]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <StandalonePageHeader
        Icon={Network}
        title="Mind Map"
        subtitle={activeTab === "vault" ? "A visual map of how your vault notes connect" : "A freeform canvas for sketching out how something should work"}
        action={
          activeTab === "workflows" && (
            <button
              onClick={() => setAddTrigger((n) => n + 1)}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" /> Add card
            </button>
          )
        }
      />
      <div className="px-4 border-b border-border">
        <nav className="flex items-center gap-1">
          {TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 text-sm px-3 py-2 border-b-2 -mb-px transition-colors ${activeTab === key ? "border-primary text-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </nav>
      </div>
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden px-4 pb-4 pt-2">
        {activeTab === "vault" ? <VaultGraph /> : <WorkflowCanvas addTrigger={addTrigger} />}
      </div>
    </div>
  );
}

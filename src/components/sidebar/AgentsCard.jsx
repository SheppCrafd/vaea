import { useEffect, useState } from "react";
import { Bot, Plus, X, Pencil, Play, Loader2 } from "lucide-react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { loadAgents, saveAgents } from "@/lib/agentsStore";
import { useSharedChatController } from "@/lib/ChatControllerContext";

const CADENCE_OPTIONS = [
  { label: "Manual only", value: "" },
  { label: "Every 6 hours", value: "6" },
  { label: "Daily", value: "24" },
  { label: "Weekly", value: "168" },
];

// The chat sidebar's Agents card — named, scoped sub-assistants a user can
// define (name + what it's for), edit, run on demand, and optionally give
// an auto-run cadence (still only ever checked the next time the app is
// open — see agentRunner.js's getDueAgents, no true background timer
// exists). No built-in/default agents — an empty list is the honest
// starting state; anything here is something the user (or Vaea, via
// CREATE_AGENT) actually made.
export default function AgentsCard() {
  const [agents, setAgents] = useState([]);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [cadence, setCadence] = useState("");
  const [runningId, setRunningId] = useState(null);
  const [runError, setRunError] = useState(null);
  const chat = useSharedChatController();

  const refresh = () => loadAgents().then(setAgents);
  useEffect(() => {
    refresh();
  }, []);

  const resetForm = () => {
    setName("");
    setPurpose("");
    setCadence("");
    setAdding(false);
    setEditingId(null);
  };

  const startEdit = (agent) => {
    setEditingId(agent.id);
    setName(agent.name);
    setPurpose(agent.purpose || "");
    setCadence(agent.cadenceHours ? String(agent.cadenceHours) : "");
    setAdding(false);
  };

  const saveAgent = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    const cadenceHours = cadence ? Number(cadence) : null;
    const agents = await loadAgents();
    const next = editingId
      ? agents.map((a) => (a.id === editingId ? { ...a, name: name.trim(), purpose: purpose.trim(), cadenceHours } : a))
      : [...agents, { id: crypto.randomUUID(), name: name.trim(), purpose: purpose.trim(), cadenceHours, lastRunAt: null }];
    setAgents(next);
    await saveAgents(next);
    resetForm();
  };

  const removeAgent = async (id) => {
    const next = agents.filter((a) => a.id !== id);
    setAgents(next);
    await saveAgents(next);
    if (editingId === id) resetForm();
  };

  const runAgent = async (agent) => {
    setRunError(null);
    setRunningId(agent.id);
    try {
      await chat.runAgentByName(agent.name);
      await refresh();
    } catch (error) {
      setRunError(error.message);
    } finally {
      setRunningId(null);
    }
  };

  return (
    <Accordion type="multiple" className="w-full px-2">
      <AccordionItem value="agents">
        <AccordionTrigger className="text-sm px-1">Agents</AccordionTrigger>
        <AccordionContent className="px-1 pb-2">
          {agents.length === 0 && !adding && (
            <p className="text-xs text-muted-foreground px-2 py-1.5">No agents yet.</p>
          )}

          {runError && <p className="text-[11px] text-destructive px-2 pb-1.5">{runError}</p>}

          {agents.map((agent) =>
            editingId === agent.id ? (
              <form key={agent.id} onSubmit={saveAgent} className="flex flex-col gap-1.5 px-2 py-2">
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Agent name"
                  className="text-xs px-2 py-1.5 rounded-md border border-input bg-background outline-none focus:ring-1 focus:ring-primary/50"
                />
                <input
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="What's it for? (optional)"
                  className="text-xs px-2 py-1.5 rounded-md border border-input bg-background outline-none focus:ring-1 focus:ring-primary/50"
                />
                <select
                  value={cadence}
                  onChange={(e) => setCadence(e.target.value)}
                  className="text-xs px-2 py-1.5 rounded-md border border-input bg-background outline-none focus:ring-1 focus:ring-primary/50"
                >
                  {CADENCE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <div className="flex gap-1.5">
                  <button type="submit" className="text-xs px-2.5 py-1 bg-primary text-primary-foreground rounded-md">Save</button>
                  <button type="button" onClick={resetForm} className="text-xs px-2.5 py-1 text-muted-foreground">Cancel</button>
                </div>
              </form>
            ) : (
              <div key={agent.id} className="flex items-start gap-2 text-xs px-2 py-2 rounded-lg hover:bg-secondary/40 group">
                <Bot className="w-3.5 h-3.5 shrink-0 mt-0.5 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{agent.name}</p>
                  {agent.purpose && <p className="text-muted-foreground truncate">{agent.purpose}</p>}
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {agent.lastRunAt ? `Last run ${new Date(agent.lastRunAt).toLocaleString()}` : "Never run"}
                    {agent.cadenceHours ? ` · ${CADENCE_OPTIONS.find((o) => Number(o.value) === agent.cadenceHours)?.label || `every ${agent.cadenceHours}h`}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => runAgent(agent)}
                  disabled={runningId === agent.id}
                  aria-label={`Run ${agent.name}`}
                  className="text-muted-foreground hover:text-foreground p-0.5 rounded shrink-0 opacity-0 group-hover:opacity-100 disabled:opacity-100"
                >
                  {runningId === agent.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => startEdit(agent)}
                  aria-label={`Edit ${agent.name}`}
                  className="text-muted-foreground hover:text-foreground p-0.5 rounded shrink-0 opacity-0 group-hover:opacity-100"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => removeAgent(agent.id)}
                  aria-label={`Remove ${agent.name}`}
                  className="text-muted-foreground hover:text-destructive p-0.5 rounded shrink-0 opacity-0 group-hover:opacity-100"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          )}

          {adding ? (
            <form onSubmit={saveAgent} className="flex flex-col gap-1.5 px-2 py-2">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Agent name"
                className="text-xs px-2 py-1.5 rounded-md border border-input bg-background outline-none focus:ring-1 focus:ring-primary/50"
              />
              <input
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="What's it for? (optional)"
                className="text-xs px-2 py-1.5 rounded-md border border-input bg-background outline-none focus:ring-1 focus:ring-primary/50"
              />
              <select
                value={cadence}
                onChange={(e) => setCadence(e.target.value)}
                className="text-xs px-2 py-1.5 rounded-md border border-input bg-background outline-none focus:ring-1 focus:ring-primary/50"
              >
                {CADENCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <div className="flex gap-1.5">
                <button type="submit" className="text-xs px-2.5 py-1 bg-primary text-primary-foreground rounded-md">Save</button>
                <button type="button" onClick={resetForm} className="text-xs px-2.5 py-1 text-muted-foreground">Cancel</button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => { setAdding(true); setEditingId(null); }}
              className="w-full flex items-center gap-1.5 text-xs px-2 py-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary/40"
            >
              <Plus className="w-3.5 h-3.5" /> New agent
            </button>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

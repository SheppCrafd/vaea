import { useEffect, useState } from "react";
import { Bot, Plus, X, TriangleAlert } from "lucide-react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { loadAgents, saveAgents } from "@/lib/agentsStore";
import { useProjects } from "@/hooks/useProjects";
import { useAllTasks } from "@/hooks/useTasks";
import { getProjectRiskLevel } from "@/lib/projectUtils";

// The chat sidebar's Agents card — named, scoped sub-assistants a user can
// define (name + what it's for). "Risk Watcher" is the one built-in agent:
// real, live data (the same getProjectRiskLevel Notifications' deadline
// digest uses), not a placeholder. User-defined agents are honestly labeled
// "not running yet" — autonomous execution, background tasks, and
// sub-agent forking land in a later pass; this is the definitions manager
// they'll plug into once that exists.
export default function AgentsCard() {
  const [agents, setAgents] = useState([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const { data: projects = [] } = useProjects();
  const { data: tasks = [] } = useAllTasks();

  useEffect(() => {
    loadAgents().then(setAgents);
  }, []);

  const atRiskCount = projects.filter((project) => {
    const projectTasks = tasks.filter((t) => t.project_id === project.id);
    const allDone = projectTasks.length > 0 && projectTasks.every((t) => t.status === "DONE" || t.status === "DELEGATED_DONE");
    const risk = getProjectRiskLevel(project, allDone);
    return risk === "overdue" || risk === "at_risk";
  }).length;

  const addAgent = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    const next = [...agents, { id: crypto.randomUUID(), name: name.trim(), purpose: purpose.trim() }];
    setAgents(next);
    await saveAgents(next);
    setName("");
    setPurpose("");
    setAdding(false);
  };

  const removeAgent = async (id) => {
    const next = agents.filter((a) => a.id !== id);
    setAgents(next);
    await saveAgents(next);
  };

  return (
    <Accordion type="multiple" className="w-full px-2">
      <AccordionItem value="agents">
        <AccordionTrigger className="text-sm px-1">Agents</AccordionTrigger>
        <AccordionContent className="px-1 pb-2">
          <div className="flex items-center gap-2 text-xs px-2 py-2 rounded-lg bg-secondary/60 mb-2">
            <TriangleAlert className={`w-3.5 h-3.5 shrink-0 ${atRiskCount > 0 ? "text-amber-500" : "text-muted-foreground"}`} />
            <span className="flex-1">Risk Watcher</span>
            <span className="text-muted-foreground tabular-nums">{atRiskCount}</span>
          </div>

          {agents.map((agent) => (
            <div key={agent.id} className="flex items-start gap-2 text-xs px-2 py-2 rounded-lg hover:bg-secondary/40">
              <Bot className="w-3.5 h-3.5 shrink-0 mt-0.5 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{agent.name}</p>
                {agent.purpose && <p className="text-muted-foreground truncate">{agent.purpose}</p>}
                <p className="text-[10px] text-muted-foreground mt-0.5">Not running yet</p>
              </div>
              <button
                onClick={() => removeAgent(agent.id)}
                aria-label={`Remove ${agent.name}`}
                className="text-muted-foreground hover:text-destructive p-0.5 rounded shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          {adding ? (
            <form onSubmit={addAgent} className="flex flex-col gap-1.5 px-2 py-2">
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
              <div className="flex gap-1.5">
                <button type="submit" className="text-xs px-2.5 py-1 bg-primary text-primary-foreground rounded-md">Save</button>
                <button type="button" onClick={() => setAdding(false)} className="text-xs px-2.5 py-1 text-muted-foreground">Cancel</button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setAdding(true)}
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

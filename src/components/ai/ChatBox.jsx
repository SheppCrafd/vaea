import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { base44 } from "@/api/base44Client";

// 🚀 IMPORTING ALL THE HOOKS
import { useCreateArea } from "@/hooks/useAreas";
import { useCreateProduct } from "@/hooks/useProducts";
import { useCreateProject, useArchiveProject, useDeleteProject, useRestoreProject } from "@/hooks/useProjects";
import { useStakeholders, useCreateStakeholder, useDeleteStakeholder } from "@/hooks/useStakeholders";
import { useAllTasks, useUpdateTaskStatus, useToggleTopThree, useDeleteTask } from "@/hooks/useTasks";

export default function ChatBox({ activeProjectId }) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isComputing, setIsComputing] = useState(false);
  const containerRef = useRef(null);

  // 1. INITIALIZE ALL MUTATIONS AND DATA HOOKS
  const { data: allStakeholders = [] } = useStakeholders();
  const { data: allTasks = [] } = useAllTasks(); // Fixed: Now initialized!
  
  const createArea = useCreateArea();
  const createProduct = useCreateProduct();
  const createProject = useCreateProject();
  const archiveProject = useArchiveProject();
  const deleteProject = useDeleteProject();
  const restoreProject = useRestoreProject();
  
  const createStakeholder = useCreateStakeholder();
  const deleteStakeholder = useDeleteStakeholder();
  
  const updateTaskStatus = useUpdateTaskStatus();
  const toggleTopThree = useToggleTopThree();
  const deleteTask = useDeleteTask();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsChatOpen(false);
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 2. THE MEGA-SCHEMA (Teaching the LLM what it can do)
  const agentTools = [
    // --- AREAS & PRODUCTS ---
    {
      name: "create_area",
      description: "Creates a new top-level Area of Responsibility.",
      parameters: {
        type: "object",
        properties: { name: { type: "string", description: "The name of the new area." } },
        required: ["name"]
      }
    },
    {
      name: "create_product",
      description: "Creates a new Product inside an Area.",
      parameters: {
        type: "object",
        properties: { 
          area_id: { type: "string" }, 
          name: { type: "string" } 
        },
        required: ["area_id", "name"]
      }
    },
    // --- PROJECTS ---
    {
      name: "create_project",
      description: "Creates a new Project.",
      parameters: {
        type: "object",
        properties: { 
          parent_product_id: { type: "string" }, 
          name: { type: "string" } 
        },
        required: ["name"]
      }
    },
    {
      name: "archive_project",
      description: "Archives an active project.",
      parameters: {
        type: "object",
        properties: { project_id: { type: "string" } },
        required: ["project_id"]
      }
    },
    {
      name: "restore_project",
      description: "Restores a previously archived project back to the dashboard.",
      parameters: {
        type: "object",
        properties: { project_id: { type: "string" } },
        required: ["project_id"]
      }
    },
    {
      name: "delete_project",
      description: "Permanently deletes a project.",
      parameters: {
        type: "object",
        properties: { project_id: { type: "string" } },
        required: ["project_id"]
      }
    },
    // --- TASKS ---
    {
      name: "update_task_status",
      description: "Updates the status of an existing task.",
      parameters: {
        type: "object",
        properties: {
          task_id: { type: "string" },
          status: { type: "string", enum: ["Not Started", "In Progress", "Done", "Blocked"] }
        },
        required: ["task_id", "status"]
      }
    },
    {
      name: "toggle_top_three",
      description: "Toggles a task as one of today's top three focus items.",
      parameters: {
        type: "object",
        properties: { 
          task_id: { type: "string" },
          intent: { type: "string", enum: ["flag", "unflag"] }
        },
        required: ["task_id", "intent"]
      }
    },
    {
      name: "delete_task",
      description: "Permanently deletes a task.",
      parameters: {
        type: "object",
        properties: { task_id: { type: "string" } },
        required: ["task_id"]
      }
    },
    // --- STAKEHOLDERS ---
    {
      name: "create_stakeholder",
      description: "Creates a new global stakeholder.",
      parameters: {
        type: "object",
        properties: { 
          name: { type: "string" },
          role: { type: "string", description: "The person's job title or role" }
        },
        required: ["name"]
      }
    }
  ];

  // 3. THE MASTER EXECUTION LOOP
  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userText = input;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userText }]);
    setIsComputing(true);

    try {
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: userText,
        system_context: `You are the PM Dashboard Copilot, an agentic AI directly integrated into the user's application. 
        DO NOT introduce yourself as a generic AI or language model. 
        DO NOT say you do not have access to the app, lists, or user files. You HAVE full database access through your tools.
        When asked to modify, flag, or delete an item, you MUST look up its ID in the provided context arrays and execute the tool immediately. 
        
        Active Project ID: ${activeProjectId}
        Available Stakeholders: ${JSON.stringify(allStakeholders.map(s => ({id: s.id, name: s.name})))}
        Active Tasks: ${JSON.stringify(allTasks.map(t => ({id: t.id, description: t.description})))}`,
        tools: agentTools
      });

      console.log("RAW AGENT RESPONSE:", response);

      if (typeof response === "string") {
        setMessages((prev) => [...prev, { role: "assistant", content: response }]);
        setIsComputing(false);
        return;
      }

      if (response?.tool_calls && response.tool_calls.length > 0) {
        let actionSummaries = [];

        for (const tool of response.tool_calls) {
          const args = JSON.parse(tool.arguments);
          
          switch (tool.name) {
            // Areas & Products
            case "create_area":
              createArea.mutate({ name: args.name });
              actionSummaries.push(`📁 Created new Area: **${args.name}**`);
              break;
            case "create_product":
              createProduct.mutate({ area_id: args.area_id, name: args.name });
              actionSummaries.push(`📦 Created new Product: **${args.name}**`);
              break;
            
            // Projects
            case "create_project":
              createProject.mutate({ parent_product_id: args.parent_product_id, name: args.name });
              actionSummaries.push(`🚀 Created new Project: **${args.name}**`);
              break;
            case "archive_project":
              archiveProject.mutate(args.project_id);
              actionSummaries.push(`📦 Archived project ${args.project_id}.`);
              break;
            case "restore_project":
              restoreProject.mutate(args.project_id);
              actionSummaries.push(`🔄 Restored project ${args.project_id}.`);
              break;
            case "delete_project":
              deleteProject.mutate(args.project_id);
              actionSummaries.push(`🗑️ Permanently deleted project ${args.project_id}.`);
              break;

            // Tasks
            case "update_task_status":
              updateTaskStatus.mutate({ id: args.task_id, status: args.status });
              actionSummaries.push(`✅ Updated task ${args.task_id} to **${args.status}**.`);
              break;
            case "toggle_top_three":
              toggleTopThree.mutate({ id: args.task_id });
              actionSummaries.push(`⭐ ${args.intent === "unflag" ? "Unflagged" : "Flagged"} task ${args.task_id} for Top 3.`);
              break;
            case "delete_task":
              deleteTask.mutate(args.task_id);
              actionSummaries.push(`🗑️ Deleted task ${args.task_id}.`);
              break;

            // Stakeholders
            case "create_stakeholder":
              createStakeholder.mutate({ name: args.name, role: args.role || "Team Member" });
              actionSummaries.push(`👤 Added stakeholder **${args.name}** (${args.role || "Team Member"}).`);
              break;

            default:
              actionSummaries.push(`❓ Agent tried to use an unknown tool: ${tool.name}`);
          }
        }

        setMessages((prev) => [...prev, { role: "assistant", content: actionSummaries.join("\n") }]);
      } 
      else if (response?.text) {
        setMessages((prev) => [...prev, { role: "assistant", content: response.text }]);
      } 
      else if (response?.content) {
        setMessages((prev) => [...prev, { role: "assistant", content: response.content }]);
      }
      else {
        const rawString = JSON.stringify(response, null, 2);
        setMessages((prev) => [
          ...prev, 
          { role: "assistant", content: `🤖 **Debug Raw Output:**\n\`\`\`json\n${rawString}\n\`\`\`` }
        ]);
      }

    } catch (error) {
      console.error("Agent failed to compute:", error);
      setMessages((prev) => [...prev, { role: "assistant", content: `⚠️ Error: ${error.message}` }]);
    } finally {
      setIsComputing(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end" ref={containerRef}>
      {isChatOpen ? (
        <div className="w-80 sm:w-96 h-[500px] bg-background border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-200">
          <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground">
            <div className="flex items-center gap-2 font-semibold">
              <MessageCircle className="w-5 h-5" />
              <span>Copilot Admin</span>
            </div>
            <button onClick={() => setIsChatOpen(false)} className="hover:bg-primary-foreground/20 p-1 rounded-md transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3 scroll-smooth">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`inline-block rounded-lg px-3 py-2 max-w-[85%] text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground shadow-sm"}`}>
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              </div>
            ))}
            
            {isComputing && (
              <div className="flex justify-start">
                <div className="inline-block rounded-lg px-4 py-2 bg-secondary text-secondary-foreground shadow-sm flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground">Admin is working...</span>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSend} className="p-3 bg-card border-t border-border flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="E.g., Archive project 123 and delete task 456..."
              className="flex-1 text-sm px-3 py-2 bg-background border border-input rounded-md outline-none focus:ring-1 focus:ring-primary/50 transition-all"
              disabled={isComputing}
            />
            <button type="submit" disabled={isComputing} className="text-sm px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md transition-colors shadow-sm disabled:opacity-50">
              Execute
            </button>
          </form>
        </div>
      ) : (
        <button onClick={() => setIsChatOpen(true)} className="w-14 h-14 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
          <MessageCircle className="w-6 h-6" />
        </button>
      )}
    </div>
  );
}

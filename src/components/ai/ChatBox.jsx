import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { base44 } from "@/api/base44Client";

// 🌍 1. IMPORT EVERY DATA & MUTATION HOOK
import { useAreas, useCreateArea, useUpdateArea, useDeleteArea } from "@/hooks/useAreas";
import { useProducts, useCreateProduct, useUpdateProduct } from "@/hooks/useProducts";
import { useProjects, useCreateProject, useUpdateProject, useMoveProject, useArchiveProject, useRestoreProject, useDeleteProject } from "@/hooks/useProjects";
import { useAllTasks, useUpdateTask, useUpdateTaskStatus, useToggleTopThree, useDeleteTask } from "@/hooks/useTasks";
import { useStakeholders, useCreateStakeholder, useDeleteStakeholder } from "@/hooks/useStakeholders";

export default function ChatBox({ activeProjectId }) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isComputing, setIsComputing] = useState(false);
  const containerRef = useRef(null);

  // 🌍 2. FETCH ALL GLOBAL STATE (The AI's "Eyes")
  const { data: areas = [] } = useAreas();
  const { data: products = [] } = useProducts();
  const { data: projects = [] } = useProjects();
  const { data: allTasks = [] } = useAllTasks();
  const { data: stakeholders = [] } = useStakeholders();

  // 🌍 3. INITIALIZE EVERY MUTATION (The AI's "Hands")
  const createArea = useCreateArea();
  const updateArea = useUpdateArea();
  const deleteArea = useDeleteArea();
  
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const moveProject = useMoveProject();
  const archiveProject = useArchiveProject();
  const restoreProject = useRestoreProject();
  const deleteProject = useDeleteProject();
  
  const updateTask = useUpdateTask();
  const updateTaskStatus = useUpdateTaskStatus();
  const toggleTopThree = useToggleTopThree();
  const deleteTask = useDeleteTask();
  
  const createStakeholder = useCreateStakeholder();
  const deleteStakeholder = useDeleteStakeholder();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setIsChatOpen(false);
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 🌍 4. THE OMNIPOTENT TOOL SCHEMA
  const agentTools = [
    // --- AREAS ---
    { name: "create_area", description: "Creates a new Area of Responsibility.", parameters: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } },
    { name: "update_area", description: "Renames an Area.", parameters: { type: "object", properties: { area_id: { type: "string" }, name: { type: "string" } }, required: ["area_id", "name"] } },
    { name: "delete_area", description: "Deletes an Area.", parameters: { type: "object", properties: { area_id: { type: "string" } }, required: ["area_id"] } },
    
    // --- PRODUCTS ---
    { name: "create_product", description: "Creates a Product inside an Area.", parameters: { type: "object", properties: { area_id: { type: "string" }, name: { type: "string" } }, required: ["area_id", "name"] } },
    { name: "update_product", description: "Renames a Product.", parameters: { type: "object", properties: { product_id: { type: "string" }, name: { type: "string" } }, required: ["product_id", "name"] } },
    
    // --- PROJECTS ---
    { name: "create_project", description: "Creates a Project inside a Product.", parameters: { type: "object", properties: { parent_product_id: { type: "string" }, name: { type: "string" } }, required: ["parent_product_id", "name"] } },
    { name: "update_project", description: "Updates a Project's name or objective.", parameters: { type: "object", properties: { project_id: { type: "string" }, name: { type: "string" }, objective: { type: "string" } }, required: ["project_id"] } },
    { name: "move_project", description: "Moves a Project to a new Product.", parameters: { type: "object", properties: { project_id: { type: "string" }, parent_product_id: { type: "string" } }, required: ["project_id", "parent_product_id"] } },
    { name: "archive_project", description: "Archives a Project.", parameters: { type: "object", properties: { project_id: { type: "string" } }, required: ["project_id"] } },
    { name: "restore_project", description: "Restores an archived Project.", parameters: { type: "object", properties: { project_id: { type: "string" } }, required: ["project_id"] } },
    { name: "delete_project", description: "Deletes a Project.", parameters: { type: "object", properties: { project_id: { type: "string" } }, required: ["project_id"] } },
    
    // --- TASKS ---
    { name: "update_task", description: "Updates task description or quadrant.", parameters: { type: "object", properties: { task_id: { type: "string" }, description: { type: "string" }, quadrant: { type: "number" } }, required: ["task_id"] } },
    { name: "update_task_status", description: "Changes task status (e.g. Done, Blocked).", parameters: { type: "object", properties: { task_id: { type: "string" }, status: { type: "string", enum: ["Not Started", "In Progress", "Done", "Blocked", "Pending Feedback", "On Hold"] } }, required: ["task_id", "status"] } },
    { name: "toggle_top_three", description: "Flags/Unflags top 3 tasks.", parameters: { type: "object", properties: { task_id: { type: "string" }, intent: { type: "string", enum: ["flag", "unflag"] } }, required: ["task_id", "intent"] } },
    { name: "delete_task", description: "Deletes a task.", parameters: { type: "object", properties: { task_id: { type: "string" } }, required: ["task_id"] } },
    
    // --- STAKEHOLDERS ---
    { name: "create_stakeholder", description: "Adds a stakeholder.", parameters: { type: "object", properties: { name: { type: "string" }, department: { type: "string" } }, required: ["name", "department"] } },
    { name: "delete_stakeholder", description: "Deletes a stakeholder.", parameters: { type: "object", properties: { stakeholder_id: { type: "string" } }, required: ["stakeholder_id"] } }
  ];

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userText = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userText }]);
    setIsComputing(true);

    try {
      // Create lean lookup maps so the prompt doesn't get too bloated
      const ctxAreas = areas.map(a => ({ id: a.id, name: a.name }));
      const ctxProducts = products.map(p => ({ id: p.id, name: p.name }));
      const ctxProjects = projects.map(p => ({ id: p.id, name: p.name }));
      const ctxTasks = allTasks.map(t => ({ id: t.id, text: t.title || t.name || t.description || "Unknown" }));
      const ctxStakeholders = stakeholders.map(s => ({ id: s.id, name: s.name }));

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: userText,
        system_context: `You are the core admin routing engine for this dashboard. YOU HAVE FULL SYSTEM ACCESS.
        CRITICAL RULES:
        1. You have tools to create, update, move, archive, and delete Areas, Products, Projects, Tasks, and Stakeholders.
        2. DO NOT ask the user for context. Look up entity IDs in the provided lists and execute the tool.
        
        GLOBAL DATABASE STATE:
        Active Project ID: ${activeProjectId || "None"}
        Areas: ${JSON.stringify(ctxAreas)}
        Products: ${JSON.stringify(ctxProducts)}
        Projects: ${JSON.stringify(ctxProjects)}
        Tasks: ${JSON.stringify(ctxTasks)}
        Stakeholders: ${JSON.stringify(ctxStakeholders)}`,
        tools: agentTools
      });

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
            case "create_area": createArea.mutate({ name: args.name }); actionSummaries.push(`📁 Created Area: **${args.name}**`); break;
            case "update_area": updateArea.mutate({ id: args.area_id, data: { name: args.name } }); actionSummaries.push(`✏️ Renamed Area.`); break;
            case "delete_area": deleteArea.mutate(args.area_id); actionSummaries.push(`🗑️ Deleted Area.`); break;
            
            case "create_product": createProduct.mutate({ area_id: args.area_id, name: args.name }); actionSummaries.push(`📦 Created Product: **${args.name}**`); break;
            case "update_product": updateProduct.mutate({ id: args.product_id, data: { name: args.name } }); actionSummaries.push(`✏️ Renamed Product.`); break;
            
            case "create_project": createProject.mutate({ parent_product_id: args.parent_product_id, name: args.name }); actionSummaries.push(`🚀 Created Project: **${args.name}**`); break;
            case "update_project": updateProject.mutate({ id: args.project_id, data: args }); actionSummaries.push(`✏️ Updated Project.`); break;
            case "move_project": moveProject.mutate({ id: args.project_id, parent_product_id: args.parent_product_id }); actionSummaries.push(`📦 Moved Project to new Product.`); break;
            case "archive_project": archiveProject.mutate(args.project_id); actionSummaries.push(`📦 Archived Project.`); break;
            case "restore_project": restoreProject.mutate(args.project_id); actionSummaries.push(`🔄 Restored Project.`); break;
            case "delete_project": deleteProject.mutate(args.project_id); actionSummaries.push(`🗑️ Deleted Project.`); break;
            
            case "update_task": updateTask.mutate({ id: args.task_id, data: args }); actionSummaries.push(`✏️ Updated Task details.`); break;
            case "update_task_status": updateTaskStatus.mutate({ id: args.task_id, status: args.status, project_id: activeProjectId }); actionSummaries.push(`✅ Updated task status to **${args.status}**.`); break;
            case "toggle_top_three": toggleTopThree.mutate({ id: args.task_id, project_id: activeProjectId }); actionSummaries.push(args.intent === "unflag" ? `⭐ Removed task from Top 3.` : `⭐ Added task to Top 3.`); break;
            case "delete_task": deleteTask.mutate(args.task_id); actionSummaries.push(`🗑️ Deleted task.`); break;
            
            case "create_stakeholder": createStakeholder.mutate({ name: args.name, department: args.department }); actionSummaries.push(`👤 Added stakeholder **${args.name}**.`); break;
            case "delete_stakeholder": deleteStakeholder.mutate(args.stakeholder_id); actionSummaries.push(`🗑️ Deleted stakeholder.`); break;
            
            default: actionSummaries.push(`❓ Unknown command: ${tool.name}`);
          }
        }

        setMessages((prev) => [...prev, { role: "assistant", content: actionSummaries.join("\n") }]);
      } 
      else if (response?.text) {
        setMessages((prev) => [...prev, { role: "assistant", content: response.text }]);
      } 

    } catch (error) {
      console.error("Agent execution crashed:", error);
      setMessages((prev) => [...prev, { role: "assistant", content: `⚠️ Error: ${error.message}` }]);
    } finally {
      setIsComputing(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans" ref={containerRef}>
      {isChatOpen ? (
        <div className="w-80 sm:w-96 bg-card border border-border shadow-2xl rounded-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-200">
          <div className="bg-primary px-4 py-3 flex items-center justify-between text-primary-foreground">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              <span className="font-semibold text-sm">PM Copilot Admin</span>
            </div>
            <button onClick={() => setIsChatOpen(false)} className="text-primary-foreground/80 hover:text-primary-foreground transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div className="h-[350px] overflow-y-auto p-4 flex flex-col gap-3 text-sm bg-background/50">
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "text-right" : ""}>
                <div className={`inline-block rounded-lg px-3 py-1.5 max-w-[85%] text-left ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground shadow-sm"}`}>
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              </div>
            ))}
            
            {isComputing && (
              <div className="flex justify-start">
                <div className="inline-block rounded-lg px-3 py-1.5 bg-secondary text-secondary-foreground shadow-sm flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground">Operating Dashboard...</span>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSend} className="p-3 bg-card border-t border-border flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="E.g., Move the 'Beta Launch' project to..."
              className="flex-1 text-sm px-3 py-2 bg-background border border-input rounded-md outline-none focus:ring-1 focus:ring-primary/50 transition-all"
              disabled={isComputing}
            />
            <button type="submit" disabled={isComputing} className="text-sm px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md transition-colors shadow-sm disabled:opacity-50">
              Send
            </button>
          </form>
        </div>
      ) : (
        <button
          onClick={() => setIsChatOpen(true)}
          className="w-14 h-14 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}
    </div>
  );
}

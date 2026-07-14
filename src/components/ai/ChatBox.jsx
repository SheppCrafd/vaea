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
  
  // ⏪ THE UNDO STACK: This remembers the "Inverse" of whatever just happened
  const [actionHistory, setActionHistory] = useState([]);
  
  const containerRef = useRef(null);

  // 🌍 2. FETCH ALL GLOBAL STATE 
  const { data: areas = [] } = useAreas();
  const { data: products = [] } = useProducts();
  const { data: projects = [] } = useProjects();
  const { data: allTasks = [] } = useAllTasks();
  const { data: stakeholders = [] } = useStakeholders();

  // 🌍 3. INITIALIZE EVERY MUTATION
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

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userText = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userText }]);
    setIsComputing(true);

    try {
      const ctxAreas = areas.map(a => ({ id: a.id, name: a.name }));
      const ctxProducts = products.map(p => ({ id: p.id, name: p.name }));
      const ctxProjects = projects.map(p => ({ id: p.id, name: p.name }));
      const ctxTasks = allTasks.map(t => ({ id: t.id, text: t.title || t.name || t.description || "Unknown", status: t.status }));
      const ctxStakeholders = stakeholders.map(s => ({ id: s.id, name: s.name }));

      const combinedPrompt = `[SYSTEM INSTRUCTIONS]
      You are the core admin routing engine for this dashboard. YOU HAVE FULL SYSTEM ACCESS.
      CRITICAL RULE: YOU MUST RESPOND ONLY IN VALID JSON FORMAT. Do not include any conversational text outside the JSON.
      
      Look up the entity ID in the lists below and determine the action.
      
      [AVAILABLE ACTIONS]
      - "UNDO_LAST_ACTION" (Use this if the user says "undo", "go back", "revert that", etc. No args required)
      - "CREATE_AREA" (args required: name)
      - "UPDATE_AREA" (args required: area_id, name)
      - "DELETE_AREA" (args required: area_id)
      - "CREATE_PRODUCT" (args required: area_id, name)
      - "UPDATE_PRODUCT" (args required: product_id, name)
      - "CREATE_PROJECT" (args required: parent_product_id, name)
      - "UPDATE_PROJECT" (args required: project_id, name, objective)
      - "MOVE_PROJECT" (args required: project_id, parent_product_id)
      - "ARCHIVE_PROJECT" (args required: project_id)
      - "RESTORE_PROJECT" (args required: project_id)
      - "DELETE_PROJECT" (args required: project_id)
      - "UPDATE_TASK" (args required: task_id, description, quadrant)
      - "UPDATE_TASK_STATUS" (args required: task_id, status)
      - "TOGGLE_TOP_THREE" (args required: task_id, intent: "flag"|"unflag")
      - "DELETE_TASK" (args required: task_id)
      - "CREATE_STAKEHOLDER" (args required: name, department)
      - "DELETE_STAKEHOLDER" (args required: stakeholder_id)
      - "CHAT_ONLY" (Use this if the user is just saying hello, asking how you are, or making small talk. No args required.)
      - "UNKNOWN" (use only if they ask you to do a dashboard task you cannot fulfill)
      
      [GLOBAL DATABASE STATE]
      Active Project ID: ${activeProjectId || "None"}
      Areas: ${JSON.stringify(ctxAreas)}
      Products: ${JSON.stringify(ctxProducts)}
      Projects: ${JSON.stringify(ctxProjects)}
      Tasks: ${JSON.stringify(ctxTasks)}
      Stakeholders: ${JSON.stringify(ctxStakeholders)}
      
      [USER REQUEST]
      ${userText}
      
      [EXPECTED JSON OUTPUT FORMAT]
      {
        "action": "THE_ACTION_NAME",
        "args": { "key": "value" },
        "message": "Your response to the user. Speak like a highly capable, candid, and upbeat AI assistant. Be conversational and energetic. Do not use generic robotic phrases like 'How can I assist you'. If they just say hello, say hi back! Be honest about being an AI, but be witty and direct. MUST BE A VALID JSON STRING."
      }`;

      const response = await base44.integrations.Core.InvokeLLM({ prompt: combinedPrompt });

      let aiDecision;
      const rawText = typeof response === "string" ? response : response?.text || "";
      
      try {
        const cleanJsonString = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        aiDecision = JSON.parse(cleanJsonString);
      } catch (parseError) {
        setMessages((prev) => [...prev, { role: "assistant", content: "I hit a snag trying to process that. Mind trying again?" }]);
        setIsComputing(false);
        return;
      }

      const { action, args, message } = aiDecision;

      // 🔀 THE MASTER ROUTER
      switch (action) {
        
        // ⏪ THE UNDO PROTOCOL
        case "UNDO_LAST_ACTION":
          if (actionHistory.length === 0) {
            setMessages((prev) => [...prev, { role: "assistant", content: "There is nothing in my history to undo right now!" }]);
            return;
          }
          
          const lastAction = actionHistory[actionHistory.length - 1];
          setActionHistory((prev) => prev.slice(0, -1));

          if (lastAction.type === "REVERT_TASK_STATUS") {
            updateTaskStatus.mutate({ id: lastAction.id, status: lastAction.previousStatus, project_id: activeProjectId });
            setMessages((prev) => [...prev, { role: "assistant", content: `⏪ Undid that! Task status reverted back to **${lastAction.previousStatus}**.` }]);
          } 
          else if (lastAction.type === "REVERT_TOGGLE") {
            toggleTopThree.mutate({ id: lastAction.id, project_id: activeProjectId });
            setMessages((prev) => [...prev, { role: "assistant", content: `⏪ Reverted the Top 3 status for that task.` }]);
          }
          else {
             setMessages((prev) => [...prev, { role: "assistant", content: "I can't safely undo that specific action yet." }]);
          }
          return;

        // -- CONVERSATION & FALLBACKS --
        case "CHAT_ONLY":
          setMessages((prev) => [...prev, { role: "assistant", content: message }]);
          return;

        // -- TASKS (WITH HISTORY TRACKING) --
        case "UPDATE_TASK_STATUS":
          const taskBeforeUpdate = allTasks.find(t => t.id === args.task_id);
          if (taskBeforeUpdate) {
            setActionHistory(prev => [...prev, { 
              type: "REVERT_TASK_STATUS", 
              id: args.task_id, 
              previousStatus: taskBeforeUpdate.status || "Not Started" 
            }]);
          }
          updateTaskStatus.mutate({ id: args.task_id, status: args.status, project_id: activeProjectId });
          break;

        case "TOGGLE_TOP_THREE":
          setActionHistory(prev => [...prev, { type: "REVERT_TOGGLE", id: args.task_id }]);
          toggleTopThree.mutate({ id: args.task_id, project_id: activeProjectId });
          break;

        // -- DESTRUCTIVE ACTIONS --
        case "DELETE_TASK": deleteTask.mutate(args.task_id); break;
        case "ARCHIVE_PROJECT": archiveProject.mutate(args.project_id); break;

        // -- EVERYTHING ELSE --
        case "CREATE_AREA": createArea.mutate({ name: args.name }); break;
        case "UPDATE_AREA": updateArea.mutate({ id: args.area_id, data: { name: args.name } }); break;
        case "DELETE_AREA": deleteArea.mutate(args.area_id); break;
        case "CREATE_PRODUCT": createProduct.mutate({ area_id: args.area_id, name: args.name }); break;
        case "UPDATE_PRODUCT": updateProduct.mutate({ id: args.product_id, data: { name: args.name } }); break;
        case "CREATE_PROJECT": createProject.mutate({ parent_product_id: args.parent_product_id, name: args.name }); break;
        case "UPDATE_PROJECT": updateProject.mutate({ id: args.project_id, data: args }); break;
        case "MOVE_PROJECT": moveProject.mutate({ id: args.project_id, parent_product_id: args.parent_product_id }); break;
        case "RESTORE_PROJECT": restoreProject.mutate(args.project_id); break;
        case "DELETE_PROJECT": deleteProject.mutate(args.project_id); break;
        case "UPDATE_TASK": updateTask.mutate({ id: args.task_id, data: args }); break;
        case "CREATE_STAKEHOLDER": createStakeholder.mutate({ name: args.name, department: args.department }); break;
        case "DELETE_STAKEHOLDER": deleteStakeholder.mutate(args.stakeholder_id); break;

        case "UNKNOWN":
        default:
          setMessages((prev) => [...prev, { role: "assistant", content: message || "I couldn't figure out how to do that based on the current data." }]);
          return;
      }

      setMessages((prev) => [...prev, { role: "assistant", content: message }]);

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

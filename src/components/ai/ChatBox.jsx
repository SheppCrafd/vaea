import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { base44 } from "@/api/base44Client";

// 🌍 1. IMPORT EVERY DATA & MUTATION HOOK (GOD MODE)
import { useAreas, useCreateArea, useUpdateArea, useDeleteArea } from "@/hooks/useAreas";
import { useProducts, useCreateProduct, useUpdateProduct, useDeleteProduct } from "@/hooks/useProducts";
import { useProjects, useCreateProject, useUpdateProject, useMoveProject, useArchiveProject, useRestoreProject, useDeleteProject } from "@/hooks/useProjects";
import { useAllTasks, useCreateTask, useUpdateTask, useUpdateTaskStatus, useToggleTopThree, useDeleteTask } from "@/hooks/useTasks";
import { useStakeholders, useCreateStakeholder, useUpdateStakeholder, useDeleteStakeholder } from "@/hooks/useStakeholders";
import { useProjectNotes, useCreateProjectNote, useUpdateProjectNote, useDeleteProjectNote } from "@/hooks/useProjectNotes";

export default function ChatBox({ activeProjectId }) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isComputing, setIsComputing] = useState(false);
  
  // ⏪ THE UNDO STACK
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
  const deleteProduct = useDeleteProduct(); 
  
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const moveProject = useMoveProject();
  const archiveProject = useArchiveProject();
  const restoreProject = useRestoreProject();
  const deleteProject = useDeleteProject();
  
  const createTask = useCreateTask(); 
  const updateTask = useUpdateTask();
  const updateTaskStatus = useUpdateTaskStatus();
  const toggleTopThree = useToggleTopThree();
  const deleteTask = useDeleteTask();
  
  const createStakeholder = useCreateStakeholder();
  const updateStakeholder = useUpdateStakeholder(); 
  const deleteStakeholder = useDeleteStakeholder();

  const createProjectNote = useCreateProjectNote();
  const updateProjectNote = useUpdateProjectNote();
  const deleteProjectNote = useDeleteProjectNote();

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
    
    const updatedMessages = [...messages, { role: "user", content: userText }];
    setMessages(updatedMessages);
    setIsComputing(true);

    try {
      // 🧠 OMNISCIENT CONTEXT MAPPING (Using .title to fix the visibility bug)
      const ctxAreas = areas.map(a => ({ id: a.id, name: a.title, description: a.description }));
      const ctxProducts = products.map(p => ({ id: p.id, name: p.title, description: p.description }));
      const ctxProjects = projects.map(p => ({ 
        id: p.id, name: p.title, 
        objective: p.objective, risks: p.risks, 
        owner: p.owner, status: p.dueDateStatus 
      }));
      const ctxTasks = allTasks.map(t => ({ 
        id: t.id, text: t.title || t.name || t.description || "Unknown", 
        status: t.status, quadrant: t.quadrant, project_id: t.project_id 
      }));
      const ctxStakeholders = stakeholders.map(s => ({ id: s.id, name: s.name, department: s.department }));

      const conversationHistoryString = updatedMessages
        .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
        .join("\n");

      const combinedPrompt = `[SYSTEM INSTRUCTIONS]
      You are the core admin routing engine for this dashboard. YOU HAVE FULL SYSTEM ACCESS.
      CRITICAL RULE: YOU MUST RESPOND ONLY IN VALID JSON FORMAT. Do not include any conversational text outside the JSON.
      
      CRITICAL MAPPING RULE: If an action requires an ID, you MUST look up the correct ID from the [GLOBAL DATABASE STATE] lists below using the name/title the user provided. Do NOT pass the plain text name as the ID.
      
      [AVAILABLE ACTIONS - FULL SYSTEM OVERRIDE]
      
      - "UNDO_LAST_ACTION" 
      
      - "CREATE_AREA" (args: name, description)
      - "UPDATE_AREA" (args: area_id, name, description)
      - "DELETE_AREA" (args: area_id)
      
      - "CREATE_PRODUCT" (args: area_id, name, description)
      - "UPDATE_PRODUCT" (args: product_id, name, description)
      - "DELETE_PRODUCT" (args: product_id)
      
      - "CREATE_PROJECT" (args: parent_product_id, parent_area_id, name, objective, owner)
      - "UPDATE_PROJECT" (args: project_id, name, objective, risks, owner, dueDate, dueDateStatus)
      - "MOVE_PROJECT" (args: project_id, parent_product_id, parent_area_id)
      - "ARCHIVE_PROJECT" (args: project_id)
      - "RESTORE_PROJECT" (args: project_id)
      - "DELETE_PROJECT" (args: project_id)
      
      - "CREATE_PROJECT_NOTE" (args: project_id, content)
      - "UPDATE_PROJECT_NOTE" (args: note_id, content)
      - "DELETE_PROJECT_NOTE" (args: note_id)
      
      - "CREATE_TASK" (args: project_id, description, quadrant)
      - "UPDATE_TASK" (args: task_id, description, quadrant)
      - "UPDATE_TASK_STATUS" (args: task_id, status)
      - "TOGGLE_TOP_THREE" (args: task_id)
      - "DELETE_TASK" (args: task_id)
      
      - "CREATE_STAKEHOLDER" (args: name, department)
      - "UPDATE_STAKEHOLDER" (args: stakeholder_id, name, department)
      - "DELETE_STAKEHOLDER" (args: stakeholder_id)
      
      - "CHAT_ONLY" 
      - "UNKNOWN" 
      
      [GLOBAL DATABASE STATE]
      Active Project ID: ${activeProjectId || "None"}
      Areas: ${JSON.stringify(ctxAreas)}
      Products: ${JSON.stringify(ctxProducts)}
      Projects: ${JSON.stringify(ctxProjects)}
      Tasks: ${JSON.stringify(ctxTasks)}
      Stakeholders: ${JSON.stringify(ctxStakeholders)}
      
      [CONVERSATION HISTORY]
      ${conversationHistoryString}
      
      [LATEST USER REQUEST]
      ${userText}
      
      [EXPECTED JSON OUTPUT FORMAT]
      {
        "action": "THE_ACTION_NAME",
        "args": { "key": "value" },
        "message": "Your text response to the user. Match their tone."
      }`;

      const response = await base44.integrations.Core.InvokeLLM({ prompt: combinedPrompt });

      let aiDecision;
      const rawText = typeof response === "string" ? response : response?.text || "";
      
      try {
        const cleanJsonString = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        aiDecision = JSON.parse(cleanJsonString);
      } catch (parseError) {
        setMessages((prev) => [...prev, { role: "assistant", content: "Hit a bump parsing that request. Try again?" }]);
        setIsComputing(false);
        return;
      }

      const { action, args, message } = aiDecision;

      // 🔀 THE ULTIMATE MASTER ROUTER
      switch (action) {
        
        case "UNDO_LAST_ACTION":
          if (actionHistory.length === 0) {
            setMessages((prev) => [...prev, { role: "assistant", content: "Nothing to undo right now." }]);
            return;
          }
          const lastAction = actionHistory[actionHistory.length - 1];
          setActionHistory((prev) => prev.slice(0, -1));

          if (lastAction.type === "REVERT_TASK_STATUS") {
            updateTaskStatus.mutate({ id: lastAction.id, status: lastAction.previousStatus, project_id: activeProjectId });
            setMessages((prev) => [...prev, { role: "assistant", content: `Reverted task status back to ${lastAction.previousStatus}.` }]);
          } 
          else if (lastAction.type === "REVERT_TOGGLE") {
            toggleTopThree.mutate({ id: lastAction.id, project_id: activeProjectId });
            setMessages((prev) => [...prev, { role: "assistant", content: `Reverted focus/top 3 status for that task.` }]);
          }
          else {
             setMessages((prev) => [...prev, { role: "assistant", content: "Can't automatically reverse that action." }]);
          }
          return;

        case "CHAT_ONLY":
          setMessages((prev) => [...prev, { role: "assistant", content: message }]);
          return;

        // -- TASKS --
        case "CREATE_TASK": createTask.mutate({ project_id: args.project_id, ...args }); break;
        case "UPDATE_TASK": updateTask.mutate({ id: args.task_id, data: args }); break;
        case "UPDATE_TASK_STATUS":
          const taskBeforeUpdate = allTasks.find(t => t.id === args.task_id);
          if (taskBeforeUpdate) {
            setActionHistory(prev => [...prev, { type: "REVERT_TASK_STATUS", id: args.task_id, previousStatus: taskBeforeUpdate.status || "Not Started" }]);
          }
          updateTaskStatus.mutate({ id: args.task_id, status: args.status, project_id: activeProjectId });
          break;
        case "TOGGLE_TOP_THREE":
          setActionHistory(prev => [...prev, { type: "REVERT_TOGGLE", id: args.task_id }]);
          toggleTopThree.mutate({ id: args.task_id, project_id: activeProjectId });
          break;
        case "DELETE_TASK": deleteTask.mutate(args.task_id); break;

        // -- PROJECTS --
        case "CREATE_PROJECT": createProject.mutate({ parent_product_id: args.parent_product_id, parent_area_id: args.parent_area_id, title: args.name, name: args.name, ...args }); break;
        case "UPDATE_PROJECT": updateProject.mutate({ id: args.project_id, data: { title: args.name, ...args } }); break;
        case "MOVE_PROJECT": 
          moveProject.mutate({ 
            id: args.project_id, 
            parent_product_id: args.parent_product_id || null,
            parent_area_id: args.parent_area_id || null
          }); 
          break;
        case "ARCHIVE_PROJECT": archiveProject.mutate(args.project_id); break;
        case "RESTORE_PROJECT": restoreProject.mutate(args.project_id); break;
        case "DELETE_PROJECT": deleteProject.mutate(args.project_id); break;

        // -- PROJECT NOTES --
        case "CREATE_PROJECT_NOTE": createProjectNote.mutate({ project_id: args.project_id, content: args.content }); break;
        case "UPDATE_PROJECT_NOTE": updateProjectNote.mutate({ id: args.note_id, data: { content: args.content } }); break;
        case "DELETE_PROJECT_NOTE": deleteProjectNote.mutate(args.note_id); break;

        // -- PRODUCTS --
        case "CREATE_PRODUCT": createProduct.mutate({ area_id: args.area_id, title: args.name, name: args.name, ...args }); break;
        case "UPDATE_PRODUCT": updateProduct.mutate({ id: args.product_id, data: { title: args.name, ...args } }); break;
        case "DELETE_PRODUCT": deleteProduct.mutate(args.product_id); break;

        // -- AREAS --
        case "CREATE_AREA": createArea.mutate({ title: args.name, name: args.name, ...args }); break;
        case "UPDATE_AREA": updateArea.mutate({ id: args.area_id, data: { title: args.name, ...args } }); break;
        case "DELETE_AREA": deleteArea.mutate(args.area_id); break;

        // -- STAKEHOLDERS --
        case "CREATE_STAKEHOLDER": createStakeholder.mutate(args); break;
        case "UPDATE_STAKEHOLDER": updateStakeholder.mutate({ id: args.stakeholder_id, data: args }); break;
        case "DELETE_STAKEHOLDER": deleteStakeholder.mutate(args.stakeholder_id); break;

        case "UNKNOWN":
        default:
          setMessages((prev) => [...prev, { role: "assistant", content: message || "Couldn't execute that command based on dashboard context." }]);
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
              placeholder="E.g., Kill everything / Delete all / Build a new..."
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
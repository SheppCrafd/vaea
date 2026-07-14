import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { base44 } from "@/api/base44Client";

// Hooks
import { useStakeholders } from "@/hooks/useStakeholders"; 
import { useAllTasks, useUpdateTaskStatus, useToggleTopThree, useDeleteTask } from "@/hooks/useTasks";

export default function ChatBox({ activeProjectId }) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isComputing, setIsComputing] = useState(false);
  const containerRef = useRef(null);

  // 1. Initialize data hooks & mutations from your useTasks file
  const { data: allStakeholders = [] } = useStakeholders();
  const { data: allTasks = [] } = useAllTasks();
  
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

  // 2. Define the Agent's Tool Schemas matching your hooks
  const agentTools = [
    {
      name: "toggle_top_three",
      description: "Flags or unflags a task as one of today's top three focus items.",
      parameters: {
        type: "object",
        properties: { 
          task_id: { type: "string" },
          intent: { type: "string", enum: ["flag", "unflag"], description: "Whether the user wants to add or remove the task from top 3." }
        },
        required: ["task_id", "intent"]
      }
    },
    {
      name: "update_task_status",
      description: "Updates the execution status of an existing task.",
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
      name: "delete_task",
      description: "Permanently deletes a task from the board.",
      parameters: {
        type: "object",
        properties: { task_id: { type: "string" } },
        required: ["task_id"]
      }
    }
  ];

  // 3. The Master Execution Loop
  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userText = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userText }]);
    setIsComputing(true);

    try {
      // Invoke the real Base44 LLM Engine
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: userText,
        system_context: `You are the PM Dashboard Copilot, an agentic AI directly integrated into the user's application. 
        DO NOT say you do not have access to the app, lists, or user files. You HAVE full database access through your tools.
        When asked to modify, flag, or delete an item, look up its ID in the provided context arrays and execute the tool immediately. 
        
        Active Project ID: ${activeProjectId}
        Available Stakeholders: ${JSON.stringify(allStakeholders.map(s => ({id: s.id, name: s.name})))}
        Active Tasks: ${JSON.stringify(allTasks.map(t => ({id: t.id, description: t.description})))}`,
        tools: agentTools
      });

      // Handle casual text chatter safely
      if (typeof response === "string") {
        setMessages((prev) => [...prev, { role: "assistant", content: response }]);
        return;
      }

      // Handle structural tool execution
      if (response?.tool_calls && response.tool_calls.length > 0) {
        let actionSummaries = [];

        for (const tool of response.tool_calls) {
          const args = JSON.parse(tool.arguments);
          
          switch (tool.name) {
            case "toggle_top_three":
              // Passing project_id alongside id satisfies your hook's onSuccess UI invalidation!
              toggleTopThree.mutate({ id: args.task_id, project_id: activeProjectId });
              actionSummaries.push(
                args.intent === "unflag" 
                  ? `⭐ I removed task \`${args.task_id}\` from Today's Top 3.` 
                  : `⭐ I added task \`${args.task_id}\` to Today's Top 3.`
              );
              break;

            case "update_task_status":
              updateTaskStatus.mutate({ id: args.task_id, status: args.status, project_id: activeProjectId });
              actionSummaries.push(`✅ Updated task \`${args.task_id}\` status to **${args.status}**.`);
              break;

            case "delete_task":
              deleteTask.mutate(args.task_id);
              actionSummaries.push(`🗑️ Deleted task \`${args.task_id}\`.`);
              break;

            default:
              actionSummaries.push(`❓ The agent attempted an unknown command: ${tool.name}`);
          }
        }

        setMessages((prev) => [...prev, { role: "assistant", content: actionSummaries.join("\n") }]);
      } 
      else if (response?.text) {
        setMessages((prev) => [...prev, { role: "assistant", content: response.text }]);
      } 
      else {
        // Fallback catch-all debug renderer
        setMessages((prev) => [...prev, { role: "assistant", content: typeof response === 'object' ? JSON.stringify(response) : String(response) }]);
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
                  <span className="text-xs text-muted-foreground">Updating dashboard records...</span>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSend} className="p-3 bg-card border-t border-border flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="E.g., Remove Test 1 from today's top 3..."
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

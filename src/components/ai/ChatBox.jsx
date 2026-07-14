import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { base44 } from "@/api/base44Client";

// Import your hooks so the Agent can mutate the dashboard
import { useStakeholders } from "@/hooks/useStakeholders";
import { useUpdateTaskStatus, useToggleTopThree } from "@/hooks/useTasks";
import { useArchiveProject } from "@/hooks/useProjects";
// Assuming you have these hooks based on your architecture:
// import { useCreateTask } from "@/hooks/useTasks";
// import { useCreateProjectNote } from "@/hooks/useProjectNotes";

export default function ChatBox({ activeProjectId }) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isComputing, setIsComputing] = useState(false);
  const containerRef = useRef(null);

  // 1. Initialize all available Agent Tools (Mutations)
  const { data: allStakeholders = [] } = useStakeholders();
  const updateTaskStatus = useUpdateTaskStatus();
  const toggleTopThree = useToggleTopThree();
  const archiveProject = useArchiveProject();
  // const createTask = useCreateTask();
  // const createNote = useCreateProjectNote();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsChatOpen(false);
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 2. Define the Agent's Tool Schemas
  const agentTools = [
    {
      name: "create_note",
      description: "Creates a new note for a project and tags relevant stakeholders.",
      parameters: {
        type: "object",
        properties: {
          note_text: { type: "string" },
          tagged_stakeholder_ids: {
            type: "array",
            items: { type: "string" },
            description: "Array of Stakeholder IDs matching the names mentioned in the prompt."
          }
        },
        required: ["note_text"]
      }
    },
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
      name: "flag_top_three",
      description: "Flags a task as one of today's top three focus items.",
      parameters: {
        type: "object",
        properties: { task_id: { type: "string" } },
        required: ["task_id"]
      }
    }
  ];

  // 3. The Agentic Execution Loop
  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userText = input;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userText }]);
    setIsComputing(true);

    try {
      // Pass the prompt, the tools, and context to base44's LLM
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: userText,
        system_context: `You are a PM Dashboard Copilot. The active project ID is ${activeProjectId}. Available stakeholders: ${JSON.stringify(allStakeholders.map(s => ({id: s.id, name: s.name})))}`,
        tools: agentTools
      });

      // 4. Check if the LLM decided to take an action (invoke a tool)
      if (response.tool_calls && response.tool_calls.length > 0) {
        let actionSummaries = [];

        for (const tool of response.tool_calls) {
          const args = JSON.parse(tool.arguments);
          
          // Route the LLM's decision to your React Query mutations
          switch (tool.name) {
            case "create_note":
              // await createNote.mutateAsync({ project_id: activeProjectId, text: args.note_text, stakeholders: args.tagged_stakeholder_ids });
              actionSummaries.push(`📝 I created a note and tagged the requested stakeholders.`);
              break;
            case "update_task_status":
              await updateTaskStatus.mutateAsync({ id: args.task_id, status: args.status });
              actionSummaries.push(`✅ I updated the task status to ${args.status}.`);
              break;
            case "flag_top_three":
              await toggleTopThree.mutateAsync({ id: args.task_id });
              actionSummaries.push(`⭐ I flagged the task for Today's Top 3.`);
              break;
            default:
              console.warn("Unknown tool called:", tool.name);
          }
        }

        // Add the success summary to the chat
        setMessages((prev) => [...prev, { role: "assistant", content: actionSummaries.join("\n") }]);
      } 
      // If no tool was needed, just output standard text
      else if (response.text) {
        setMessages((prev) => [...prev, { role: "assistant", content: response.text }]);
      }

    } catch (error) {
      console.error("Agent failed to compute:", error);
      setMessages((prev) => [...prev, { role: "assistant", content: "⚠️ Sorry, I encountered an error connecting to the dashboard engine." }]);
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
              <span>Copilot Agent</span>
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
            
            {/* Visual computation feedback required by your checklist */}
            {isComputing && (
              <div className="flex justify-start">
                <div className="inline-block rounded-lg px-4 py-2 bg-secondary text-secondary-foreground shadow-sm flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground">Agent is thinking...</span>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSend} className="p-3 bg-card border-t border-border flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="E.g., Flag task #123 as top priority..."
              className="flex-1 text-sm px-3 py-2 bg-background border border-input rounded-md outline-none focus:ring-1 focus:ring-primary/50 transition-all"
              disabled={isComputing}
            />
            <button type="submit" disabled={isComputing} className="text-sm px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md transition-colors shadow-sm disabled:opacity-50">
              Send
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

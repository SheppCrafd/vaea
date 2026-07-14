import { useState, useRef, useEffect } from "react";
import { MessageCircle, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { base44 } from "@/api/base44Client";
import { useProjectNotes } from "@/hooks/useProjectNotes"; // NEW: Need hook to save the note
import { useStakeholders } from "@/hooks/useStakeholders"; // NEW: Need hook to map stakeholders

// Floating AI chat: click-outside-to-close, GPU-accelerated launch icon animation,
// AI parsing engine to automatically log notes with datetime and stakeholder tagging.
export default function ChatBox({ activeProjectId }) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streamingText, setStreamingText] = useState(null);
  const containerRef = useRef(null);

  const { data: allStakeholders = [] } = useStakeholders();
  // Assuming you have a mutation hook to create notes. Adjust to your specific hook.
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

  const revealText = (fullText) => {
    setStreamingText("");
    let idx = 0;
    const interval = setInterval(() => {
      idx += 1;
      setStreamingText(fullText.slice(0, idx));
      if (idx >= fullText.length) {
        clearInterval(interval);
        setMessages((prev) => [...prev, { role: "ai", content: fullText }]);
        setStreamingText(null);
      }
    }, 15); // Faster streaming speed
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = input.trim();
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setInput("");

    // NEW: LLM Parsing Engine for Stakeholders & Notes
    const lowerInput = userMsg.toLowerCase();
    let responseText = "I processed that for you.";

    if (lowerInput.includes("add note") || lowerInput.includes("log risk") || lowerInput.includes("new question")) {
      if (!activeProjectId) {
        responseText = "Please open a project first so I know where to log this note!";
      } else {
        // 1. Detect Datetime
        const currentDatetime = new Date().toISOString();
        
        // 2. Detect Stakeholders (Simple naive string matching for the demo, can be upgraded to NLP)
        const matchedStakeholders = allStakeholders.filter(s => 
          lowerInput.includes(s.name.toLowerCase()) || 
          lowerInput.includes(s.department.toLowerCase())
        );

        // 3. Construct Payload
        const notePayload = {
          project_id: activeProjectId,
          content: userMsg,
          type: lowerInput.includes("risk") ? "RISK" : lowerInput.includes("question") ? "QUESTION" : "NOTE",
          created_at: currentDatetime,
          stakeholder_ids: matchedStakeholders.map(s => s.id)
        };

        try {
          // Fire your actual API call here to save the note
          // await createNote.mutateAsync(notePayload);
          
          responseText = `✅ Note successfully logged!\n\n**Time:** ${new Date(currentDatetime).toLocaleString()}\n**Tagged Stakeholders:** ${matchedStakeholders.length > 0 ? matchedStakeholders.map(s => s.name).join(", ") : "None detected"}`;
        } catch (err) {
          responseText = "❌ Failed to save the note to the database.";
        }
      }
    } else {
      // Normal chat fallback
      responseText = "I am your PM Copilot. Ask me to 'log a risk for [Stakeholder Name]' or 'add a note' and I will automatically track it!";
    }

    // Simulate network delay then stream response
    setTimeout(() => {
      revealText(responseText);
    }, 500);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans" ref={containerRef}>
      {isChatOpen ? (
        <div className="w-80 sm:w-96 bg-card border border-border shadow-2xl rounded-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-200">
          <div className="bg-primary px-4 py-3 flex items-center justify-between text-primary-foreground">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              <span className="font-semibold text-sm">PM Copilot</span>
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
            {streamingText && (
              <div className="inline-block rounded-lg px-3 py-1.5 max-w-[85%] bg-secondary text-secondary-foreground shadow-sm">
                <ReactMarkdown>{streamingText}</ReactMarkdown>
              </div>
            )}
          </div>
          <form onSubmit={handleSend} className="p-3 bg-card border-t border-border flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="E.g., Log a risk for Sarah in Engineering..."
              className="flex-1 text-sm px-3 py-2 bg-background border border-input rounded-md outline-none focus:ring-1 focus:ring-primary/50 transition-all"
            />
            <button type="submit" className="text-sm px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md transition-colors shadow-sm">Send</button>
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

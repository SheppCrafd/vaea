import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Bot, Sparkles, HelpCircle, Smile, X, Plus, ChevronLeft, Paperclip } from "lucide-react";
import { base44 } from "@/api/base44Client";
import Portal from "@/lib/Portal";
import { usePositionedMenu } from "@/hooks/usePositionedMenu";
import { useCreateChatSession } from "@/hooks/useChatSessions";
import { useChatMessages, useCreateChatMessage, useUpdateChatMessage } from "@/hooks/useChatMessages";
import ChatMessageList from "@/components/ai/ChatMessageList";
import ChatSessionList from "@/components/ai/ChatSessionList";

const ICON_OPTIONS = [
  { key: "message-circle", Icon: MessageCircle },
  { key: "bot", Icon: Bot },
  { key: "sparkles", Icon: Sparkles },
  { key: "help-circle", Icon: HelpCircle },
  { key: "smile", Icon: Smile },
];

const ICON_STORAGE_KEY = "portfolio_tracker_chat_icon";
const SESSION_STORAGE_KEY = "portfolio_tracker_chat_active_session";

// Query keys that can change as a result of an AI-driven mutation — kept
// broad and invalidated in bulk after any successful action, since chat
// mutations bypass the individual entity hooks and their per-key
// invalidation logic.
const APP_QUERY_KEYS = [
  "areas", "products", "projects", "tasks", "allTasks", "archivedTasks",
  "stakeholders", "projectNotes", "allProjectNotes", "archivedProjects", "project",
];

function loadIconChoice() {
  try {
    return JSON.parse(localStorage.getItem(ICON_STORAGE_KEY)) || { key: "message-circle" };
  } catch {
    return { key: "message-circle" };
  }
}

export default function ChatBox({ activeProjectId }) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSessionListOpen, setIsSessionListOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isComputing, setIsComputing] = useState(false);
  const [attachedFile, setAttachedFile] = useState(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [iconChoice, setIconChoice] = useState(loadIconChoice);
  const [resolvingId, setResolvingId] = useState(null);
  const [actionHistory, setActionHistory] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(() => localStorage.getItem(SESSION_STORAGE_KEY) || null);

  const containerRef = useRef(null);
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  const iconPicker = usePositionedMenu();
  const createSession = useCreateChatSession();
  const chatState = useChatMessages(activeSessionId);
  const createMessage = useCreateChatMessage();
  const updateMessage = useUpdateChatMessage();

  useEffect(() => {
    const handleClickOutside = (e) => {
      // The icon picker and session list render in a Portal (outside this
      // container's DOM subtree), so skip the outside-click close while
      // either is open — otherwise clicking them would close the whole
      // chat panel before their own click handler ever runs.
      if (iconPicker.isOpen || isSessionListOpen) return;
      if (containerRef.current && !containerRef.current.contains(e.target)) setIsChatOpen(false);
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [iconPicker.isOpen, isSessionListOpen]);

  const invalidateAppQueries = () => {
    APP_QUERY_KEYS.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
  };

  const chooseIcon = (choice) => {
    setIconChoice(choice);
    localStorage.setItem(ICON_STORAGE_KEY, JSON.stringify(choice));
    iconPicker.close();
  };

  const renderIcon = (className) => {
    if (iconChoice.emoji) return <span className={className}>{iconChoice.emoji}</span>;
    const match = ICON_OPTIONS.find((o) => o.key === iconChoice.key) || ICON_OPTIONS[0];
    const Icon = match.Icon;
    return <Icon className={className} />;
  };

  const ensureSession = async () => {
    if (activeSessionId) return activeSessionId;
    const session = await createSession.mutateAsync({ title: input.trim().slice(0, 40) || "New chat" });
    setActiveSessionId(session.id);
    localStorage.setItem(SESSION_STORAGE_KEY, session.id);
    return session.id;
  };

  const handleSelectSession = (id) => {
    setActiveSessionId(id);
    localStorage.setItem(SESSION_STORAGE_KEY, id);
    setIsSessionListOpen(false);
  };

  const handleNewChat = () => {
    setActiveSessionId(null);
    localStorage.removeItem(SESSION_STORAGE_KEY);
    setIsSessionListOpen(false);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingAttachment(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setAttachedFile({ name: file.name, url: file_url });
    } finally {
      setIsUploadingAttachment(false);
      e.target.value = "";
    }
  };

  const invokeAssistant = async (payload) => {
    const res = await base44.functions.invoke("aiChatStream", payload);
    if (res.data?.error) throw new Error(res.data.error);
    return res.data;
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() && !attachedFile) return;

    const sessionId = await ensureSession();
    const userText = attachedFile
      ? `${input.trim()}${input.trim() ? "\n\n" : ""}[Attached: ${attachedFile.name}](${attachedFile.url})`
      : input.trim();

    setInput("");
    setAttachedFile(null);
    await createMessage.mutateAsync({ session_id: sessionId, role: "user", content: userText });
    setIsComputing(true);

    try {
      const conversationHistory = (chatState.data || [])
        .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
        .join("\n");

      const data = await invokeAssistant({ message: userText, conversationHistory, activeProjectId });

      if (data.action === "UNDO_LAST_ACTION") {
        await runUndo(sessionId);
        await createMessage.mutateAsync({ session_id: sessionId, role: "assistant", content: data.reply });
        return;
      }

      if (data.pending_action) {
        await createMessage.mutateAsync({ session_id: sessionId, role: "assistant", content: data.reply, pending_action: data.pending_action });
        return;
      }

      if (data.toolResult?.undo) {
        setActionHistory((prev) => [...prev, data.toolResult.undo]);
      }

      await createMessage.mutateAsync({ session_id: sessionId, role: "assistant", content: data.reply });
      if (data.action) invalidateAppQueries();
    } catch (error) {
      await createMessage.mutateAsync({ session_id: sessionId, role: "assistant", content: `⚠️ Error: ${error.message}` });
    } finally {
      setIsComputing(false);
    }
  };

  const runUndo = async (sessionId) => {
    const last = actionHistory[actionHistory.length - 1];
    if (!last) return;
    setActionHistory((prev) => prev.slice(0, -1));
    const { type, ...args } = last;
    try {
      await invokeAssistant({ confirmedAction: { action: type, args, confirmMessage: "Undone." } });
      invalidateAppQueries();
    } catch {
      // best-effort — surfaced via the assistant's own reply already
    }
  };

  const handleConfirm = async (message) => {
    setResolvingId(message.id);
    setIsComputing(true);
    try {
      const data = await invokeAssistant({ confirmedAction: message.pending_action });
      await updateMessage.mutateAsync({ id: message.id, data: { session_id: message.session_id, pending_action: null } });
      await createMessage.mutateAsync({ session_id: message.session_id, role: "assistant", content: data.reply || "Done." });
      invalidateAppQueries();
    } catch (error) {
      await createMessage.mutateAsync({ session_id: message.session_id, role: "assistant", content: `⚠️ Couldn't complete that: ${error.message}` });
    } finally {
      setIsComputing(false);
      setResolvingId(null);
    }
  };

  const handleCancel = async (message) => {
    setResolvingId(message.id);
    try {
      await updateMessage.mutateAsync({ id: message.id, data: { session_id: message.session_id, pending_action: null } });
      await createMessage.mutateAsync({ session_id: message.session_id, role: "assistant", content: "Okay, cancelled." });
    } finally {
      setResolvingId(null);
    }
  };

  const triggerAnimation = isComputing ? "animate-bounce" : "";

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans" ref={containerRef}>
      {isChatOpen ? (
        <div className="w-80 sm:w-96 bg-card border border-border shadow-2xl rounded-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-200">
          <div className="bg-primary px-4 py-3 flex items-center justify-between text-primary-foreground">
            <div className="flex flex-col items-start gap-0.5">
              <button
                ref={iconPicker.triggerRef}
                onClick={iconPicker.toggle}
                className={`flex items-center gap-2 ${triggerAnimation}`}
                aria-label="Choose chat icon"
              >
                {renderIcon("w-5 h-5")}
                <span className="font-semibold text-sm">PM Copilot</span>
              </button>
              <button
                onClick={() => setIsSessionListOpen((v) => !v)}
                aria-label="Chat history"
                className="text-primary-foreground/70 hover:text-primary-foreground -mt-0.5"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </div>
            <button onClick={() => setIsChatOpen(false)} aria-label="Collapse chat" className="text-primary-foreground/80 hover:text-primary-foreground transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <ChatMessageList
            messages={chatState.messages}
            isComputing={isComputing}
            hasMore={chatState.hasMore}
            onLoadMore={chatState.loadMore}
            resolvingId={resolvingId}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
          />

          {attachedFile && (
            <div className="px-3 pt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Paperclip className="w-3 h-3" />
              {attachedFile.name}
              <button onClick={() => setAttachedFile(null)} className="text-destructive/80 hover:text-destructive">×</button>
            </div>
          )}

          <form onSubmit={handleSend} className="p-3 bg-card border-t border-border flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingAttachment}
              aria-label="Add attachment"
              className="shrink-0 p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary transition-colors disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
            </button>
            <input ref={fileInputRef} type="file" onChange={handleFileChange} className="hidden" />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="E.g., Hello... / PLease add... / File a report for..."
              className="flex-1 text-sm px-3 py-2 bg-background border border-input rounded-md outline-none focus:ring-1 focus:ring-primary/50 transition-all"
              disabled={isComputing}
            />
            <button type="submit" disabled={isComputing} className="shrink-0 text-sm px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md transition-colors shadow-sm disabled:opacity-50">
              Send
            </button>
          </form>
        </div>
      ) : (
        <button
          onClick={() => setIsChatOpen(true)}
          className={`w-14 h-14 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 ${triggerAnimation}`}
        >
          {renderIcon("w-6 h-6")}
        </button>
      )}

      {iconPicker.isOpen && (
        <Portal>
          <div className="fixed inset-0 z-[9999]" onClick={iconPicker.close}>
            <div
              className="fixed bg-card border border-border rounded-lg shadow-2xl p-2 flex flex-col gap-2"
              style={{ top: iconPicker.coords.top, left: iconPicker.coords.left }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex gap-1">
                {ICON_OPTIONS.map(({ key, Icon }) => (
                  <button
                    key={key}
                    onClick={() => chooseIcon({ key })}
                    className={`p-1.5 rounded-md hover:bg-secondary ${iconChoice.key === key && !iconChoice.emoji ? "bg-secondary" : ""}`}
                    aria-label={key}
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const value = e.target.elements.emoji.value.trim();
                  if (value) chooseIcon({ emoji: value.slice(0, 2) });
                }}
                className="flex gap-1"
              >
                <input name="emoji" placeholder="or type an emoji" maxLength={2} className="w-28 text-xs px-2 py-1 bg-background border border-input rounded outline-none" />
                <button type="submit" className="text-xs px-2 py-1 bg-secondary text-secondary-foreground rounded">Use</button>
              </form>
            </div>
          </div>
        </Portal>
      )}

      {isSessionListOpen && (
        <ChatSessionList
          activeSessionId={activeSessionId}
          onSelect={handleSelectSession}
          onNewChat={handleNewChat}
          onDeleted={handleNewChat}
          onClose={() => setIsSessionListOpen(false)}
        />
      )}
    </div>
  );
}

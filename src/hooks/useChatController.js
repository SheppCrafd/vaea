import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Bot, Sparkles, HelpCircle, Smile } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { usePositionedMenu } from "@/hooks/usePositionedMenu";
import { useCreateChatSession } from "@/hooks/useChatSessions";
import { useChatMessages, useCreateChatMessage, useUpdateChatMessage } from "@/hooks/useChatMessages";

// Icon component references only (no JSX here) so this can stay a plain .js
// module — actual rendering happens in ChatIcon.jsx.
export const CHAT_ICON_OPTIONS = [
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

// localStorage can throw on read or write (private-browsing storage
// restrictions, quota errors, storage disabled/blocked in an embedded
// iframe, etc.) — real conditions, not just theoretical. This hook's state
// initializers run at mount time, and since ChatBox is a persistent widget
// that's designed to never unmount during normal use, mount only actually
// happens on a hard refresh (or some other full remount) — so an unguarded
// throw here doesn't surface in everyday use, it surfaces as the chat
// widget silently failing to render the moment the page reloads. Guarding
// every access (matching the pattern already used for geometry/icon reads
// elsewhere in this file) keeps a storage failure from ever taking the
// widget down with it.
function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // best-effort — the choice just won't survive a reload
  }
}

function removeStorage(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // best-effort
  }
}

function loadIconChoice() {
  try {
    return JSON.parse(readStorage(ICON_STORAGE_KEY)) || { key: "message-circle" };
  } catch {
    return { key: "message-circle" };
  }
}

// Shared brains for the chat experience — session management, sending and
// confirming/undoing assistant actions, icon persistence, attachments. Both
// the floating chat widget (ChatBox) and the full-page chat (ChatPage) use
// this; each owns only its own layout and open/closed chrome around it, so
// there's exactly one implementation of "how chat works."
export function useChatController({ activeProjectId } = {}) {
  const [input, setInput] = useState("");
  const [isComputing, setIsComputing] = useState(false);
  const [attachedFile, setAttachedFile] = useState(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [iconChoice, setIconChoice] = useState(loadIconChoice);
  const [resolvingId, setResolvingId] = useState(null);
  const [actionHistory, setActionHistory] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(() => readStorage(SESSION_STORAGE_KEY));

  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  const iconPicker = usePositionedMenu();
  const createSession = useCreateChatSession();
  const chatState = useChatMessages(activeSessionId);
  const createMessage = useCreateChatMessage();
  const updateMessage = useUpdateChatMessage();

  const invalidateAppQueries = () => {
    APP_QUERY_KEYS.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
  };

  const chooseIcon = (choice) => {
    setIconChoice(choice);
    writeStorage(ICON_STORAGE_KEY, JSON.stringify(choice));
    iconPicker.close();
  };

  const ensureSession = async () => {
    if (activeSessionId) return activeSessionId;
    const session = await createSession.mutateAsync({ title: input.trim().slice(0, 40) || "New chat" });
    setActiveSessionId(session.id);
    writeStorage(SESSION_STORAGE_KEY, session.id);
    return session.id;
  };

  const handleSelectSession = (id) => {
    setActiveSessionId(id);
    writeStorage(SESSION_STORAGE_KEY, id);
  };

  const handleNewChat = () => {
    setActiveSessionId(null);
    removeStorage(SESSION_STORAGE_KEY);
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

  const runUndo = async () => {
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
      const conversationHistory = (chatState.messages || [])
        .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
        .join("\n");

      const data = await invokeAssistant({ message: userText, conversationHistory, activeProjectId });

      if (data.action === "UNDO_LAST_ACTION") {
        await runUndo();
        await createMessage.mutateAsync({ session_id: sessionId, role: "assistant", content: data.reply });
        return;
      }

      if (data.pending_action) {
        await createMessage.mutateAsync({ session_id: sessionId, role: "assistant", content: data.reply, pending_action: data.pending_action });
        return;
      }

      // A response can now carry a whole plan's worth of steps (mass
      // populate/delete) instead of just one — collect every step's undo
      // info, if any, so each stays individually undoable via
      // UNDO_LAST_ACTION (which only ever pops the single most recent one).
      const undos = (data.results || []).map((r) => r.toolResult?.undo).filter(Boolean);
      if (undos.length) {
        setActionHistory((prev) => [...prev, ...undos]);
      }

      await createMessage.mutateAsync({ session_id: sessionId, role: "assistant", content: data.reply });
      if (data.action) invalidateAppQueries();
    } catch (error) {
      await createMessage.mutateAsync({ session_id: sessionId, role: "assistant", content: `⚠️ Error: ${error.message}` });
    } finally {
      setIsComputing(false);
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

  return {
    input, setInput,
    isComputing,
    attachedFile, setAttachedFile,
    isUploadingAttachment,
    iconChoice, chooseIcon,
    resolvingId,
    activeSessionId,
    fileInputRef,
    iconPicker,
    chatState,
    handleSelectSession,
    handleNewChat,
    handleFileChange,
    handleSend,
    handleConfirm,
    handleCancel,
  };
}

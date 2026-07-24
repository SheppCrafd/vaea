import { useEffect, useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Bot, Sparkles, HelpCircle, Smile } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { localDb } from "@/lib/localDb";
import { executeAction, executeActionSequence, DESTRUCTIVE_ACTIONS, NON_EXECUTABLE_ACTIONS } from "@/lib/chatActions";
import { loadAiIdentity, DEFAULTS as IDENTITY_DEFAULTS } from "@/lib/aiPreferences";
import { loadVaultConnection } from "@/lib/vaultConnection";
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

const ICON_STORAGE_KEY = "vaea_chat_icon";
const SESSION_STORAGE_KEY = "vaea_chat_active_session";

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
  const [aiIdentity, setAiIdentity] = useState(IDENTITY_DEFAULTS);
  const [authPromptVisible, setAuthPromptVisible] = useState(false);

  useEffect(() => {
    loadAiIdentity().then(setAiIdentity);
  }, []);

  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  const iconPicker = usePositionedMenu();
  const createSession = useCreateChatSession();
  const chatState = useChatMessages(activeSessionId);
  const createMessage = useCreateChatMessage();
  const updateMessage = useUpdateChatMessage();

  const invalidateAppQueries = async () => {
    APP_QUERY_KEYS.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
    // SET_AI_IDENTITY writes straight through deviceStorage (chatActions.js),
    // same as every other action — re-read it so the header's displayed name
    // updates immediately after "/setup" runs, not just on next reload.
    setAiIdentity(await loadAiIdentity());
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

  // aiChatStream only ever decides a plan now — it never touches your data.
  // Your current local dataset is sent along with the message so the LLM
  // can see it, and the returned actions are executed here, against
  // localDb, via chatActions.js. Nothing about your projects/tasks/etc. is
  // ever written back to Base44.
  const invokeAssistant = async (payload) => {
    const [areas, products, projects, allTasks, stakeholders, departments, notes] = await Promise.all([
      localDb.areas.list(),
      localDb.products.list(),
      localDb.projects.list(),
      localDb.tasks.list(),
      localDb.stakeholders.list(),
      localDb.departments.list(),
      localDb.projectNotes.list(),
    ]);
    const projectsActive = projects.filter((p) => !p.is_archived && !p.deleted_at);
    const archivedProjects = projects.filter((p) => p.is_archived && !p.deleted_at);
    const tasks = allTasks.filter((t) => !t.archived_at && !t.deleted_at);
    const archivedTasks = allTasks.filter((t) => t.archived_at && !t.deleted_at);

    try {
      // base44.functions.invoke() runs on its own axios client, created with
      // interceptResponses: false (see @base44/sdk/dist/client.js) — unlike
      // every other SDK module, function calls never get unwrapped to their
      // body or transformed into a Base44Error. `response` here is the full
      // axios envelope, so the actual `{reply, actions}` is response.data.
      const response = await base44.functions.invoke("aiChatStream", {
        ...payload,
        aiIdentity: await loadAiIdentity(),
        // Sent transiently, per-request, so the vault_* tools can use it for
        // this one turn — never stored server-side, same guarantee as the
        // rest of this payload (see ExternalVaultSection.jsx's disclosure).
        externalVault: await loadVaultConnection(),
        areas: areas.filter((a) => !a.deleted_at),
        products: products.filter((p) => !p.deleted_at),
        projects: projectsActive,
        archivedProjects,
        tasks,
        archivedTasks,
        stakeholders: stakeholders.filter((s) => !s.deleted_at),
        departments: departments.filter((d) => !d.deleted_at),
        notes,
      });
      return response.data;
    } catch (error) {
      // Same reason as above: this rejects as a plain AxiosError (no
      // interceptor to transform it into a Base44Error), so the body our
      // function actually returned on a non-2xx response — `{ error:
      // error.message }` — lives at error.response.data, not error.data.
      const serverMessage = error.response?.data?.error;
      throw new Error(serverMessage || error.message);
    }
  };

  const runUndo = async () => {
    const last = actionHistory[actionHistory.length - 1];
    if (!last) return;
    setActionHistory((prev) => prev.slice(0, -1));
    const { type, ...args } = last;
    try {
      await executeAction(type, args);
      await invalidateAppQueries();
    } catch {
      // best-effort — surfaced via the assistant's own reply already
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() && !attachedFile) return;

    // ensureSession()/the user-message create both hit Base44's hosted
    // ChatSession/ChatMessage entities, which RLS denies for an anonymous
    // visitor (this app runs with requiresAuth: false so the dashboard
    // itself stays usable while logged out — see AuthContext.jsx). Both
    // calls used to sit outside any try/catch here, so that denial surfaced
    // as an uncaught promise rejection: no message in the thread, no
    // feedback at all, input box silently keeps its text. Catch it and show
    // the same real chat bubble + sign-in prompt a mid-conversation auth
    // failure gets below.
    let sessionId;
    const userText = attachedFile
      ? `${input.trim()}${input.trim() ? "\n\n" : ""}[Attached: ${attachedFile.name}](${attachedFile.url})`
      : input.trim();
    try {
      sessionId = await ensureSession();
      setInput("");
      setAttachedFile(null);
      await createMessage.mutateAsync({ session_id: sessionId, role: "user", content: userText });
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        setAuthPromptVisible(true);
      }
      return;
    }
    setIsComputing(true);

    try {
      const conversationHistory = (chatState.messages || [])
        .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
        .join("\n");

      const data = await invokeAssistant({ message: userText, conversationHistory, activeProjectId });
      // ChatMessage.content is a required field on Base44's side — never
      // forward a falsy reply from aiChatStream (a stale deploy, a model
      // hiccup) straight into a create call, or the write gets rejected
      // with a 422 ("Field required") instead of showing the user anything.
      const reply = data.reply || "Done.";
      const actions = data.actions || [];

      if (actions.length === 0 || actions.every((a) => NON_EXECUTABLE_ACTIONS.has(a.action))) {
        if (actions[0]?.action === "UNDO_LAST_ACTION") {
          await runUndo();
        }
        await createMessage.mutateAsync({ session_id: sessionId, role: "assistant", content: reply });
        return;
      }

      const executable = actions.filter((a) => !NON_EXECUTABLE_ACTIONS.has(a.action));

      if (executable.some((a) => DESTRUCTIVE_ACTIONS.has(a.action))) {
        await createMessage.mutateAsync({
          session_id: sessionId, role: "assistant", content: reply,
          pending_action: { actions: executable, confirmMessage: reply },
        });
        return;
      }

      const results = await executeActionSequence(executable);
      // A response can carry a whole plan's worth of steps (mass
      // populate/delete) instead of just one — collect every step's undo
      // info, if any, so each stays individually undoable via
      // UNDO_LAST_ACTION (which only ever pops the single most recent one).
      const undos = results.map((r) => r.toolResult?.undo).filter(Boolean);
      if (undos.length) {
        setActionHistory((prev) => [...prev, ...undos]);
      }

      await createMessage.mutateAsync({ session_id: sessionId, role: "assistant", content: reply });
      await invalidateAppQueries();
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
      await executeActionSequence(message.pending_action.actions);
      // ChatMessage's `content`/`role` are required fields, and Base44
      // validates an update against the entity's full required-field list,
      // not just the keys being changed — a payload that only clears
      // `pending_action` gets rejected with "Field required". Carry the
      // message's existing values through so nothing's missing.
      await updateMessage.mutateAsync({ id: message.id, data: { session_id: message.session_id, role: message.role, content: message.content, pending_action: null } });
      await createMessage.mutateAsync({ session_id: message.session_id, role: "assistant", content: message.pending_action.confirmMessage || "Done." });
      await invalidateAppQueries();
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
      await updateMessage.mutateAsync({ id: message.id, data: { session_id: message.session_id, role: message.role, content: message.content, pending_action: null } });
      await createMessage.mutateAsync({ session_id: message.session_id, role: "assistant", content: "Okay, cancelled." });
    } finally {
      setResolvingId(null);
    }
  };

  const dismissAuthPrompt = () => setAuthPromptVisible(false);
  // redirectToLogin() targets Base44's hosted /login page route, which
  // doesn't work for this app's deployment (see LoginScreen.jsx) —
  // loginWithProvider() hits a real API route instead. One-click Google
  // default, since this is a small inline recovery prompt, not the full
  // provider/email picker LoginScreen shows for the main auth gate.
  const signInForChat = () => base44.auth.loginWithProvider('google', window.location.pathname + window.location.search);

  return {
    input, setInput,
    isComputing,
    aiIdentity,
    attachedFile, setAttachedFile,
    isUploadingAttachment,
    iconChoice, chooseIcon,
    resolvingId,
    activeSessionId,
    fileInputRef,
    iconPicker,
    authPromptVisible,
    dismissAuthPrompt,
    signInForChat,
    chatState,
    handleSelectSession,
    handleNewChat,
    handleFileChange,
    handleSend,
    handleConfirm,
    handleCancel,
  };
}

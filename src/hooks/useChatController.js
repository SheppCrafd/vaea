import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Bot, Sparkles, HelpCircle, Smile } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { localDb } from "@/lib/localDb";
import { executeAction, executeActionSequence, describeToolCall, describePlan, stripToolLog, DESTRUCTIVE_ACTIONS, NON_EXECUTABLE_ACTIONS } from "@/lib/chatActions";
import { loadAiIdentity, DEFAULTS as IDENTITY_DEFAULTS } from "@/lib/aiPreferences";
import { loadAiProviderConfig, isByokConfigured, isLocalBridgeConfigured } from "@/lib/aiProviderConfig";
import { runByokChat } from "@/lib/llm/byokChat";
import { readNdjson } from "@/lib/llm/streamUtils";
import { loadVaultConnection, isVaultConnected } from "@/lib/vaultConnection";
import { fetchVaultOverview } from "@/lib/githubApi";
import { matchesProtocolTrigger } from "@/lib/protocolReminder";
import { usePositionedMenu } from "@/hooks/usePositionedMenu";
import { useCreateChatSession } from "@/hooks/useChatSessions";
import { useChatMessages, useCreateChatMessage, useUpdateChatMessage } from "@/hooks/useChatMessages";
import { useAiIdentity } from "@/hooks/useAiIdentity";

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
  "stakeholders", "departments", "projectNotes", "allProjectNotes", "archivedProjects", "project",
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

// A short, deliberate pause between revealing each live step — local
// execution against localDb finishes in well under a frame, too fast to
// read as "happening" at all without this. Only applied up to a handful of
// steps; a bulk plan (CSV import's own action lists, BULK_CREATE) shouldn't
// force a multi-second wait just to be watchable.
const STEP_REVEAL_DELAY_MS = 150;
const MAX_PACED_STEPS = 6;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// `lines` (live tool calls, the plan tally, each executed step) lead, in
// the same order they actually happened and the same order their own live
// reveal (liveSteps) already showed them — the reply follows as the
// plain-English wrap-up. No lines at all (a plain reply with nothing
// behind it) means no tool-log block — most conversational replies.
function buildLoggedContent(reply, lines) {
  return lines.length ? `\`\`\`tool-log\n${lines.join("\n")}\n\`\`\`\n\n${reply}` : reply;
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
  // Lines shown live while a plan runs — the "plan · ..." line, then one
  // "tool call · fn(...)" per step as it actually finishes (see
  // executeActionSequence's onStep). Cleared once the final message
  // (which carries the same lines, permanently) is created.
  const [liveSteps, setLiveSteps] = useState([]);
  // The model's own narration, growing live as thinking-delta events arrive
  // (invokeAssistant's onEvent) — real streaming for base44-hosted/BYOK, a
  // paced simulation for Backdoor Mode (see byokChat.js's simulateLiveReveal).
  // Reset to "" at the start of each send; once it holds anything, the final
  // message (which carries the same text, permanently, as its `reply`)
  // skips the typewriter — it was already shown appearing, live.
  const [streamingText, setStreamingText] = useState("");
  const [activeSessionId, setActiveSessionId] = useState(() => readStorage(SESSION_STORAGE_KEY));
  // Cached via react-query (useAiIdentity.js) rather than local state read
  // once on mount — this is what lets a name saved in Settings reach an
  // already-mounted chat header immediately, instead of only after a reload.
  const { data: aiIdentity = IDENTITY_DEFAULTS } = useAiIdentity();
  const [authPromptVisible, setAuthPromptVisible] = useState(false);
  // IDs of assistant messages actually created during this mounted session's
  // live send/confirm/cancel flow — ChatMessageList uses this to type out
  // only a message that just arrived, never one loaded from chat history on
  // mount (this state starts empty on every fresh mount, so history is never
  // retroactively marked "new").
  const [newMessageIds, setNewMessageIds] = useState(() => new Set());
  const markMessageNew = (id) => {
    if (!id) return;
    setNewMessageIds((prev) => new Set(prev).add(id));
  };

  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();
  // Force-loaded vault context (vault.md-style summary, priority-marked
  // notes, recently-touched notes — see githubApi.js's fetchVaultOverview)
  // fetched once per chat session, not once per message; a real GitHub
  // crawl isn't free, and the whole point is matching a Claude Code
  // SessionStart hook's "fires once per session" shape, not re-running it
  // on every turn. Keyed by session id so a brand new session (or coming
  // back to this ref after switching sessions) refetches, but sending a
  // second message in the same session reuses the cached copy.
  const vaultOverviewCacheRef = useRef({ sessionId: null, overview: null });

  const iconPicker = usePositionedMenu();
  const createSession = useCreateChatSession();
  const chatState = useChatMessages(activeSessionId);
  const createMessage = useCreateChatMessage();
  const updateMessage = useUpdateChatMessage();

  const invalidateAppQueries = async () => {
    APP_QUERY_KEYS.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
    // SET_AI_IDENTITY writes straight through deviceStorage (chatActions.js),
    // same as every other action — invalidate the cached identity so the
    // header's displayed name updates immediately after "/setup" runs, not
    // just on next reload.
    queryClient.invalidateQueries({ queryKey: ["aiIdentity"] });
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
  // ever written back to Base44. `onEvent`, if provided, fires live as the
  // model's own narration and any live tool call actually happen (real
  // streaming for base44-hosted/BYOK, a paced simulation for Backdoor Mode —
  // see byokChat.js) — always resolves to the same {reply, actions,
  // liveTrace} shape regardless.
  const invokeAssistant = async (payload, onEvent) => {
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

    // Settings -> AI Model: if the user brought their own provider key, the
    // plan is decided entirely client-side (src/lib/llm/byokChat.js) —
    // straight from this browser to that provider's own API, never through
    // Base44. Same {reply, actions} contract either way, so nothing past
    // this point (chatActions.js, confirm/undo, tool-log rendering) needs
    // to know or care which path answered.
    const providerConfig = await loadAiProviderConfig();
    if (isByokConfigured(providerConfig) || isLocalBridgeConfigured(providerConfig)) {
      return runByokChat({
        providerConfig,
        onEvent,
        contextArgs: {
          activeProjectId: payload.activeProjectId,
          userText: payload.message,
          conversationHistory: payload.conversationHistory,
          aiIdentity: await loadAiIdentity(),
          protocolReminderRequested: payload.protocolReminderRequested,
          areas: areas.filter((a) => !a.deleted_at),
          products: products.filter((p) => !p.deleted_at),
          projects: projectsActive,
          archivedProjects,
          tasks,
          archivedTasks,
          stakeholders: stakeholders.filter((s) => !s.deleted_at),
          departments: departments.filter((d) => !d.deleted_at),
          notes,
        },
      });
    }

    const externalVault = await loadVaultConnection();

    // Force-loaded vault context — the Vaea analog of a Claude Code CLI's
    // own SessionStart hook (see [[Claude Code Vault System]] in the
    // connected vault itself, if this is that vault): fetched once per
    // session and cached, not once per message. GitHub calls happen here,
    // client-side, using the same locally-stored token every other vault
    // read/write already trusts (see githubApi.js) — never server-side, and
    // best-effort throughout, so a fetch failure just means less context,
    // never a visible error.
    let vaultOverview = null;
    if (isVaultConnected(externalVault)) {
      if (vaultOverviewCacheRef.current.sessionId === payload.sessionId) {
        vaultOverview = vaultOverviewCacheRef.current.overview;
      } else {
        vaultOverview = await fetchVaultOverview(externalVault).catch(() => null);
        vaultOverviewCacheRef.current = { sessionId: payload.sessionId, overview: vaultOverview };
      }
    }

    // base44.functions.invoke() runs on its own axios client (interceptResponses:
    // false — see @base44/sdk/dist/client.js), buffered end-to-end: it can't
    // hand back anything before the whole response body exists, which is
    // exactly what a real-time "watch it think" stream needs to not be true.
    // functions.fetch() is the SDK's own documented sibling for this —
    // "streaming responses, like SSE" is its first listed use case — a plain
    // native fetch() with the same auth headers .invoke() uses, returning a
    // real Response whose body we read as it arrives.
    const response = await base44.functions.fetch("/aiChatStream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        aiIdentity: await loadAiIdentity(),
        // Sent transiently, per-request, so the vault_* tools can use it for
        // this one turn — never stored server-side, same guarantee as the
        // rest of this payload (see ExternalVaultSection.jsx's disclosure).
        externalVault,
        vaultOverview,
        // Mirrors the CLI's own UserPromptSubmit hook (see protocolReminder.js) —
        // decided client-side from the user's own just-typed message, not
        // re-derived here.
        protocolReminderRequested: payload.protocolReminderRequested,
        areas: areas.filter((a) => !a.deleted_at),
        products: products.filter((p) => !p.deleted_at),
        projects: projectsActive,
        archivedProjects,
        tasks,
        archivedTasks,
        stakeholders: stakeholders.filter((s) => !s.deleted_at),
        departments: departments.filter((d) => !d.deleted_at),
        notes,
      }),
    });

    if (!response.ok) {
      // A pre-flight failure (401 unauthenticated, 400 no message) is still
      // a normal JSON body, same shape as before streaming — entry.ts only
      // ever switches to its NDJSON stream once it's committed to a 200.
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || `Request failed (${response.status}).`);
    }

    let finalPayload = null;
    let streamError = null;
    await readNdjson(response, (event) => {
      if (event.type === "thinking-delta" || event.type === "tool-call") {
        onEvent?.(event);
      } else if (event.type === "done") {
        finalPayload = event;
      } else if (event.type === "error") {
        streamError = event.message;
      }
    });
    if (streamError) throw new Error(streamError);
    if (!finalPayload) throw new Error("The assistant's response ended unexpectedly.");
    return { reply: finalPayload.reply, reasoning: finalPayload.reasoning, actions: finalPayload.actions, liveTrace: finalPayload.liveTrace };
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
        .map((m) => `${m.role.toUpperCase()}: ${stripToolLog(m.content)}`)
        .join("\n");

      // Clean slate BEFORE invokeAssistant starts, not after — onEvent below
      // fires live, DURING that call, so liveSteps/streamingText need to
      // already be empty by the time the first event can possibly arrive,
      // not just once the whole response is back.
      setLiveSteps([]);
      setStreamingText("");
      // A plain closure variable, not state — read synchronously right
      // after invokeAssistant resolves to decide whether the final message
      // needs the typewriter treatment. (React state set inside onEvent
      // wouldn't be readable here without going stale — this function's own
      // `streamingText` binding is fixed to whatever it was when this
      // render's handleSend closure was created.)
      let liveThinkingShown = false;
      const onEvent = (event) => {
        if (event.type === "thinking-delta") {
          liveThinkingShown = true;
          setStreamingText((prev) => prev + event.text);
        } else if (event.type === "tool-call") {
          setLiveSteps((prev) => [...prev, event.label]);
        }
      };

      const data = await invokeAssistant({
        message: userText, conversationHistory, activeProjectId, sessionId,
        protocolReminderRequested: matchesProtocolTrigger(userText),
      }, onEvent);
      // ChatMessage.content is a required field on Base44's side — never
      // forward a falsy reply from aiChatStream (a stale deploy, a model
      // hiccup) straight into a create call, or the write gets rejected
      // with a 422 ("Field required") instead of showing the user anything.
      const reply = data.reply || "Done.";
      // The full multi-round narrative (deliberation included) — distinct
      // from `reply` (just the last round's own text) since a real user
      // caught these two being the exact same string: the plan line's own
      // modal used to show `reply` too, which is already fully visible in
      // the chat bubble right above it, making the click pointless. Falls
      // back to `reply` itself so a single-round turn (nothing to separate
      // out) or an old cached response shape still shows something.
      const reasoning = data.reasoning || reply;
      const actions = data.actions || [];
      // Read tools (web_search, analyze_attachment, read_project_link,
      // search_workspace, audit_workspace, the vault_* readers) already ran
      // for real, server/BYOK-side, during this same turn, and — via onEvent
      // above — were already shown live the instant each one finished, not
      // just discoverable once the whole response was back. liveTrace is
      // still persisted onto the final message below so every kind of thing
      // the assistant can do stays a real, clickable action line after a
      // reload too, not just the ones that write data.
      const liveTrace = data.liveTrace || [];
      // Skips markMessageNew (and so the typewriter) for the reply-bearing
      // message below when its text was already shown live via
      // streamingText — replaying the same text a second time, now via
      // typewriter, would just be a redundant re-animation of something the
      // user already watched appear. Falls back to the old
      // mark-as-new/typewriter treatment on the rare turn that streamed no
      // narration at all (e.g. a reply of just "Done.").
      const skipTypewriter = liveThinkingShown ? {} : { onSuccess: (created) => markMessageNew(created.id) };

      if (actions.length === 0 || actions.every((a) => NON_EXECUTABLE_ACTIONS.has(a.action))) {
        if (actions[0]?.action === "UNDO_LAST_ACTION") {
          await runUndo();
        }
        setLiveSteps([]);
        await createMessage.mutateAsync(
          {
            session_id: sessionId, role: "assistant",
            content: buildLoggedContent(reply, liveTrace.map((l) => l.label)),
            ...(liveTrace.length ? { tool_log_detail: { liveTrace } } : {}),
          },
          skipTypewriter
        );
        return;
      }

      const executable = actions.filter((a) => !NON_EXECUTABLE_ACTIONS.has(a.action));

      if (executable.some((a) => DESTRUCTIVE_ACTIONS.has(a.action))) {
        setLiveSteps([]);
        await createMessage.mutateAsync(
          {
            session_id: sessionId, role: "assistant",
            content: buildLoggedContent(reply, liveTrace.map((l) => l.label)),
            pending_action: { actions: executable },
            ...(liveTrace.length ? { tool_log_detail: { liveTrace } } : {}),
          },
          skipTypewriter
        );
        return;
      }

      // Any live tool calls already appeared live above (onEvent) — now the
      // plan, then each mutation as it actually runs — executeActionSequence's
      // onStep fires only once that step has really executed.
      // STEP_REVEAL_DELAY_MS just paces the *reveal* so a sub-frame localDb
      // write is still readable; it doesn't fake anything that didn't happen.
      setLiveSteps((prev) => [...prev, describePlan(executable)]);
      const paceReveal = executable.length <= MAX_PACED_STEPS;
      const results = await executeActionSequence(executable, {
        onStep: async (step) => {
          setLiveSteps((prev) => [...prev, describeToolCall(step)]);
          if (paceReveal) await sleep(STEP_REVEAL_DELAY_MS);
        },
      });
      // A response can carry a whole plan's worth of steps (mass
      // populate/delete) instead of just one — collect every step's undo
      // info, if any, so each stays individually undoable via
      // UNDO_LAST_ACTION (which only ever pops the single most recent one).
      const undos = results.map((r) => r.toolResult?.undo).filter(Boolean);
      if (undos.length) {
        setActionHistory((prev) => [...prev, ...undos]);
      }

      // A fenced ```tool-log block, parsed and styled by ChatMessageList —
      // the same live-reveal lines just shown, now persisted so they survive
      // a reload. tool_log_detail carries the real data behind each line
      // (each live call's own args/result, the plan's own actions/args, and
      // each step's resolved args + toolResult) so a line stays clickable to
      // reveal it verbatim. Trails the reply now, not leads it — the reply
      // is the assistant's own account of *why*, so it reads as the
      // headline; the tool-log is the concrete supporting detail underneath
      // it, the same relationship a commit summary has to its own diff.
      const toolLog = [...liveTrace.map((l) => l.label), describePlan(executable), ...results.map(describeToolCall)];
      const content = buildLoggedContent(reply, toolLog);
      setLiveSteps([]);
      await createMessage.mutateAsync(
        {
          session_id: sessionId, role: "assistant", content,
          // `reasoning` (the full multi-round narrative, NOT the same string
          // as `content`'s own `reply`) carried alongside the structured
          // plan/steps data so the plan line's own click-to-inspect modal
          // shows the model's real deliberation instead of either a
          // structured action breakdown or a pointless echo of what's
          // already visible in the chat bubble — see ChatToolLogDetail.jsx.
          tool_log_detail: { liveTrace, plan: executable, steps: results, reasoning },
        },
        skipTypewriter
      );
      await invalidateAppQueries();
    } catch (error) {
      // A session token that expired mid-conversation (session already
      // existed, so the earlier 401/403 check above never ran) used to fall
      // straight into the generic error bubble below — a confusing "⚠️
      // Error" instead of the same sign-in prompt that already handles this
      // exact case when it happens on the very first message.
      if (error.status === 401 || error.status === 403) {
        setAuthPromptVisible(true);
      } else {
        await createMessage.mutateAsync(
          { session_id: sessionId, role: "assistant", content: `⚠️ Error: ${error.message}` },
          { onSuccess: (created) => markMessageNew(created.id) }
        );
      }
    } finally {
      setIsComputing(false);
      setLiveSteps([]);
      setStreamingText("");
    }
  };

  const handleConfirm = async (message) => {
    const { actions } = message.pending_action;
    setResolvingId(message.id);
    setIsComputing(true);
    try {
      setLiveSteps([describePlan(actions)]);
      const paceReveal = actions.length <= MAX_PACED_STEPS;
      const results = await executeActionSequence(actions, {
        onStep: async (step) => {
          setLiveSteps((prev) => [...prev, describeToolCall(step)]);
          if (paceReveal) await sleep(STEP_REVEAL_DELAY_MS);
        },
      });
      // ChatMessage's `content`/`role` are required fields, and Base44
      // validates an update against the entity's full required-field list,
      // not just the keys being changed — a payload that only clears
      // `pending_action` gets rejected with "Field required". Carry the
      // message's existing values through so nothing's missing.
      await updateMessage.mutateAsync({ id: message.id, data: { session_id: message.session_id, role: message.role, content: message.content, pending_action: null } });
      // A distinct completion message with its own tool-log, not a repeat
      // of the pre-confirm `reply` text above it (that was the doubling bug
      // — confirmMessage used to just be that same `reply` string again).
      const toolLog = [describePlan(actions), ...results.map(describeToolCall)];
      setLiveSteps([]);
      await createMessage.mutateAsync(
        {
          session_id: message.session_id, role: "assistant", content: buildLoggedContent("Done.", toolLog),
          tool_log_detail: { plan: actions, steps: results },
        },
        { onSuccess: (created) => markMessageNew(created.id) }
      );
      await invalidateAppQueries();
    } catch (error) {
      // If executeActionSequence threw partway through (step 3 of 5 failed
      // validation, say), pending_action was never cleared below — the
      // message would keep rendering Confirm/Cancel, and clicking Confirm
      // again would re-run the *entire* actions array from the start,
      // re-executing whatever already succeeded (duplicate creates/updates).
      // Clear it here too so a partial failure can't be retried blindly;
      // the user can always ask the assistant to redo whatever's still
      // missing instead.
      try {
        await updateMessage.mutateAsync({ id: message.id, data: { session_id: message.session_id, role: message.role, content: message.content, pending_action: null } });
      } catch {
        // best-effort — worst case the message still shows stale
        // Confirm/Cancel buttons, no worse than before this fix
      }
      await createMessage.mutateAsync(
        { session_id: message.session_id, role: "assistant", content: `⚠️ Couldn't complete that: ${error.message}` },
        { onSuccess: (created) => markMessageNew(created.id) }
      );
    } finally {
      setIsComputing(false);
      setResolvingId(null);
      setLiveSteps([]);
    }
  };

  const handleCancel = async (message) => {
    setResolvingId(message.id);
    try {
      await updateMessage.mutateAsync({ id: message.id, data: { session_id: message.session_id, role: message.role, content: message.content, pending_action: null } });
      await createMessage.mutateAsync(
        { session_id: message.session_id, role: "assistant", content: "Okay, cancelled." },
        { onSuccess: (created) => markMessageNew(created.id) }
      );
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
    liveSteps,
    streamingText,
    newMessageIds,
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

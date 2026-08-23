import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { localDb } from "@/lib/localDb";
import { executeAction, executeActionSequence, describeToolCall, describePlan, stripToolLog, DESTRUCTIVE_ACTIONS, NON_EXECUTABLE_ACTIONS, filterReflectionActions } from "@/lib/chatActions";
import { loadAiIdentity, DEFAULTS as IDENTITY_DEFAULTS } from "@/lib/aiPreferences";
import { loadAiProviderConfig, isByokConfigured, isLocalBridgeConfigured } from "@/lib/aiProviderConfig";
import { runByokChat, resumeOrphanedLocalModeRequest } from "@/lib/llm/byokChat";
import { getPendingLocalModeRequest, clearPendingLocalModeRequest, getBridgeStatus, subscribeStatus } from "@/lib/llm/localBridgeStorage";
import { readNdjson, ROUND_BOUNDARY_MARKER } from "@/lib/llm/streamUtils";
import { loadVaultConnection, isVaultConnected } from "@/lib/vaultConnection";
import { loadGoogleWorkspaceConnection as loadCalendarConnection } from "@/lib/googleWorkspaceConnection";
import { loadGmailConnection } from "@/lib/gmailConnection";
import { loadMicrosoftConnection } from "@/lib/microsoftConnection";
import { loadOutlookConnection } from "@/lib/outlookConnection";
import { saveSnippet, findSnippet } from "@/lib/snippetsStore";
import { loadAgentBehavior } from "@/lib/agentBehaviorSettings";
import { loadSlackConnection } from "@/lib/slackConnection";
import { loadClickUpConnection } from "@/lib/clickupConnection";
import { fetchVaultOverview, SELF_NOTE_PATH } from "@/lib/githubApi";
import { gatherDreamTranscript } from "@/lib/dreamSummary";
import { stripUserNotesSection } from "@/lib/selfNote";
import { matchesProtocolTrigger } from "@/lib/protocolReminder";
import { usePositionedMenu } from "@/hooks/usePositionedMenu";
import { useCreateChatSession } from "@/hooks/useChatSessions";
import { useChatMessages, useCreateChatMessage, useUpdateChatMessage } from "@/hooks/useChatMessages";
import { useAiIdentity } from "@/hooks/useAiIdentity";
import { computeWorkspaceDelta, buildReflectionInstruction } from "@/lib/reflectionSummary";
import { runReflectionIfDue } from "@/lib/reflectionTrigger";
import { loadReflectionPreferences, saveReflectionPreferences, VAULT_TIDY_INTERVAL_MS, DREAM_INTERVAL_MS, VAULT_LOG_IDLE_MS } from "@/lib/reflectionPreferences";
import { loadAgents, saveAgents } from "@/lib/agentsStore";
import { buildAgentInstruction, getDueAgents } from "@/lib/agentRunner";
import { ICON_STORAGE_KEY, loadIconChoice } from "@/lib/chatIcon";
import { getNowContext } from "@/lib/nowContext";
import { useAppStore } from "@/lib/store";

const SESSION_STORAGE_KEY = "vaea_chat_active_session";

// Whenever a turn's pending (not-yet-confirmed) actions include a proposal
// to write a vault note, surface it visually instead of leaving it buried
// in a chat bubble: record the path(s) in the store (VaultGraph.jsx renders
// them as "new" nodes) and jump the user to the Mind Map's Vault tab so
// they actually see it land. No-op if nothing pending is a vault write.
function proposeVaultNotesIfAny(pendingActions) {
  const paths = (pendingActions || [])
    .filter((a) => a.action === "WRITE_VAULT_NOTE")
    .map((a) => a.args?.path)
    .filter(Boolean);
  if (!paths.length) return;
  useAppStore.getState().setPendingVaultProposals(paths);
  useAppStore.getState().openAppSection("/app/mindmap");
}

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
  // paced simulation for Local Mode (see byokChat.js's simulateLiveReveal).
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
  // Real, confirmed bug fixed here: nothing ever removed an id from
  // newMessageIds once its typewriter finished, and this Set lives on the
  // controller instance — which deliberately survives route navigation
  // (ChatControllerContext.jsx's whole reason for existing) even though the
  // rendered message *components* don't (React Router really does unmount
  // /app/chat on navigation away). So navigating off /chat and back
  // remounted every still-"new" message's row with fresh startedRef/
  // finishedRef, and ChatMessageList.jsx's useTypewriter replayed the whole
  // animation again — reported live as "errors always re-typewrite
  // whenever the user opens the chat again" (errors specifically noticed
  // first only because they're visually distinct, not because they're
  // special-cased anywhere; every message type has the same bug). Called
  // once a message's own typewriter genuinely finishes (see
  // ChatMessageList.jsx's onMessageTyped), not on every render.
  const clearNewMessage = (id) => {
    if (!id) return;
    setNewMessageIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };
  // The session id of a reflection-created check-in (see runReflectionTurn
  // below), if one exists and hasn't been opened yet. Deliberately NOT the
  // same as switching activeSessionId out from under the user the moment
  // it's created — if they already have chat open reading something else,
  // silently yanking them into a new conversation would be exactly the kind
  // of "does something without being asked" behavior this feature is
  // supposed to avoid. Instead this just flags that a new one exists; the
  // host (ChatBox/ChatPage) shows a small badge, and switching to it is a
  // real click via handleSelectSession, same as any other session.
  const [reflectionSessionId, setReflectionSessionId] = useState(null);

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
  // Mirrors activeSessionId for the idle-vault-log timer below, which reads
  // it from inside a setTimeout callback that can fire many minutes after
  // the render that armed it — a plain closure over the `activeSessionId`
  // state variable would see whatever it was AT ARM TIME, not whatever the
  // user has actually switched to by the time the hour is up.
  const activeSessionIdRef = useRef(activeSessionId);
  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);
  // Holds the pending idle-vault-log setTimeout, if one is armed — always
  // cleared before a new one is set (see armVaultLogTimer below), so at most
  // one is ever live. That's the actual guard against firing twice for the
  // same stretch of silence; there's no separate "already fired" flag to
  // keep in sync.
  const vaultLogTimerRef = useRef(null);
  useEffect(() => () => clearTimeout(vaultLogTimerRef.current), []);

  const iconPicker = usePositionedMenu();
  const createSession = useCreateChatSession();
  const chatState = useChatMessages(activeSessionId);
  const createMessage = useCreateChatMessage();
  const updateMessage = useUpdateChatMessage();

  // A real customer's Local Mode reply went permanently missing: they
  // navigated away while a human was still relaying the answer, and the
  // requestId that would have claimed the eventually-written response only
  // ever lived in one in-memory JS closure — gone the moment that
  // navigation happened, even though the answer sat right there on disk,
  // fully written, forever unread (localBridgeStorage.js's
  // savePendingLocalModeRequest has the full incident writeup). This is the
  // recovery half: whenever the Local Mode folder becomes connected
  // (on mount with an already-granted permission, or right after a manual
  // re-grant click), check for a leftover pointer and, if the answer is
  // sitting there, finish the exchange the same way a live send would —
  // via applyAssistantReply, defined below — instead of leaving it stranded
  // a second time.
  const resumingLocalModeRef = useRef(false);
  useEffect(() => {
    let cancelled = false;

    const attemptResume = async () => {
      if (cancelled || resumingLocalModeRef.current) return;
      const status = await getBridgeStatus();
      if (status !== "connected") return;
      const pending = await getPendingLocalModeRequest();
      if (!pending?.requestId || !pending?.sessionId) return;

      resumingLocalModeRef.current = true;
      try {
        // Only what byokChat.js's own `dataset` shape actually uses for a
        // tool call (matching runByokChat, which never includes departments
        // either) — round 0's system/tools (built from the FULL context,
        // departments included) are already sitting in the prompt file this
        // is resuming from, never regenerated here.
        const [areas, products, projects, allTasks, stakeholders, notes] = await Promise.all([
          localDb.areas.list(),
          localDb.products.list(),
          localDb.projects.list(),
          localDb.tasks.list(),
          localDb.stakeholders.list(),
          localDb.projectNotes.list(),
        ]);
        const externalVault = await loadVaultConnection();
        const result = await resumeOrphanedLocalModeRequest({
          requestId: pending.requestId,
          contextArgs: {
            areas: areas.filter((a) => !a.deleted_at),
            products: products.filter((p) => !p.deleted_at),
            projects: projects.filter((p) => !p.is_archived && !p.deleted_at),
            archivedProjects: projects.filter((p) => p.is_archived && !p.deleted_at),
            tasks: allTasks.filter((t) => !t.archived_at && !t.deleted_at),
            archivedTasks: allTasks.filter((t) => t.archived_at && !t.deleted_at),
            stakeholders: stakeholders.filter((s) => !s.deleted_at),
            notes,
            externalVault,
          },
        });
        if (!cancelled && result) {
          await applyAssistantReply(pending.sessionId, result, { onSuccess: (created) => markMessageNew(created.id) });
        }
        // Cleared on a definite outcome either way: a real reply just got
        // attached above, or resumeOrphanedLocalModeRequest returned null
        // because every round for this id was already archived (fully
        // resolved some other way already) — either way there's nothing
        // left to resume.
        await clearPendingLocalModeRequest();
      } catch {
        // A genuine transient failure (permission not actually granted yet,
        // folder briefly unreadable) — leave the pointer in place so the
        // next status change or reload gets another attempt, rather than
        // silently discarding a still-real pending request.
      } finally {
        resumingLocalModeRef.current = false;
      }
    };

    attemptResume();
    const unsubscribe = subscribeStatus(attemptResume);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

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

  // The reflection badge's click handler — switches into it like any other
  // session AND clears the badge, in one step, so it doesn't linger pointing
  // at a session the user is now already looking at.
  const openReflectionSession = () => {
    if (!reflectionSessionId) return;
    handleSelectSession(reflectionSessionId);
    setReflectionSessionId(null);
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
  // streaming for base44-hosted/BYOK, a paced simulation for Local Mode —
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

    // Vault connection + force-loaded overview — the Vaea analog of a Claude
    // Code CLI's own SessionStart hook (see [[Claude Code Vault System]] in
    // the connected vault itself, if this is that vault): fetched once per
    // session and cached, not once per message. GitHub calls happen here,
    // client-side, using the same locally-stored token every other vault
    // read/write already trusts (see githubApi.js) — never server-side, and
    // best-effort throughout, so a fetch failure just means less context,
    // never a visible error. Loaded for EVERY provider now, not just
    // base44-hosted — BYOK/Local Mode's own vault_* tools (localTools.js)
    // need externalVault just as much as entry.ts's server-side ones do.
    const externalVault = await loadVaultConnection();
    let vaultOverview = null;
    if (isVaultConnected(externalVault)) {
      if (vaultOverviewCacheRef.current.sessionId === payload.sessionId) {
        vaultOverview = vaultOverviewCacheRef.current.overview;
      } else {
        vaultOverview = await fetchVaultOverview(externalVault).catch(() => null);
        vaultOverviewCacheRef.current = { sessionId: payload.sessionId, overview: vaultOverview };
      }
    }

    // Same "sent transiently, per-request" trust model as externalVault
    // above — see calendarConnection.js. entry.ts refreshes the access
    // token server-side, per-request, from the refresh token if needed,
    // but never reports that refresh back here — harmless (the client's
    // own next refresh, if any, just runs one extra token exchange), and
    // avoids adding a side-channel to the {reply, actions} contract for it.
    const googleCalendar = await loadCalendarConnection();
    // Same trust model, same reasoning, as googleCalendar just above.
    const gmail = await loadGmailConnection();
    const microsoft = await loadMicrosoftConnection();
    const outlook = await loadOutlookConnection();
    const slack = await loadSlackConnection();
    // ClickUp's connection has no token-freshness concept at all (see
    // clickupConnection.js) — nothing to refresh-and-persist here, just a
    // plain read.
    const clickup = await loadClickUpConnection();

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
          sessionId: payload.sessionId,
          activeProjectId: payload.activeProjectId,
          userText: payload.message,
          conversationHistory: payload.conversationHistory,
          aiIdentity: await loadAiIdentity(),
          protocolReminderRequested: payload.protocolReminderRequested,
          externalVault,
          vaultOverview,
          googleCalendar,
          gmail,
          microsoft,
          outlook,
          slack,
          clickup,
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
        // The server (base44-hosted, Deno) has no way to know the user's
        // real local time/timezone on its own — see entry.ts's own
        // resolveNow() comment. Computed fresh per request, not cached,
        // since a long-open tab could otherwise send a stale time.
        clientNow: getNowContext(),
        // Sent transiently, per-request, so the vault_* tools can use it for
        // this one turn — never stored server-side, same guarantee as the
        // rest of this payload (see ExternalVaultSection.jsx's disclosure).
        externalVault,
        vaultOverview,
        googleCalendar,
        gmail,
        microsoft,
        outlook,
        slack,
        clickup,
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
      if (event.type === "thinking-delta" || event.type === "tool-call" || event.type === "round-boundary") {
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

  // A reflection-initiated turn: the assistant, not the user, opens a brand
  // new conversation with an opening message grounded in real deltas since
  // `sinceIso` (computeWorkspaceDelta — code-computed, never asked of the
  // model). Deliberately doesn't reuse ensureSession/handleSend: a
  // reflection needs a genuinely NEW session (not whatever the user was
  // last in) whose first message is role:"assistant". Real workspace data
  // (tasks/projects/etc.) stays fully un-mutable here, always — only
  // filterReflectionActions's narrow WRITE_VAULT_NOTE allowlist
  // (Vaea Self.md / today's Daily/ log) is allowed to actually run, via the
  // same executeActionSequence primitive a normal turn already uses;
  // everything else still goes straight into pending_action, no exceptions.
  // Every failure is swallowed — a reflection that can't complete must
  // never surface an error bubble or the sign-in prompt; the user never
  // asked for this turn, so it should simply not have happened, from their
  // perspective.
  const runReflectionTurn = async (sinceIso) => {
    const delta = await computeWorkspaceDelta(sinceIso);

    const externalVault = await loadVaultConnection();
    const vaultConnected = isVaultConnected(externalVault);

    // Vault-tidy's own, much longer cooldown (see reflectionPreferences.js) —
    // checked and (if used) advanced independently of the base reflection
    // cadence, since it's a genuinely separate, expensive-to-run-often thing
    // layered on top of the same cycle, not gated by the same clock. Dream's
    // own cooldown (DREAM_INTERVAL_MS) works the same way, one layer
    // heavier still — see dreamSummary.js.
    let includeVaultTidy = false;
    let dreamDue = false;
    let reflectionPrefs = null;
    if (vaultConnected) {
      reflectionPrefs = await loadReflectionPreferences();
      includeVaultTidy = !reflectionPrefs.lastVaultTidyAt
        || Date.now() - new Date(reflectionPrefs.lastVaultTidyAt).getTime() >= VAULT_TIDY_INTERVAL_MS;
      dreamDue = !reflectionPrefs.lastDreamAt
        || Date.now() - new Date(reflectionPrefs.lastDreamAt).getTime() >= DREAM_INTERVAL_MS;
    }

    // Dream reads real conversation content, not tiny fact strings — fetched
    // only when actually due, and doesn't depend on the reflection session
    // itself, so this can resolve before deciding whether a check-in is even
    // worth creating at all. `includeDream` additionally requires there was
    // something to review — an empty day shouldn't hand the model an empty
    // transcript to "review."
    const dreamResult = dreamDue ? await gatherDreamTranscript(reflectionPrefs.lastDreamAt || sinceIso).catch(() => null) : null;
    const includeDream = dreamDue && !!dreamResult?.hasMessages;

    if (!delta.hasChanges && !includeDream) return; // nothing to say — a "nothing happened!" check-in erodes trust in the feature fast

    const session = await createSession.mutateAsync({ title: "Check-in" });

    // Fetched here (once) rather than left to invokeAssistant's own internal
    // fetch, for two reasons: the self-note's current length needs to be
    // known before buildReflectionInstruction runs, and priming
    // vaultOverviewCacheRef with this session's id up front means
    // invokeAssistant's own fetch (keyed by the same session id) hits the
    // cache instead of fetching the exact same data a second time.
    let vaultOverview = null;
    if (vaultConnected) {
      vaultOverview = await fetchVaultOverview(externalVault).catch(() => null);
      vaultOverviewCacheRef.current = { sessionId: session.id, overview: vaultOverview };
    }

    const instruction = buildReflectionInstruction(delta.facts, {
      vaultConnected,
      selfNoteLength: vaultOverview?.selfNote?.length || 0,
      includeVaultTidy,
      includeDream,
      dreamTranscript: dreamResult?.transcriptText || "",
      userAnalysisConsent: reflectionPrefs?.userAnalysisConsent === true,
    });
    if (includeVaultTidy || dreamDue) {
      // Both cooldowns advance once checked this cycle, regardless of
      // whether vault-tidy found anything or dream had messages to review —
      // "checked recently" is what each cooldown tracks, not "found
      // something."
      await saveReflectionPreferences({
        ...reflectionPrefs,
        ...(includeVaultTidy ? { lastVaultTidyAt: new Date().toISOString() } : {}),
        ...(dreamDue ? { lastDreamAt: new Date().toISOString() } : {}),
      });
    }
    const data = await invokeAssistant({
      message: instruction,
      conversationHistory: "",
      activeProjectId: null,
      sessionId: session.id,
      protocolReminderRequested: false,
      // Not read by anything client-side (see byokChat.js) — rides along in
      // the hosted path's own request body as honest metadata, harmless and
      // free for entry.ts to use later if it ever needs to distinguish this
      // kind of turn.
      isReflectionTurn: true,
    });

    const reply = data.reply || "Hey — just checking in on a few things.";
    const liveTrace = data.liveTrace || [];
    const { autoExecute, pending } = filterReflectionActions(data.actions || []);

    // Structural backstop behind userAnalysisConsent, not just the prompt
    // instruction telling the model not to write it (see dreamSummary.js's
    // buildDreamInstruction): WRITE_VAULT_NOTE always sends the whole file
    // content in one call, so a confused/ignored-instruction model output
    // could otherwise smuggle a "## User Notes" section into Vaea Self.md
    // even without real consent. Strip it from what actually gets written,
    // whenever consent isn't a real `true`.
    const userAnalysisConsent = reflectionPrefs?.userAnalysisConsent === true;
    const sanitizedAutoExecute = userAnalysisConsent
      ? autoExecute
      : autoExecute.map((a) =>
          a.action === "WRITE_VAULT_NOTE" && a.args?.path === SELF_NOTE_PATH
            ? { ...a, args: { ...a.args, content: stripUserNotesSection(a.args.content) } }
            : a
        );

    // Only ever WRITE_VAULT_NOTE calls to the two allowlisted paths reach
    // here — same execution primitive a normal turn's own auto-executing
    // plan already uses (handleSend, below), not a new write path.
    const autoResults = sanitizedAutoExecute.length
      ? await executeActionSequence(sanitizedAutoExecute, {})
      : [];
    const toolLog = [...liveTrace.map((l) => l.label), ...autoResults.map(describeToolCall)];
    proposeVaultNotesIfAny(pending);

    const created = await createMessage.mutateAsync({
      session_id: session.id,
      role: "assistant",
      content: buildLoggedContent(reply, toolLog),
      ...(pending.length ? { pending_action: { actions: pending } } : {}),
      ...(toolLog.length ? { tool_log_detail: { liveTrace, steps: autoResults } } : {}),
    });
    markMessageNew(created.id);
    setReflectionSessionId(session.id);
  };

  // Foreground, on-demand run of a named agent (agentsStore.js) — a real
  // chat turn in a brand-new session, scoped to the agent's purpose, using
  // the SAME action pipeline as a normal user turn (applyAssistantReply,
  // below) rather than reflection's own narrow allowlist: an agent is
  // meant to actually do things, gated by the same destructive/
  // approval-queue confirm rules as any other turn, not a new,
  // less-supervised execution surface. Callable from three places: the
  // Agents card's own "Run" button, RUN_AGENT (the model asking to start
  // one — special-cased in applyAssistantReply below, same shape as
  // UNDO_LAST_ACTION), and runDueAgents just below (cadence auto-run).
  const runAgentTurn = async (agent) => {
    const session = await createSession.mutateAsync({ title: agent.name });
    const data = await invokeAssistant({
      message: buildAgentInstruction(agent),
      conversationHistory: "",
      activeProjectId: null,
      sessionId: session.id,
      protocolReminderRequested: false,
    });
    await applyAssistantReply(session.id, data, {
      onSuccess: (created) => {
        markMessageNew(created.id);
        if (session.id !== activeSessionIdRef.current) setReflectionSessionId(session.id);
      },
    });
    const agents = await loadAgents();
    await saveAgents(agents.map((a) => (a.id === agent.id ? { ...a, lastRunAt: new Date().toISOString() } : a)));
  };

  // Same "only when the app actually happens to be open" honesty as
  // reflection's own cadence (see reflectionTrigger.js) — no background
  // worker exists to check this while the tab is closed. Runs due agents
  // one at a time (not Promise.all) so two agents launching at once never
  // race to create/select a session.
  const runDueAgents = async () => {
    const due = getDueAgents(await loadAgents());
    for (const agent of due) await runAgentTurn(agent).catch(() => {});
  };

  const runAgentByName = async (name) => {
    const agents = await loadAgents();
    const target = agents.find((a) => a.name.toLowerCase() === name.toLowerCase());
    if (!target) throw new Error(`No agent named "${name}" — check the Agents list for the exact name.`);
    await runAgentTurn(target);
  };

  // Call from the actual moment Vaea Chat is opened (ChatBox's isChatOpen
  // becoming true; ChatPage mounting) — not from this hook's own bare
  // mount, which happens on every dashboard load even while the floating
  // widget stays collapsed. Fire-and-forget by design: opening chat should
  // never visibly wait on this.
  const notifyChatOpened = () => {
    runReflectionIfDue({
      runReflectionTurn,
      checkVaultConnected: async () => isVaultConnected(await loadVaultConnection()),
    });
    runDueAgents();
  };

  // Arms (or re-arms) the "auto /vault-log after an hour of silence in this
  // chat" timer (runIdleVaultLog, below). Called from handleSend right after
  // a real user message lands in `sessionId` — every new message pushes the
  // hour back out, same as it would for a person deciding "it's been quiet a
  // while, let me jot this down." Unlike REFLECTION_INTERVAL_MS's "checked
  // only when chat reopens" pattern, this is a real, live setTimeout — see
  // VAULT_LOG_IDLE_MS's own comment in reflectionPreferences.js for why that
  // honesty claim is different (and achievable) here: it only needs the tab
  // to stay open for the hour, not survive being closed.
  const armVaultLogTimer = (sessionId) => {
    clearTimeout(vaultLogTimerRef.current);
    vaultLogTimerRef.current = setTimeout(() => {
      vaultLogTimerRef.current = null;
      runIdleVaultLog(sessionId);
    }, VAULT_LOG_IDLE_MS);
  };

  // Fires once, an hour after the user's last message in `sessionId`, with
  // no further message sent in the meantime — the exact same "/vault-log"
  // a user could type themselves (see systemPrompt.js's slash-command
  // table), just triggered by silence instead of a keystroke. Consent and
  // vault-connection are both re-checked here, at FIRE time, not back when
  // the timer was armed — either could have changed during that hour (a
  // Settings toggle, a disconnected vault), and a silent, permission-less
  // vault write is exactly what this feature must never become. Writes into
  // THIS session (not a new one, unlike runReflectionTurn's check-ins) since
  // this is logging a real conversation that already happened here, not
  // opening a new one. Fully silent on any failure, same as
  // runReflectionTurn: the user never asked for this turn, so from their
  // side it should simply not have happened.
  const runIdleVaultLog = async (sessionId) => {
    try {
      const prefs = await loadReflectionPreferences();
      if (prefs.consent !== true) return;
      const externalVault = await loadVaultConnection();
      if (!isVaultConnected(externalVault)) return;

      // "-created_date" + reverse, same convention useChatMessages.js's own
      // "recent" page uses — this is a standalone fetch (the session may no
      // longer be the active one by the time this fires, so chatState's own
      // cached messages can't be trusted to still be for THIS session), not
      // a call through that hook. Branches to the same local backend
      // useChatMessages.js/useChatSessions.js use for Local Mode — see
      // their shared comment.
      const providerConfig = await loadAiProviderConfig();
      let messages;
      if (isLocalBridgeConfigured(providerConfig)) {
        const all = await localDb.chatMessages.filter({ session_id: sessionId });
        messages = all.slice().sort((a, b) => new Date(a.created_date) - new Date(b.created_date)).slice(-200);
      } else {
        const desc = await base44.entities.ChatMessage.filter({ session_id: sessionId }, "-created_date", 200);
        messages = [...desc].reverse();
      }
      if (!messages.length) return; // nothing was ever said here — nothing to log
      const conversationHistory = messages
        .map((m) => `${m.role.toUpperCase()}: ${stripToolLog(m.content)}`)
        .join("\n");

      const data = await invokeAssistant({
        message: "/vault-log",
        conversationHistory,
        activeProjectId: null,
        sessionId,
        protocolReminderRequested: false,
      });

      const reply = data.reply || "";
      const liveTrace = data.liveTrace || [];
      const actions = data.actions || [];
      const executable = actions.filter((a) => !NON_EXECUTABLE_ACTIONS.has(a.action));

      if (!executable.length) {
        if (!reply) return; // nothing written and nothing to say — stay silent rather than post an empty aside
        const created = await createMessage.mutateAsync({
          session_id: sessionId, role: "assistant",
          content: buildLoggedContent(reply, liveTrace.map((l) => l.label)),
          ...(liveTrace.length ? { tool_log_detail: { liveTrace } } : {}),
        });
        markMessageNew(created.id);
        if (sessionId !== activeSessionIdRef.current) setReflectionSessionId(sessionId);
        return;
      }

      // "/vault-log" only ever proposes WRITE_VAULT_NOTE (see
      // systemPrompt.js), never anything in DESTRUCTIVE_ACTIONS — but this
      // still routes through the same pending_action fallback handleSend
      // uses for a normal turn, rather than assuming that holds forever. A
      // silent auto-execute of something destructive is exactly the failure
      // mode every confirm-gate in this file exists to prevent.
      const isDestructive = executable.some((a) => DESTRUCTIVE_ACTIONS.has(a.action));
      const results = isDestructive ? [] : await executeActionSequence(executable, {});
      const toolLog = [...liveTrace.map((l) => l.label), describePlan(executable), ...results.map(describeToolCall)];
      if (isDestructive) proposeVaultNotesIfAny(executable);
      const created = await createMessage.mutateAsync({
        session_id: sessionId, role: "assistant",
        content: buildLoggedContent(reply, toolLog),
        ...(isDestructive ? { pending_action: { actions: executable } } : {}),
        ...(toolLog.length ? { tool_log_detail: { liveTrace, plan: executable, steps: results } } : {}),
      });
      markMessageNew(created.id);
      if (sessionId !== activeSessionIdRef.current) setReflectionSessionId(sessionId);
      if (!isDestructive) await invalidateAppQueries();
    } catch {
      // best-effort — a failed idle log just means it didn't happen this hour
    }
  };

  // Returns { hadAction, ok, error? } instead of swallowing a failure
  // silently — this used to pop the entry off actionHistory BEFORE
  // attempting it and empty-catch any error with a comment claiming it was
  // "surfaced via the assistant's own reply already." That was never true:
  // the model's reply text is generated in the same turn, before this
  // actually runs, so it has no way to know whether the undo succeeded —
  // a failed undo was completely invisible, and the popped entry was gone
  // for good with no way to retry it. Now the entry only leaves history on
  // real success, so a failure can be retried, and the caller (handleSend,
  // right below) can show the user what actually happened.
  const runUndo = async () => {
    const last = actionHistory[actionHistory.length - 1];
    if (!last) return { hadAction: false, ok: true };
    const { type, ...args } = last;
    try {
      await executeAction(type, args);
      await invalidateAppQueries();
      setActionHistory((prev) => prev.slice(0, -1));
      return { hadAction: true, ok: true };
    } catch (error) {
      return { hadAction: true, ok: false, error };
    }
  };

  // The part of a successful assistant turn that turns {reply, reasoning,
  // actions, liveTrace} into real chat messages/mutations — extracted out
  // of handleSend so the exact same logic also drives a RESUMED Local
  // Mode reply (see the resume useEffect above), not a second,
  // separately-maintained copy of it. `messageOptions` is only ever the
  // typewriter-skip/markMessageNew choice handleSend already made; a
  // resumed reply always gets the normal markMessageNew treatment since
  // nothing streamed live for it.
  const applyAssistantReply = async (sessionId, data, messageOptions = {}) => {
    const reply = data.reply || "Done.";
    const reasoning = data.reasoning || reply;
    const actions = data.actions || [];
    const liveTrace = data.liveTrace || [];

    if (actions.length === 0 || actions.every((a) => NON_EXECUTABLE_ACTIONS.has(a.action))) {
      let replyText = reply;
      if (actions[0]?.action === "UNDO_LAST_ACTION") {
        const undoResult = await runUndo();
        if (!undoResult.hadAction) replyText += "\n\n⚠️ There was nothing to undo.";
        else if (!undoResult.ok) replyText += `\n\n⚠️ Undo failed: ${undoResult.error.message}`;
      } else if (actions[0]?.action === "RUN_AGENT") {
        try {
          await runAgentByName(actions[0].args?.name || "");
        } catch (error) {
          replyText += `\n\n⚠️ ${error.message}`;
        }
      }
      setLiveSteps([]);
      await createMessage.mutateAsync(
        {
          session_id: sessionId, role: "assistant",
          content: buildLoggedContent(replyText, liveTrace.map((l) => l.label)),
          ...(liveTrace.length ? { tool_log_detail: { liveTrace } } : {}),
        },
        messageOptions
      );
      return;
    }

    const executable = actions.filter((a) => !NON_EXECUTABLE_ACTIONS.has(a.action));

    // "Approve every action, not just destructive ones" (Settings -> Agent
    // Behavior, off by default) widens this same confirm gate to every
    // staged action, not a separate approval queue — see chatActions.js's
    // DESTRUCTIVE_ACTIONS comment for why this one gate is the real
    // mechanism a widened toggle should reuse rather than duplicate.
    const { approvalQueueEnabled } = await loadAgentBehavior();
    if (approvalQueueEnabled || executable.some((a) => DESTRUCTIVE_ACTIONS.has(a.action))) {
      setLiveSteps([]);
      proposeVaultNotesIfAny(executable);
      await createMessage.mutateAsync(
        {
          session_id: sessionId, role: "assistant",
          content: buildLoggedContent(reply, liveTrace.map((l) => l.label)),
          pending_action: { actions: executable },
          ...(liveTrace.length ? { tool_log_detail: { liveTrace } } : {}),
        },
        messageOptions
      );
      return;
    }

    setLiveSteps((prev) => [...prev, describePlan(executable)]);
    const paceReveal = executable.length <= MAX_PACED_STEPS;
    const results = await executeActionSequence(executable, {
      onStep: async (step) => {
        setLiveSteps((prev) => [...prev, describeToolCall(step)]);
        if (paceReveal) await sleep(STEP_REVEAL_DELAY_MS);
      },
    });
    const undos = results.map((r) => r.toolResult?.undo).filter(Boolean);
    if (undos.length) {
      setActionHistory((prev) => [...prev, ...undos]);
    }

    const toolLog = [...liveTrace.map((l) => l.label), describePlan(executable), ...results.map(describeToolCall)];
    const content = buildLoggedContent(reply, toolLog);
    setLiveSteps([]);
    await createMessage.mutateAsync(
      {
        session_id: sessionId, role: "assistant", content,
        tool_log_detail: { liveTrace, plan: executable, steps: results, reasoning },
      },
      messageOptions
    );
    await invalidateAppQueries();
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() && !attachedFile) return;

    // /snippet is the one slash command handled entirely client-side, never
    // sent to the model — saving/recalling a block of text needs no AI
    // reasoning, so round-tripping it through a tool call would just be
    // slower and burn a real request for nothing. "/snippet save <name>:
    // <text>" saves and clears the composer; "/snippet <name>" drops the
    // saved text back into the composer for review before actually sending —
    // never sends on the user's behalf.
    const saveMatch = input.match(/^\/snippet\s+save\s+([^:]+):\s*([\s\S]+)$/i);
    if (saveMatch) {
      await saveSnippet(saveMatch[1].trim(), saveMatch[2].trim());
      setInput("");
      return;
    }
    const useMatch = input.match(/^\/snippet\s+(\S+)\s*$/i);
    if (useMatch) {
      const snippet = await findSnippet(useMatch[1].trim());
      setInput(snippet ? snippet.text : input);
      return;
    }

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
      armVaultLogTimer(sessionId);
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
        } else if (event.type === "round-boundary") {
          // A real marker for where one tool-loop round's own text ended and
          // the next began — ROUND_BOUNDARY_MARKER, not "\n\n": a blank line
          // is something the model's own prose can legitimately contain
          // (a genuine multi-paragraph answer), so ChatMessageList.jsx can't
          // safely treat one as "this round is over" the way it used to. See
          // anthropicAdapter.js's callAnthropic for where this event
          // actually comes from.
          setStreamingText((prev) => prev + ROUND_BOUNDARY_MARKER);
        }
      };

      const data = await invokeAssistant({
        message: userText, conversationHistory, activeProjectId, sessionId,
        protocolReminderRequested: matchesProtocolTrigger(userText),
      }, onEvent);
      // Skips markMessageNew (and so the typewriter) for the reply-bearing
      // message below when its text was already shown live via
      // streamingText — replaying the same text a second time, now via
      // typewriter, would just be a redundant re-animation of something the
      // user already watched appear. Falls back to the old
      // mark-as-new/typewriter treatment on the rare turn that streamed no
      // narration at all (e.g. a reply of just "Done.").
      const skipTypewriter = liveThinkingShown ? {} : { onSuccess: (created) => markMessageNew(created.id) };
      await applyAssistantReply(sessionId, data, skipTypewriter);
    } catch (error) {
      // A session token that expired mid-conversation (session already
      // existed, so the earlier 401/403 check above never ran) used to fall
      // straight into the generic error bubble below — a confusing "⚠️
      // Error" instead of the same sign-in prompt that already handles this
      // exact case when it happens on the very first message.
      if (error.status === 401 || error.status === 403) {
        setAuthPromptVisible(true);
      } else {
        // A plan that failed partway through executeActionSequence carries
        // its already-completed steps on the error (see chatActions.js) —
        // register their undo info (otherwise a real UPDATE_TASK_STATUS/etc.
        // that DID succeed becomes permanently un-undoable via chat) and
        // show them in the error message's own tool-log, so "3 of 5 steps
        // already ran" is something the user actually sees, not just
        // error.message's own parenthetical count.
        const completedSteps = error.completedSteps || [];
        const undos = completedSteps.map((r) => r.toolResult?.undo).filter(Boolean);
        if (undos.length) setActionHistory((prev) => [...prev, ...undos]);
        const content = completedSteps.length
          ? buildLoggedContent(`⚠️ Error: ${error.message}`, completedSteps.map(describeToolCall))
          : `⚠️ Error: ${error.message}`;
        await createMessage.mutateAsync(
          { session_id: sessionId, role: "assistant", content, ...(completedSteps.length ? { tool_log_detail: { steps: completedSteps } } : {}) },
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
    useAppStore.getState().setPendingVaultProposals([]);
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
      // Same partial-completion handling as handleSend's catch above — see
      // chatActions.js's executeActionSequence for where completedSteps
      // comes from.
      const completedSteps = error.completedSteps || [];
      const undos = completedSteps.map((r) => r.toolResult?.undo).filter(Boolean);
      if (undos.length) setActionHistory((prev) => [...prev, ...undos]);
      const content = completedSteps.length
        ? buildLoggedContent(`⚠️ Couldn't complete that: ${error.message}`, completedSteps.map(describeToolCall))
        : `⚠️ Couldn't complete that: ${error.message}`;
      await createMessage.mutateAsync(
        { session_id: message.session_id, role: "assistant", content, ...(completedSteps.length ? { tool_log_detail: { steps: completedSteps } } : {}) },
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
    useAppStore.getState().setPendingVaultProposals([]);
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
    clearNewMessage,
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
    reflectionSessionId,
    notifyChatOpened,
    runAgentByName,
    openReflectionSession,
    handleSelectSession,
    handleNewChat,
    handleFileChange,
    handleSend,
    handleConfirm,
    handleCancel,
  };
}

// Client-side execution of the AI chat assistant's decided actions. Used to
// run entirely server-side against Base44's own hosted entities — a
// deliberate scope decision when the app was forked off Base44 — but that
// meant chat operated on a dataset completely disconnected from what the
// Dashboard actually shows. This module makes chat act on the exact same
// `localDb` data the rest of the app reads, by reusing the identical plain
// mutation functions (including their cascade logic) the UI's own hooks are
// built on — imported directly below, not duplicated.
//
// aiChatStream (the Base44 function) now only decides *what* to do — it
// never touches your project data itself. Your data is sent to it for one
// request just so the LLM can see it, and nothing is written back to Base44;
// every actual create/update/delete happens here, against localDb.
import { localDb } from "@/lib/localDb";
import { withKeyLock } from "@/lib/asyncKeyLock";
import { toCsv } from "@/lib/csv";
import { excludeSoftDeleted, assertLiveParent, sortByPosition, reorderPositions } from "@/lib/entityUtils";
import { filterActiveTasks } from "@/lib/taskUtils";
import { CARD_VIEW_STORAGE_KEY, CARD_VIEW_CHANGE_EVENT } from "@/lib/cardViewConstants";
import { APPEARANCE_CHANGE_EVENT, THEME_MODES, ACCENT_KEYS } from "@/lib/appearanceConstants";
import { loadAiIdentity, saveAiIdentity } from "@/lib/aiPreferences";
import { createSnapshot, restoreSnapshot } from "@/lib/backupSnapshots";
import { loadNotificationRules, saveNotificationRules } from "@/lib/notificationRules";
import { loadAgents, saveAgents } from "@/lib/agentsStore";
import { loadPromptTemplates, savePromptTemplates } from "@/lib/promptTemplatesStore";
import { loadWorkflowCards, saveWorkflowCards } from "@/lib/workflowCanvasStore";
import { loadVaultConnection, isVaultConnected } from "@/lib/vaultConnection";
import { writeVaultFile, SELF_NOTE_PATH, SELF_NOTE_HARD_CAP_CHARS } from "@/lib/githubApi";
import {
  loadGoogleWorkspaceConnection as loadCalendarConnection,
  saveGoogleWorkspaceConnection as saveCalendarConnection,
  isGoogleWorkspaceConnected as isCalendarConnected,
} from "@/lib/googleWorkspaceConnection";
import { listEvents as listGoogleCalendarEvents, createEvent, updateEvent, deleteEvent } from "@/lib/googleCalendarApi";
import { loadAgentBehavior, saveAgentBehavior } from "@/lib/agentBehaviorSettings";
import { findFreeSlot, findRecurringSlots, findConflicts, VAEA_TAG } from "@/lib/vaeaCalendarScheduling";
import { createTextFile as createDriveFile, deleteFile as deleteDriveFile } from "@/lib/googleDriveApi";
import { createDocument as createGoogleDoc, appendText as appendGoogleDocText, replaceText as replaceGoogleDocText } from "@/lib/googleDocsApi";
import { createSpreadsheet as createGoogleSheet, updateValues as updateGoogleSheetValues, appendValues as appendGoogleSheetValues } from "@/lib/googleSheetsApi";
import { createPresentation as createGoogleSlides, addSlide as addGoogleSlide } from "@/lib/googleSlidesApi";
import { createTask as createGoogleTask, updateTask as updateGoogleTask, deleteTask as deleteGoogleTask } from "@/lib/googleTasksApi";
import { createForm as createGoogleForm, addTextQuestion as addGoogleFormQuestion } from "@/lib/googleFormsApi";
import { loadGmailConnection, saveGmailConnection, isGmailConnected } from "@/lib/gmailConnection";
import { sendMessage as sendGmailMessage, archiveMessage as archiveGmailMessage, trashMessage as trashGmailMessage, markSpam as markGmailSpam, createDraftReply as createGmailDraftReply } from "@/lib/gmailApi";
import { loadMicrosoftConnection, saveMicrosoftConnection, isMicrosoftConnected } from "@/lib/microsoftConnection";
import { loadOutlookConnection, saveOutlookConnection, isOutlookConnected } from "@/lib/outlookConnection";
import { loadSlackConnection, isSlackConnected } from "@/lib/slackConnection";
import { sendMessage as sendSlackMessage } from "@/lib/slackApi";
import {
  listEvents as listOutlookEvents,
  createEvent as createOutlookEvent,
  updateEvent as updateOutlookEvent,
  deleteEvent as deleteOutlookEvent,
  sendMessage as sendOutlookMessage,
  archiveMessage as archiveOutlookMessage,
  deleteMessage as deleteOutlookMessage,
  markSpam as markOutlookSpam,
  createDraftReply as createOutlookDraftReply,
} from "@/lib/microsoftGraphApi";
import { loadClickUpConnection, isClickUpConnected } from "@/lib/clickupConnection";
import { createTask as createClickUpTask, updateTask as updateClickUpTask, deleteTask as deleteClickUpTask, sendMessage as sendClickUpMessage } from "@/lib/clickupApi";
import { syncIdentityToSelfNote } from "@/lib/selfNote";
import { useAppStore } from "@/lib/store";
import { TABS } from "@/lib/tabs";
import { createArea, updateArea, deleteArea } from "@/hooks/useAreas";
import { createProduct, updateProduct, deleteProduct } from "@/hooks/useProducts";
import { createProject, updateProject, archiveProject, restoreProject, deleteProject } from "@/hooks/useProjects";
import { createTask, updateTask, deleteTask, toggleTopThree } from "@/hooks/useTasks";
import { createStakeholder, updateStakeholder, deleteStakeholder } from "@/hooks/useStakeholders";
import { createDepartment, renameDepartment, deleteDepartment } from "@/hooks/useDepartments";
import { createProjectNote, updateProjectNote, deleteProjectNote } from "@/hooks/useProjectNotes";

export const DESTRUCTIVE_ACTIONS = new Set([
  "DELETE_AREA",
  "DELETE_PRODUCT",
  "DELETE_PROJECT",
  "DELETE_TASK",
  "DELETE_STAKEHOLDER",
  "DELETE_NOTE",
  "DELETE_DEPARTMENT",
  "ARCHIVE_DONE_TASKS",
  "BULK_DELETE",
  "DELETE_CALENDAR_EVENT",
  "DELETE_OUTLOOK_EVENT",
  "DELETE_CLICKUP_TASK",
  "DELETE_DRIVE_FILE",
  "DELETE_GOOGLE_TASK",
  "DELETE_WORKFLOW_CARD",
  "RESTORE_BACKUP",
  "DELETE_GMAIL_MESSAGE",
  "DELETE_OUTLOOK_MESSAGE",
]);

// UNDO_LAST_ACTION is a real tool the assistant can call, but it's handled
// specially by useChatController.js's runUndo() rather than routed through
// executeAction below — it never appears alongside other actions in a plan
// (the server prompt requires it to be the only tool call in a turn).
// RUN_AGENT is the same shape of exception: starting an agent run means
// creating a brand-new chat session and invoking the assistant again inside
// it (useChatController.js's runAgentTurn), which needs real hook state
// (createSession/invokeAssistant/applyAssistantReply) this stateless
// executor doesn't have.
export const NON_EXECUTABLE_ACTIONS = new Set(["UNDO_LAST_ACTION", "RUN_AGENT"]);

// Vaea Calendar's auto-scheduling helpers (SCHEDULE_CALENDAR_TIME /
// RESCHEDULE_CALENDAR_CONFLICTS below) — merges busy events across whatever
// of Google Workspace/Microsoft 365 is connected, and picks which one to
// actually write new auto-scheduled events into (Google Workspace first,
// Microsoft 365 as the fallback, matching Vaea Calendar's own aggregation
// order in VaeaCalendarPage.jsx).
async function gatherBusyEvents({ earliest, latest }) {
  const [google, microsoft] = await Promise.all([loadCalendarConnection(), loadMicrosoftConnection()]);
  const [googleEvents, outlookEvents] = await Promise.all([
    isCalendarConnected(google)
      ? listGoogleCalendarEvents(google, { timeMin: earliest, timeMax: latest, maxResults: 100 }).then((r) => r.events).catch(() => [])
      : [],
    isMicrosoftConnected(microsoft)
      ? listOutlookEvents(microsoft, { timeMin: earliest, timeMax: latest, maxResults: 100 }).then((r) => r.events).catch(() => [])
      : [],
  ]);
  // microsoftGraphApi.js's shapeEvent appends a human-readable " (Time/Zone)"
  // suffix to start/end for display purposes — strip it back off here so
  // `new Date(...)` gets a real parseable ISO string for the busy-time math.
  const stripTz = (s) => (s ? s.replace(/\s*\([^)]*\)\s*$/, "") : s);
  return [
    ...googleEvents.map((e) => ({ ...e, _provider: "google" })),
    ...outlookEvents.map((e) => ({ ...e, _provider: "microsoft", start: { dateTime: stripTz(e.start) }, end: { dateTime: stripTz(e.end) } })),
  ];
}

async function primaryCalendarConnection() {
  const google = await loadCalendarConnection();
  if (isCalendarConnected(google)) return { provider: "google", connection: google };
  const microsoft = await loadMicrosoftConnection();
  if (isMicrosoftConnected(microsoft)) return { provider: "microsoft", connection: microsoft };
  return null;
}

async function createVaeaEvent(primary, { title, start, end, tag }) {
  if (primary.provider === "google") {
    const { event, connection } = await createEvent(primary.connection, {
      summary: title,
      description: tag,
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
    });
    await saveCalendarConnection(connection);
    return event;
  }
  const { event, connection } = await createOutlookEvent(primary.connection, {
    subject: title,
    description: tag,
    start: { dateTime: start.toISOString(), timeZone: "UTC" },
    end: { dateTime: end.toISOString(), timeZone: "UTC" },
  });
  await saveMicrosoftConnection(connection);
  return event;
}

// A reflection turn (see reflectionTrigger.js) runs with nobody having asked
// anything this turn, so the normal trust model — DESTRUCTIVE_ACTIONS need a
// confirm click, everything else (SET_AI_IDENTITY, WRITE_VAULT_NOTE,
// CREATE_*, ...) auto-executes because the user just asked for it in plain
// language — doesn't apply by default. Two real gaps if the normal gate were
// reused as-is: UNDO_LAST_ACTION bypasses DESTRUCTIVE_ACTIONS entirely (it's
// special-cased in useChatController.js's handleSend, before that check ever
// runs), and every non-destructive staged action auto-executes with no
// confirmation at all. So the default here is deliberately NOT "reuse
// DESTRUCTIVE_ACTIONS" — everything lands in `pending`, no allowlist of
// "safe" staged actions, EXCEPT one narrow, explicit exception: a
// WRITE_VAULT_NOTE to exactly one of two paths the reflection feature owns
// (see reflectionSummary.js) auto-executes, same as a user-initiated
// "/vault-log" already does today. The reasoning that justifies requiring a
// confirm click in the first place — an unreviewed GUESS ABOUT THE USER
// becoming permanent "fact" — doesn't apply to either: `Vaea Self.md` is the
// assistant writing about itself, and today's Daily/ log is code-computed
// fact (reflectionSummary.js's computeWorkspaceDelta), never model-inferred.
// This is an exact-path allowlist, not "any vault write" — a WRITE_VAULT_NOTE
// to any other path still requires confirmation, same as every other action
// (destructive or not). Read-only (staged: false) tools never reach here at
// all — they already ran immediately and only show up in liveTrace, not
// actions. UNDO_LAST_ACTION is still dropped outright, unconditionally.
//
// A write to Vaea Self.md specifically also needs to pass a sanity size
// check before it's allowed to auto-execute — the middle layer of the
// file's size management (see githubApi.js's SELF_NOTE_HARD_CAP_CHARS for
// the other two: reflectionSummary.js's soft prompt guidance to consolidate
// rather than keep appending, and systemPrompt.js/entry.ts's hard read-time
// truncation regardless of how the file got large). A single write this far
// past the target size reads as a runaway generation, not a normal note
// update — demoted to `pending` so the user actually sees it before it's
// committed, rather than trusting the model's own restraint unconditionally.
function isReflectionAutoExecutable(action) {
  if (action.action !== "WRITE_VAULT_NOTE") return false;
  const path = action.args?.path;
  if (path === SELF_NOTE_PATH) return (action.args?.content?.length ?? 0) <= SELF_NOTE_HARD_CAP_CHARS;
  return path === `Daily/${new Date().toISOString().slice(0, 10)}.md`;
}

export function filterReflectionActions(actions) {
  const usable = (actions || []).filter((a) => !NON_EXECUTABLE_ACTIONS.has(a.action));
  return {
    autoExecute: usable.filter(isReflectionAutoExecutable),
    pending: usable.filter((a) => !isReflectionAutoExecutable(a)),
  };
}

// A model asked for a huge single BULK_CREATE/BULK_DELETE (e.g. 60 tasks in
// one call) has, in practice, sometimes given up partway through generating
// that one giant tool-call argument and printed the rest as plain text
// instead — MAX_ACTIONS_PER_REQUEST (toolRunner.js/entry.ts) only counts
// tool calls, so one bulk call with an unbounded items/ids array slipped
// past it entirely. Capped hard here (not just described in the tool
// schema/system prompt) so a model that ignores the guidance still can't
// generate a call bigger than this — it gets a real error back instead,
// which the tool loop can recover from by splitting into more calls. Same
// cap also keeps a single step's persisted tool_log_detail (useChatController.js)
// bounded, instead of one bulk step embedding dozens of full entity records.
const MAX_BULK_ITEMS_PER_CALL = 5;

const BULK_CREATE_ACTION_BY_TYPE = {
  area: "CREATE_AREA",
  product: "CREATE_PRODUCT",
  project: "CREATE_PROJECT",
  task: "CREATE_TASK",
  note: "CREATE_NOTE",
  stakeholder: "CREATE_STAKEHOLDER",
  department: "CREATE_DEPARTMENT",
};

const BULK_DELETE_ACTION_AND_ID_KEY_BY_TYPE = {
  area: ["DELETE_AREA", "area_id"],
  product: ["DELETE_PRODUCT", "product_id"],
  project: ["DELETE_PROJECT", "project_id"],
  task: ["DELETE_TASK", "task_id"],
  note: ["DELETE_NOTE", "note_id"],
  stakeholder: ["DELETE_STAKEHOLDER", "stakeholder_id"],
  department: ["DELETE_DEPARTMENT", "department_id"],
};

// localDb.create() never checks that a parent id (parent_area_id,
// parent_product_id, or a task/note's project_id) actually points at a real
// record — it just stores whatever it's given. Without this guard, a model
// that mis-resolves (or never resolves) a $temp_id placeholder — or
// hallucinates a plausible-looking id instead of using one — silently
// produces a Product/Project/Task/Note that "creates" fine but then never
// renders anywhere: every list view filters strictly by parent-id match,
// and unlike orphan Projects (which fall back into an Area's "Direct
// Projects" box), there's no fallback slot for an orphan Product/Task/Note.
// The chat's own reply text, decided by the model in the same turn as the
// plan, has no way to know this happened and reports success regardless —
// so the failure was invisible until someone went looking at the actual
// board. Failing loudly here turns that into a real, visible "⚠️ Couldn't
// complete that: ..." error instead.
// See entityUtils.js's assertLiveParent for the shared implementation (also
// used directly by the plain UI mutation hooks now, not just here) — kept
// under this name locally since every call site below already uses it.
const assertParentExists = assertLiveParent;

// Same guard, applied to every id in an array field (stakeholder_ids,
// related_product_ids) — a model-issued plan can tag these with unresolved
// "$temp_id" placeholders (resolvePlaceholders leaves an unresolved one as
// the literal string) or a genuinely stale id, and unlike the single parent
// reference above, nothing was catching that before: it would land verbatim
// in a real record as a silent dangling reference.
async function assertLiveIds(collection, ids, label) {
  for (const id of ids || []) await assertParentExists(collection, id, label);
}

export async function executeAction(action, args) {
  switch (action) {
    case "CREATE_AREA": {
      const area = await createArea({ title: args.title, description: args.description });
      return { toolResult: { area } };
    }
    case "UPDATE_AREA": {
      const area = await updateArea({ id: args.area_id, data: { title: args.title, description: args.description } });
      return { toolResult: { area } };
    }
    case "DELETE_AREA": {
      const area = await deleteArea(args.area_id);
      return { toolResult: { area } };
    }

    case "CREATE_PRODUCT": {
      await assertParentExists(localDb.areas, args.parent_area_id, "Area");
      await assertLiveIds(localDb.stakeholders, args.stakeholder_ids, "Stakeholder");
      const product = await createProduct({
        parent_area_id: args.parent_area_id,
        title: args.title,
        description: args.description,
        stakeholder_ids: args.stakeholder_ids || [],
      });
      return { toolResult: { product } };
    }
    case "UPDATE_PRODUCT": {
      const { product_id, ...rest } = args;
      if (rest.stakeholder_ids) await assertLiveIds(localDb.stakeholders, rest.stakeholder_ids, "Stakeholder");
      const product = await updateProduct({ id: product_id, data: rest });
      return { toolResult: { product } };
    }
    case "DELETE_PRODUCT": {
      const product = await deleteProduct(args.product_id);
      return { toolResult: { product } };
    }

    case "CREATE_PROJECT": {
      await assertParentExists(localDb.areas, args.parent_area_id, "Area");
      if (args.parent_product_id) await assertParentExists(localDb.products, args.parent_product_id, "Product");
      await assertLiveIds(localDb.stakeholders, args.stakeholder_ids, "Stakeholder");
      await assertLiveIds(localDb.products, args.related_product_ids, "Related product");
      const project = await createProject({
        parent_area_id: args.parent_area_id,
        parent_product_id: args.parent_product_id || null,
        title: args.title,
        objective: args.objective,
        problem_statement: args.problem_statement,
        owner_name: args.owner_name,
        due_date: args.due_date,
        due_date_status: args.due_date_status || "ESTIMATED",
        stakeholder_ids: args.stakeholder_ids || [],
        related_product_ids: args.related_product_ids || [],
      });
      return { toolResult: { project } };
    }
    case "UPDATE_PROJECT": {
      const { project_id, ...rest } = args;
      // Unlike MOVE_PROJECT (the intended path for re-parenting), nothing
      // stops a model from including a parent field directly in a plain
      // UPDATE_PROJECT — this used to skip validation entirely.
      if (rest.parent_area_id) await assertParentExists(localDb.areas, rest.parent_area_id, "Area");
      if (rest.parent_product_id) await assertParentExists(localDb.products, rest.parent_product_id, "Product");
      if (rest.stakeholder_ids) await assertLiveIds(localDb.stakeholders, rest.stakeholder_ids, "Stakeholder");
      if (rest.related_product_ids) await assertLiveIds(localDb.products, rest.related_product_ids, "Related product");
      const project = await updateProject({ id: project_id, data: rest });
      return { toolResult: { project } };
    }
    case "MOVE_PROJECT": {
      await assertParentExists(localDb.areas, args.parent_area_id, "Area");
      if (args.parent_product_id) await assertParentExists(localDb.products, args.parent_product_id, "Product");
      const project = await updateProject({
        id: args.project_id,
        data: { parent_product_id: args.parent_product_id ?? null, parent_area_id: args.parent_area_id },
      });
      return { toolResult: { project } };
    }
    case "ARCHIVE_PROJECT": {
      const project = await archiveProject(args.project_id);
      return { toolResult: { project } };
    }
    case "RESTORE_PROJECT": {
      const project = await restoreProject(args.project_id);
      return { toolResult: { project } };
    }
    case "DELETE_PROJECT": {
      const project = await deleteProject(args.project_id);
      return { toolResult: { project } };
    }

    case "CREATE_NOTE": {
      await assertParentExists(localDb.projects, args.project_id, "Project");
      await assertLiveIds(localDb.stakeholders, args.stakeholder_ids, "Stakeholder");
      const note = await createProjectNote({
        project_id: args.project_id,
        type: args.type || "NOTE",
        content: args.content,
        reporter: args.reporter,
        stakeholder_ids: args.stakeholder_ids || [],
      });
      return { toolResult: { note } };
    }
    case "UPDATE_NOTE": {
      const note = await updateProjectNote({ id: args.note_id, data: { content: args.content } });
      return { toolResult: { note } };
    }
    case "DELETE_NOTE": {
      await deleteProjectNote(args.note_id);
      return { toolResult: {} };
    }

    case "CREATE_TASK": {
      await assertParentExists(localDb.projects, args.project_id, "Project");
      await assertLiveIds(localDb.stakeholders, args.stakeholder_ids, "Stakeholder");
      const task = await createTask({
        project_id: args.project_id,
        description: args.description,
        quadrant: args.quadrant ?? null,
        type: args.type || "OTHER",
        is_highly_important: !!args.is_highly_important,
        is_quick_task: !!args.is_quick_task,
        stakeholder_ids: args.stakeholder_ids || [],
        status: args.status || "NOT_STARTED",
        notes: args.notes || "",
        is_weekly_focus: !!args.is_weekly_focus,
      });
      return { toolResult: { task } };
    }
    case "UPDATE_TASK": {
      const { task_id, ...rest } = args;
      if (rest.stakeholder_ids) await assertLiveIds(localDb.stakeholders, rest.stakeholder_ids, "Stakeholder");
      const task = await updateTask({ id: task_id, data: rest });
      return { toolResult: { task } };
    }
    case "UPDATE_TASK_STATUS": {
      const previous = await localDb.tasks.get(args.task_id);
      const task = await updateTask({ id: args.task_id, data: { status: args.status } });
      return { toolResult: { task, previousStatus: previous?.status, undo: { type: "UPDATE_TASK_STATUS", task_id: args.task_id, status: previous?.status } } };
    }
    case "BULK_UPDATE_TASK_STATUS": {
      const { task_ids, status } = args;
      const tasks = [];
      for (const task_id of task_ids) tasks.push(await updateTask({ id: task_id, data: { status } }));
      return { toolResult: { tasks, count: tasks.length } };
    }
    case "TOGGLE_WEEKLY_FOCUS": {
      const previous = await localDb.tasks.get(args.task_id);
      const task = await updateTask({ id: args.task_id, data: { is_weekly_focus: !previous?.is_weekly_focus } });
      return { toolResult: { task, undo: { type: "TOGGLE_WEEKLY_FOCUS", task_id: args.task_id } } };
    }
    case "TOGGLE_TOP_THREE": {
      const task = await toggleTopThree({ id: args.task_id });
      return { toolResult: { task, undo: { type: "TOGGLE_TOP_THREE", task_id: args.task_id } } };
    }
    case "ARCHIVE_TASK": {
      const task = await updateTask({ id: args.task_id, data: { archived_at: new Date().toISOString() } });
      return { toolResult: { task } };
    }
    case "ARCHIVE_DONE_TASKS": {
      await assertParentExists(localDb.projects, args.project_id, "Project");
      const tasks = await localDb.tasks.filter({ project_id: args.project_id });
      const now = new Date().toISOString();
      const doneIds = tasks.filter((t) => !t.archived_at && (t.status === "DONE" || t.status === "DELEGATED_DONE")).map((t) => t.id);
      const archived = await localDb.tasks.updateMany(doneIds, { archived_at: now });
      return { toolResult: { tasks: archived, count: archived.length } };
    }
    case "RESTORE_TASK": {
      const task = await updateTask({ id: args.task_id, data: { archived_at: null } });
      return { toolResult: { task } };
    }
    case "DELETE_TASK": {
      const task = await deleteTask(args.task_id);
      return { toolResult: { task } };
    }

    case "CREATE_STAKEHOLDER": {
      const stakeholder = await createStakeholder({ name: args.name, department: args.department, avatar_url: args.avatar_url });
      return { toolResult: { stakeholder } };
    }
    case "UPDATE_STAKEHOLDER": {
      const { stakeholder_id, ...rest } = args;
      const stakeholder = await updateStakeholder({ id: stakeholder_id, data: rest });
      return { toolResult: { stakeholder } };
    }
    case "DELETE_STAKEHOLDER": {
      const stakeholder = await deleteStakeholder(args.stakeholder_id);
      return { toolResult: { stakeholder } };
    }

    case "CREATE_DEPARTMENT": {
      const department = await createDepartment({ name: args.name });
      return { toolResult: { department } };
    }
    case "RENAME_DEPARTMENT": {
      const department = await renameDepartment({ id: args.department_id, name: args.name });
      return { toolResult: { department } };
    }
    case "DELETE_DEPARTMENT": {
      const department = await deleteDepartment(args.department_id);
      return { toolResult: { department } };
    }

    case "SET_CUSTOM_FIELD": {
      const collectionMap = { project: localDb.projects, product: localDb.products, area: localDb.areas };
      const collection = collectionMap[args.entity_type];
      if (!collection) throw new Error(`Unknown entity_type "${args.entity_type}"`);
      const entity = await collection.get(args.entity_id);
      if (!entity) throw new Error("Entity not found");
      const key = String(args.label).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "field";
      const custom_data = { ...entity.custom_data, [key]: { label: args.label, value: args.value } };
      const display_on_card_fields = args.show_on_card
        ? [...new Set([...(entity.display_on_card_fields || []), key])]
        : entity.display_on_card_fields || [];
      const updated = await collection.update(args.entity_id, { custom_data, display_on_card_fields });

      if (args.area_wide && args.entity_type !== "area" && entity.parent_area_id) {
        const area = await localDb.areas.get(entity.parent_area_id);
        if (area) {
          const fieldListKey = `${args.entity_type}_fields`;
          const existingFields = area.custom_schema?.[fieldListKey] || [];
          if (!existingFields.some((f) => f.key === key)) {
            await localDb.areas.update(area.id, {
              custom_schema: { ...area.custom_schema, [fieldListKey]: [...existingFields, { key, label: args.label }] },
            });
          }
        }
      }

      return { toolResult: { entity: updated } };
    }

    case "DELETE_CUSTOM_FIELD": {
      // The UI has a real "remove field" button (CustomFieldsSection.jsx)
      // with no chat equivalent until now — SET_CUSTOM_FIELD only ever
      // added/updated one. Same key-slugging as SET_CUSTOM_FIELD above, so
      // "Remove the 'Priority' field" resolves to the same key it was
      // stored under.
      const collectionMap = { project: localDb.projects, product: localDb.products, area: localDb.areas };
      const collection = collectionMap[args.entity_type];
      if (!collection) throw new Error(`Unknown entity_type "${args.entity_type}"`);
      const entity = await collection.get(args.entity_id);
      if (!entity) throw new Error("Entity not found");
      const key = String(args.label).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "field";
      const custom_data = { ...entity.custom_data };
      delete custom_data[key];
      const display_on_card_fields = (entity.display_on_card_fields || []).filter((k) => k !== key);
      const updated = await collection.update(args.entity_id, { custom_data, display_on_card_fields });
      return { toolResult: { entity: updated } };
    }

    case "REORDER_ENTITY": {
      // The UI's drag-to-reorder (useGlobalDragEnd.js) for Areas/Products/
      // Projects had no chat equivalent at all — "move X above Y" was
      // simply impossible to do via chat. Shares the same reorderPositions
      // helper (entityUtils.js) the real drag handler uses, so a chat-
      // issued reorder and a real drag land on identical position math.
      const { entity_type, entity_id, before_id } = args;
      const collectionMap = { area: localDb.areas, product: localDb.products, project: localDb.projects };
      const collection = collectionMap[entity_type];
      if (!collection) throw new Error(`Unknown entity_type "${entity_type}" for REORDER_ENTITY`);
      const entity = await collection.get(entity_id);
      if (!entity || entity.deleted_at) throw new Error(`${entity_type} "${entity_id}" doesn't exist — the record to reorder didn't resolve to a real one.`);
      const all = excludeSoftDeleted(await collection.list());
      const siblings = all.filter((item) => {
        if (item.id === entity_id) return false;
        if (entity_type === "product") return item.parent_area_id === entity.parent_area_id;
        if (entity_type === "project") {
          return (item.parent_area_id ?? null) === (entity.parent_area_id ?? null) && (item.parent_product_id ?? null) === (entity.parent_product_id ?? null);
        }
        return true; // area: one single global list, no parent to match on
      });
      const orderedIds = sortByPosition(siblings).map((s) => s.id);
      const positions = reorderPositions([...orderedIds, entity_id], entity_id, before_id);
      await collection.updateMany(Object.keys(positions), (item) => ({ position: positions[item.id] }));
      const updated = await collection.get(entity_id);
      return { toolResult: { entity: updated, entity_type } };
    }

    case "MOVE_PRODUCT": {
      // MOVE_PROJECT's own equivalent for Products — the UI lets a user
      // drag a Product onto a different Area to reparent it; chat had no
      // way to do the same. updateProduct (useProducts.js) already
      // validates parent_area_id itself (this session's earlier fix), so
      // no separate assertLiveParent call is needed here.
      const product = await updateProduct({ id: args.product_id, data: { parent_area_id: args.parent_area_id } });
      return { toolResult: { product } };
    }

    case "SET_APPEARANCE": {
      // Same event-bridge pattern as SET_CARD_VIEW below — theme mode and
      // accent color both live behind real React hooks (next-themes'
      // useTheme, useAccentTheme), so this plain module dispatches a window
      // event instead of calling a setter directly; ChatAppearanceBridge.jsx
      // (mounted once in App.jsx) is the one real listener.
      const { theme, accent } = args;
      if (theme && !THEME_MODES.includes(theme)) throw new Error(`theme must be one of: ${THEME_MODES.join(", ")}`);
      if (accent && !ACCENT_KEYS.includes(accent)) throw new Error(`accent must be one of: ${ACCENT_KEYS.join(", ")}`);
      if (!theme && !accent) throw new Error("Pass at least one of theme or accent.");
      window.dispatchEvent(new CustomEvent(APPEARANCE_CHANGE_EVENT, { detail: { mode: theme, accent } }));
      return { toolResult: { theme, accent } };
    }

    case "BULK_CREATE": {
      const { entity_type, items } = args;
      const createAction = BULK_CREATE_ACTION_BY_TYPE[entity_type];
      if (!createAction) throw new Error(`Unknown entity_type "${entity_type}" for BULK_CREATE`);
      if (!Array.isArray(items) || items.length === 0) throw new Error("items must be a non-empty array");
      if (items.length > MAX_BULK_ITEMS_PER_CALL) {
        throw new Error(`BULK_CREATE can only create up to ${MAX_BULK_ITEMS_PER_CALL} ${entity_type}s per call — split a bigger request into multiple BULK_CREATE calls.`);
      }
      const results = [];
      for (const item of items) results.push(await executeAction(createAction, item));
      // Not `items: created` (the full entity objects) — nothing downstream
      // reads it (temp_id chaining doesn't work for BULK_CREATE either, see
      // systemPrompt.js), and it's the one thing that was making a single
      // bulk step's persisted tool_log_detail balloon.
      return { toolResult: { entity_type, count: results.length } };
    }
    case "BULK_DELETE": {
      const { entity_type, ids } = args;
      const mapping = BULK_DELETE_ACTION_AND_ID_KEY_BY_TYPE[entity_type];
      if (!mapping) throw new Error(`Unknown entity_type "${entity_type}" for BULK_DELETE`);
      if (!Array.isArray(ids) || ids.length === 0) throw new Error("ids must be a non-empty array");
      if (ids.length > MAX_BULK_ITEMS_PER_CALL) {
        throw new Error(`BULK_DELETE can only remove up to ${MAX_BULK_ITEMS_PER_CALL} ${entity_type}s per call — split a bigger request into multiple BULK_DELETE calls.`);
      }
      const [deleteAction, idKey] = mapping;
      for (const id of ids) await executeAction(deleteAction, { [idKey]: id });
      return { toolResult: { entity_type, count: ids.length } };
    }

    case "EXPORT_CSV": {
      // Active records only — an export represents the current workspace,
      // so soft-deleted rows (every type) and archived projects/tasks stay
      // out of it, matching exactly what the UI itself shows.
      const listers = {
        area: async () => excludeSoftDeleted(await localDb.areas.list()),
        product: async () => excludeSoftDeleted(await localDb.products.list()),
        project: async () => excludeSoftDeleted(await localDb.projects.list()).filter((p) => !p.is_archived),
        task: async () => filterActiveTasks(await localDb.tasks.list()),
        stakeholder: async () => excludeSoftDeleted(await localDb.stakeholders.list()),
        department: async () => excludeSoftDeleted(await localDb.departments.list()),
        note: async () => excludeSoftDeleted(await localDb.projectNotes.list()),
      };
      const lister = listers[args.entity_type];
      if (!lister) throw new Error(`Unknown entity_type "${args.entity_type}" for EXPORT_CSV`);
      const records = await lister();
      downloadCsv(args.entity_type, records);
      return { toolResult: { entity_type: args.entity_type, count: records.length } };
    }

    case "SET_AI_IDENTITY": {
      // Locked (unlike every other case here) because this is a real
      // read-modify-write cycle over a single shared key, the same race
      // shape localDb.js's collections have — the "/setup" interview
      // calling this repeatedly across a few turns, or a manual Settings
      // save landing at the same moment, would otherwise let one silently
      // clobber the other's fields instead of merging.
      const updated = await withKeyLock("aiIdentity", async () => {
        const current = await loadAiIdentity();
        const merged = { ...current, ...args };
        await saveAiIdentity(merged);
        return merged;
      });
      // Mirrors into Vaea Self.md's Identity section when a vault is
      // connected, same as AiPreferencesSection.jsx's own Save button does —
      // "/setup" reaches this exact case too, so this one hook covers both
      // paths that can ever change aiIdentity. Best-effort, never blocks
      // this action's own success.
      await syncIdentityToSelfNote(updated);
      return { toolResult: { identity: updated } };
    }

    case "WRITE_VAULT_NOTE": {
      const connection = await loadVaultConnection();
      if (!isVaultConnected(connection)) throw new Error("No Vaea Brain connected — set one up in Settings.");
      const result = await writeVaultFile({
        owner: connection.owner,
        repo: connection.repo,
        branch: connection.branch || "main",
        token: connection.token,
        path: args.path,
        content: args.content,
        commitMessage: args.commit_message,
      });
      return { toolResult: { vaultNote: result } };
    }

    case "CREATE_CALENDAR_EVENT": {
      const connection = await loadCalendarConnection();
      if (!isCalendarConnected(connection)) throw new Error("No Google Calendar connected — connect one in Settings.");
      const event = {
        summary: args.summary,
        description: args.description,
        location: args.location,
        start: args.start.includes("T") ? { dateTime: args.start } : { date: args.start },
        end: (args.end || args.start).includes("T")
          ? { dateTime: args.end || new Date(new Date(args.start).getTime() + 60 * 60 * 1000).toISOString() }
          : { date: args.end || args.start },
        // requestId just needs to be unique per creation attempt — Google
        // uses it for idempotency on retries, not shown to anyone.
        ...(args.meet_link ? { conferenceData: { createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: "hangoutsMeet" } } } } : {}),
      };
      const { event: created, connection: refreshed } = await createEvent(connection, event);
      await saveCalendarConnection(refreshed);
      return { toolResult: { calendarEvent: { ...created, meetLink: created.hangoutLink } } };
    }

    case "UPDATE_CALENDAR_EVENT": {
      const connection = await loadCalendarConnection();
      if (!isCalendarConnected(connection)) throw new Error("No Google Calendar connected — connect one in Settings.");
      const patch = {};
      if (args.summary !== undefined) patch.summary = args.summary;
      if (args.description !== undefined) patch.description = args.description;
      if (args.location !== undefined) patch.location = args.location;
      if (args.start !== undefined) patch.start = args.start.includes("T") ? { dateTime: args.start } : { date: args.start };
      if (args.end !== undefined) patch.end = args.end.includes("T") ? { dateTime: args.end } : { date: args.end };
      const { event: updated, connection: refreshed } = await updateEvent(connection, args.event_id, patch);
      await saveCalendarConnection(refreshed);
      return { toolResult: { calendarEvent: updated } };
    }

    case "DELETE_CALENDAR_EVENT": {
      const connection = await loadCalendarConnection();
      if (!isCalendarConnected(connection)) throw new Error("No Google Calendar connected — connect one in Settings.");
      const { connection: refreshed } = await deleteEvent(connection, args.event_id);
      await saveCalendarConnection(refreshed);
      return { toolResult: { deleted: args.event_id } };
    }

    case "CREATE_DRIVE_FILE": {
      const connection = await loadCalendarConnection();
      if (!isCalendarConnected(connection)) throw new Error("No Google Workspace connected — connect one in Settings.");
      const { file, connection: refreshed } = await createDriveFile(connection, { name: args.name, content: args.content, mimeType: args.mime_type });
      await saveCalendarConnection(refreshed);
      return { toolResult: { driveFile: file } };
    }

    case "DELETE_DRIVE_FILE": {
      const connection = await loadCalendarConnection();
      if (!isCalendarConnected(connection)) throw new Error("No Google Workspace connected — connect one in Settings.");
      const { connection: refreshed } = await deleteDriveFile(connection, args.file_id);
      await saveCalendarConnection(refreshed);
      return { toolResult: { deleted: args.file_id } };
    }

    case "CREATE_GOOGLE_DOC": {
      const connection = await loadCalendarConnection();
      if (!isCalendarConnected(connection)) throw new Error("No Google Workspace connected — connect one in Settings.");
      const { document: doc, connection: refreshed } = await createGoogleDoc(connection, { title: args.title });
      await saveCalendarConnection(refreshed);
      return { toolResult: { document: doc } };
    }

    case "APPEND_GOOGLE_DOC_TEXT": {
      const connection = await loadCalendarConnection();
      if (!isCalendarConnected(connection)) throw new Error("No Google Workspace connected — connect one in Settings.");
      const { connection: refreshed } = await appendGoogleDocText(connection, args.document_id, args.text);
      await saveCalendarConnection(refreshed);
      return { toolResult: { appended: args.document_id } };
    }

    case "REPLACE_GOOGLE_DOC_TEXT": {
      const connection = await loadCalendarConnection();
      if (!isCalendarConnected(connection)) throw new Error("No Google Workspace connected — connect one in Settings.");
      const { occurrencesChanged, connection: refreshed } = await replaceGoogleDocText(connection, args.document_id, args.find, args.replace);
      await saveCalendarConnection(refreshed);
      return { toolResult: { occurrencesChanged } };
    }

    case "CREATE_GOOGLE_SHEET": {
      const connection = await loadCalendarConnection();
      if (!isCalendarConnected(connection)) throw new Error("No Google Workspace connected — connect one in Settings.");
      const { spreadsheet, connection: refreshed } = await createGoogleSheet(connection, { title: args.title });
      await saveCalendarConnection(refreshed);
      return { toolResult: { spreadsheet } };
    }

    case "UPDATE_GOOGLE_SHEET_VALUES": {
      const connection = await loadCalendarConnection();
      if (!isCalendarConnected(connection)) throw new Error("No Google Workspace connected — connect one in Settings.");
      const { connection: refreshed } = await updateGoogleSheetValues(connection, args.spreadsheet_id, args.range, args.values);
      await saveCalendarConnection(refreshed);
      return { toolResult: { updated: args.range } };
    }

    case "APPEND_GOOGLE_SHEET_VALUES": {
      const connection = await loadCalendarConnection();
      if (!isCalendarConnected(connection)) throw new Error("No Google Workspace connected — connect one in Settings.");
      const { connection: refreshed } = await appendGoogleSheetValues(connection, args.spreadsheet_id, args.range, args.values);
      await saveCalendarConnection(refreshed);
      return { toolResult: { appended: args.range } };
    }

    case "CREATE_GOOGLE_SLIDES": {
      const connection = await loadCalendarConnection();
      if (!isCalendarConnected(connection)) throw new Error("No Google Workspace connected — connect one in Settings.");
      const { presentation, connection: refreshed } = await createGoogleSlides(connection, { title: args.title });
      await saveCalendarConnection(refreshed);
      return { toolResult: { presentation } };
    }

    case "ADD_GOOGLE_SLIDE": {
      const connection = await loadCalendarConnection();
      if (!isCalendarConnected(connection)) throw new Error("No Google Workspace connected — connect one in Settings.");
      const { slideId, connection: refreshed } = await addGoogleSlide(connection, args.presentation_id, { title: args.title, body: args.body });
      await saveCalendarConnection(refreshed);
      return { toolResult: { slideId } };
    }

    case "CREATE_GOOGLE_TASK": {
      const connection = await loadCalendarConnection();
      if (!isCalendarConnected(connection)) throw new Error("No Google Workspace connected — connect one in Settings.");
      const { task, connection: refreshed } = await createGoogleTask(connection, args.task_list_id || "@default", { title: args.title, notes: args.notes, due: args.due });
      await saveCalendarConnection(refreshed);
      return { toolResult: { task } };
    }

    case "UPDATE_GOOGLE_TASK": {
      const connection = await loadCalendarConnection();
      if (!isCalendarConnected(connection)) throw new Error("No Google Workspace connected — connect one in Settings.");
      const patch = {};
      if (args.title !== undefined) patch.title = args.title;
      if (args.notes !== undefined) patch.notes = args.notes;
      if (args.due !== undefined) patch.due = args.due;
      if (args.completed !== undefined) patch.status = args.completed ? "completed" : "needsAction";
      const { task, connection: refreshed } = await updateGoogleTask(connection, args.task_list_id || "@default", args.task_id, patch);
      await saveCalendarConnection(refreshed);
      return { toolResult: { task } };
    }

    case "DELETE_GOOGLE_TASK": {
      const connection = await loadCalendarConnection();
      if (!isCalendarConnected(connection)) throw new Error("No Google Workspace connected — connect one in Settings.");
      const { connection: refreshed } = await deleteGoogleTask(connection, args.task_list_id || "@default", args.task_id);
      await saveCalendarConnection(refreshed);
      return { toolResult: { deleted: args.task_id } };
    }

    case "CREATE_GOOGLE_FORM": {
      const connection = await loadCalendarConnection();
      if (!isCalendarConnected(connection)) throw new Error("No Google Workspace connected — connect one in Settings.");
      const { form, connection: refreshed } = await createGoogleForm(connection, { title: args.title });
      await saveCalendarConnection(refreshed);
      return { toolResult: { form } };
    }

    case "ADD_GOOGLE_FORM_QUESTION": {
      const connection = await loadCalendarConnection();
      if (!isCalendarConnected(connection)) throw new Error("No Google Workspace connected — connect one in Settings.");
      const { connection: refreshed } = await addGoogleFormQuestion(connection, args.form_id, { title: args.title, required: args.required });
      await saveCalendarConnection(refreshed);
      return { toolResult: { added: args.title } };
    }

    case "SCHEDULE_CALENDAR_TIME": {
      const behavior = await loadAgentBehavior();
      if (!behavior.autoSchedulingEnabled) {
        throw new Error('Auto-scheduling is off — turn on "Let Vaea Calendar auto-schedule tasks" in Settings -> Agent Behavior first.');
      }
      const primary = await primaryCalendarConnection();
      if (!primary) throw new Error("No Google Workspace or Microsoft 365 calendar connected — connect one in Settings.");
      const tag = VAEA_TAG[args.block_type] || VAEA_TAG.task;
      const durationMinutes = args.duration_minutes;
      const busy = await gatherBusyEvents({
        earliest: args.earliest || new Date().toISOString(),
        latest: args.latest || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      });

      if (args.block_type === "task") {
        const slot = findFreeSlot(busy, { durationMinutes, earliest: args.earliest, latest: args.latest });
        if (!slot) throw new Error("Couldn't find a free slot in the next 14 days — try widening the range or shortening the duration.");
        const event = await createVaeaEvent(primary, { title: args.title, start: slot.start, end: slot.end, tag });
        return { toolResult: { scheduled: [{ title: args.title, start: slot.start.toISOString(), end: slot.end.toISOString() }], event } };
      }

      const slots = findRecurringSlots(busy, {
        durationMinutes,
        occurrences: args.occurrences || 4,
        daysOfWeek: args.days_of_week,
        startingFrom: args.earliest,
      });
      if (!slots.length) throw new Error("Couldn't find any free slots for this recurring block — try different days or a shorter duration.");
      const created = [];
      for (const slot of slots) {
        // eslint-disable-next-line no-await-in-loop -- each booking depends on the previous one's token refresh being saved first
        const event = await createVaeaEvent(primary, { title: args.title, start: slot.start, end: slot.end, tag });
        created.push({ title: args.title, start: slot.start.toISOString(), end: slot.end.toISOString(), event });
      }
      return { toolResult: { scheduled: created.map(({ title, start, end }) => ({ title, start, end })), count: created.length } };
    }

    case "RESCHEDULE_CALENDAR_CONFLICTS": {
      const primary = await primaryCalendarConnection();
      if (!primary) throw new Error("No Google Workspace or Microsoft 365 calendar connected — connect one in Settings.");
      const earliest = new Date().toISOString();
      const latest = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      const busy = await gatherBusyEvents({ earliest, latest });
      // Outlook's shaped events don't carry a description field (see
      // gatherBusyEvents/shapeEvent), so a Vaea-tagged Outlook event can't be
      // recognized here yet — conflict detection is real, but Google-only
      // until that gap closes.
      const conflicts = findConflicts(busy);
      if (!conflicts.length) return { toolResult: { moved: [], message: "No conflicts found." } };

      const moved = [];
      for (const { event } of conflicts) {
        const durationMinutes = (new Date(event.end.dateTime) - new Date(event.start.dateTime)) / 60000;
        const stillBusy = busy.filter((e) => e !== event);
        const slot = findFreeSlot(stillBusy, { durationMinutes, earliest, latest });
        if (!slot) continue;
        // eslint-disable-next-line no-await-in-loop -- each move needs the previous one's fresh token saved first
        if (event._provider === "google") {
          const { connection } = await updateEvent(await loadCalendarConnection(), event.id, {
            start: { dateTime: slot.start.toISOString() },
            end: { dateTime: slot.end.toISOString() },
          });
          await saveCalendarConnection(connection);
        } else {
          const { connection } = await updateOutlookEvent(await loadMicrosoftConnection(), event.id, {
            start: { dateTime: slot.start.toISOString(), timeZone: "UTC" },
            end: { dateTime: slot.end.toISOString(), timeZone: "UTC" },
          });
          await saveMicrosoftConnection(connection);
        }
        moved.push({ title: event.summary || event.subject, new_start: slot.start.toISOString(), new_end: slot.end.toISOString() });
      }
      return { toolResult: { moved } };
    }

    // --- Full UI parity: notification rules, agents, prompt templates,
    // workflow canvas cards, agent-behavior toggles, and manual backups —
    // every one of these mirrors a button the user already has on the
    // matching page. See toolCatalog.js's own comment above these entries.

    case "CREATE_NOTIFICATION_RULE": {
      const rules = await loadNotificationRules();
      const next = [...rules.filter((r) => r.name !== args.name), { name: args.name, metric: args.metric, comparator: "gte", threshold: args.threshold }];
      await saveNotificationRules(next);
      return { toolResult: { rule: args.name } };
    }

    case "DELETE_NOTIFICATION_RULE": {
      const rules = await loadNotificationRules();
      await saveNotificationRules(rules.filter((r) => r.name !== args.name));
      return { toolResult: { deleted: args.name } };
    }

    case "CREATE_AGENT": {
      const agents = await loadAgents();
      const next = [...agents, { id: crypto.randomUUID(), name: args.name, purpose: args.purpose || "" }];
      await saveAgents(next);
      return { toolResult: { agent: args.name } };
    }

    case "DELETE_AGENT": {
      const agents = await loadAgents();
      const target = agents.find((a) => a.name.toLowerCase() === args.name.toLowerCase());
      if (!target) throw new Error(`No agent named "${args.name}" — check Settings for the exact name.`);
      await saveAgents(agents.filter((a) => a.id !== target.id));
      return { toolResult: { deleted: args.name } };
    }

    case "UPDATE_AGENT": {
      const agents = await loadAgents();
      const target = agents.find((a) => a.name.toLowerCase() === args.name.toLowerCase());
      if (!target) throw new Error(`No agent named "${args.name}" — check the Agents list for the exact name.`);
      const next = {
        ...target,
        ...(args.new_name !== undefined ? { name: args.new_name } : {}),
        ...(args.purpose !== undefined ? { purpose: args.purpose } : {}),
        ...(args.cadence_hours !== undefined ? { cadenceHours: args.cadence_hours || null } : {}),
      };
      await saveAgents(agents.map((a) => (a.id === target.id ? next : a)));
      return { toolResult: { updated: next.name } };
    }

    case "CREATE_PROMPT_TEMPLATE": {
      const templates = await loadPromptTemplates();
      const next = [...templates.filter((t) => t.name !== args.name), { id: crypto.randomUUID(), name: args.name, text: args.text }];
      await savePromptTemplates(next);
      return { toolResult: { template: args.name } };
    }

    case "UPDATE_PROMPT_TEMPLATE": {
      const templates = await loadPromptTemplates();
      const target = templates.find((t) => t.name.toLowerCase() === args.name.toLowerCase());
      if (!target) throw new Error(`No template named "${args.name}" — check the Prompt Templates list for the exact name.`);
      const next = {
        ...target,
        ...(args.new_name !== undefined ? { name: args.new_name } : {}),
        ...(args.text !== undefined ? { text: args.text } : {}),
      };
      await savePromptTemplates(templates.map((t) => (t.id === target.id ? next : t)));
      return { toolResult: { updated: next.name } };
    }

    case "DELETE_PROMPT_TEMPLATE": {
      const templates = await loadPromptTemplates();
      await savePromptTemplates(templates.filter((t) => t.name !== args.name));
      return { toolResult: { deleted: args.name } };
    }

    case "CREATE_WORKFLOW_CARD": {
      const cards = await loadWorkflowCards();
      const card = { id: crypto.randomUUID(), text: args.text, x: 40 + Math.random() * 80, y: 60 + Math.random() * 80 };
      await saveWorkflowCards([...cards, card]);
      return { toolResult: { card } };
    }

    case "UPDATE_WORKFLOW_CARD": {
      const cards = await loadWorkflowCards();
      if (!cards.some((c) => c.id === args.card_id)) throw new Error("No card with that id — call list_workflow_cards first.");
      await saveWorkflowCards(cards.map((c) => (c.id === args.card_id ? { ...c, text: args.text } : c)));
      return { toolResult: { updated: args.card_id } };
    }

    case "DELETE_WORKFLOW_CARD": {
      const cards = await loadWorkflowCards();
      await saveWorkflowCards(cards.filter((c) => c.id !== args.card_id));
      return { toolResult: { deleted: args.card_id } };
    }

    case "SET_AGENT_BEHAVIOR": {
      const current = await loadAgentBehavior();
      const next = { ...current };
      if (args.approval_queue_enabled !== undefined) next.approvalQueueEnabled = args.approval_queue_enabled;
      if (args.multi_model_comparison_enabled !== undefined) next.multiModelComparisonEnabled = args.multi_model_comparison_enabled;
      if (args.auto_scheduling_enabled !== undefined) next.autoSchedulingEnabled = args.auto_scheduling_enabled;
      await saveAgentBehavior(next);
      return { toolResult: { agentBehavior: next } };
    }

    case "CREATE_BACKUP": {
      const snapshot = await createSnapshot(args.label || "Manual backup (via chat)");
      return { toolResult: { snapshot } };
    }

    case "RESTORE_BACKUP": {
      await restoreSnapshot(args.snapshot_id);
      return { toolResult: { restored: args.snapshot_id } };
    }

    case "OPEN_APP_SECTION": {
      const tabEntry = TABS.find((t) => t.key === args.tab);
      if (!tabEntry) throw new Error(`Unknown tab "${args.tab}". Valid tabs: ${TABS.map((t) => t.key).join(", ")}.`);
      const highlightId =
        args.tab === "settings" && args.settings_section ? `settings:${args.settings_section}`
        : args.tab === "mindmap" && args.mindmap_tab ? `mindmap:${args.mindmap_tab}`
        : `tab:${args.tab}`;
      useAppStore.getState().openAppSection(tabEntry.to, highlightId);
      return { toolResult: { opened: args.tab, section: args.settings_section || args.mindmap_tab || null } };
    }

    case "CREATE_OUTLOOK_EVENT": {
      const connection = await loadMicrosoftConnection();
      if (!isMicrosoftConnected(connection)) throw new Error("No Microsoft account connected — connect one in Settings.");
      const start = args.start.includes("T") ? { dateTime: args.start, timeZone: args.start_timezone || "UTC" } : { date: args.start };
      const endValue = args.end || args.start;
      const end = endValue.includes("T")
        ? { dateTime: args.end || new Date(new Date(args.start).getTime() + 60 * 60 * 1000).toISOString(), timeZone: args.end_timezone || args.start_timezone || "UTC" }
        : { date: endValue };
      const { event: created, connection: refreshed } = await createOutlookEvent(connection, {
        subject: args.subject,
        start,
        end,
        description: args.description,
        location: args.location,
        teamsMeeting: args.teams_meeting,
      });
      await saveMicrosoftConnection(refreshed);
      return { toolResult: { outlookEvent: created } };
    }

    case "UPDATE_OUTLOOK_EVENT": {
      const connection = await loadMicrosoftConnection();
      if (!isMicrosoftConnected(connection)) throw new Error("No Microsoft account connected — connect one in Settings.");
      const patch = {};
      if (args.subject !== undefined) patch.subject = args.subject;
      if (args.description !== undefined) patch.description = args.description;
      if (args.location !== undefined) patch.location = args.location;
      if (args.start !== undefined) patch.start = args.start.includes("T") ? { dateTime: args.start, timeZone: args.start_timezone || "UTC" } : { date: args.start };
      if (args.end !== undefined) patch.end = args.end.includes("T") ? { dateTime: args.end, timeZone: args.end_timezone || args.start_timezone || "UTC" } : { date: args.end };
      const { event: updated, connection: refreshed } = await updateOutlookEvent(connection, args.event_id, patch);
      await saveMicrosoftConnection(refreshed);
      return { toolResult: { outlookEvent: updated } };
    }

    case "DELETE_OUTLOOK_EVENT": {
      const connection = await loadMicrosoftConnection();
      if (!isMicrosoftConnected(connection)) throw new Error("No Microsoft account connected — connect one in Settings.");
      const { connection: refreshed } = await deleteOutlookEvent(connection, args.event_id);
      await saveMicrosoftConnection(refreshed);
      return { toolResult: { deleted: args.event_id } };
    }

    case "SEND_OUTLOOK_MESSAGE": {
      const connection = await loadOutlookConnection();
      if (!isOutlookConnected(connection)) throw new Error("No Outlook account connected — connect one in Settings (feeds the Vmail tab).");
      const { connection: refreshed } = await sendOutlookMessage(connection, { to: args.to, subject: args.subject, body: args.body });
      await saveOutlookConnection(refreshed);
      return { toolResult: { sent: true } };
    }

    case "SEND_GMAIL_MESSAGE": {
      const connection = await loadGmailConnection();
      if (!isGmailConnected(connection)) throw new Error("No Gmail account connected — connect one in Settings.");
      const { id, connection: refreshed } = await sendGmailMessage(connection, { to: args.to, subject: args.subject, body: args.body });
      await saveGmailConnection(refreshed);
      return { toolResult: { sent: id } };
    }

    case "ARCHIVE_GMAIL_MESSAGE": {
      const connection = await loadGmailConnection();
      if (!isGmailConnected(connection)) throw new Error("No Gmail account connected — connect one in Settings.");
      const { connection: refreshed } = await archiveGmailMessage(connection, args.message_id);
      await saveGmailConnection(refreshed);
      return { toolResult: { archived: args.message_id } };
    }

    case "DELETE_GMAIL_MESSAGE": {
      const connection = await loadGmailConnection();
      if (!isGmailConnected(connection)) throw new Error("No Gmail account connected — connect one in Settings.");
      const { connection: refreshed } = await trashGmailMessage(connection, args.message_id);
      await saveGmailConnection(refreshed);
      return { toolResult: { deleted: args.message_id } };
    }

    case "REPORT_GMAIL_SPAM": {
      const connection = await loadGmailConnection();
      if (!isGmailConnected(connection)) throw new Error("No Gmail account connected — connect one in Settings.");
      const { connection: refreshed } = await markGmailSpam(connection, args.message_id);
      await saveGmailConnection(refreshed);
      return { toolResult: { reportedSpam: args.message_id } };
    }

    case "DRAFT_GMAIL_REPLY": {
      const connection = await loadGmailConnection();
      if (!isGmailConnected(connection)) throw new Error("No Gmail account connected — connect one in Settings.");
      const { draftId, connection: refreshed } = await createGmailDraftReply(connection, { messageId: args.message_id, to: args.to, subject: args.subject, body: args.body });
      await saveGmailConnection(refreshed);
      return { toolResult: { draft: draftId } };
    }

    case "ARCHIVE_OUTLOOK_MESSAGE": {
      const connection = await loadOutlookConnection();
      if (!isOutlookConnected(connection)) throw new Error("No Outlook account connected — connect one in Settings (feeds the Vmail tab).");
      const { connection: refreshed } = await archiveOutlookMessage(connection, args.message_id);
      await saveOutlookConnection(refreshed);
      return { toolResult: { archived: args.message_id } };
    }

    case "DELETE_OUTLOOK_MESSAGE": {
      const connection = await loadOutlookConnection();
      if (!isOutlookConnected(connection)) throw new Error("No Outlook account connected — connect one in Settings (feeds the Vmail tab).");
      const { connection: refreshed } = await deleteOutlookMessage(connection, args.message_id);
      await saveOutlookConnection(refreshed);
      return { toolResult: { deleted: args.message_id } };
    }

    case "REPORT_OUTLOOK_SPAM": {
      const connection = await loadOutlookConnection();
      if (!isOutlookConnected(connection)) throw new Error("No Outlook account connected — connect one in Settings (feeds the Vmail tab).");
      const { connection: refreshed } = await markOutlookSpam(connection, args.message_id);
      await saveOutlookConnection(refreshed);
      return { toolResult: { reportedSpam: args.message_id } };
    }

    case "DRAFT_OUTLOOK_REPLY": {
      const connection = await loadOutlookConnection();
      if (!isOutlookConnected(connection)) throw new Error("No Outlook account connected — connect one in Settings (feeds the Vmail tab).");
      const { draftId, connection: refreshed } = await createOutlookDraftReply(connection, { messageId: args.message_id, body: args.body });
      await saveOutlookConnection(refreshed);
      return { toolResult: { draft: draftId } };
    }

    case "SEND_SLACK_MESSAGE": {
      const connection = await loadSlackConnection();
      if (!isSlackConnected(connection)) throw new Error("No Slack workspace connected — connect one in Settings.");
      const { ts } = await sendSlackMessage(connection, args.channel_id, args.text);
      return { toolResult: { sent: ts } };
    }

    case "CREATE_CLICKUP_TASK": {
      const connection = await loadClickUpConnection();
      if (!isClickUpConnected(connection)) throw new Error("No ClickUp workspace connected — connect one in Settings.");
      const listId = args.list_id || connection.defaultListId;
      if (!listId) throw new Error("No ClickUp list to create this in — pick a default list in Settings, or specify one.");
      const task = await createClickUpTask(connection, listId, args);
      return { toolResult: { clickupTask: task } };
    }

    case "UPDATE_CLICKUP_TASK": {
      const connection = await loadClickUpConnection();
      if (!isClickUpConnected(connection)) throw new Error("No ClickUp workspace connected — connect one in Settings.");
      const task = await updateClickUpTask(connection, args.task_id, args);
      return { toolResult: { clickupTask: task } };
    }

    case "DELETE_CLICKUP_TASK": {
      const connection = await loadClickUpConnection();
      if (!isClickUpConnected(connection)) throw new Error("No ClickUp workspace connected — connect one in Settings.");
      await deleteClickUpTask(connection, args.task_id);
      return { toolResult: { deleted: args.task_id } };
    }

    case "SEND_CLICKUP_MESSAGE": {
      const connection = await loadClickUpConnection();
      if (!isClickUpConnected(connection)) throw new Error("No ClickUp workspace connected — connect one in Settings.");
      const message = await sendClickUpMessage(connection, args.channel_id, args.content);
      return { toolResult: { clickupMessage: message } };
    }

    case "SET_CARD_VIEW": {
      const { view } = args;
      if (view !== "mini" && view !== "full") throw new Error('view must be "mini" or "full"');
      try {
        localStorage.setItem(CARD_VIEW_STORAGE_KEY, view);
      } catch {
        // best-effort — the choice just won't survive a reload
      }
      window.dispatchEvent(new CustomEvent(CARD_VIEW_CHANGE_EVENT, { detail: view }));
      return { toolResult: { view } };
    }

    default:
      throw new Error(`Unknown action "${action}"`);
  }
}

// Serializes records to CSV and triggers a browser download — no server
// round-trip, matching every other chat action's local-only execution.
function downloadCsv(entityType, records) {
  const headers = records.length ? Object.keys(records[0]) : [];
  const csvText = toCsv(headers, records);
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `vaea_${entityType}_export_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Resolves "$temp_id" placeholders against ids captured from earlier steps in
// the same plan. Walks arrays and plain objects recursively so a placeholder
// can appear anywhere in an action's args.
function resolvePlaceholders(value, tempIdMap) {
  if (typeof value === "string") {
    const match = value.match(/^\$(.+)$/);
    return match && tempIdMap[match[1]] !== undefined ? tempIdMap[match[1]] : value;
  }
  if (Array.isArray(value)) return value.map((v) => resolvePlaceholders(v, tempIdMap));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolvePlaceholders(v, tempIdMap)]));
  }
  return value;
}

// A plan risky enough to snapshot before running: more than one step (a
// multi-step AI plan or a CSV bulk-import — both go through this same
// function), or any single step that creates/deletes in bulk. A lone
// UPDATE_TASK_STATUS-style action already has its own per-action undo via
// actionHistory (useChatController.js) and doesn't need a full snapshot.
function planNeedsSnapshot(actions) {
  return actions.length > 1 || actions.some((a) => a.action === "BULK_CREATE" || DESTRUCTIVE_ACTIONS.has(a.action));
}

// Which key of a step's toolResult holds the entity to label a tool-log
// line with (e.g. ARCHIVE_PROJECT's result is `{ project }` — label the
// line with that project's own title, not its id).
const TOOL_LOG_RESULT_KEY = {
  CREATE_AREA: "area", UPDATE_AREA: "area", DELETE_AREA: "area",
  CREATE_PRODUCT: "product", UPDATE_PRODUCT: "product", DELETE_PRODUCT: "product", MOVE_PRODUCT: "product",
  CREATE_PROJECT: "project", UPDATE_PROJECT: "project", MOVE_PROJECT: "project",
  ARCHIVE_PROJECT: "project", RESTORE_PROJECT: "project", DELETE_PROJECT: "project",
  CREATE_TASK: "task", UPDATE_TASK: "task", UPDATE_TASK_STATUS: "task",
  TOGGLE_WEEKLY_FOCUS: "task", TOGGLE_TOP_THREE: "task", ARCHIVE_TASK: "task",
  RESTORE_TASK: "task", DELETE_TASK: "task",
  CREATE_STAKEHOLDER: "stakeholder", UPDATE_STAKEHOLDER: "stakeholder", DELETE_STAKEHOLDER: "stakeholder",
  CREATE_DEPARTMENT: "department", RENAME_DEPARTMENT: "department", DELETE_DEPARTMENT: "department",
  CREATE_NOTE: "note", UPDATE_NOTE: "note",
  SET_CUSTOM_FIELD: "entity", DELETE_CUSTOM_FIELD: "entity", REORDER_ENTITY: "entity",
};

function labelOf(entity) {
  return entity?.title || entity?.name || entity?.description || "";
}

// Turns one executed step into the same "tool call · fn(...)" shape the
// marketing site's hero mockup shows — built from the step's *real*
// toolResult (a project's actual title, a bulk action's actual count), not
// a canned string, so the chat transcript's tool-call log is always true.
export function describeToolCall({ action, toolResult }) {
  const fn = action.toLowerCase();
  const resultKey = TOOL_LOG_RESULT_KEY[action];
  if (resultKey) {
    const label = labelOf(toolResult?.[resultKey]);
    return label ? `${fn}("${label}")` : `${fn}()`;
  }
  if (typeof toolResult?.count === "number") {
    return `${fn}(${toolResult.count}${toolResult.entity_type ? ` ${toolResult.entity_type}` : ""})`;
  }
  return `${fn}()`;
}

// Same entity-type grouping as TOOL_LOG_RESULT_KEY, but read from a step's
// own args — used for the "plan · ..." line, shown before any step has run
// (so there's no toolResult yet to read a type from).
function entityTypeOfStep({ action, args }) {
  const key = TOOL_LOG_RESULT_KEY[action];
  if (key === "entity") return args?.entity_type || "item";
  if (key) return key;
  if (action === "BULK_CREATE" || action === "BULK_DELETE" || action === "EXPORT_CSV") return args?.entity_type || "item";
  return null;
}

// How many real entities a single step actually represents — 1 for every
// ordinary CREATE_*/UPDATE_*/etc. call, but a BULK_CREATE/BULK_DELETE step
// is one tool call standing in for however many items/ids are actually
// inside it (5 products in one BULK_CREATE call is 5 products, not 1).
// Missing this was a real bug: a plan of one BULK_CREATE(2 areas) + one
// BULK_CREATE(5 products) rendered as "plan · 2 steps across 1 area, 1
// product" — flatly wrong, and a real user caught it by clicking the line
// and comparing the summary against its own toolLogDetail JSON.
function entityCountOfStep({ action, args }) {
  if (action === "BULK_CREATE") return Array.isArray(args?.items) ? args.items.length : 1;
  if (action === "BULK_DELETE") return Array.isArray(args?.ids) ? args.ids.length : 1;
  return 1;
}

// The "plan · ..." line shown before a plan's steps run — tallies the real
// entity types the plan's own actions touch (2 projects, 1 stakeholder),
// not a canned summary, so it stays true even though nothing has executed yet.
export function describePlan(actions) {
  const counts = {};
  for (const step of actions) {
    const type = entityTypeOfStep(step);
    if (!type) continue;
    counts[type] = (counts[type] || 0) + entityCountOfStep(step);
  }
  const parts = Object.entries(counts).map(([type, n]) => `${n} ${type}${n === 1 ? "" : "s"}`);
  const stepWord = actions.length === 1 ? "step" : "steps";
  return parts.length
    ? `plan · ${actions.length} ${stepWord} across ${parts.join(", ")}`
    : `plan · ${actions.length} ${stepWord}`;
}

// The inverse of the ```tool-log fence describePlan/describeToolCall build —
// used by useChatController.js when folding past messages into
// conversationHistory sent back to the model. A persisted assistant message
// looks, from the model's own point of view, like ITS OWN past reply — and
// that reply's tool-log lines are literal pseudo-function-call syntax
// (archive_project("Q1 Newsletter"), bulk_create(5 area), ...). Feeding that
// back as context taught the model (in a real, observed case) to start
// imitating that exact text pattern in a NEW reply instead of actually
// calling tools — a classic in-context-imitation failure, not a size/token
// problem (it happened even with properly-sized 5-item batches). The
// [DATABASE STATE] block sent fresh every turn already reflects whatever
// those past steps really did, so the plain-English reply that follows the
// fence (always present — reply/"Done." is never blank) is all history
// actually needs to carry forward.
const TOOL_LOG_FENCE = /^```tool-log\n[\s\S]*?\n```\n\n/;
export function stripToolLog(content) {
  return content.replace(TOOL_LOG_FENCE, "").trim();
}

// Runs a plan's actions in order (not in parallel — later steps may depend
// on ids captured from earlier ones via temp_id/$placeholder). `onStep`,
// if given, is awaited after each step actually finishes — this is what
// lets the UI reveal tool-call lines as they really happen instead of only
// after the whole plan completes.
export async function executeActionSequence(actions, { onStep } = {}) {
  if (planNeedsSnapshot(actions)) {
    await createSnapshot(`Before ${actions.length > 1 ? `${actions.length}-step plan` : actions[0].action}`);
  }

  const tempIdMap = {};
  const steps = [];
  for (const step of actions) {
    const resolvedArgs = resolvePlaceholders(step.args || {}, tempIdMap);
    let result;
    try {
      result = await executeAction(step.action, resolvedArgs);
    } catch (err) {
      // Steps 1..k-1 (`steps` so far) already mutated real data for real —
      // this used to just throw `err` straight out, so both callers in
      // useChatController.js only ever saw a generic message with no way to
      // know some of the plan had already run. Undo info for those already-
      // succeeded steps (UPDATE_TASK_STATUS, TOGGLE_WEEKLY_FOCUS, etc.) was
      // silently lost too, since it only ever got registered from this
      // function's normal return value — never reached on a throw. Attaching
      // the completed steps to the thrown error lets the caller register
      // their undo info and tell the user exactly how far the plan got,
      // instead of losing both.
      const partialError = new Error(
        steps.length
          ? `${err.message} (${steps.length} of ${actions.length} step${actions.length === 1 ? "" : "s"} already completed before this failed.)`
          : err.message
      );
      partialError.completedSteps = steps;
      partialError.failedStep = { action: step.action, args: resolvedArgs };
      partialError.cause = err;
      throw partialError;
    }
    if (step.temp_id) {
      const created = Object.values(result.toolResult || {})[0];
      if (created && typeof created === "object" && created.id) tempIdMap[step.temp_id] = created.id;
    }
    const executed = { action: step.action, args: resolvedArgs, toolResult: result.toolResult };
    steps.push(executed);
    if (onStep) await onStep(executed);
  }
  return steps;
}

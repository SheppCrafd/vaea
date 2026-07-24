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
import { toCsv } from "@/lib/csv";
import { CARD_VIEW_STORAGE_KEY, CARD_VIEW_CHANGE_EVENT } from "@/lib/cardViewConstants";
import { loadAiIdentity, saveAiIdentity } from "@/lib/aiPreferences";
import { createSnapshot } from "@/lib/backupSnapshots";
import { loadVaultConnection, isVaultConnected } from "@/lib/vaultConnection";
import { writeVaultFile } from "@/lib/githubApi";
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
]);

// UNDO_LAST_ACTION is a real tool the assistant can call, but it's handled
// specially by useChatController.js's runUndo() rather than routed through
// executeAction below — it never appears alongside other actions in a plan
// (the server prompt requires it to be the only tool call in a turn).
export const NON_EXECUTABLE_ACTIONS = new Set(["UNDO_LAST_ACTION"]);

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
      const product = await updateProduct({ id: product_id, data: rest });
      return { toolResult: { product } };
    }
    case "DELETE_PRODUCT": {
      const product = await deleteProduct(args.product_id);
      return { toolResult: { product } };
    }

    case "CREATE_PROJECT": {
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
      const project = await updateProject({ id: project_id, data: rest });
      return { toolResult: { project } };
    }
    case "MOVE_PROJECT": {
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
      const listers = {
        area: () => localDb.areas.list(),
        product: () => localDb.products.list(),
        project: () => localDb.projects.list(),
        task: () => localDb.tasks.list(),
        stakeholder: () => localDb.stakeholders.list(),
        department: () => localDb.departments.list(),
        note: () => localDb.projectNotes.list(),
      };
      const lister = listers[args.entity_type];
      if (!lister) throw new Error(`Unknown entity_type "${args.entity_type}" for EXPORT_CSV`);
      const records = await lister();
      downloadCsv(args.entity_type, records);
      return { toolResult: { entity_type: args.entity_type, count: records.length } };
    }

    case "SET_AI_IDENTITY": {
      const current = await loadAiIdentity();
      const updated = { ...current, ...args };
      await saveAiIdentity(updated);
      return { toolResult: { identity: updated } };
    }

    case "WRITE_VAULT_NOTE": {
      const connection = await loadVaultConnection();
      if (!isVaultConnected(connection)) throw new Error("No Vaea Vault connected — set one up in Settings.");
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
  CREATE_PRODUCT: "product", UPDATE_PRODUCT: "product", DELETE_PRODUCT: "product",
  CREATE_PROJECT: "project", UPDATE_PROJECT: "project", MOVE_PROJECT: "project",
  ARCHIVE_PROJECT: "project", RESTORE_PROJECT: "project", DELETE_PROJECT: "project",
  CREATE_TASK: "task", UPDATE_TASK: "task", UPDATE_TASK_STATUS: "task",
  TOGGLE_WEEKLY_FOCUS: "task", TOGGLE_TOP_THREE: "task", ARCHIVE_TASK: "task",
  RESTORE_TASK: "task", DELETE_TASK: "task",
  CREATE_STAKEHOLDER: "stakeholder", UPDATE_STAKEHOLDER: "stakeholder", DELETE_STAKEHOLDER: "stakeholder",
  CREATE_DEPARTMENT: "department", RENAME_DEPARTMENT: "department", DELETE_DEPARTMENT: "department",
  CREATE_NOTE: "note", UPDATE_NOTE: "note",
  SET_CUSTOM_FIELD: "entity",
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

// The "plan · ..." line shown before a plan's steps run — tallies the real
// entity types the plan's own actions touch (2 projects, 1 stakeholder),
// not a canned summary, so it stays true even though nothing has executed yet.
export function describePlan(actions) {
  const counts = {};
  for (const step of actions) {
    const type = entityTypeOfStep(step);
    if (!type) continue;
    counts[type] = (counts[type] || 0) + 1;
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
const TOOL_LOG_FENCE = /^```tool-log\n[\s\S]*?\n```\n?/;
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
    const result = await executeAction(step.action, resolvedArgs);
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

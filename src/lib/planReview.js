// Two checks a Vaea Chat plan goes through before it runs.
//
// 1. connectorHoldReason: when the turn read outside content (an email, a
//    Slack thread, meeting notes, a web page), any step that changes a
//    connected app waits for the user's yes, whatever the settings say.
//    Text from outside can carry instructions aimed at the assistant, and a
//    sent message or a change in someone else's app can't be undone from
//    here.
//
// 2. reviewPlan: with auto-approve on, a plan that would normally wait for
//    the user's yes (a delete, a restore) is judged by a fixed rulebook
//    (REVIEW_RULES, below) instead. It runs only if it breaks none of them.
//
// Pure: both take the plan and data and return plain values, so they are
// tested without storage (planReview.test.js).

// Read tools whose results are the user's own: the board, its checkpoints
// and workflow cards, and their own notes. Every other tool that ran this
// turn counts as outside content (deny by default), so a reader added later
// is covered without anyone remembering to list it here.
const OWN_CONTENT_TOOLS = new Set([
  "search_workspace", "audit_workspace", "suggest_task_fields", "list_backups", "list_workflow_cards",
  "list_vault_notes", "read_vault_note", "search_vault", "audit_vault",
]);

// Plain words for the outside sources the reason names.
const OUTSIDE_SOURCES = [
  [/^(list|read)_(gmail|outlook)_message/, "email"],
  [/^list_slack_messages/, "Slack messages"],
  [/^list_clickup_(messages|tasks)/, "ClickUp"],
  [/^(list|get)_granola_meeting/, "meeting notes"],
  [/^(web_search|read_project_link)/, "a web page"],
  [/^list_(calendar|outlook)_events/, "calendar events"],
  [/^search_drive_files/, "Drive files"],
  [/^analyze_attachment/, "an attachment"],
];

// Steps that act on a connected app (mail, calendars, Drive, Slack, ClickUp,
// the notes repository) rather than the local board.
export function isConnectorStep(action) {
  return /(CALENDAR|DRIVE|GOOGLE|OUTLOOK|GMAIL|SLACK|CLICKUP|VAULT_NOTE)/.test(String(action || ""));
}

function outsideSourcesRead(liveTrace) {
  const found = [];
  for (const entry of liveTrace || []) {
    const name = String(entry?.label || "").split(/[\s(]/)[0].trim();
    if (!name || OWN_CONTENT_TOOLS.has(name)) continue;
    const word = OUTSIDE_SOURCES.find(([pattern]) => pattern.test(name))?.[1] || "content from outside Vaea";
    if (!found.includes(word)) found.push(word);
  }
  return found;
}

function listWords(words) {
  return words.length > 1 ? `${words.slice(0, -1).join(", ")} and ${words.at(-1)}` : words[0];
}

export function connectorHoldReason(actions, liveTrace) {
  const sources = outsideSourcesRead(liveTrace);
  if (!sources.length || !(actions || []).some((a) => isConnectorStep(a.action))) return null;
  return `This chat read ${listWords(sources)}, so changes to your connected apps wait for your yes.`;
}

// --- The auto-approve reviewer ------------------------------------------
//
// A fixed rulebook in the app's own code, not a model. Every chat plan
// reaches applyAssistantReply (useChatController.js) the same way, whichever
// model wrote it (hosted, your own API key, Local Mode), so the same rules
// judge every plan. The model is never asked whether its own plan is safe.
//
// A plan passes only if it breaks none of REVIEW_RULES. The rules check the
// whole plan, not just the steps that would have waited: one step a
// checkpoint can't undo is enough to hold all of it. Anything the reviewer
// doesn't recognise fails (deny by default). The user can switch rules off
// or change their numbers (DEFAULT_REVIEW_RULES); board-only stays on.

// Steps that only change the board. A checkpoint saves and restores every
// collection these touch (backupSnapshots.js COLLECTIONS), so Revert undoes
// them. Anything not listed here, including settings, agents, workflow
// cards, notes in the user's repository and every connected app, fails rule 1.
const BOARD_STEPS = new Set([
  "CREATE_AREA", "UPDATE_AREA", "DELETE_AREA",
  "CREATE_PRODUCT", "UPDATE_PRODUCT", "MOVE_PRODUCT", "DELETE_PRODUCT",
  "CREATE_PROJECT", "UPDATE_PROJECT", "MOVE_PROJECT", "ARCHIVE_PROJECT", "RESTORE_PROJECT", "DELETE_PROJECT",
  "CREATE_NOTE", "UPDATE_NOTE", "DELETE_NOTE",
  "CREATE_TASK", "UPDATE_TASK", "UPDATE_TASK_STATUS", "BULK_UPDATE_TASK_STATUS", "TOGGLE_WEEKLY_FOCUS",
  "TOGGLE_TOP_THREE", "ARCHIVE_TASK", "ARCHIVE_DONE_TASKS", "RESTORE_TASK", "DELETE_TASK",
  "CREATE_STAKEHOLDER", "UPDATE_STAKEHOLDER", "DELETE_STAKEHOLDER",
  "CREATE_DEPARTMENT", "RENAME_DEPARTMENT", "DELETE_DEPARTMENT",
  "SET_CUSTOM_FIELD", "DELETE_CUSTOM_FIELD", "REORDER_ENTITY",
  "BULK_CREATE", "BULK_DELETE", "RESTORE_BACKUP",
]);

// Steps that change nothing (save a checkpoint, download a CSV, open a page).
const NO_CHANGE_STEPS = new Set(["CREATE_BACKUP", "EXPORT_CSV", "OPEN_APP_SECTION"]);

// Which board item each step points at: [collection, id argument, word].
const AREA = ["areas", "area_id", "area"];
const PRODUCT = ["products", "product_id", "product"];
const PROJECT = ["projects", "project_id", "project"];
const NOTE = ["projectNotes", "note_id", "note"];
const TASK = ["tasks", "task_id", "task"];
const PERSON = ["stakeholders", "stakeholder_id", "person"];
const DEPARTMENT = ["departments", "department_id", "department"];
const STEP_TARGET = {
  UPDATE_AREA: AREA, DELETE_AREA: AREA,
  UPDATE_PRODUCT: PRODUCT, MOVE_PRODUCT: PRODUCT, DELETE_PRODUCT: PRODUCT,
  UPDATE_PROJECT: PROJECT, MOVE_PROJECT: PROJECT, ARCHIVE_PROJECT: PROJECT, RESTORE_PROJECT: PROJECT, DELETE_PROJECT: PROJECT,
  UPDATE_NOTE: NOTE, DELETE_NOTE: NOTE,
  UPDATE_TASK: TASK, UPDATE_TASK_STATUS: TASK, TOGGLE_WEEKLY_FOCUS: TASK, TOGGLE_TOP_THREE: TASK,
  ARCHIVE_TASK: TASK, RESTORE_TASK: TASK, DELETE_TASK: TASK,
  UPDATE_STAKEHOLDER: PERSON, DELETE_STAKEHOLDER: PERSON,
  RENAME_DEPARTMENT: DEPARTMENT, DELETE_DEPARTMENT: DEPARTMENT,
};
const KIND_TARGET = { area: AREA, product: PRODUCT, project: PROJECT, note: NOTE, task: TASK, stakeholder: PERSON, department: DEPARTMENT };

const DELETE_STEPS = new Set(["DELETE_AREA", "DELETE_PRODUCT", "DELETE_PROJECT", "DELETE_NOTE", "DELETE_TASK", "DELETE_STAKEHOLDER", "DELETE_DEPARTMENT"]);

// More than this many board items removed in one go always waits for a yes.
export const AUTO_APPROVE_MAX_REMOVED = 50;

// The main kinds the share rule protects, and the smallest removal it
// applies to: deleting 2 of your 3 projects is ordinary, deleting 6 of 10 is not.
const SHARE_KINDS = [["areas", "areas"], ["products", "products"], ["projects", "projects"], ["tasks", "tasks"]];
const SHARE_MIN_REMOVED = 3;

// Every kind of board item, as the kinds rule names them.
export const REMOVABLE_KINDS = [
  ["areas", "Areas", "area"], ["products", "Products", "product"], ["projects", "Projects", "project"],
  ["tasks", "Tasks", "task"], ["projectNotes", "Notes", "note"], ["stakeholders", "People", "person"],
  ["departments", "Departments", "department"],
];

// Bounds for the numbers the user can set, so a typo can't switch a rule
// off by accident (a limit of 0 would hold everything; 100000 would hold nothing).
export const LIMIT_RANGE = { min: 1, max: 500 };
export const SHARE_RANGE = { min: 10, max: 100, step: 5 };

// The user's settings for each rule. Only the user changes these, from the
// Review Rules panel; the assistant has no tool that writes them.
export const DEFAULT_REVIEW_RULES = {
  asked: { on: true },
  named: { on: true },
  count: { on: true },
  exists: { on: true },
  "no-repeats": { on: true },
  kinds: { on: true, allowed: REMOVABLE_KINDS.map(([c]) => c) },
  limit: { on: true, max: AUTO_APPROVE_MAX_REMOVED },
  share: { on: true, percent: 50 },
  "restore-alone": { on: true },
  "inside-only": { on: true },
};

const clamp = (n, { min, max }, fallback) => (Number.isFinite(Number(n)) ? Math.min(max, Math.max(min, Math.round(Number(n)))) : fallback);

// Fills gaps and pulls stored values back inside their bounds, so an old or
// hand-edited setting can never weaken a rule in a way the panel can't show.
export function normalizeReviewRules(stored) {
  const s = stored && typeof stored === "object" ? stored : {};
  const out = {};
  for (const [id, def] of Object.entries(DEFAULT_REVIEW_RULES)) {
    const v = s[id] && typeof s[id] === "object" ? s[id] : {};
    out[id] = { ...def, on: typeof v.on === "boolean" ? v.on : def.on };
  }
  out.limit.max = clamp(s.limit?.max, LIMIT_RANGE, AUTO_APPROVE_MAX_REMOVED);
  out.share.percent = clamp(s.share?.percent, SHARE_RANGE, 50);
  const known = new Set(REMOVABLE_KINDS.map(([c]) => c));
  out.kinds.allowed = Array.isArray(s.kinds?.allowed) ? s.kinds.allowed.filter((c) => known.has(c)) : [...DEFAULT_REVIEW_RULES.kinds.allowed];
  return out;
}

const LOCKED_RULES = new Set(["board-only", "from-you"]);

// The rulebook, in the order it's checked. `text` is the rule as one
// sentence for the current settings. Two are locked on: without board-only,
// auto-approve could send a message or change another app with nothing to
// undo it; without from-you, an agent the assistant wrote (perhaps on an
// email's say-so) could delete on a schedule with no one asking.
export const REVIEW_RULES = [
  { id: "board-only", title: "Board Only", locked: true, text: () => "Every step changes only your board, so a checkpoint can undo it. Nothing is sent, and nothing changes in another app or in your settings." },
  { id: "from-you", title: "From You", locked: true, text: () => "The plan answers a message you sent. Plans from agents and check-ins always wait for your yes." },
  { id: "asked", title: "You Asked for It", text: () => "Your last message asks to remove something, or to restore a checkpoint. \"Don't delete anything\" doesn't count." },
  { id: "named", title: "Named by You", text: () => "Every item it deletes is named in your last message. \"All\" or \"every\" covers what's inside something you named, and \"them\" or \"those\" covers the items in the reply you're answering." },
  { id: "count", title: "Matches Your Number", text: () => "When you give a number (\"delete 3 tasks\"), it removes exactly that many." },
  { id: "exists", title: "Items Exist", text: () => "Every item it changes or deletes is on your board now, or is made earlier in the same plan." },
  { id: "no-repeats", title: "No Repeats", text: () => "No item is deleted twice." },
  { id: "kinds", title: "Kinds It Can Remove", text: (r) => (r.kinds.allowed.length ? `It removes only ${listWords(REMOVABLE_KINDS.filter(([c]) => r.kinds.allowed.includes(c)).map(([, label]) => label.toLowerCase()))}.` : "It removes nothing.") },
  { id: "limit", title: "Removal Limit", text: (r) => `It removes at most ${r.limit.max} ${r.limit.max === 1 ? "item" : "items"}, counting everything each delete takes with it.` },
  { id: "share", title: "Share of Your Board", text: (r) => `It removes no more than ${r.share.percent}% of your areas, products, projects or tasks.` },
  { id: "restore-alone", title: "Restores Alone", text: () => "A checkpoint restore is the only step in its plan, and the checkpoint exists." },
  { id: "inside-only", title: "Nothing From Outside", text: () => "If the chat read email, messages, meeting notes, web pages or anything else from outside Vaea, it removes only items you named yourself." },
];

const ACTION_WORDS = {
  SEND: "sends", DELETE: "deletes", ARCHIVE: "archives", REPORT: "reports", UPDATE: "changes", CREATE: "creates",
  WRITE: "writes", SET: "changes", APPEND: "adds to", REPLACE: "replaces", ADD: "adds", SCHEDULE: "schedules",
  RESCHEDULE: "reschedules", DRAFT: "drafts", RUN: "runs",
};
const PROPER = { GMAIL: "Gmail", OUTLOOK: "Outlook", GOOGLE: "Google", CLICKUP: "ClickUp", SLACK: "Slack", DRIVE: "Drive", AI: "AI" };

function describeStep(action) {
  const [head, ...rest] = String(action).split("_");
  const noun = rest.map((w) => PROPER[w] || w.toLowerCase()).join(" ");
  if (!ACTION_WORDS[head] || !noun) return "takes a step Vaea's reviewer doesn't know";
  return `${ACTION_WORDS[head]} ${/^[aeiou]/i.test(noun) ? "an" : "a"} ${noun}`;
}

const live = (e) => e && !e.deleted_at;
const isPlanRef = (id) => typeof id === "string" && id.startsWith("$"); // made earlier in this plan

// Everything deleting this entity removes, children included (an area takes
// its products, projects and their tasks with it), as { collection: Set(ids) }.
function removalOf(del, entity, data) {
  const out = { [del[0]]: new Set([entity.id]) };
  const add = (collection, items) => items.forEach((e) => (out[collection] ||= new Set()).add(e.id));
  const liveIn = (collection, pred) => (data[collection] || []).filter((e) => live(e) && pred(e));
  let projects = [];
  if (del === AREA) {
    add("products", liveIn("products", (p) => p.parent_area_id === entity.id));
    projects = liveIn("projects", (p) => p.parent_area_id === entity.id);
  } else if (del === PRODUCT) {
    projects = liveIn("projects", (p) => p.parent_product_id === entity.id);
  } else if (del === PROJECT) {
    projects = [entity];
  }
  add("projects", projects);
  const projectIds = new Set(projects.map((p) => p.id));
  add("tasks", liveIn("tasks", (t) => projectIds.has(t.project_id)));
  return out;
}

// The board ids a step names, as [targetSpec, id] pairs.
function targetsOf({ action, args = {} }) {
  if (action === "BULK_DELETE") return (Array.isArray(args.ids) ? args.ids : [null]).map((id) => [KIND_TARGET[args.entity_type], id]);
  if (action === "BULK_UPDATE_TASK_STATUS") return (Array.isArray(args.task_ids) ? args.task_ids : [null]).map((id) => [TASK, id]);
  if (action === "SET_CUSTOM_FIELD" || action === "DELETE_CUSTOM_FIELD" || action === "REORDER_ENTITY") {
    return [[KIND_TARGET[args.entity_type], args.entity_id]];
  }
  const spec = STEP_TARGET[action];
  return spec ? [[spec, args[spec[1]]]] : [];
}

const isDeleteStep = (action) => DELETE_STEPS.has(action) || action === "BULK_DELETE";

// --- Reading the conversation -------------------------------------------
//
// The reviewer reads what the model read: the user's latest message, the
// recent chat, the board and the tools the chat ran. It never asks a model.
// It checks the plan against the user's own words: did they ask to remove
// something, did they name what goes, does the number match.

const norm = (s) => ` ${String(s || "").toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim()} `;

// Words too common to identify an item on their own.
const COMMON_WORDS = new Set([
  "the", "and", "for", "with", "from", "into", "our", "my", "your", "new", "old", "all", "of", "to", "in", "on", "a", "an",
  "area", "areas", "product", "products", "project", "projects", "task", "tasks", "note", "notes", "plan", "list", "item",
]);

// How `text` names the item titled `title`: "full" (the whole title, in
// order), "partial" (every distinctive word of it, in any order), or null.
// A partial match counts only when it can't mean another item (namedIn).
function matchKind(text, title) {
  const t = norm(text);
  const name = norm(title).trim();
  if (!name) return null;
  if (t.includes(` ${name} `)) return "full";
  const distinct = name.split(" ").filter((w) => w.length >= 3 && !COMMON_WORDS.has(w));
  // People usually leave a year or number off a title ("Website Redesign 2026").
  const words = distinct.some((w) => !/^\d+$/.test(w)) ? distinct.filter((w) => !/^\d+$/.test(w)) : distinct;
  if (!words.length) return null;
  if (words.length === 1) return words[0].length >= 4 && t.includes(` ${words[0]} `) ? "partial" : null;
  return words.every((w) => t.includes(` ${w} `)) ? "partial" : null;
}

export function namesItem(text, title) {
  return matchKind(text, title) !== null;
}

const REMOVE_VERBS = "delete|deleting|remove|removing|clear|clean up|cleanup|tidy|get rid of|wipe|erase|drop|trash|purge|archive|discard|scrap|ditch|toss|dump|eliminate|kill";
const RESTORE_VERBS = "restore|revert|undo|roll back|rollback|go back|put back|bring back";
const NEGATION = "dont|do not|never|without|no need to|not|stop";

// True when the text asks for one of `verbs`, and not only in the negative
// ("don't delete anything" is not a request to delete).
function asksTo(text, verbs) {
  const t = norm(text);
  const pattern = new RegExp(` (${verbs}) `, "g");
  let match;
  while ((match = pattern.exec(t))) {
    const before = t.slice(Math.max(0, match.index - 24), match.index + 1);
    if (!new RegExp(` (${NEGATION}) (\\w+ )?$`).test(before)) return true;
    pattern.lastIndex = match.index + 1;
  }
  return /(^|\s)\/tidy\b/.test(String(text || "")) && verbs === REMOVE_VERBS;
}

const REFERS_BACK = / (it|them|those|these|that|this|both|ones|the rest|all of them|each of them|everything you (listed|found|mentioned)) /;
const ALL_WORDS = / (all|every|everything|each|whole|entire) /;
const DONE_WORDS = / (done|completed|complete|finished|archive) /;

const NUMBER_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20 };
const KIND_WORDS = [
  ["areas", /^areas?$/], ["products", /^products?$/], ["projects", /^projects?$/], ["tasks", /^tasks?$/],
  ["projectNotes", /^notes?$/], ["stakeholders", /^(people|persons?|stakeholders?|contacts?)$/], ["departments", /^departments?$/],
];

// "delete 3 tasks", "remove the two old projects": the number the user gave
// for each kind.
function numbersAskedFor(text) {
  const words = norm(text).trim().split(" ");
  const out = {};
  words.forEach((w, i) => {
    const n = /^\d+$/.test(w) ? Number(w) : NUMBER_WORDS[w];
    if (!n) return;
    for (const next of words.slice(i + 1, i + 4)) {
      const kind = KIND_WORDS.find(([, re]) => re.test(next));
      if (kind) { out[kind[0]] = n; break; }
    }
  });
  return out;
}

// The items above this one (a task's project, product and area), so "delete
// every task in Launch" names each task through its project.
function ancestorsOf(collection, entity, data) {
  const find = (c, id) => (id ? (data[c] || []).find((e) => e.id === id) : null);
  const out = [];
  let project = collection === "tasks" || collection === "projectNotes" ? find("projects", entity.project_id) : collection === "projects" ? entity : null;
  if (project && project !== entity) out.push(project);
  const product = collection === "products" ? entity : find("products", project?.parent_product_id);
  if (product && product !== entity) out.push(product);
  const area = find("areas", (collection === "areas" ? null : product?.parent_area_id || project?.parent_area_id || entity.parent_area_id));
  if (area) out.push(area);
  return out;
}

const SPEC_BY_COLLECTION = { areas: AREA, products: PRODUCT, projects: PROJECT, projectNotes: NOTE, tasks: TASK, stakeholders: PERSON, departments: DEPARTMENT };

const titleOf = (e) => e?.title || e?.name || e?.label || "";

// A session's messages (oldest first) as the conversation reviewPlan reads:
// the latest user message, and everything up to it. Each message keeps the
// tools its turn ran (liveTrace), so a reply built on outside content is
// known to be.
export function conversationFrom(messages) {
  const history = (messages || []).filter((m) => m && (m.role === "user" || m.role === "assistant"));
  const last = history.map((m) => m.role).lastIndexOf("user");
  return { latest: last >= 0 ? String(history[last].content || "") : "", history: history.slice(0, last + 1) };
}

// The latest user message, and the one assistant reply right before it
// (what "them" or "it" can point back to). `conversation` is
// { latest, history: [{ role, content, liveTrace }] }, oldest first, or
// { fromAgent: true } for a plan no one typed a message for.
function readConversation(conversation) {
  const latest = String(conversation?.latest || "");
  const history = Array.isArray(conversation?.history) ? conversation.history : [];
  const lastUser = history.map((m) => m.role).lastIndexOf("user");
  const prev = lastUser > 0 && history[lastUser - 1]?.role === "assistant" ? history[lastUser - 1] : null;
  return {
    latest,
    before: String(prev?.content || ""),
    beforeSources: outsideSourcesRead(prev?.liveTrace),
    fromAgent: conversation?.fromAgent === true,
    known: !!latest.trim(),
  };
}

// "all the tasks in Launch": the name has to follow the "all", not sit
// anywhere in the message.
function namedAfterAll(text, title) {
  const words = norm(text).trim().split(" ");
  return words.some((w, i) => ALL_WORDS.test(` ${w} `) && namesItem(words.slice(i + 1, i + 12).join(" "), title));
}

// Judges a plan against REVIEW_RULES. `data` is the board (loadBoardData),
// `checkpoints` the saved checkpoints (listSnapshots), `liveTrace` the tools
// the chat ran while making the plan, `conversation` the user's latest
// message and the chat before it. Pure, so planReview.test.js runs every
// rule without storage. Each problem names the step it's about (`step`, an
// index into the plan) so the held card can point at it.
export function reviewPlan(actions, data = {}, { checkpoints = [], liveTrace = [], rules: storedRules, conversation } = {}) {
  const steps = actions || [];
  const rules = normalizeReviewRules(storedRules);
  const problems = [];
  const fail = (rule, text, step = null) => {
    if (!LOCKED_RULES.has(rule) && !rules[rule]?.on) return;
    if (!problems.some((p) => p.text === text)) problems.push({ rule, text, step });
  };

  const removedIds = {}; // collection -> Set of ids this plan removes
  const removals = []; // the items the plan itself names for removal
  const deletedOnce = new Set();
  let planMade = 0;
  let restoreStep = null;
  let archiveDoneStep = null;

  steps.forEach((step, index) => {
    const { action } = step;

    // Board only.
    if (NO_CHANGE_STEPS.has(action)) return;
    if (!BOARD_STEPS.has(action)) {
      fail("board-only", `It ${describeStep(action)}, which a checkpoint can't undo.`, index);
      return;
    }

    // Restores alone.
    if (action === "RESTORE_BACKUP") {
      restoreStep = index;
      const id = step.args?.snapshot_id;
      if (steps.filter((s) => !NO_CHANGE_STEPS.has(s.action)).length > 1) fail("restore-alone", "It restores a checkpoint and makes other changes in the same plan.", index);
      if (!checkpoints.some((c) => c.id === id)) fail("restore-alone", "It restores a checkpoint that isn't saved.", index);
      return;
    }

    // Items exist, and no repeats.
    for (const [spec, id] of targetsOf(step)) {
      if (!spec) { fail("exists", `It changes a kind of item Vaea doesn't know ("${step.args?.entity_type}").`, index); continue; }
      const [collection, , word] = spec;
      if (typeof id !== "string" || !id) { fail("exists", `It changes a ${word} without saying which one.`, index); continue; }
      if (isDeleteStep(action)) {
        if (deletedOnce.has(id)) { fail("no-repeats", `It deletes the same ${word} twice.`, index); continue; }
        deletedOnce.add(id);
      }
      if (isPlanRef(id)) { if (isDeleteStep(action)) planMade += 1; continue; }
      const entity = (data[collection] || []).find((e) => e.id === id);
      if (!live(entity)) { fail("exists", `It ${isDeleteStep(action) ? "deletes" : "changes"} a ${word} that isn't on your board.`, index); continue; }
      if (isDeleteStep(action)) {
        removals.push({ step: index, collection, word, entity });
        for (const [c, ids] of Object.entries(removalOf(spec, entity, data))) ids.forEach((x) => (removedIds[c] ||= new Set()).add(x));
      }
    }

    if (action === "ARCHIVE_DONE_TASKS") {
      archiveDoneStep = index;
      (data.tasks || [])
        .filter((t) => live(t) && !t.archived_at && (t.status === "DONE" || t.status === "DELEGATED_DONE"))
        .forEach((t) => (removedIds.tasks ||= new Set()).add(t.id));
    }
  });

  // What the user asked for. Checked only when the plan removes or restores
  // something, since only those plans reach the reviewer.
  const talk = readConversation(conversation);
  const removes = removals.length > 0 || archiveDoneStep !== null || planMade > 0;
  const firstRemoval = removals[0]?.step ?? archiveDoneStep;

  // A partial name ("the newsletter") counts only if no other item on the
  // board answers to it too, unless the kind is said as well ("the
  // newsletter project").
  const everyItem = Object.entries(SPEC_BY_COLLECTION).flatMap(([c]) => (data[c] || []).filter(live).map((e) => [c, e]));
  const namedIn = (text, r) => {
    const kind = matchKind(text, titleOf(r.entity));
    if (kind === "full") return true;
    if (kind !== "partial") return false;
    if (new RegExp(` ${r.word}s? `).test(norm(text))) return true;
    return !everyItem.some(([, e]) => e.id !== r.entity.id && matchKind(text, titleOf(e)));
  };
  const namedByUser = (r) => namedIn(talk.latest, r)
    || ancestorsOf(r.collection, r.entity, data).some((a) => namedAfterAll(talk.latest, titleOf(a)));
  // "it", "that", "this" point back to one item; "them", "those" to several.
  // Only the reply right before your message counts, and not one built on
  // outside content (which could have put the names there).
  const singular = !/ (them|those|these|both|all|everything|ones|the rest) /.test(norm(talk.latest));
  const canReferBack = REFERS_BACK.test(norm(talk.latest)) && !talk.beforeSources.length;
  const earlierOnly = removals.filter((r) => !namedByUser(r));
  const namedEarlier = (r) => canReferBack && namedIn(talk.before, r) && !(singular && earlierOnly.length > 1);

  // From you: a plan an agent or check-in made, with no message from you
  // behind it, always waits. An agent's purpose isn't proof of what you
  // want: the assistant can write one too.
  if ((removes || restoreStep !== null) && talk.fromAgent) {
    fail("from-you", "An agent made this plan, not a message from you, so it waits for your yes.", firstRemoval ?? restoreStep);
  } else if ((removes || restoreStep !== null) && !talk.known) {
    fail("asked", "Vaea couldn't read the message this plan answers.", firstRemoval ?? restoreStep);
  } else {
    // You asked for it.
    if (removes && !asksTo(talk.latest, REMOVE_VERBS)) fail("asked", "Your last message doesn't ask to remove anything.", firstRemoval);
    if (restoreStep !== null && !asksTo(talk.latest, RESTORE_VERBS)) fail("asked", "Your last message doesn't ask to restore a checkpoint.", restoreStep);

    // Named by you.
    for (const r of removals) {
      if (!namedByUser(r) && !namedEarlier(r)) fail("named", `It deletes the "${titleOf(r.entity) || "untitled"}" ${r.word}, which your messages don't name.`, r.step);
    }
    if (archiveDoneStep !== null && !DONE_WORDS.test(norm(talk.latest))) {
      fail("named", "It archives every done task, and your last message doesn't mention done tasks.", archiveDoneStep);
    }

    // Matches your number.
    for (const [collection, asked] of Object.entries(numbersAskedFor(talk.latest))) {
      const planned = removals.filter((r) => r.collection === collection);
      const word = REMOVABLE_KINDS.find(([c]) => c === collection);
      if (planned.length && planned.length !== asked) {
        fail("count", `You asked to remove ${asked} ${asked === 1 ? word[2] : word[1].toLowerCase()}, and it removes ${planned.length}.`, planned[0].step);
      }
    }
  }

  // Kinds: every kind this plan removes, children included, must be allowed.
  for (const [collection, label, word] of REMOVABLE_KINDS) {
    if (removedIds[collection]?.size && !rules.kinds.allowed.includes(collection)) {
      const step = removals.find((r) => removalOf(SPEC_BY_COLLECTION[r.collection], r.entity, data)[collection]?.size)?.step ?? firstRemoval;
      fail("kinds", `It removes ${removedIds[collection].size === 1 ? `a ${word}` : `${removedIds[collection].size} ${label.toLowerCase()}`}, and auto-approve is set not to remove ${label.toLowerCase()}.`, step);
    }
  }

  // Limit. A child removed by two deletes counts once.
  const removed = planMade + Object.values(removedIds).reduce((n, ids) => n + ids.size, 0);
  if (removed > rules.limit.max) {
    fail("limit", `It removes ${removed} items at once, and the limit is ${rules.limit.max}.`, firstRemoval);
  }

  // Share.
  for (const [collection, word] of SHARE_KINDS) {
    const gone = removedIds[collection]?.size || 0;
    const total = (data[collection] || []).filter(live).length;
    if (gone >= SHARE_MIN_REMOVED && gone * 100 > total * rules.share.percent) {
      fail("share", `It removes ${gone} of your ${total} ${word}, more than ${rules.share.percent === 50 ? "half" : `${rules.share.percent}%`}.`, firstRemoval);
    }
  }

  // Nothing from outside. Outside text can carry instructions aimed at the
  // assistant. A removal the user named in their own latest message can't
  // have come from there; anything else waits for a yes.
  // The reply right before your message counts too: a summary of an email
  // carries the email's words.
  const sources = [...new Set([...outsideSourcesRead(liveTrace), ...talk.beforeSources])];
  if (sources.length) {
    const unnamed = removals.find((r) => !namedIn(talk.latest, r));
    const other = unnamed?.step ?? (archiveDoneStep !== null && !DONE_WORDS.test(norm(talk.latest)) ? archiveDoneStep : null) ?? restoreStep;
    if (other !== null && other !== undefined) {
      fail("inside-only", `The chat read ${listWords(sources)} while making this plan, and you didn't name ${unnamed ? `the "${titleOf(unnamed.entity) || "untitled"}" ${unnamed.word}` : "this change"} yourself.`, other);
    }
  }

  const ok = problems.length === 0;
  const count = steps.length;
  return {
    ok,
    problems,
    removed,
    summary: ok
      ? `Passed ${REVIEW_RULES.filter((r) => r.locked || rules[r.id]?.on).length} review rules for ${count} ${count === 1 ? "step" : "steps"}. It removes ${removed} ${removed === 1 ? "item" : "items"}, and a checkpoint can undo all of it.`
      : problems[0].text,
  };
}

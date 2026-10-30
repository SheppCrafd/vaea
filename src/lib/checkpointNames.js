// Names a checkpoint after what the change did and where, from the plan's
// own steps and the board as it was just before they ran, e.g.
//   Deleted project "Q1 Newsletter" from Marketing
//   Added 3 tasks to Launch plan
//   Added 2 projects and 4 tasks, deleted 1 task in Marketing
// instead of "Before 3-step plan". Pure: takes the plan and the board data,
// so it's tested without storage (checkpointNames.test.js).

import { statusLabel } from "@/lib/taskUtils";

const MAX_LENGTH = 90;

// Board collections, keyed by the entity type the chat actions use.
const COLLECTION = {
  area: "areas", product: "products", project: "projects", task: "tasks",
  note: "projectNotes", stakeholder: "stakeholders", department: "departments",
};

// Action -> [verb, entity type, id arg]. Creates carry no id; their name and
// parent come from the args themselves.
const BOARD_STEPS = {
  CREATE_AREA: ["added", "area"], UPDATE_AREA: ["edited", "area", "area_id"], DELETE_AREA: ["deleted", "area", "area_id"],
  CREATE_PRODUCT: ["added", "product"], UPDATE_PRODUCT: ["edited", "product", "product_id"], DELETE_PRODUCT: ["deleted", "product", "product_id"],
  MOVE_PRODUCT: ["moved", "product", "product_id"],
  CREATE_PROJECT: ["added", "project"], UPDATE_PROJECT: ["edited", "project", "project_id"], DELETE_PROJECT: ["deleted", "project", "project_id"],
  MOVE_PROJECT: ["moved", "project", "project_id"], ARCHIVE_PROJECT: ["archived", "project", "project_id"], RESTORE_PROJECT: ["restored", "project", "project_id"],
  CREATE_NOTE: ["added", "note"], UPDATE_NOTE: ["edited", "note", "note_id"], DELETE_NOTE: ["deleted", "note", "note_id"],
  CREATE_TASK: ["added", "task"], UPDATE_TASK: ["edited", "task", "task_id"], DELETE_TASK: ["deleted", "task", "task_id"],
  UPDATE_TASK_STATUS: ["marked", "task", "task_id"], ARCHIVE_TASK: ["archived", "task", "task_id"], RESTORE_TASK: ["restored", "task", "task_id"],
  TOGGLE_WEEKLY_FOCUS: ["refocused", "task", "task_id"], TOGGLE_TOP_THREE: ["refocused", "task", "task_id"],
  CREATE_STAKEHOLDER: ["added", "stakeholder"], UPDATE_STAKEHOLDER: ["edited", "stakeholder", "stakeholder_id"], DELETE_STAKEHOLDER: ["deleted", "stakeholder", "stakeholder_id"],
  CREATE_DEPARTMENT: ["added", "department"], RENAME_DEPARTMENT: ["renamed", "department", "department_id"], DELETE_DEPARTMENT: ["deleted", "department", "department_id"],
};

const CREATE_BY_TYPE = {
  area: "CREATE_AREA", product: "CREATE_PRODUCT", project: "CREATE_PROJECT", task: "CREATE_TASK",
  note: "CREATE_NOTE", stakeholder: "CREATE_STAKEHOLDER", department: "CREATE_DEPARTMENT",
};
const DELETE_BY_TYPE = {
  area: ["DELETE_AREA", "area_id"], product: ["DELETE_PRODUCT", "product_id"], project: ["DELETE_PROJECT", "project_id"],
  task: ["DELETE_TASK", "task_id"], note: ["DELETE_NOTE", "note_id"], stakeholder: ["DELETE_STAKEHOLDER", "stakeholder_id"],
  department: ["DELETE_DEPARTMENT", "department_id"],
};

const PREPOSITION = { added: "to", imported: "into", deleted: "from", moved: "to" };

// Words for the steps that aren't board edits (connected apps, settings).
const VERB_PREFIX = {
  CREATE: "added", ADD: "added", UPDATE: "edited", APPEND: "edited", REPLACE: "edited", DELETE: "deleted",
  SEND: "sent", ARCHIVE: "archived", DRAFT: "drafted", REPORT: "reported", SCHEDULE: "scheduled",
  RESCHEDULE: "rescheduled", SET: "changed", MOVE: "moved", RESTORE: "restored", RENAME: "renamed", WRITE: "wrote",
};
const PROPER_WORDS = { GMAIL: "Gmail", OUTLOOK: "Outlook", GOOGLE: "Google", CLICKUP: "ClickUp", SLACK: "Slack", DRIVE: "Drive", AI: "AI" };

function short(text, max = 40) {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

function plural(type, n) {
  if (n === 1) return type;
  return type.endsWith("y") ? `${type.slice(0, -1)}ies` : `${type}s`;
}

function capitalise(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

function nameOf(type, entity) {
  if (!entity) return "";
  if (type === "task") return short(entity.description || entity.title);
  if (type === "note") return "";
  return short(entity.title || entity.name);
}

function makeLookup(data) {
  const byId = {};
  for (const [type, key] of Object.entries(COLLECTION)) {
    byId[type] = new Map((data?.[key] || []).map((e) => [e.id, e]));
  }
  return (type, id) => (id ? byId[type]?.get(id) : undefined);
}

// Where an entity sits: its direct parent's name (the project a task is in,
// the product or area a project is in) and the area at the top of the chain.
function placeOf(type, entity, find) {
  if (!entity) return { where: "", area: "" };
  if (type === "task" || type === "note") {
    const project = find("project", entity.project_id);
    return { where: project ? short(project.title) : "", area: placeOf("project", project, find).area };
  }
  if (type === "project") {
    const product = find("product", entity.parent_product_id);
    const area = find("area", entity.parent_area_id || product?.parent_area_id);
    return { where: product ? short(product.title) : area ? short(area.title) : "", area: area ? short(area.title) : "" };
  }
  if (type === "product") {
    const area = find("area", entity.parent_area_id);
    return { where: area ? short(area.title) : "", area: area ? short(area.title) : "" };
  }
  if (type === "area") return { where: "", area: short(entity.title) };
  return { where: "", area: "" };
}

// One plain fact per entity the plan touches: { verb, type, name, where, area, extra }.
function factsFor(actions, find) {
  const facts = [];
  const created = {}; // temp_id -> the args of a create earlier in this plan
  const resolve = (type, id) => {
    if (typeof id === "string" && id.startsWith("$")) {
      const args = created[id.slice(1)];
      return args ? { ...args } : undefined;
    }
    return find(type, id);
  };
  const lookup = (type, id) => resolve(type, id);

  const pushBoardStep = (action, args, temp_id) => {
    const [verb, type, idKey] = BOARD_STEPS[action];
    if (verb === "added" && temp_id) created[temp_id] = args;
    const entity = idKey ? lookup(type, args?.[idKey]) : args;
    // A move's "where" is where it went, so read the destination from args.
    const placeSource = verb === "moved" ? { ...entity, ...args } : entity;
    const { where, area } = placeOf(type, placeSource, lookup);
    let extra = "";
    if (action === "UPDATE_TASK_STATUS") extra = statusLabel(args?.status);
    facts.push({ verb, type, name: nameOf(type, entity), where, area, extra });
  };

  for (const step of actions || []) {
    const { action, args = {}, temp_id } = step;
    if (BOARD_STEPS[action]) {
      pushBoardStep(action, args, temp_id);
    } else if (action === "BULK_CREATE" && CREATE_BY_TYPE[args.entity_type]) {
      for (const item of args.items || []) pushBoardStep(CREATE_BY_TYPE[args.entity_type], item, item.temp_id);
    } else if (action === "BULK_DELETE" && DELETE_BY_TYPE[args.entity_type]) {
      const [del, idKey] = DELETE_BY_TYPE[args.entity_type];
      for (const id of args.ids || []) pushBoardStep(del, { [idKey]: id });
    } else if (action === "BULK_UPDATE_TASK_STATUS") {
      for (const id of args.task_ids || []) pushBoardStep("UPDATE_TASK_STATUS", { task_id: id, status: args.status });
    } else if (action === "ARCHIVE_DONE_TASKS") {
      facts.push({ verb: "archived", type: "done task", name: "", where: "", area: "", bulk: true });
    } else if (action === "RESTORE_BACKUP") {
      facts.push({ verb: "restored", type: "checkpoint", name: "", where: "", area: "", lone: "Restored an earlier checkpoint" });
    } else if (!["OPEN_APP_SECTION", "EXPORT_CSV", "CREATE_BACKUP"].includes(action)) {
      // A connected-app or settings step: "Sent Gmail message", "Added calendar event".
      const [head, ...rest] = String(action).split("_");
      const verb = VERB_PREFIX[head] || "changed";
      const noun = rest.map((w) => PROPER_WORDS[w] || w.toLowerCase()).join(" ") || "setting";
      facts.push({ verb, type: noun, name: short(args.title || args.subject || args.name || args.summary), where: "", area: "" });
    }
  }
  return facts;
}

// `skipVerb` drops the verb when the previous phrase used the same one
// ("Added area "Platform" and product "Core""); `skipWhere` drops a place
// that's just the thing named earlier in the same name.
function phraseOne(f, { skipVerb = false, skipWhere = false } = {}) {
  if (f.lone) return f.lone;
  if (f.bulk) return `${capitalise(f.verb)} ${plural(f.type, 2)}`;
  const target = f.name ? `${f.type} "${f.name}"` : f.type === "note" ? "a note" : f.type;
  const where = skipWhere ? "" : f.where;
  if (f.verb === "marked") return `${skipVerb ? "" : "Marked "}${target} ${f.extra || "updated"}${where ? ` in ${where}` : ""}`;
  if (f.verb === "refocused") return `Changed focus for ${target}`;
  const prep = PREPOSITION[f.verb] || "in";
  return `${skipVerb ? "" : `${capitalise(f.verb)} `}${target}${where ? ` ${prep} ${where}` : ""}`;
}

// Two or three different changes, each named: "Added task "Brief" to
// Launch and deleted task "Old brief"". Null when it would run too long.
function phraseFew(facts) {
  const named = new Set();
  // One shared place goes once, at the end.
  const shared = facts.length > 1 ? sameValue(facts, "where") : "";
  const parts = facts.map((f, i) => {
    const bare = f.where;
    const skipVerb = i > 0 && facts[i - 1].verb === f.verb;
    const phrase = phraseOne(f, { skipVerb, skipWhere: !!shared || named.has(bare) });
    if (f.name) named.add(f.name);
    return i > 0 && !skipVerb ? phrase[0].toLowerCase() + phrase.slice(1) : phrase;
  });
  const joined = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : parts[0];
  const text = shared ? `${joined} in ${shared}` : joined;
  return text.length <= MAX_LENGTH ? text : null;
}

function sameValue(facts, key) {
  const values = new Set(facts.map((f) => f[key]));
  return values.size === 1 ? [...values][0] : "";
}

export function nameCheckpoint(actions, data, { source } = {}) {
  const find = makeLookup(data);
  let facts = factsFor(actions, find);
  if (source === "csv") facts = facts.map((f) => (f.verb === "added" ? { ...f, verb: "imported" } : f));
  if (facts.length === 0) return "Change from Vaea Chat";
  if (facts.length === 1) return clip(phraseOne(facts[0]));

  // Group by verb, then by type within each verb, keeping plan order.
  const groups = new Map();
  for (const f of facts) {
    if (!groups.has(f.verb)) groups.set(f.verb, new Map());
    const types = groups.get(f.verb);
    types.set(f.type, (types.get(f.type) || 0) + 1);
  }

  // One verb, one type: "Added 3 tasks to Launch plan".
  if (groups.size === 1 && [...groups.values()][0].size === 1) {
    const f = facts[0];
    if (f.verb === "marked") {
      const status = sameValue(facts, "extra");
      const where = sameValue(facts, "where") || sameValue(facts, "area");
      return clip(`Marked ${facts.length} tasks ${status || "updated"}${where ? ` in ${where}` : ""}`);
    }
    const count = `${facts.length} ${plural(f.type, facts.length)}`;
    const where = sameValue(facts, "where");
    const area = sameValue(facts, "area");
    const prep = PREPOSITION[f.verb] || "in";
    if (source === "csv") return clip(`Imported ${count} from a CSV file`);
    if (where) return clip(`${capitalise(f.verb)} ${count} ${prep} ${where}`);
    if (area) return clip(`${capitalise(f.verb)} ${count} in ${area}`);
    return clip(`${capitalise(f.verb)} ${count}`);
  }

  if (facts.length <= 3 && source !== "csv") {
    const few = phraseFew(facts);
    if (few) return few;
  }

  // Mixed: "Added 2 projects and 4 tasks, deleted 1 task in Marketing".
  const clauses = [...groups.entries()].map(([verb, types], i) => {
    const things = [...types.entries()].map(([type, n]) => `${n} ${plural(type, n)}`);
    const list = things.length > 1 ? `${things.slice(0, -1).join(", ")} and ${things.at(-1)}` : things[0];
    return `${i === 0 ? capitalise(verb) : verb} ${list}`;
  });
  const place = sameValue(facts, "where") || sameValue(facts, "area");
  const tail = source === "csv" ? " from a CSV file" : place ? ` in ${place}` : "";
  return clip(`${clauses.join(", ")}${tail}`);
}

function clip(text) {
  return text.length > MAX_LENGTH ? `${text.slice(0, MAX_LENGTH - 1).trimEnd()}…` : text;
}

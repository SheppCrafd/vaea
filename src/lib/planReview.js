// Two checks a Vaea Chat plan goes through before it runs.
//
// 1. connectorHoldReason: when the turn read outside content (an email, a
//    Slack thread, meeting notes, a web page), any step that changes a
//    connected app waits for the user's yes, even with auto-approve on.
//    Text from outside can carry instructions aimed at the assistant, and a
//    sent message or a change in someone else's app can't be undone from
//    here. Board changes in the same turn still run: a checkpoint covers them.
//
// 2. reviewPlan: with auto-approve on, a plan that would normally wait for
//    the user's yes (a delete, a restore) is checked against the board
//    instead. It passes only if every step can be undone by a checkpoint,
//    every target exists, and it doesn't remove too much at once.
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

// Board collections a checkpoint saves and restores (backupSnapshots.js).
const ID_TARGETS = {
  DELETE_AREA: ["areas", "area_id", "area"], DELETE_PRODUCT: ["products", "product_id", "product"],
  DELETE_PROJECT: ["projects", "project_id", "project"], DELETE_TASK: ["tasks", "task_id", "task"],
  DELETE_NOTE: ["projectNotes", "note_id", "note"], DELETE_STAKEHOLDER: ["stakeholders", "stakeholder_id", "person"],
  DELETE_DEPARTMENT: ["departments", "department_id", "department"],
};
const BULK_DELETE_TARGETS = {
  area: "DELETE_AREA", product: "DELETE_PRODUCT", project: "DELETE_PROJECT", task: "DELETE_TASK",
  note: "DELETE_NOTE", stakeholder: "DELETE_STAKEHOLDER", department: "DELETE_DEPARTMENT",
};

// The waiting steps a checkpoint can undo: board deletes, archiving done
// tasks, and restoring a checkpoint (which saves one of its own first).
const UNDOABLE = new Set([...Object.keys(ID_TARGETS), "BULK_DELETE", "ARCHIVE_DONE_TASKS", "RESTORE_BACKUP"]);

// More than this many board items removed in one go always waits for a yes.
export const AUTO_APPROVE_MAX_REMOVED = 50;

const ACTION_WORDS = {
  SEND: "sends", DELETE: "deletes", ARCHIVE: "archives", REPORT: "reports", UPDATE: "changes", CREATE: "creates",
};
const PROPER = { GMAIL: "Gmail", OUTLOOK: "Outlook", GOOGLE: "Google", CLICKUP: "ClickUp", SLACK: "Slack", DRIVE: "Drive" };

function describeStep(action) {
  const [head, ...rest] = String(action).split("_");
  const noun = rest.map((w) => PROPER[w] || w.toLowerCase()).join(" ");
  return `${ACTION_WORDS[head] || "changes"} ${/^[aeiou]/i.test(noun) ? "an" : "a"} ${noun}`;
}

const live = (e) => e && !e.deleted_at;

// How many live board items deleting this entity removes, children included
// (an area takes its products, projects and their tasks with it).
function removedCount(action, entity, data) {
  if (!entity) return 0;
  const tasksOf = (projectIds) => (data.tasks || []).filter((t) => live(t) && projectIds.has(t.project_id)).length;
  if (action === "DELETE_AREA") {
    const products = (data.products || []).filter((p) => live(p) && p.parent_area_id === entity.id);
    const projects = (data.projects || []).filter((p) => live(p) && p.parent_area_id === entity.id);
    return 1 + products.length + projects.length + tasksOf(new Set(projects.map((p) => p.id)));
  }
  if (action === "DELETE_PRODUCT") {
    const projects = (data.projects || []).filter((p) => live(p) && p.parent_product_id === entity.id);
    return 1 + projects.length + tasksOf(new Set(projects.map((p) => p.id)));
  }
  if (action === "DELETE_PROJECT") return 1 + tasksOf(new Set([entity.id]));
  return 1;
}

export function reviewPlan(actions, data, { waitingActions } = {}) {
  const problems = [];
  let removed = 0;
  const steps = actions || [];
  const waiting = waitingActions || ((a) => UNDOABLE.has(a.action) || isConnectorStep(a.action));

  for (const step of steps) {
    const { action, args = {} } = step;
    if (!waiting(step)) continue;

    if (!UNDOABLE.has(action)) {
      problems.push(`It ${describeStep(action)}, which a checkpoint can't undo.`);
      continue;
    }

    const targets = action === "BULK_DELETE"
      ? (args.ids || []).map((id) => [BULK_DELETE_TARGETS[args.entity_type], id])
      : ID_TARGETS[action] ? [[action, args[ID_TARGETS[action][1]]]] : [];

    for (const [del, id] of targets) {
      if (!del) { problems.push(`It deletes a kind of item Vaea doesn't know ("${args.entity_type}").`); continue; }
      const [collection, , word] = ID_TARGETS[del];
      if (typeof id === "string" && id.startsWith("$")) { removed += 1; continue; } // made earlier in this plan
      const entity = (data?.[collection] || []).find((e) => e.id === id);
      if (!live(entity)) { problems.push(`It deletes a ${word} that isn't on your board.`); continue; }
      removed += removedCount(del, entity, data || {});
    }

    if (action === "ARCHIVE_DONE_TASKS") {
      removed += (data?.tasks || []).filter((t) => live(t) && !t.archived_at && (t.status === "DONE" || t.status === "DELEGATED_DONE")).length;
    }
  }

  if (removed > AUTO_APPROVE_MAX_REMOVED) {
    problems.push(`It removes ${removed} items at once, more than auto-approve allows (${AUTO_APPROVE_MAX_REMOVED}).`);
  }

  const ok = problems.length === 0;
  const count = steps.length;
  return {
    ok,
    problems,
    removed,
    summary: ok
      ? `Checked ${count} ${count === 1 ? "step" : "steps"} against your board: every item exists, and a checkpoint can undo all of it.`
      : problems[0],
  };
}

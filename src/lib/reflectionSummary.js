// Real, code-computed "what changed since last time" for a reflection turn
// (see reflectionTrigger.js) — deliberately NOT something the model infers.
// systemPrompt.js's buildContextPrompt sends the model a whitelisted view of
// each task/project (id, title, status, ...) that never includes
// created_date/updated_date/archived_at, so it has no way to compute an
// honest delta on its own even if asked to. This module reads those
// timestamps directly from localDb and hands the result to the model as
// plain fact text — the one thing a reflection turn is told not to add to.
import { localDb } from "@/lib/localDb";
import { isTaskDone } from "@/lib/taskUtils";

const MAX_ITEMS_PER_FACT = 8;

function after(iso, sinceMs) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t > sinceMs;
}

function describeItems(items, format) {
  const shown = items.slice(0, MAX_ITEMS_PER_FACT).map(format);
  const rest = items.length - shown.length;
  return rest > 0 ? `${shown.join(", ")}, and ${rest} more` : shown.join(", ");
}

// Pure read — no side effects, safe to call outside any confirm/consent
// flow, since "look at what changed" is itself one of the read-only
// operations a reflection turn is allowed to do freely.
export async function computeWorkspaceDelta(sinceIso) {
  const sinceMs = new Date(sinceIso).getTime();
  const [projects, tasks] = await Promise.all([localDb.projects.list(), localDb.tasks.list()]);

  const activeProjects = projects.filter((p) => !p.deleted_at);
  const activeTasks = tasks.filter((t) => !t.deleted_at);
  const projectTitleById = new Map(activeProjects.map((p) => [p.id, p.title]));
  const describeTask = (t) => {
    const projectTitle = projectTitleById.get(t.project_id);
    return `"${t.description}"${projectTitle ? ` (${projectTitle})` : ""}`;
  };

  const completedTasks = activeTasks.filter((t) => isTaskDone(t) && after(t.updated_date, sinceMs));
  const newTasks = activeTasks.filter((t) => after(t.created_date, sinceMs));
  const archivedTasks = activeTasks.filter((t) => after(t.archived_at, sinceMs));
  const newProjects = activeProjects.filter((p) => !p.is_archived && after(p.created_date, sinceMs));
  const archivedProjects = activeProjects.filter((p) => p.is_archived && after(p.archived_at, sinceMs));

  const facts = [];
  if (completedTasks.length) facts.push(`Completed (${completedTasks.length}): ${describeItems(completedTasks, describeTask)}`);
  if (newTasks.length) facts.push(`New tasks (${newTasks.length}): ${describeItems(newTasks, describeTask)}`);
  if (archivedTasks.length) facts.push(`Archived tasks (${archivedTasks.length}): ${describeItems(archivedTasks, describeTask)}`);
  if (newProjects.length) facts.push(`New projects: ${describeItems(newProjects, (p) => `"${p.title}"`)}`);
  if (archivedProjects.length) facts.push(`Archived projects: ${describeItems(archivedProjects, (p) => `"${p.title}"`)}`);

  return { hasChanges: facts.length > 0, facts };
}

// The synthetic "message" a reflection turn sends in place of real user
// input — travels through the exact same invokeAssistant()/message field
// every normal turn already uses, so nothing downstream needs a new payload
// shape.
export function buildReflectionInstruction(facts) {
  return `[SYSTEM-INITIATED CHECK-IN — the user has not sent a message this turn]
It has been over 3 hours since you last talked. Here is what actually changed in their workspace since then (computed by the app, not by you — do not add anything beyond this):
${facts.map((f) => `- ${f}`).join("\n")}

Write ONE short, warm opening message as the first message of a brand-new conversation. Ground it strictly in the facts above — no speculation about how the user feels or why, no invented trends. You may use search_workspace/audit_workspace to look closer at 1-2 items before writing. Do not use web search this turn — stay inside the workspace. You may NOT create, update, delete, archive, or write anything this turn under any circumstance — if something's worth remembering or logging, PROPOSE it in your message and wait for the user to confirm; never assume it.`;
}

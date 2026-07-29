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
import { SELF_NOTE_PATH, SELF_NOTE_TARGET_MAX_CHARS } from "@/lib/githubApi";

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
//
// `vaultConnected` opens exactly two auto-executing exceptions to the
// otherwise-blanket "nothing this turn" rule — chatActions.js's
// filterReflectionActions is what actually enforces them (a hard filter on
// the returned actions, not just this wording), so this text is guidance for
// the model to use them for their intended purpose, not the safety boundary
// itself. Not vault-connected: the original, unchanged instruction.
//
// `selfNoteLength` is the soft layer of Vaea Self.md's size management (see
// githubApi.js's SELF_NOTE_TARGET_MAX_CHARS for the other two: a hard
// write-time sanity cap in chatActions.js, and hard read-time truncation in
// systemPrompt.js/entry.ts regardless of what actually happened here) — once
// the file's already near the target, the model is told to consolidate
// instead of just appending, so the file has a real chance of staying
// useful-sized on its own, not just capped from outside.
export function buildReflectionInstruction(facts, { vaultConnected = false, selfNoteLength = 0 } = {}) {
  const todayLogPath = `Daily/${new Date().toISOString().slice(0, 10)}.md`;
  const nearingCap = selfNoteLength >= SELF_NOTE_TARGET_MAX_CHARS * 0.75;
  const vaultGuidance = vaultConnected
    ? `

You have a connected Vaea Vault, with two files you can write to directly this turn — no confirmation needed, they'll save automatically:
- "${SELF_NOTE_PATH}" — your own notes about yourself: what you've learned about working in this particular workspace, corrections to how you'd been operating, style notes. Its current content, if any, is already shown above in [VAULT CONTEXT] — write the full revised version if you genuinely have something new to add, otherwise leave it alone entirely; don't touch it just to have touched it. This is about YOU, never a read on the user — no notes about their behavior, tone, or personality belong here.${
        nearingCap
          ? " It's already getting long — if you're updating it, consolidate rather than append: fold related points together, cut anything stale or superseded, keep only what's still genuinely useful. Don't let it grow without bound."
          : ""
      }
- "${todayLogPath}" — a plain log entry for the facts above, same convention "/vault-log" already uses (read_vault_note it first if it already has content today, and append rather than overwrite).
Any other vault path still needs the user's confirmation, same as everything else.`
    : "";

  return `[SYSTEM-INITIATED CHECK-IN — the user has not sent a message this turn]
It has been over 3 hours since you last talked. Here is what actually changed in their workspace since then (computed by the app, not by you — do not add anything beyond this):
${facts.map((f) => `- ${f}`).join("\n")}

Write ONE short, warm opening message as the first message of a brand-new conversation. Ground it strictly in the facts above — no speculation about how the user feels or why, no invented trends. You may use search_workspace/audit_workspace to look closer at 1-2 items before writing. Do not use web search this turn — stay inside the workspace. Beyond the two vault paths named below (if any), you may NOT create, update, delete, archive, or write anything this turn under any circumstance — if something else is worth remembering or logging, PROPOSE it in your message and wait for the user to confirm; never assume it.${vaultGuidance}`;
}

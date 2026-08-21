// Minimal client-side Google Tasks API helpers for the connected Google
// Workspace connection (googleWorkspaceConnection.js). Client-side twin of
// the equivalent calls in base44/functions/aiChatStream/entry.ts — see
// googleCalendarApi.js's header comment for why that split exists.
// Deliberately separate from Vaea's own task entity — this talks to the
// user's actual Google Tasks lists, not anything stored in Vaea.
import { jsonHeaders, ensureFreshToken } from "@/lib/googleWorkspaceApiBase";

const API_BASE = "https://tasks.googleapis.com/tasks/v1";

function tasksErrorMessage(status) {
  if (status === 401) return "Google rejected that token — try reconnecting Google Workspace.";
  if (status === 403) return "Google Tasks denied this request — check the connected account still has access.";
  if (status === 404) return "Task list or task not found.";
  return `Google Tasks error (${status}).`;
}

export async function listTaskLists(connection) {
  const fresh = await ensureFreshToken(connection);
  const res = await fetch(`${API_BASE}/users/@me/lists`, { headers: jsonHeaders(fresh.accessToken) });
  if (!res.ok) throw Object.assign(new Error(tasksErrorMessage(res.status)), { connection: fresh });
  const data = await res.json();
  return { taskLists: data.items || [], connection: fresh };
}

export async function listTasks(connection, taskListId = "@default", { showCompleted = false } = {}) {
  const fresh = await ensureFreshToken(connection);
  const params = new URLSearchParams({ showCompleted: String(showCompleted), showHidden: "false" });
  const res = await fetch(`${API_BASE}/lists/${encodeURIComponent(taskListId)}/tasks?${params}`, { headers: jsonHeaders(fresh.accessToken) });
  if (!res.ok) throw Object.assign(new Error(tasksErrorMessage(res.status)), { connection: fresh });
  const data = await res.json();
  return { tasks: data.items || [], connection: fresh };
}

export async function createTask(connection, taskListId = "@default", { title, notes, due }) {
  const fresh = await ensureFreshToken(connection);
  const res = await fetch(`${API_BASE}/lists/${encodeURIComponent(taskListId)}/tasks`, {
    method: "POST",
    headers: jsonHeaders(fresh.accessToken),
    body: JSON.stringify({ title, notes, due }),
  });
  if (!res.ok) throw Object.assign(new Error(tasksErrorMessage(res.status)), { connection: fresh });
  const task = await res.json();
  return { task, connection: fresh };
}

export async function updateTask(connection, taskListId = "@default", taskId, patch) {
  const fresh = await ensureFreshToken(connection);
  const res = await fetch(`${API_BASE}/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(taskId)}`, {
    method: "PATCH",
    headers: jsonHeaders(fresh.accessToken),
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw Object.assign(new Error(tasksErrorMessage(res.status)), { connection: fresh });
  const task = await res.json();
  return { task, connection: fresh };
}

export async function deleteTask(connection, taskListId = "@default", taskId) {
  const fresh = await ensureFreshToken(connection);
  const res = await fetch(`${API_BASE}/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(taskId)}`, {
    method: "DELETE",
    headers: jsonHeaders(fresh.accessToken),
  });
  if (!res.ok && res.status !== 404) throw Object.assign(new Error(tasksErrorMessage(res.status)), { connection: fresh });
  return { connection: fresh };
}

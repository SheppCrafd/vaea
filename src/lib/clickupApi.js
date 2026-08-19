// Minimal client-side ClickUp API helpers for the connected workspace
// (clickupConnection.js). Deliberately separate from the equivalent calls
// in base44/functions/aiChatStream/entry.ts — different (Deno) runtime,
// kept in sync by hand, same reasoning as githubApi.js/googleCalendarApi.js.
// Unlike those two, ClickUp's access token never expires (confirmed against
// ClickUp's own OAuth docs — no refresh token is even issued), so there's
// no token-refresh dance here at all: every call just uses the stored
// accessToken directly.
const API_V2 = "https://api.clickup.com/api/v2";
const API_V3 = "https://api.clickup.com/api/v3";

function headers(accessToken) {
  return { Authorization: accessToken, "Content-Type": "application/json" };
}

function clickupErrorMessage(status) {
  if (status === 401) return "ClickUp rejected that token — try reconnecting.";
  if (status === 403) return "ClickUp denied this request — check the connected account still has access.";
  if (status === 404) return "Not found in ClickUp.";
  if (status === 429) return "ClickUp's rate limit was hit — try again in a moment.";
  return `ClickUp error (${status}).`;
}

async function clickupFetch(url, accessToken, init) {
  const res = await fetch(url, { ...init, headers: headers(accessToken) });
  if (!res.ok) throw new Error(clickupErrorMessage(res.status));
  return res.status === 204 ? null : res.json();
}

// --- Workspace hierarchy (discovery) ------------------------------------

export async function listSpaces(connection) {
  const data = await clickupFetch(`${API_V2}/team/${encodeURIComponent(connection.workspaceId)}/space`, connection.accessToken);
  return (data.spaces || []).map((s) => ({ id: s.id, name: s.name }));
}

export async function listLists(connection, spaceId) {
  // Folderless lists live directly on the space; folder-nested lists need a
  // second call per folder. Both are real, common ClickUp layouts, so this
  // covers both rather than assuming every workspace is folderless.
  const [folderless, folders] = await Promise.all([
    clickupFetch(`${API_V2}/space/${encodeURIComponent(spaceId)}/list`, connection.accessToken),
    clickupFetch(`${API_V2}/space/${encodeURIComponent(spaceId)}/folder`, connection.accessToken),
  ]);
  const lists = (folderless.lists || []).map((l) => ({ id: l.id, name: l.name, folder: null }));
  for (const folder of folders.folders || []) {
    for (const l of folder.lists || []) lists.push({ id: l.id, name: l.name, folder: folder.name });
  }
  return lists;
}

// --- Tasks ---------------------------------------------------------------

export async function listTasks(connection, listId, { includeClosed = false } = {}) {
  const params = new URLSearchParams({ include_closed: String(includeClosed) });
  const data = await clickupFetch(`${API_V2}/list/${encodeURIComponent(listId)}/task?${params}`, connection.accessToken);
  return (data.tasks || []).map((t) => ({
    id: t.id,
    name: t.name,
    status: t.status?.status,
    due_date: t.due_date ? new Date(Number(t.due_date)).toISOString() : null,
    url: t.url,
  }));
}

export async function createTask(connection, listId, task) {
  const body = { name: task.name };
  if (task.description !== undefined) body.description = task.description;
  if (task.due_date !== undefined) body.due_date = new Date(task.due_date).getTime();
  if (task.status !== undefined) body.status = task.status;
  const created = await clickupFetch(`${API_V2}/list/${encodeURIComponent(listId)}/task`, connection.accessToken, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return { id: created.id, name: created.name, url: created.url };
}

export async function updateTask(connection, taskId, patch) {
  const body = {};
  if (patch.name !== undefined) body.name = patch.name;
  if (patch.description !== undefined) body.description = patch.description;
  if (patch.status !== undefined) body.status = patch.status;
  if (patch.due_date !== undefined) body.due_date = new Date(patch.due_date).getTime();
  const updated = await clickupFetch(`${API_V2}/task/${encodeURIComponent(taskId)}`, connection.accessToken, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  return { id: updated.id, name: updated.name, url: updated.url };
}

export async function deleteTask(connection, taskId) {
  await clickupFetch(`${API_V2}/task/${encodeURIComponent(taskId)}`, connection.accessToken, { method: "DELETE" });
}

// --- Chat (ClickUp's own team-chat feature, real v3 endpoints) -----------

export async function listChannels(connection) {
  const data = await clickupFetch(`${API_V3}/workspaces/${encodeURIComponent(connection.workspaceId)}/chat/channels`, connection.accessToken);
  return (data.data || []).map((c) => ({ id: c.id, name: c.name, type: c.type, visibility: c.visibility }));
}

export async function listMessages(connection, channelId, { limit = 50 } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  const data = await clickupFetch(`${API_V3}/workspaces/${encodeURIComponent(connection.workspaceId)}/chat/channels/${encodeURIComponent(channelId)}/messages?${params}`, connection.accessToken);
  return (data.data || []).map((m) => ({ id: m.id, content: m.content, user_id: m.user_id, date: m.date }));
}

export async function sendMessage(connection, channelId, content) {
  const created = await clickupFetch(`${API_V3}/workspaces/${encodeURIComponent(connection.workspaceId)}/chat/channels/${encodeURIComponent(channelId)}/messages`, connection.accessToken, {
    method: "POST",
    body: JSON.stringify({ type: "message", content, content_format: "text/md" }),
  });
  return { id: created.id, date: created.date };
}

// Confirms the token actually works and fetches the workspace name — used
// right after the OAuth callback finishes.
export async function testClickUpConnection(accessToken) {
  const data = await clickupFetch(`${API_V2}/team`, accessToken);
  const team = (data.teams || [])[0];
  if (!team) throw new Error("No ClickUp workspace found on this account.");
  return { workspaceId: team.id, workspaceName: team.name };
}

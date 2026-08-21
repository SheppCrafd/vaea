// Client-side Slack API helpers. No token refresh needed — Slack user tokens
// don't expire (same model as ClickUp). Client-side twin of the same-shaped
// calls in base44/functions/aiChatStream/entry.ts.
const API = "https://slack.com/api";

function authHeaders(accessToken) {
  return { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
}

async function slackFetch(endpoint, accessToken, init = {}) {
  const res = await fetch(`${API}/${endpoint}`, { ...init, headers: { ...authHeaders(accessToken), ...init.headers } });
  if (!res.ok) throw new Error(`Slack network error (${res.status}).`);
  const data = await res.json();
  if (!data.ok) {
    if (data.error === "invalid_auth" || data.error === "token_revoked") throw new Error("Slack rejected that token — try reconnecting.");
    if (data.error === "missing_scope") throw new Error(`Missing Slack permission: ${data.needed}. Try reconnecting.`);
    throw new Error(`Slack error: ${data.error}`);
  }
  return data;
}

function shapeChannel(ch) {
  return {
    id: ch.id,
    name: ch.name,
    topic: ch.topic?.value || "",
    memberCount: ch.num_members,
    isPrivate: !!ch.is_private,
  };
}

function shapeMessage(m) {
  return {
    ts: m.ts,
    userId: m.user,
    text: m.text,
    replyCount: m.reply_count || 0,
  };
}

export async function listChannels(connection) {
  const data = await slackFetch("conversations.list?types=public_channel&limit=100&exclude_archived=true", connection.accessToken);
  return (data.channels || []).map(shapeChannel);
}

export async function listMessages(connection, channelId, { limit = 20 } = {}) {
  const data = await slackFetch(`conversations.history?channel=${encodeURIComponent(channelId)}&limit=${limit}`, connection.accessToken);
  return (data.messages || []).filter((m) => m.type === "message" && !m.subtype).map(shapeMessage);
}

export async function sendMessage(connection, channelId, text) {
  const data = await slackFetch("chat.postMessage", connection.accessToken, {
    method: "POST",
    body: JSON.stringify({ channel: channelId, text }),
  });
  return { ts: data.ts, channel: data.channel };
}

export async function testSlackConnection(accessToken) {
  const data = await slackFetch("auth.test", accessToken);
  return {
    workspaceId: data.team_id,
    workspaceName: data.team,
    userId: data.user_id,
    username: data.user,
  };
}

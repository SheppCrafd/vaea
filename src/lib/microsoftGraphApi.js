// Client-side Microsoft Graph calls for the connected Outlook account
// (microsoftConnection.js) — calendar, mail, and Teams meeting links, all
// through the one unified Graph API. Mirrors googleCalendarApi.js's
// refresh-then-call shape; see that file for the fuller comment on why.
// Client-side twin of the same-shaped calls in
// base44/functions/aiChatStream/entry.ts.
import { refreshAccessToken } from "@/lib/microsoftOAuthPkce";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0/me";
const EXPIRY_SKEW_MS = 60 * 1000;

function headers(accessToken) {
  return { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
}

function isExpired(connection) {
  return !connection.expiresAt || Date.now() >= connection.expiresAt - EXPIRY_SKEW_MS;
}

async function ensureFreshToken(connection) {
  if (!isExpired(connection)) return connection;
  const refreshed = await refreshAccessToken(connection.refreshToken);
  return { ...connection, ...refreshed };
}

function graphErrorMessage(status) {
  if (status === 401) return "Microsoft rejected that token — try reconnecting your Microsoft account.";
  if (status === 403) return "Microsoft denied this request — check the connected account still has access.";
  if (status === 404) return "Not found.";
  if (status === 429) return "Microsoft's rate limit was hit — try again in a moment.";
  return `Microsoft Graph error (${status}).`;
}

async function graphFetch(url, accessToken, init) {
  const res = await fetch(url, { ...init, headers: { ...headers(accessToken), ...init?.headers } });
  if (!res.ok) throw Object.assign(new Error(graphErrorMessage(res.status)), { status: res.status });
  // sendMail replies 202 Accepted with no body at all — same "no content"
  // case as 204, just a different status code for it.
  if (res.status === 204 || res.status === 202) return null;
  return res.json();
}

function shapeEvent(e) {
  return {
    id: e.id,
    subject: e.subject,
    start: e.start?.dateTime ? `${e.start.dateTime}${e.start.timeZone ? ` (${e.start.timeZone})` : ""}` : e.start?.date,
    end: e.end?.dateTime ? `${e.end.dateTime}${e.end.timeZone ? ` (${e.end.timeZone})` : ""}` : e.end?.date,
    location: e.location?.displayName,
    onlineMeetingUrl: e.onlineMeeting?.joinUrl,
    isOnlineMeeting: !!e.isOnlineMeeting,
  };
}

export async function listEvents(connection, { timeMin, timeMax, maxResults = 20 } = {}) {
  const fresh = await ensureFreshToken(connection);
  const params = new URLSearchParams({
    $orderby: "start/dateTime",
    $top: String(maxResults),
    startDateTime: timeMin || new Date().toISOString(),
    endDateTime: timeMax || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  });
  const data = await graphFetch(`${GRAPH_BASE}/calendarView?${params}`, fresh.accessToken);
  return { events: (data.value || []).map(shapeEvent), connection: fresh };
}

// teamsMeeting: pass true to have Graph auto-generate a real Teams join
// link for the event — the Microsoft-side equivalent of Google Calendar's
// conferenceData, no separate connector needed for meeting scheduling.
export async function createEvent(connection, { subject, start, end, description, location, teamsMeeting }) {
  const fresh = await ensureFreshToken(connection);
  const body = {
    subject,
    start,
    end,
    location: location ? { displayName: location } : undefined,
    body: description ? { contentType: "text", content: description } : undefined,
    ...(teamsMeeting ? { isOnlineMeeting: true, onlineMeetingProvider: "teamsForBusiness" } : {}),
  };
  const data = await graphFetch(`${GRAPH_BASE}/events`, fresh.accessToken, { method: "POST", body: JSON.stringify(body) });
  return { event: shapeEvent(data), connection: fresh };
}

export async function updateEvent(connection, eventId, patch) {
  const fresh = await ensureFreshToken(connection);
  const body = {};
  if (patch.subject !== undefined) body.subject = patch.subject;
  if (patch.start !== undefined) body.start = patch.start;
  if (patch.end !== undefined) body.end = patch.end;
  if (patch.description !== undefined) body.body = { contentType: "text", content: patch.description };
  if (patch.location !== undefined) body.location = { displayName: patch.location };
  const data = await graphFetch(`${GRAPH_BASE}/events/${eventId}`, fresh.accessToken, { method: "PATCH", body: JSON.stringify(body) });
  return { event: shapeEvent(data), connection: fresh };
}

export async function deleteEvent(connection, eventId) {
  const fresh = await ensureFreshToken(connection);
  try {
    await graphFetch(`${GRAPH_BASE}/events/${eventId}`, fresh.accessToken, { method: "DELETE" });
  } catch (err) {
    if (err.status !== 404) throw err;
  }
  return { connection: fresh };
}

function shapeMessage(m) {
  return {
    id: m.id,
    subject: m.subject,
    from: m.from?.emailAddress?.address || m.sender?.emailAddress?.address || "",
    receivedDateTime: m.receivedDateTime,
    bodyPreview: m.bodyPreview,
    unread: !!m.isRead === false,
  };
}

export async function listMessages(connection, { query = "", maxResults = 10 } = {}) {
  const fresh = await ensureFreshToken(connection);
  const params = new URLSearchParams({ $top: String(maxResults), $orderby: "receivedDateTime desc" });
  if (query) params.set("$search", `"${query}"`);
  const data = await graphFetch(`${GRAPH_BASE}/messages?${params}`, fresh.accessToken);
  return { messages: (data.value || []).map(shapeMessage), connection: fresh };
}

export async function readMessage(connection, messageId) {
  const fresh = await ensureFreshToken(connection);
  const data = await graphFetch(`${GRAPH_BASE}/messages/${messageId}`, fresh.accessToken);
  return {
    message: {
      id: data.id,
      subject: data.subject,
      from: data.from?.emailAddress?.address || "",
      to: (data.toRecipients || []).map((r) => r.emailAddress?.address).filter(Boolean).join(", "),
      receivedDateTime: data.receivedDateTime,
      body: data.body?.contentType === "text" ? data.body.content : data.bodyPreview,
    },
    connection: fresh,
  };
}

export async function sendMessage(connection, { to, subject, body }) {
  const fresh = await ensureFreshToken(connection);
  const payload = {
    message: {
      subject,
      body: { contentType: "text", content: body },
      toRecipients: [{ emailAddress: { address: to } }],
    },
  };
  await graphFetch(`${GRAPH_BASE}/sendMail`, fresh.accessToken, { method: "POST", body: JSON.stringify(payload) });
  return { sent: true, connection: fresh };
}

// Confirms the connection works and returns the real signed-in address —
// used right after the OAuth callback finishes.
export async function testMicrosoftConnection(connection) {
  const fresh = await ensureFreshToken(connection);
  const data = await graphFetch(GRAPH_BASE, fresh.accessToken);
  return { emailAddress: data.mail || data.userPrincipalName || "", connection: fresh };
}

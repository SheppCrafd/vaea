// Minimal client-side Google Calendar API helpers for the connected
// calendar (calendarConnection.js). Deliberately separate from the
// equivalent calls in base44/functions/aiChatStream/entry.ts — that's a
// different (Deno) runtime and can't share a module with browser code,
// same reasoning githubApi.js documents for its own split from entry.ts.
// BYOK/Local Mode have no server at all, so their own tool loop
// (localTools.js) calls listEvents/createEvent/etc. below directly — the
// client-side twins of entry.ts's own calendar tool bodies.
//
// Auth model: PKCE against a public "Desktop app" OAuth client (no client
// secret exists — see CalendarOAuthCallbackPage.jsx for the authorization
// half of the flow). Every exported call-making function below refreshes
// an expired access token itself before the real request, using nothing
// but the refresh token + the public client ID, and returns the
// (possibly refreshed) connection alongside the result so the caller can
// persist it via saveCalendarConnection.
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API_BASE = "https://www.googleapis.com/calendar/v3";
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CALENDAR_CLIENT_ID;

// A little slack before the real expiry so a token doesn't die mid-request.
const EXPIRY_SKEW_MS = 60 * 1000;

function headers(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

function isExpired(connection) {
  return !connection.expiresAt || Date.now() >= connection.expiresAt - EXPIRY_SKEW_MS;
}

// Exchanges a refresh token for a new access token. Public client — no
// client_secret parameter, matching the Desktop-app credential type this
// whole connector is built around (see the plan's "skip the server
// entirely" rationale).
export async function refreshAccessToken(refreshToken) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error_description || `Google rejected the refresh (${res.status}).`);
  }
  const data = await res.json();
  return {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

// Called at the top of every real API call below — refreshes only when
// actually needed, and hands back the connection object the caller should
// persist (unchanged if no refresh was needed, so this is always safe to
// await and re-save without a redundant write).
async function ensureFreshToken(connection) {
  if (!isExpired(connection)) return connection;
  const refreshed = await refreshAccessToken(connection.refreshToken);
  return { ...connection, ...refreshed };
}

function calendarErrorMessage(status) {
  if (status === 401) return "Google rejected that token — try reconnecting your calendar.";
  if (status === 403) return "Google Calendar denied this request — check the connected account still has access.";
  if (status === 404) return "Calendar or event not found.";
  return `Google Calendar error (${status}).`;
}

export async function listEvents(connection, { timeMin, timeMax, maxResults = 20 } = {}) {
  const fresh = await ensureFreshToken(connection);
  const params = new URLSearchParams({
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: String(maxResults),
    ...(timeMin ? { timeMin } : {}),
    ...(timeMax ? { timeMax } : {}),
  });
  const res = await fetch(
    `${API_BASE}/calendars/${encodeURIComponent(fresh.calendarId)}/events?${params}`,
    { headers: headers(fresh.accessToken) }
  );
  if (!res.ok) throw Object.assign(new Error(calendarErrorMessage(res.status)), { connection: fresh });
  const data = await res.json();
  return { events: data.items || [], connection: fresh };
}

// conferenceDataVersion=1 is required on the write itself whenever the
// event body carries a conferenceData.createRequest (see chatActions.js's
// meet_link handling) — harmless to always send, Google just ignores it
// for an event with no conferenceData.
export async function createEvent(connection, event) {
  const fresh = await ensureFreshToken(connection);
  const res = await fetch(
    `${API_BASE}/calendars/${encodeURIComponent(fresh.calendarId)}/events?conferenceDataVersion=1`,
    { method: "POST", headers: headers(fresh.accessToken), body: JSON.stringify(event) }
  );
  if (!res.ok) throw Object.assign(new Error(calendarErrorMessage(res.status)), { connection: fresh });
  const created = await res.json();
  return { event: created, connection: fresh };
}

export async function updateEvent(connection, eventId, patch) {
  const fresh = await ensureFreshToken(connection);
  const res = await fetch(
    `${API_BASE}/calendars/${encodeURIComponent(fresh.calendarId)}/events/${encodeURIComponent(eventId)}?conferenceDataVersion=1`,
    { method: "PATCH", headers: headers(fresh.accessToken), body: JSON.stringify(patch) }
  );
  if (!res.ok) throw Object.assign(new Error(calendarErrorMessage(res.status)), { connection: fresh });
  const updated = await res.json();
  return { event: updated, connection: fresh };
}

export async function deleteEvent(connection, eventId) {
  const fresh = await ensureFreshToken(connection);
  const res = await fetch(
    `${API_BASE}/calendars/${encodeURIComponent(fresh.calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: "DELETE", headers: headers(fresh.accessToken) }
  );
  if (!res.ok && res.status !== 410) throw Object.assign(new Error(calendarErrorMessage(res.status)), { connection: fresh });
  return { connection: fresh };
}

// Confirms the connected calendar actually resolves (used right after the
// OAuth callback finishes, and by the Settings "Connect" flow) — mirrors
// testVaultConnection's role for the vault's PAT flow.
export async function testCalendarConnection(connection) {
  const fresh = await ensureFreshToken(connection);
  const res = await fetch(
    `${API_BASE}/calendars/${encodeURIComponent(fresh.calendarId)}`,
    { headers: headers(fresh.accessToken) }
  );
  if (!res.ok) throw Object.assign(new Error(calendarErrorMessage(res.status)), { connection: fresh });
  const data = await res.json();
  return { summary: data.summary, timeZone: data.timeZone, connection: fresh };
}

// Shared plumbing every Google Workspace product API module (googleDriveApi.js,
// googleDocsApi.js, googleSheetsApi.js, googleSlidesApi.js, googleTasksApi.js,
// googleFormsApi.js — googleCalendarApi.js predates this file and still
// carries its own copy) builds on: token refresh against the same public
// "Desktop app" OAuth client the whole connector shares (see
// googleWorkspaceOAuthPkce.js), and the request headers every product's
// REST API takes identically.
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CALENDAR_CLIENT_ID;

// A little slack before the real expiry so a token doesn't die mid-request.
const EXPIRY_SKEW_MS = 60 * 1000;

export function jsonHeaders(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

function isExpired(connection) {
  return !connection.expiresAt || Date.now() >= connection.expiresAt - EXPIRY_SKEW_MS;
}

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

// Called at the top of every real API call across every product module —
// refreshes only when actually needed, and hands back the connection object
// the caller should persist (unchanged if no refresh was needed, so this is
// always safe to await and re-save without a redundant write).
export async function ensureFreshToken(connection) {
  if (!isExpired(connection)) return connection;
  const refreshed = await refreshAccessToken(connection.refreshToken);
  return { ...connection, ...refreshed };
}

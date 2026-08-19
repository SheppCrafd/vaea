// Minimal client-side Gmail API helpers for the connected inbox
// (gmailConnection.js). Mirrors googleCalendarApi.js's refresh-then-call
// shape exactly (same token endpoint, same public client, same expiry
// skew) — see that file for the fuller comment on why. Client-side twin of
// the same-shaped calls in base44/functions/aiChatStream/entry.ts.
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CALENDAR_CLIENT_ID;

const EXPIRY_SKEW_MS = 60 * 1000;

function headers(accessToken) {
  return { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
}

function isExpired(connection) {
  return !connection.expiresAt || Date.now() >= connection.expiresAt - EXPIRY_SKEW_MS;
}

export async function refreshAccessToken(refreshToken) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CLIENT_ID, refresh_token: refreshToken, grant_type: "refresh_token" }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error_description || `Google rejected the refresh (${res.status}).`);
  }
  const data = await res.json();
  return { accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
}

async function ensureFreshToken(connection) {
  if (!isExpired(connection)) return connection;
  const refreshed = await refreshAccessToken(connection.refreshToken);
  return { ...connection, ...refreshed };
}

function gmailErrorMessage(status) {
  if (status === 401) return "Google rejected that token — try reconnecting Gmail.";
  if (status === 403) return "Gmail denied this request — check the connected account still has access.";
  if (status === 404) return "Message not found.";
  return `Gmail error (${status}).`;
}

function headerValue(headersArr, name) {
  return headersArr?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";
}

function decodeBase64Url(data) {
  return decodeURIComponent(escape(atob(data.replace(/-/g, "+").replace(/_/g, "/"))));
}

function extractPlainTextBody(payload) {
  if (payload.mimeType === "text/plain" && payload.body?.data) return decodeBase64Url(payload.body.data);
  for (const part of payload.parts || []) {
    const text = extractPlainTextBody(part);
    if (text) return text;
  }
  return "";
}

// Lists recent messages matching an optional Gmail search query (same
// syntax as the Gmail search box, e.g. "is:unread", "from:someone@x.com")
// and fetches each one's real headers/snippet — two API calls per message
// (list gives ids only), capped at maxResults to keep this bounded.
export async function listMessages(connection, { query = "", maxResults = 10 } = {}) {
  const fresh = await ensureFreshToken(connection);
  const params = new URLSearchParams({ maxResults: String(maxResults), ...(query ? { q: query } : {}) });
  const listRes = await fetch(`${API_BASE}/messages?${params}`, { headers: headers(fresh.accessToken) });
  if (!listRes.ok) throw Object.assign(new Error(gmailErrorMessage(listRes.status)), { connection: fresh });
  const listData = await listRes.json();
  const ids = (listData.messages || []).map((m) => m.id);

  const messages = await Promise.all(
    ids.map(async (id) => {
      const res = await fetch(`${API_BASE}/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`, { headers: headers(fresh.accessToken) });
      if (!res.ok) return null;
      const data = await res.json();
      return {
        id: data.id,
        threadId: data.threadId,
        subject: headerValue(data.payload?.headers, "Subject"),
        from: headerValue(data.payload?.headers, "From"),
        date: headerValue(data.payload?.headers, "Date"),
        snippet: data.snippet,
        unread: (data.labelIds || []).includes("UNREAD"),
      };
    })
  );
  return { messages: messages.filter(Boolean), connection: fresh };
}

export async function readMessage(connection, messageId) {
  const fresh = await ensureFreshToken(connection);
  const res = await fetch(`${API_BASE}/messages/${messageId}?format=full`, { headers: headers(fresh.accessToken) });
  if (!res.ok) throw Object.assign(new Error(gmailErrorMessage(res.status)), { connection: fresh });
  const data = await res.json();
  return {
    message: {
      id: data.id,
      subject: headerValue(data.payload?.headers, "Subject"),
      from: headerValue(data.payload?.headers, "From"),
      to: headerValue(data.payload?.headers, "To"),
      date: headerValue(data.payload?.headers, "Date"),
      body: extractPlainTextBody(data.payload) || data.snippet,
    },
    connection: fresh,
  };
}

function buildRawEmail({ to, subject, body }) {
  const lines = [`To: ${to}`, `Subject: ${subject}`, "Content-Type: text/plain; charset=utf-8", "", body];
  const raw = lines.join("\r\n");
  return btoa(unescape(encodeURIComponent(raw))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sendMessage(connection, { to, subject, body }) {
  const fresh = await ensureFreshToken(connection);
  const res = await fetch(`${API_BASE}/messages/send`, {
    method: "POST",
    headers: headers(fresh.accessToken),
    body: JSON.stringify({ raw: buildRawEmail({ to, subject, body }) }),
  });
  if (!res.ok) throw Object.assign(new Error(gmailErrorMessage(res.status)), { connection: fresh });
  const sent = await res.json();
  return { id: sent.id, connection: fresh };
}

// Confirms the connection works and returns the actual address — used
// right after the OAuth callback finishes.
export async function testGmailConnection(connection) {
  const fresh = await ensureFreshToken(connection);
  const res = await fetch(`${API_BASE}/profile`, { headers: headers(fresh.accessToken) });
  if (!res.ok) throw Object.assign(new Error(gmailErrorMessage(res.status)), { connection: fresh });
  const data = await res.json();
  return { emailAddress: data.emailAddress, connection: fresh };
}

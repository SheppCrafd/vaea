// Minimal client-side Google Drive API helpers for the connected Google
// Workspace connection (googleWorkspaceConnection.js). Client-side twin of
// the equivalent calls in base44/functions/aiChatStream/entry.ts — see
// googleCalendarApi.js's header comment for why that split exists.
import { jsonHeaders, ensureFreshToken } from "@/lib/googleWorkspaceApiBase";

const API_BASE = "https://www.googleapis.com/drive/v3";
const UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3";
const FILE_FIELDS = "id,name,mimeType,modifiedTime,webViewLink,size";

function driveErrorMessage(status) {
  if (status === 401) return "Google rejected that token — try reconnecting Google Workspace.";
  if (status === 403) return "Google Drive denied this request — check the connected account still has access.";
  if (status === 404) return "File not found.";
  return `Google Drive error (${status}).`;
}

export async function listFiles(connection, { query, maxResults = 20 } = {}) {
  const fresh = await ensureFreshToken(connection);
  const params = new URLSearchParams({
    pageSize: String(maxResults),
    fields: `files(${FILE_FIELDS})`,
    orderBy: "modifiedTime desc",
    ...(query ? { q: `name contains '${query.replace(/'/g, "\\'")}' and trashed = false` } : { q: "trashed = false" }),
  });
  const res = await fetch(`${API_BASE}/files?${params}`, { headers: jsonHeaders(fresh.accessToken) });
  if (!res.ok) throw Object.assign(new Error(driveErrorMessage(res.status)), { connection: fresh });
  const data = await res.json();
  return { files: data.files || [], connection: fresh };
}

export async function getFile(connection, fileId) {
  const fresh = await ensureFreshToken(connection);
  const res = await fetch(`${API_BASE}/files/${encodeURIComponent(fileId)}?fields=${FILE_FIELDS}`, { headers: jsonHeaders(fresh.accessToken) });
  if (!res.ok) throw Object.assign(new Error(driveErrorMessage(res.status)), { connection: fresh });
  const file = await res.json();
  return { file, connection: fresh };
}

// Creates a plain-text file in Drive (the general-purpose "put some text
// somewhere in Drive" tool — Docs/Sheets/Slides each have their own richer
// create* in their own API module for structured documents).
export async function createTextFile(connection, { name, content, mimeType = "text/plain" }) {
  const fresh = await ensureFreshToken(connection);
  const boundary = "vaea-drive-upload";
  const metadata = JSON.stringify({ name, mimeType });
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
    `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n${content}\r\n--${boundary}--`;
  const res = await fetch(`${UPLOAD_BASE}/files?uploadType=multipart&fields=${FILE_FIELDS}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${fresh.accessToken}`, "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!res.ok) throw Object.assign(new Error(driveErrorMessage(res.status)), { connection: fresh });
  const file = await res.json();
  return { file, connection: fresh };
}

export async function deleteFile(connection, fileId) {
  const fresh = await ensureFreshToken(connection);
  const res = await fetch(`${API_BASE}/files/${encodeURIComponent(fileId)}`, { method: "DELETE", headers: jsonHeaders(fresh.accessToken) });
  if (!res.ok && res.status !== 404) throw Object.assign(new Error(driveErrorMessage(res.status)), { connection: fresh });
  return { connection: fresh };
}

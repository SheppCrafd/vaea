// Minimal client-side Google Sheets API helpers for the connected Google
// Workspace connection (googleWorkspaceConnection.js). Client-side twin of
// the equivalent calls in base44/functions/aiChatStream/entry.ts — see
// googleCalendarApi.js's header comment for why that split exists.
import { jsonHeaders, ensureFreshToken } from "@/lib/googleWorkspaceApiBase";

const API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

function sheetsErrorMessage(status) {
  if (status === 401) return "Google rejected that token — try reconnecting Google Workspace.";
  if (status === 403) return "Google Sheets denied this request — check the connected account still has access.";
  if (status === 404) return "Spreadsheet or range not found.";
  return `Google Sheets error (${status}).`;
}

export async function createSpreadsheet(connection, { title }) {
  const fresh = await ensureFreshToken(connection);
  const res = await fetch(API_BASE, { method: "POST", headers: jsonHeaders(fresh.accessToken), body: JSON.stringify({ properties: { title } }) });
  if (!res.ok) throw Object.assign(new Error(sheetsErrorMessage(res.status)), { connection: fresh });
  const spreadsheet = await res.json();
  return { spreadsheet, connection: fresh };
}

// range uses A1 notation, e.g. "Sheet1!A1:C10". Omit to read the first
// sheet's used range.
export async function getValues(connection, spreadsheetId, range = "A1:Z1000") {
  const fresh = await ensureFreshToken(connection);
  const res = await fetch(`${API_BASE}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`, { headers: jsonHeaders(fresh.accessToken) });
  if (!res.ok) throw Object.assign(new Error(sheetsErrorMessage(res.status)), { connection: fresh });
  const data = await res.json();
  return { values: data.values || [], connection: fresh };
}

export async function updateValues(connection, spreadsheetId, range, values) {
  const fresh = await ensureFreshToken(connection);
  const res = await fetch(
    `${API_BASE}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    { method: "PUT", headers: jsonHeaders(fresh.accessToken), body: JSON.stringify({ values }) }
  );
  if (!res.ok) throw Object.assign(new Error(sheetsErrorMessage(res.status)), { connection: fresh });
  return { connection: fresh };
}

export async function appendValues(connection, spreadsheetId, range, values) {
  const fresh = await ensureFreshToken(connection);
  const res = await fetch(
    `${API_BASE}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`,
    { method: "POST", headers: jsonHeaders(fresh.accessToken), body: JSON.stringify({ values }) }
  );
  if (!res.ok) throw Object.assign(new Error(sheetsErrorMessage(res.status)), { connection: fresh });
  return { connection: fresh };
}

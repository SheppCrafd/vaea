// Minimal client-side Google Docs API helpers for the connected Google
// Workspace connection (googleWorkspaceConnection.js). Client-side twin of
// the equivalent calls in base44/functions/aiChatStream/entry.ts — see
// googleCalendarApi.js's header comment for why that split exists.
import { jsonHeaders, ensureFreshToken } from "@/lib/googleWorkspaceApiBase";

const API_BASE = "https://docs.googleapis.com/v1/documents";

function docsErrorMessage(status) {
  if (status === 401) return "Google rejected that token — try reconnecting Google Workspace.";
  if (status === 403) return "Google Docs denied this request — check the connected account still has access.";
  if (status === 404) return "Document not found.";
  return `Google Docs error (${status}).`;
}

export async function createDocument(connection, { title }) {
  const fresh = await ensureFreshToken(connection);
  const res = await fetch(API_BASE, { method: "POST", headers: jsonHeaders(fresh.accessToken), body: JSON.stringify({ title }) });
  if (!res.ok) throw Object.assign(new Error(docsErrorMessage(res.status)), { connection: fresh });
  const doc = await res.json();
  return { document: doc, connection: fresh };
}

// Flattens a Docs body into plain text — good enough for the assistant to
// read back what's in a document; doesn't preserve tables/images/styling.
function extractText(doc) {
  const content = doc.body?.content || [];
  let text = "";
  for (const el of content) {
    for (const run of el.paragraph?.elements || []) {
      if (run.textRun?.content) text += run.textRun.content;
    }
  }
  return text;
}

export async function getDocument(connection, documentId) {
  const fresh = await ensureFreshToken(connection);
  const res = await fetch(`${API_BASE}/${encodeURIComponent(documentId)}`, { headers: jsonHeaders(fresh.accessToken) });
  if (!res.ok) throw Object.assign(new Error(docsErrorMessage(res.status)), { connection: fresh });
  const doc = await res.json();
  return { title: doc.title, text: extractText(doc), connection: fresh };
}

// Appends text to the end of the document. Google Docs indexes the body by
// UTF-16 code unit, and the very last index is reserved for the document's
// implicit trailing newline, so "end of document" is endIndex - 1.
export async function appendText(connection, documentId, text) {
  const fresh = await ensureFreshToken(connection);
  const { document: doc } = await (async () => {
    const r = await fetch(`${API_BASE}/${encodeURIComponent(documentId)}`, { headers: jsonHeaders(fresh.accessToken) });
    if (!r.ok) throw Object.assign(new Error(docsErrorMessage(r.status)), { connection: fresh });
    return { document: await r.json() };
  })();
  const endIndex = (doc.body?.content || []).reduce((max, el) => Math.max(max, el.endIndex || 0), 1);
  const res = await fetch(`${API_BASE}/${encodeURIComponent(documentId)}:batchUpdate`, {
    method: "POST",
    headers: jsonHeaders(fresh.accessToken),
    body: JSON.stringify({ requests: [{ insertText: { location: { index: Math.max(1, endIndex - 1) }, text } }] }),
  });
  if (!res.ok) throw Object.assign(new Error(docsErrorMessage(res.status)), { connection: fresh });
  return { connection: fresh };
}

// Find-and-replace across the whole document — the simplest reliable "edit"
// primitive Docs exposes (no free-text patching of arbitrary ranges without
// tracking every element's exact index, which the assistant has no way to
// know in advance).
export async function replaceText(connection, documentId, findText, replaceWith) {
  const fresh = await ensureFreshToken(connection);
  const res = await fetch(`${API_BASE}/${encodeURIComponent(documentId)}:batchUpdate`, {
    method: "POST",
    headers: jsonHeaders(fresh.accessToken),
    body: JSON.stringify({ requests: [{ replaceAllText: { containsText: { text: findText, matchCase: true }, replaceText: replaceWith } }] }),
  });
  if (!res.ok) throw Object.assign(new Error(docsErrorMessage(res.status)), { connection: fresh });
  const data = await res.json();
  return { occurrencesChanged: data.replies?.[0]?.replaceAllText?.occurrencesChanged || 0, connection: fresh };
}

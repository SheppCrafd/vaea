// Minimal client-side Google Forms API helpers for the connected Google
// Workspace connection (googleWorkspaceConnection.js). Client-side twin of
// the equivalent calls in base44/functions/aiChatStream/entry.ts — see
// googleCalendarApi.js's header comment for why that split exists.
import { jsonHeaders, ensureFreshToken } from "@/lib/googleWorkspaceApiBase";

const API_BASE = "https://forms.googleapis.com/v1/forms";

function formsErrorMessage(status) {
  if (status === 401) return "Google rejected that token — try reconnecting Google Workspace.";
  if (status === 403) return "Google Forms denied this request — check the connected account still has access.";
  if (status === 404) return "Form not found.";
  return `Google Forms error (${status}).`;
}

// Forms' create endpoint only accepts a title (a documentTitle can't be set
// on creation — the API requires a separate batchUpdate for that).
export async function createForm(connection, { title }) {
  const fresh = await ensureFreshToken(connection);
  const res = await fetch(API_BASE, { method: "POST", headers: jsonHeaders(fresh.accessToken), body: JSON.stringify({ info: { title } }) });
  if (!res.ok) throw Object.assign(new Error(formsErrorMessage(res.status)), { connection: fresh });
  const form = await res.json();
  return { form, connection: fresh };
}

function extractQuestions(form) {
  return (form.items || []).map((item) => ({
    itemId: item.itemId,
    title: item.title,
    type: item.questionItem?.question ? Object.keys(item.questionItem.question).find((k) => k.endsWith("Question")) : null,
  }));
}

export async function getForm(connection, formId) {
  const fresh = await ensureFreshToken(connection);
  const res = await fetch(`${API_BASE}/${encodeURIComponent(formId)}`, { headers: jsonHeaders(fresh.accessToken) });
  if (!res.ok) throw Object.assign(new Error(formsErrorMessage(res.status)), { connection: fresh });
  const form = await res.json();
  return { title: form.info?.title, questions: extractQuestions(form), responderUri: form.responderUri, connection: fresh };
}

// Adds one text-answer question at the end of the form — the simplest
// reliable "build a form" primitive; richer question types (choice,
// scale, etc.) can layer on this same batchUpdate shape later if needed.
export async function addTextQuestion(connection, formId, { title, required = false }) {
  const fresh = await ensureFreshToken(connection);
  const res = await fetch(`${API_BASE}/${encodeURIComponent(formId)}:batchUpdate`, {
    method: "POST",
    headers: jsonHeaders(fresh.accessToken),
    body: JSON.stringify({
      requests: [
        {
          createItem: {
            item: { title, questionItem: { question: { required, textQuestion: { paragraph: false } } } },
            location: { index: 0 },
          },
        },
      ],
    }),
  });
  if (!res.ok) throw Object.assign(new Error(formsErrorMessage(res.status)), { connection: fresh });
  return { connection: fresh };
}

export async function listResponses(connection, formId) {
  const fresh = await ensureFreshToken(connection);
  const res = await fetch(`${API_BASE}/${encodeURIComponent(formId)}/responses`, { headers: jsonHeaders(fresh.accessToken) });
  if (!res.ok) throw Object.assign(new Error(formsErrorMessage(res.status)), { connection: fresh });
  const data = await res.json();
  return { responses: data.responses || [], connection: fresh };
}

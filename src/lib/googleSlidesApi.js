// Minimal client-side Google Slides API helpers for the connected Google
// Workspace connection (googleWorkspaceConnection.js). Client-side twin of
// the equivalent calls in base44/functions/aiChatStream/entry.ts — see
// googleCalendarApi.js's header comment for why that split exists.
import { jsonHeaders, ensureFreshToken } from "@/lib/googleWorkspaceApiBase";

const API_BASE = "https://slides.googleapis.com/v1/presentations";

function slidesErrorMessage(status) {
  if (status === 401) return "Google rejected that token — try reconnecting Google Workspace.";
  if (status === 403) return "Google Slides denied this request — check the connected account still has access.";
  if (status === 404) return "Presentation not found.";
  return `Google Slides error (${status}).`;
}

export async function createPresentation(connection, { title }) {
  const fresh = await ensureFreshToken(connection);
  const res = await fetch(API_BASE, { method: "POST", headers: jsonHeaders(fresh.accessToken), body: JSON.stringify({ title }) });
  if (!res.ok) throw Object.assign(new Error(slidesErrorMessage(res.status)), { connection: fresh });
  const presentation = await res.json();
  return { presentation, connection: fresh };
}

// Flattens each slide's text boxes into one string per slide — good enough
// for the assistant to read back what a deck says, not a layout-faithful
// export.
function extractSlideText(slide) {
  return (slide.pageElements || [])
    .flatMap((el) => (el.shape?.text?.textElements || []).map((t) => t.textRun?.content || ""))
    .join("")
    .trim();
}

export async function getPresentation(connection, presentationId) {
  const fresh = await ensureFreshToken(connection);
  const res = await fetch(`${API_BASE}/${encodeURIComponent(presentationId)}`, { headers: jsonHeaders(fresh.accessToken) });
  if (!res.ok) throw Object.assign(new Error(slidesErrorMessage(res.status)), { connection: fresh });
  const presentation = await res.json();
  const slides = (presentation.slides || []).map((s, i) => ({ slideId: s.objectId, index: i, text: extractSlideText(s) }));
  return { title: presentation.title, slides, connection: fresh };
}

// Appends a new slide with a title + body text box using Slides' built-in
// TITLE_AND_BODY layout — the simplest reliable "add content" primitive
// without hand-placing shapes on a blank layout.
export async function addSlide(connection, presentationId, { title, body }) {
  const fresh = await ensureFreshToken(connection);
  const slideId = `slide_${crypto.randomUUID().replace(/-/g, "")}`;
  const titleId = `${slideId}_title`;
  const bodyId = `${slideId}_body`;
  const requests = [
    {
      createSlide: {
        objectId: slideId,
        slideLayoutReference: { predefinedLayout: "TITLE_AND_BODY" },
        placeholderIdMappings: [
          { layoutPlaceholder: { type: "TITLE" }, objectId: titleId },
          { layoutPlaceholder: { type: "BODY" }, objectId: bodyId },
        ],
      },
    },
    ...(title ? [{ insertText: { objectId: titleId, text: title } }] : []),
    ...(body ? [{ insertText: { objectId: bodyId, text: body } }] : []),
  ];
  const res = await fetch(`${API_BASE}/${encodeURIComponent(presentationId)}:batchUpdate`, {
    method: "POST",
    headers: jsonHeaders(fresh.accessToken),
    body: JSON.stringify({ requests }),
  });
  if (!res.ok) throw Object.assign(new Error(slidesErrorMessage(res.status)), { connection: fresh });
  return { slideId, connection: fresh };
}

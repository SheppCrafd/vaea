// Client-side ports of aiChatStream/entry.ts's "live" tools — search_workspace
// and audit_workspace are pure reads over the same dataset
// useChatController.js already gathers for the prompt; the vault_* tools
// below call githubApi.js's own exports (the same GitHub REST calls
// entry.ts makes server-side, just from the browser instead of Deno).
// read_project_link, unlike entry.ts's own version (base44.integrations.Core.
// InvokeLLM with add_context_from_internet — a paid, LLM-driven browse), is a
// PLAIN client-side fetch()+text-extraction here — no paid dependency, but a
// real consequence: many sites reject a cross-origin browser fetch (no
// Access-Control-Allow-Origin header), which InvokeLLM's own server-side
// request never has to deal with. That's a genuine capability gap, not a
// bug — surfaced to the model as a plain error to relay, never guessed past.
// Kept in sync by hand with entry.ts's own tool bodies — different
// runtime, can't share a module, same reasoning as toolCatalog.js.
import { listVaultNoteRepo, readVaultNoteContent, searchVaultNotes, auditVaultNotes } from "@/lib/githubApi";
import {
  loadGoogleWorkspaceConnection as loadCalendarConnection,
  saveGoogleWorkspaceConnection as saveCalendarConnection,
  isGoogleWorkspaceConnected as isCalendarConnected,
} from "@/lib/googleWorkspaceConnection";
import { listEvents } from "@/lib/googleCalendarApi";
import { listFiles as listDriveFiles } from "@/lib/googleDriveApi";
import { getDocument } from "@/lib/googleDocsApi";
import { getValues as getSheetValues } from "@/lib/googleSheetsApi";
import { getPresentation } from "@/lib/googleSlidesApi";
import { listTaskLists as listGoogleTaskLists, listTasks as listGoogleTasks } from "@/lib/googleTasksApi";
import { getForm, listResponses as listGoogleFormResponses } from "@/lib/googleFormsApi";
import { loadGmailConnection, saveGmailConnection, isGmailConnected } from "@/lib/gmailConnection";
import { listMessages as listGmailMessages, readMessage as readGmailMessage } from "@/lib/gmailApi";
import { loadMicrosoftConnection, saveMicrosoftConnection, isMicrosoftConnected } from "@/lib/microsoftConnection";
import { loadOutlookConnection, saveOutlookConnection, isOutlookConnected } from "@/lib/outlookConnection";
import { loadSlackConnection, isSlackConnected } from "@/lib/slackConnection";
import { listChannels as listSlackChannels, listMessages as listSlackMessages } from "@/lib/slackApi";
import { listEvents as listOutlookEvents, listMessages as listOutlookMessages, readMessage as readOutlookMessage } from "@/lib/microsoftGraphApi";
import { loadClickUpConnection, isClickUpConnected } from "@/lib/clickupConnection";
import { listSpaces, listLists, listTasks, listChannels, listMessages } from "@/lib/clickupApi";
import { loadWorkflowCards } from "@/lib/workflowCanvasStore";
import { listSnapshots } from "@/lib/backupSnapshots";

const MAX_LINK_CONTENT_CHARS = 6000;

function extractReadableText(html) {
  const withoutNonContent = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");
  return withoutNonContent
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function readProjectLinkTool(url, focus) {
  let response;
  try {
    response = await fetch(url);
  } catch (error) {
    return {
      error: `Couldn't reach "${url}" directly from the browser: ${error.message}. Many sites block cross-origin requests (CORS) from a page like this one — that's a real limitation of reading links this way, not a bug. Tell the user plainly rather than guessing at the content.`,
    };
  }
  if (!response.ok) {
    return { error: `Fetching "${url}" returned HTTP ${response.status} ${response.statusText}. Tell the user plainly rather than guessing at the content.` };
  }
  const raw = await response.text();
  const contentType = response.headers.get("content-type") || "";
  const text = contentType.includes("html") ? extractReadableText(raw) : raw.trim();
  if (!text) {
    return { url, focus, content: "(the page returned no readable text content)" };
  }
  return {
    url,
    focus,
    content: text.slice(0, MAX_LINK_CONTENT_CHARS),
    truncated: text.length > MAX_LINK_CONTENT_CHARS,
  };
}

const IMAGE_MEDIA_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const MAX_ATTACHMENT_TEXT_CHARS = 6000;

function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

// Unlike entry.ts's own version (base44.integrations.Core.
// ExtractDataFromUploadedFile — a paid integration that handles any file
// type server-side), this is a plain client-side fetch(): images become a
// real base64 image content block the adapters (anthropicAdapter.js/
// openaiCompatibleAdapter.js/localBridgeAdapter.js) inject into the next
// round so the model genuinely SEES it, not a caption of it, plus a
// best-effort OCR pass (documentParsing.js, tesseract.js) so Local Mode's
// non-vision models still get real text out of it; plain-text files are
// read directly; PDFs get real page-by-page text extraction (pdf.js). Office
// docs (.docx/.xlsx/etc.) are the one remaining honest gap — no parser for
// those formats lives in this app outside Vaea's own built-in model.
async function analyzeAttachmentTool(fileUrl, focus) {
  let response;
  try {
    response = await fetch(fileUrl);
  } catch (error) {
    return { error: `Couldn't fetch that attachment directly from the browser: ${error.message}. Tell the user plainly rather than guessing at its contents.` };
  }
  if (!response.ok) {
    return { error: `Fetching the attachment returned HTTP ${response.status} ${response.statusText}. Tell the user plainly rather than guessing at its contents.` };
  }
  const contentType = (response.headers.get("content-type") || "").split(";")[0].trim();
  if (IMAGE_MEDIA_TYPES.has(contentType)) {
    const buffer = await response.arrayBuffer();
    const result = { file_url: fileUrl, focus, is_image: true, media_type: contentType, image_base64: arrayBufferToBase64(buffer) };
    // OCR runs alongside the raw image, not instead of it — a vision-capable
    // model still sees the actual image; ocr_text is what makes this usable
    // for Local Mode too, where the local model may have no vision input at
    // all (see byokChat.js). Best-effort: a failed/empty OCR pass just means
    // the field comes back empty, never blocks the real image result.
    try {
      const { ocrImage } = await import("@/lib/documentParsing");
      const text = await ocrImage(new Blob([buffer], { type: contentType }));
      if (text) result.ocr_text = text.slice(0, MAX_ATTACHMENT_TEXT_CHARS);
    } catch {
      // best-effort — OCR is a bonus field, not a requirement
    }
    return result;
  }
  if (contentType.startsWith("text/") || contentType.includes("json")) {
    const raw = await response.text();
    const text = contentType.includes("html") ? extractReadableText(raw) : raw.trim();
    return {
      file_url: fileUrl,
      focus,
      extracted_text: text.slice(0, MAX_ATTACHMENT_TEXT_CHARS),
      truncated: text.length > MAX_ATTACHMENT_TEXT_CHARS,
    };
  }
  if (contentType === "application/pdf") {
    try {
      const { extractPdfText } = await import("@/lib/documentParsing");
      const buffer = await response.arrayBuffer();
      const { text, pageCount, truncated } = await extractPdfText(buffer);
      return {
        file_url: fileUrl,
        focus,
        extracted_text: text.slice(0, MAX_ATTACHMENT_TEXT_CHARS),
        truncated: truncated || text.length > MAX_ATTACHMENT_TEXT_CHARS,
        page_count: pageCount,
      };
    } catch (error) {
      return { error: `Couldn't parse that PDF: ${error.message}. Tell the user plainly rather than guessing at its contents.` };
    }
  }
  return {
    error: `This mode can only analyze images (png/jpeg/gif/webp), PDFs, and plain-text files client-side — "${contentType || "an unknown file type"}" (e.g. a Word doc) needs a real document parser this app doesn't have outside Vaea's own built-in model. Tell the user plainly rather than guessing at its contents.`,
  };
}

function searchRecords(query, records, type, fields, titleField) {
  const q = query.toLowerCase();
  const matches = [];
  for (const record of records) {
    const haystack = fields.map((f) => record[f] || "").join(" ").toLowerCase();
    if (haystack.includes(q)) {
      matches.push({
        type,
        id: record.id,
        title: record[titleField] || fields.map((f) => record[f]).find(Boolean) || "(untitled)",
        snippet: fields.map((f) => record[f]).filter(Boolean).join(" — ").slice(0, 300),
      });
    }
  }
  return matches;
}

export function searchWorkspace(dataset, query) {
  const matches = [
    ...searchRecords(query, dataset.areas, "area", ["title", "description"], "title"),
    ...searchRecords(query, dataset.products, "product", ["title", "description"], "title"),
    ...searchRecords(query, dataset.projects, "project", ["title", "objective", "problem_statement"], "title"),
    ...searchRecords(query, dataset.archivedProjects, "archived_project", ["title", "objective", "problem_statement"], "title"),
    ...searchRecords(query, dataset.tasks, "task", ["description", "notes"], "description"),
    ...searchRecords(query, dataset.archivedTasks, "archived_task", ["description", "notes"], "description"),
    ...searchRecords(query, dataset.stakeholders, "stakeholder", ["name", "department"], "name"),
    ...searchRecords(query, dataset.notes, "note", ["content"], "content"),
  ];
  return { count: matches.length, matches: matches.slice(0, 25) };
}

export function auditWorkspace(dataset) {
  const findings = {};

  findings.projects_missing_owner_or_due_date = dataset.projects
    .filter((p) => !p.owner_name || !p.due_date)
    .map((p) => ({ id: p.id, title: p.title, missing: [!p.owner_name && "owner", !p.due_date && "due_date"].filter(Boolean) }));

  const today = new Date().toISOString().slice(0, 10);
  findings.overdue_projects = dataset.projects
    .filter((p) => p.due_date && p.due_date < today)
    .map((p) => ({ id: p.id, title: p.title, due_date: p.due_date }));

  findings.done_tasks_not_yet_archived = dataset.tasks
    .filter((t) => t.status === "DONE" || t.status === "DELEGATED_DONE")
    .map((t) => ({ id: t.id, project_id: t.project_id, description: t.description }));

  const seen = new Map();
  findings.possible_duplicate_tasks = [];
  for (const t of dataset.tasks) {
    const key = `${t.project_id}::${(t.description || "").trim().toLowerCase()}`;
    if (t.description && seen.has(key)) findings.possible_duplicate_tasks.push({ ids: [seen.get(key), t.id], project_id: t.project_id, description: t.description });
    else seen.set(key, t.id);
  }

  findings.stakeholders_missing_department = dataset.stakeholders
    .filter((s) => !s.department)
    .map((s) => ({ id: s.id, name: s.name }));

  const productIdsWithProjects = new Set(dataset.projects.map((p) => p.parent_product_id).filter(Boolean));
  findings.empty_products = dataset.products
    .filter((p) => !productIdsWithProjects.has(p.id))
    .map((p) => ({ id: p.id, title: p.title }));

  const areaIdsWithContent = new Set([...dataset.projects, ...dataset.products].map((x) => x.parent_area_id).filter(Boolean));
  findings.empty_areas = dataset.areas
    .filter((a) => !areaIdsWithContent.has(a.id))
    .map((a) => ({ id: a.id, title: a.title }));

  return findings;
}

// Same connected-check and shape as entry.ts's own vaultNotConnected() —
// the model is told plainly to relay "connect one in Settings" rather than
// guessing or pretending a call worked.
function vaultNotConnected() {
  return { connected: false, message: "No Vaea Brain connected. Tell the user to connect one in Settings -> Vaea Brain before this can work." };
}

async function listVaultNotesTool(externalVault) {
  if (!externalVault?.owner || !externalVault?.repo || !externalVault?.token) return vaultNotConnected();
  try {
    const paths = await listVaultNoteRepo(externalVault);
    return { connected: true, count: paths.length, paths };
  } catch (error) {
    return { connected: true, error: `Couldn't list the vault: ${error.message}` };
  }
}

async function readVaultNoteTool(externalVault, path) {
  if (!externalVault?.owner || !externalVault?.repo || !externalVault?.token) return vaultNotConnected();
  try {
    const content = await readVaultNoteContent({ ...externalVault, path });
    return { connected: true, path, content };
  } catch (error) {
    return { connected: true, error: `Couldn't read "${path}": ${error.message}` };
  }
}

async function searchVaultTool(externalVault, query) {
  if (!externalVault?.owner || !externalVault?.repo || !externalVault?.token) return vaultNotConnected();
  try {
    const { count, matches } = await searchVaultNotes(externalVault, query);
    return { connected: true, count, matches };
  } catch (error) {
    return {
      connected: true,
      error: `Vault search failed: ${error.message}. GitHub's code search can lag a few minutes behind a fresh push — try list_vault_notes + read_vault_note instead if this keeps missing something you know is there.`,
    };
  }
}

async function auditVaultTool(externalVault) {
  if (!externalVault?.owner || !externalVault?.repo || !externalVault?.token) return vaultNotConnected();
  try {
    const result = await auditVaultNotes(externalVault);
    return { connected: true, ...result };
  } catch (error) {
    return { connected: true, error: `Vault audit failed: ${error.message}` };
  }
}

async function listCalendarEventsTool(args) {
  const connection = await loadCalendarConnection();
  if (!isCalendarConnected(connection)) {
    return { connected: false, message: "No Google Calendar connected. Tell the user to connect one in Settings -> Google Calendar before this can work." };
  }
  try {
    const { events, connection: refreshed } = await listEvents(connection, { timeMin: args.time_min, timeMax: args.time_max });
    if (refreshed.accessToken !== connection.accessToken) await saveCalendarConnection(refreshed);
    return {
      connected: true,
      count: events.length,
      events: events.map((e) => ({
        id: e.id,
        summary: e.summary,
        start: e.start?.dateTime || e.start?.date,
        end: e.end?.dateTime || e.end?.date,
        location: e.location,
        meetLink: e.hangoutLink,
      })),
    };
  } catch (error) {
    return { connected: true, error: `Couldn't list calendar events: ${error.message}` };
  }
}

function workspaceNotConnected() {
  return { connected: false, message: "No Google Workspace connected. Tell the user to connect one in Settings -> Google Workspace before this can work." };
}

async function searchDriveFilesTool(args) {
  const connection = await loadCalendarConnection();
  if (!isCalendarConnected(connection)) return workspaceNotConnected();
  try {
    const { files, connection: refreshed } = await listDriveFiles(connection, { query: args.query, maxResults: args.max_results });
    if (refreshed.accessToken !== connection.accessToken) await saveCalendarConnection(refreshed);
    return { connected: true, count: files.length, files };
  } catch (error) {
    return { connected: true, error: `Couldn't search Drive: ${error.message}` };
  }
}

async function readGoogleDocTool(args) {
  const connection = await loadCalendarConnection();
  if (!isCalendarConnected(connection)) return workspaceNotConnected();
  try {
    const { title, text, connection: refreshed } = await getDocument(connection, args.document_id);
    if (refreshed.accessToken !== connection.accessToken) await saveCalendarConnection(refreshed);
    return { connected: true, title, text };
  } catch (error) {
    return { connected: true, error: `Couldn't read the doc: ${error.message}` };
  }
}

async function readGoogleSheetTool(args) {
  const connection = await loadCalendarConnection();
  if (!isCalendarConnected(connection)) return workspaceNotConnected();
  try {
    const { values, connection: refreshed } = await getSheetValues(connection, args.spreadsheet_id, args.range);
    if (refreshed.accessToken !== connection.accessToken) await saveCalendarConnection(refreshed);
    return { connected: true, values };
  } catch (error) {
    return { connected: true, error: `Couldn't read the sheet: ${error.message}` };
  }
}

async function readGoogleSlidesTool(args) {
  const connection = await loadCalendarConnection();
  if (!isCalendarConnected(connection)) return workspaceNotConnected();
  try {
    const { title, slides, connection: refreshed } = await getPresentation(connection, args.presentation_id);
    if (refreshed.accessToken !== connection.accessToken) await saveCalendarConnection(refreshed);
    return { connected: true, title, slides };
  } catch (error) {
    return { connected: true, error: `Couldn't read the presentation: ${error.message}` };
  }
}

async function listGoogleTasksTool(args) {
  const connection = await loadCalendarConnection();
  if (!isCalendarConnected(connection)) return workspaceNotConnected();
  try {
    const taskListId = args.task_list_id || "@default";
    const { tasks, connection: refreshed } = await listGoogleTasks(connection, taskListId, { showCompleted: args.show_completed });
    if (refreshed.accessToken !== connection.accessToken) await saveCalendarConnection(refreshed);
    return { connected: true, count: tasks.length, tasks };
  } catch (error) {
    return { connected: true, error: `Couldn't list Google Tasks: ${error.message}` };
  }
}

async function listGoogleTaskListsTool() {
  const connection = await loadCalendarConnection();
  if (!isCalendarConnected(connection)) return workspaceNotConnected();
  try {
    const { taskLists, connection: refreshed } = await listGoogleTaskLists(connection);
    if (refreshed.accessToken !== connection.accessToken) await saveCalendarConnection(refreshed);
    return { connected: true, taskLists };
  } catch (error) {
    return { connected: true, error: `Couldn't list Google Task lists: ${error.message}` };
  }
}

async function readGoogleFormTool(args) {
  const connection = await loadCalendarConnection();
  if (!isCalendarConnected(connection)) return workspaceNotConnected();
  try {
    const { title, questions, responderUri, connection: refreshed } = await getForm(connection, args.form_id);
    if (refreshed.accessToken !== connection.accessToken) await saveCalendarConnection(refreshed);
    return { connected: true, title, questions, responderUri };
  } catch (error) {
    return { connected: true, error: `Couldn't read the form: ${error.message}` };
  }
}

async function listGoogleFormResponsesTool(args) {
  const connection = await loadCalendarConnection();
  if (!isCalendarConnected(connection)) return workspaceNotConnected();
  try {
    const { responses, connection: refreshed } = await listGoogleFormResponses(connection, args.form_id);
    if (refreshed.accessToken !== connection.accessToken) await saveCalendarConnection(refreshed);
    return { connected: true, count: responses.length, responses };
  } catch (error) {
    return { connected: true, error: `Couldn't list form responses: ${error.message}` };
  }
}

function gmailNotConnected() {
  return { connected: false, message: "No Gmail account connected. Tell the user to connect one in Settings -> Gmail before this can work." };
}

async function listGmailMessagesTool(args) {
  const connection = await loadGmailConnection();
  if (!isGmailConnected(connection)) return gmailNotConnected();
  try {
    const { messages, connection: refreshed } = await listGmailMessages(connection, { query: args.query, maxResults: args.max_results });
    if (refreshed.accessToken !== connection.accessToken) await saveGmailConnection(refreshed);
    return { connected: true, count: messages.length, messages };
  } catch (error) {
    return { connected: true, error: `Couldn't list Gmail messages: ${error.message}` };
  }
}

async function readGmailMessageTool(args) {
  const connection = await loadGmailConnection();
  if (!isGmailConnected(connection)) return gmailNotConnected();
  try {
    const { message, connection: refreshed } = await readGmailMessage(connection, args.message_id);
    if (refreshed.accessToken !== connection.accessToken) await saveGmailConnection(refreshed);
    return { connected: true, message };
  } catch (error) {
    return { connected: true, error: `Couldn't read that message: ${error.message}` };
  }
}

function microsoftNotConnected() {
  return { connected: false, message: "No Microsoft 365 calendar connected. Tell the user to connect one in Settings -> Microsoft 365 Calendar before this can work." };
}

function outlookNotConnected() {
  return { connected: false, message: "No Outlook mail connected. Tell the user to connect one in Settings -> Outlook Mail (feeds the Vmail tab) before this can work." };
}

async function listOutlookEventsTool(args) {
  const connection = await loadMicrosoftConnection();
  if (!isMicrosoftConnected(connection)) return microsoftNotConnected();
  try {
    const { events, connection: refreshed } = await listOutlookEvents(connection, { timeMin: args.time_min, timeMax: args.time_max });
    if (refreshed.accessToken !== connection.accessToken) await saveMicrosoftConnection(refreshed);
    return { connected: true, count: events.length, events };
  } catch (error) {
    return { connected: true, error: `Couldn't list Outlook events: ${error.message}` };
  }
}

async function listOutlookMessagesTool(args) {
  const connection = await loadOutlookConnection();
  if (!isOutlookConnected(connection)) return outlookNotConnected();
  try {
    const { messages, connection: refreshed } = await listOutlookMessages(connection, { query: args.query, maxResults: args.max_results });
    if (refreshed.accessToken !== connection.accessToken) await saveOutlookConnection(refreshed);
    return { connected: true, count: messages.length, messages };
  } catch (error) {
    return { connected: true, error: `Couldn't list Outlook messages: ${error.message}` };
  }
}

async function readOutlookMessageTool(args) {
  const connection = await loadOutlookConnection();
  if (!isOutlookConnected(connection)) return outlookNotConnected();
  try {
    const { message, connection: refreshed } = await readOutlookMessage(connection, args.message_id);
    if (refreshed.accessToken !== connection.accessToken) await saveOutlookConnection(refreshed);
    return { connected: true, message };
  } catch (error) {
    return { connected: true, error: `Couldn't read that message: ${error.message}` };
  }
}

function slackNotConnected() {
  return { connected: false, message: "No Slack workspace connected. Tell the user to connect one in Settings -> Slack before this can work." };
}

async function listSlackChannelsTool() {
  const connection = await loadSlackConnection();
  if (!isSlackConnected(connection)) return slackNotConnected();
  try {
    const channels = await listSlackChannels(connection);
    return { connected: true, count: channels.length, channels };
  } catch (error) {
    return { connected: true, error: `Couldn't list Slack channels: ${error.message}` };
  }
}

async function listSlackMessagesTool(args) {
  const connection = await loadSlackConnection();
  if (!isSlackConnected(connection)) return slackNotConnected();
  try {
    const messages = await listSlackMessages(connection, args.channel_id, { limit: args.limit });
    return { connected: true, count: messages.length, messages };
  } catch (error) {
    return { connected: true, error: `Couldn't list Slack messages: ${error.message}` };
  }
}

function clickupNotConnected() {
  return { connected: false, message: "No ClickUp workspace connected. Tell the user to connect one in Settings -> ClickUp before this can work." };
}

async function listClickUpSpacesTool() {
  const connection = await loadClickUpConnection();
  if (!isClickUpConnected(connection)) return clickupNotConnected();
  try {
    return { connected: true, spaces: await listSpaces(connection) };
  } catch (error) {
    return { connected: true, error: `Couldn't list spaces: ${error.message}` };
  }
}

async function listClickUpListsTool(args) {
  const connection = await loadClickUpConnection();
  if (!isClickUpConnected(connection)) return clickupNotConnected();
  try {
    return { connected: true, lists: await listLists(connection, args.space_id) };
  } catch (error) {
    return { connected: true, error: `Couldn't list lists: ${error.message}` };
  }
}

async function listClickUpTasksTool(args) {
  const connection = await loadClickUpConnection();
  if (!isClickUpConnected(connection)) return clickupNotConnected();
  const listId = args.list_id || connection.defaultListId;
  if (!listId) return { connected: true, error: "No default list configured — pick one in Settings, or specify list_id." };
  try {
    const tasks = await listTasks(connection, listId, { includeClosed: args.include_closed });
    return { connected: true, count: tasks.length, tasks };
  } catch (error) {
    return { connected: true, error: `Couldn't list tasks: ${error.message}` };
  }
}

async function listClickUpChannelsTool() {
  const connection = await loadClickUpConnection();
  if (!isClickUpConnected(connection)) return clickupNotConnected();
  try {
    return { connected: true, channels: await listChannels(connection) };
  } catch (error) {
    return { connected: true, error: `Couldn't list channels: ${error.message}` };
  }
}

async function listClickUpMessagesTool(args) {
  const connection = await loadClickUpConnection();
  if (!isClickUpConnected(connection)) return clickupNotConnected();
  try {
    return { connected: true, messages: await listMessages(connection, args.channel_id) };
  } catch (error) {
    return { connected: true, error: `Couldn't list messages: ${error.message}` };
  }
}

async function listWorkflowCardsTool() {
  const cards = await loadWorkflowCards();
  return { count: cards.length, cards: cards.map((c) => ({ id: c.id, text: c.text })) };
}

async function listBackupsTool() {
  const snapshots = await listSnapshots();
  return { count: snapshots.length, snapshots };
}

// Dispatches one of the catalog's non-staged ("live") tools by name. Staged
// (mutation) tools never reach here — byokChat.js's tool runner queues those
// directly without needing a dataset at all. Async — the vault_* tools make
// real GitHub API calls, and read_project_link makes a real fetch().
export async function runLocalTool(name, args, { dataset, externalVault } = {}) {
  switch (name) {
    case "suggest_task_fields": {
      // Pure AI reasoning — no API call, just return a structured suggestion
      // the model itself generates based on the task description.
      return {
        suggestion: "Call this tool to get the model's own quadrant/importance reasoning in structured form — the tool result itself is the model's analysis, not a separate computation.",
        description: args.description,
        context: args.context || "",
      };
    }
    case "search_workspace":
      return searchWorkspace(dataset, args.query);
    case "audit_workspace":
      return auditWorkspace(dataset);
    case "list_vault_notes":
      return listVaultNotesTool(externalVault);
    case "read_vault_note":
      return readVaultNoteTool(externalVault, args.path);
    case "search_vault":
      return searchVaultTool(externalVault, args.query);
    case "audit_vault":
      return auditVaultTool(externalVault);
    case "list_calendar_events":
      return listCalendarEventsTool(args);
    case "search_drive_files":
      return searchDriveFilesTool(args);
    case "read_google_doc":
      return readGoogleDocTool(args);
    case "read_google_sheet":
      return readGoogleSheetTool(args);
    case "read_google_slides":
      return readGoogleSlidesTool(args);
    case "list_google_task_lists":
      return listGoogleTaskListsTool();
    case "list_google_tasks":
      return listGoogleTasksTool(args);
    case "read_google_form":
      return readGoogleFormTool(args);
    case "list_google_form_responses":
      return listGoogleFormResponsesTool(args);
    case "list_workflow_cards":
      return listWorkflowCardsTool();
    case "list_backups":
      return listBackupsTool();
    case "list_gmail_messages":
      return listGmailMessagesTool(args);
    case "read_gmail_message":
      return readGmailMessageTool(args);
    case "list_outlook_events":
      return listOutlookEventsTool(args);
    case "list_outlook_messages":
      return listOutlookMessagesTool(args);
    case "read_outlook_message":
      return readOutlookMessageTool(args);
    case "list_slack_channels":
      return listSlackChannelsTool();
    case "list_slack_messages":
      return listSlackMessagesTool(args);
    case "read_project_link":
      return readProjectLinkTool(args.url, args.focus);
    case "analyze_attachment":
      return analyzeAttachmentTool(args.file_url, args.focus);
    default:
      return { error: `Unknown tool "${name}"` };
  }
}

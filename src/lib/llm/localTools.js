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
// round so the model genuinely SEES it, not a caption of it; plain-text
// files are read directly. PDFs/Office docs etc. are an honest gap — no
// document parser lives in this app outside Vaea's own built-in model.
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
    return { file_url: fileUrl, focus, is_image: true, media_type: contentType, image_base64: arrayBufferToBase64(buffer) };
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
  return {
    error: `This mode can only analyze images (png/jpeg/gif/webp) and plain-text files client-side — "${contentType || "an unknown file type"}" (e.g. a PDF or Word doc) needs a real document parser this app doesn't have outside Vaea's own built-in model. Tell the user plainly rather than guessing at its contents.`,
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
  return { connected: false, message: "No Vaea Vault connected. Tell the user to connect one in Settings -> Vaea Vault before this can work." };
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

// Dispatches one of the catalog's non-staged ("live") tools by name. Staged
// (mutation) tools never reach here — byokChat.js's tool runner queues those
// directly without needing a dataset at all. Async — the vault_* tools make
// real GitHub API calls, and read_project_link makes a real fetch().
export async function runLocalTool(name, args, { dataset, externalVault } = {}) {
  switch (name) {
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
    case "read_project_link":
      return readProjectLinkTool(args.url, args.focus);
    case "analyze_attachment":
      return analyzeAttachmentTool(args.file_url, args.focus);
    default:
      return { error: `Unknown tool "${name}"` };
  }
}

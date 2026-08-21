import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeToolRunner, MAX_ACTIONS_PER_REQUEST } from "./toolRunner.js";
import { MAX_BULK_ITEMS_PER_CALL } from "./toolCatalog.js";

vi.mock("@/lib/githubApi", () => ({
  listVaultNoteRepo: vi.fn(),
  readVaultNoteContent: vi.fn(),
  searchVaultNotes: vi.fn(),
  auditVaultNotes: vi.fn(),
}));
import { listVaultNoteRepo, readVaultNoteContent, searchVaultNotes, auditVaultNotes } from "@/lib/githubApi";

// pdf.js/tesseract.js both need real browser APIs (DOMMatrix, Worker, wasm
// fetch) jsdom doesn't provide — mocked so analyze_attachment's PDF/OCR
// branches are tested for their own wiring/error-handling, not pdf.js's or
// tesseract.js's actual parsing internals (out of scope for a unit test).
vi.mock("@/lib/documentParsing", () => ({
  extractPdfText: vi.fn(),
  ocrImage: vi.fn(),
}));
import { extractPdfText, ocrImage } from "@/lib/documentParsing";

beforeEach(() => {
  vi.clearAllMocks();
});

// runTool is async now — every live tool (vault reads/writes,
// read_project_link, analyze_attachment) makes a real network call, not
// just a synchronous read over an already-loaded dataset.
describe("toolRunner: staged tools queue instead of executing", () => {
  it("pushes {action, args} onto plan and returns a queued ack", async () => {
    const plan = [];
    const runTool = makeToolRunner({ plan, dataset: {} });
    const result = await runTool("CREATE_AREA", { title: "Marketing", description: "" });
    expect(result.queued).toBe(true);
    expect(plan).toEqual([{ action: "CREATE_AREA", args: { title: "Marketing", description: "" } }]);
  });

  it("strips temp_id out of args but keeps it as its own plan field, and hints the model how to reference it", async () => {
    const plan = [];
    const runTool = makeToolRunner({ plan, dataset: {} });
    const result = await runTool("CREATE_AREA", { title: "Marketing", temp_id: "area1" });
    expect(plan[0]).toEqual({ action: "CREATE_AREA", args: { title: "Marketing" }, temp_id: "area1" });
    expect(result.temp_id_registered).toBe("area1");
    expect(result.hint).toContain("$area1");
  });

  it("refuses to queue past MAX_ACTIONS_PER_REQUEST", async () => {
    const plan = Array.from({ length: MAX_ACTIONS_PER_REQUEST }, () => ({ action: "CREATE_AREA", args: {} }));
    const runTool = makeToolRunner({ plan, dataset: {} });
    const result = await runTool("CREATE_AREA", { title: "One too many" });
    expect(result.queued).toBe(false);
    expect(plan).toHaveLength(MAX_ACTIONS_PER_REQUEST);
  });

  // Rejected right here, at staging time — not left to surface later as a
  // chatActions.js runtime error only once the plan actually executes on
  // the user's device (see chatActions.js's own MAX_BULK_ITEMS_PER_CALL
  // comment for why that was too late).
  it("refuses to queue a BULK_CREATE over MAX_BULK_ITEMS_PER_CALL, without touching the plan", async () => {
    const plan = [];
    const runTool = makeToolRunner({ plan, dataset: {} });
    const items = Array.from({ length: MAX_BULK_ITEMS_PER_CALL + 1 }, (_, i) => ({ description: `Task ${i}` }));
    const result = await runTool("BULK_CREATE", { entity_type: "task", items });
    expect(result.queued).toBe(false);
    expect(result.error).toMatch(new RegExp(`up to ${MAX_BULK_ITEMS_PER_CALL}`));
    expect(plan).toHaveLength(0);
  });

  it("refuses to queue a BULK_DELETE over MAX_BULK_ITEMS_PER_CALL, without touching the plan", async () => {
    const plan = [];
    const runTool = makeToolRunner({ plan, dataset: {} });
    const ids = Array.from({ length: MAX_BULK_ITEMS_PER_CALL + 1 }, (_, i) => `id-${i}`);
    const result = await runTool("BULK_DELETE", { entity_type: "task", ids });
    expect(result.queued).toBe(false);
    expect(result.error).toMatch(new RegExp(`up to ${MAX_BULK_ITEMS_PER_CALL}`));
    expect(plan).toHaveLength(0);
  });

  it("tells the model a non-destructive action runs immediately with no confirm step", async () => {
    // The tool's own returned note used to unconditionally say "Do not tell
    // the user this already happened" for every action, contradicting the
    // system instructions for the (far more common) non-destructive case —
    // a real, verified contributor to the model describing plain creates as
    // "queued"/"pending confirmation."
    const plan = [];
    const runTool = makeToolRunner({ plan, dataset: {} });
    const result = await runTool("CREATE_TASK", { project_id: "p1", description: "Do the thing" });
    expect(result.note).toMatch(/runs automatically, immediately/);
    expect(result.note).not.toMatch(/confirm click before this runs/);
  });

  it("tells the model a destructive action needs a real confirm click first", async () => {
    const plan = [];
    const runTool = makeToolRunner({ plan, dataset: {} });
    const result = await runTool("DELETE_TASK", { task_id: "t1" });
    expect(result.note).toMatch(/confirm click before this runs/);
  });

  it("still queues a BULK_CREATE/BULK_DELETE at exactly the limit", async () => {
    const plan = [];
    const runTool = makeToolRunner({ plan, dataset: {} });
    const items = Array.from({ length: MAX_BULK_ITEMS_PER_CALL }, (_, i) => ({ description: `Task ${i}` }));
    const result = await runTool("BULK_CREATE", { entity_type: "task", items });
    expect(result.queued).toBe(true);
    expect(plan).toHaveLength(1);
  });
});

// A relay agent hand-typing JSON (Local Mode) or a smaller BYOK model is far
// more likely to send a malformed tool call than Vaea's own hosted model —
// caught here, at staging time, instead of silently sailing into the plan
// and only failing later at confirm/execute time (chatActions.js).
describe("toolRunner: staged tool_use input validation (validateToolInput)", () => {
  it("rejects a staged call missing a required field, without touching the plan", async () => {
    const plan = [];
    const runTool = makeToolRunner({ plan, dataset: {} });
    // CREATE_TASK requires project_id AND description.
    const result = await runTool("CREATE_TASK", { description: "Do the thing" });
    expect(result.queued).toBe(false);
    expect(result.error).toMatch(/Missing required field "project_id"/);
    expect(plan).toHaveLength(0);
  });

  it("rejects a staged call whose field is the wrong type", async () => {
    const plan = [];
    const runTool = makeToolRunner({ plan, dataset: {} });
    // stakeholder_ids must be an array, not a bare string.
    const result = await runTool("CREATE_TASK", { project_id: "p1", description: "x", stakeholder_ids: "s1" });
    expect(result.queued).toBe(false);
    expect(result.error).toMatch(/must be an array/);
    expect(plan).toHaveLength(0);
  });

  it("rejects a staged call with a value outside its enum", async () => {
    const plan = [];
    const runTool = makeToolRunner({ plan, dataset: {} });
    const result = await runTool("BULK_CREATE", { entity_type: "not-a-real-type", items: [{ description: "x" }] });
    expect(result.queued).toBe(false);
    expect(result.error).toMatch(/must be one of/);
    expect(plan).toHaveLength(0);
  });

  it("still queues a correctly-shaped call normally", async () => {
    const plan = [];
    const runTool = makeToolRunner({ plan, dataset: {} });
    const result = await runTool("CREATE_TASK", { project_id: "p1", description: "Do the thing" });
    expect(result.queued).toBe(true);
    expect(plan).toHaveLength(1);
  });
});

describe("toolRunner: local (non-staged) tools run for real against the dataset", () => {
  it("search_workspace finds a real match instead of being queued", async () => {
    const plan = [];
    const dataset = {
      areas: [{ id: "a1", title: "Growth", description: "" }],
      products: [], projects: [], archivedProjects: [], tasks: [], archivedTasks: [], stakeholders: [], notes: [],
    };
    const runTool = makeToolRunner({ plan, dataset });
    const result = await runTool("search_workspace", { query: "growth" });
    expect(plan).toHaveLength(0);
    expect(result.count).toBe(1);
    expect(result.matches[0]).toMatchObject({ type: "area", id: "a1" });
  });

  it("records a real search_workspace/audit_workspace call onto liveTrace, the same live-action shape a staged step gets", async () => {
    // Read tools used to be invisible beyond their raw result feeding the
    // model's next reasoning step — nothing surfaced them to the user as a
    // real action the way a staged CREATE_*/BULK_CREATE step does. liveTrace
    // is what ChatMessageList (via useChatController.js) now renders as a
    // real, clickable "search_workspace(...)" line, same as create_area(...).
    const plan = [];
    const liveTrace = [];
    const dataset = {
      areas: [{ id: "a1", title: "Growth", description: "" }],
      products: [], projects: [], archivedProjects: [], tasks: [], archivedTasks: [], stakeholders: [], notes: [],
    };
    const runTool = makeToolRunner({ plan, liveTrace, dataset });
    await runTool("search_workspace", { query: "growth" });
    expect(liveTrace).toHaveLength(1);
    expect(liveTrace[0].label).toBe('search_workspace("growth") — 1 match');
    expect(liveTrace[0].detail.matches[0]).toMatchObject({ type: "area", id: "a1" });

    await runTool("audit_workspace", {});
    expect(liveTrace).toHaveLength(2);
    expect(liveTrace[1].label).toMatch(/^audit_workspace\(\) — \d+ findings?$/);
  });

  it("emits a live tool-call event via onEvent the instant a live tool finishes, but never for a staged action", async () => {
    const plan = [];
    const liveTrace = [];
    const events = [];
    const dataset = {
      areas: [{ id: "a1", title: "Growth", description: "" }],
      products: [], projects: [], archivedProjects: [], tasks: [], archivedTasks: [], stakeholders: [], notes: [],
    };
    const runTool = makeToolRunner({ plan, liveTrace, dataset, onEvent: (e) => events.push(e) });

    await runTool("CREATE_AREA", { title: "Marketing" });
    expect(events).toHaveLength(0);

    await runTool("search_workspace", { query: "growth" });
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: "tool-call", label: liveTrace[0].label, detail: liveTrace[0].detail });
  });
});

describe("toolRunner: vault_* live tools (BYOK/Local Mode's own GitHub layer)", () => {
  const dataset = { areas: [], products: [], projects: [], archivedProjects: [], tasks: [], archivedTasks: [], stakeholders: [], notes: [] };
  const externalVault = { owner: "me", repo: "vault", branch: "main", token: "gh-token" };

  it("list_vault_notes returns connected:false without calling GitHub when no vault is connected", async () => {
    const runTool = makeToolRunner({ plan: [], dataset });
    const result = await runTool("list_vault_notes", {});
    expect(result.connected).toBe(false);
    expect(listVaultNoteRepo).not.toHaveBeenCalled();
  });

  it("list_vault_notes lists real paths and records liveTrace when connected", async () => {
    listVaultNoteRepo.mockResolvedValueOnce(["Daily/2026-07-28.md", "Projects/Vaea.md"]);
    const liveTrace = [];
    const runTool = makeToolRunner({ plan: [], liveTrace, dataset, externalVault });
    const result = await runTool("list_vault_notes", {});
    expect(result).toEqual({ connected: true, count: 2, paths: ["Daily/2026-07-28.md", "Projects/Vaea.md"] });
    expect(liveTrace[0].label).toBe("list_vault_notes() — 2 notes");
  });

  it("read_vault_note returns real content by path", async () => {
    readVaultNoteContent.mockResolvedValueOnce("# Hello\n[[Other Note]]");
    const runTool = makeToolRunner({ plan: [], dataset, externalVault });
    const result = await runTool("read_vault_note", { path: "Daily/2026-07-28.md" });
    expect(result).toEqual({ connected: true, path: "Daily/2026-07-28.md", content: "# Hello\n[[Other Note]]" });
    expect(readVaultNoteContent).toHaveBeenCalledWith({ ...externalVault, path: "Daily/2026-07-28.md" });
  });

  it("read_vault_note surfaces the real GitHub error verbatim on failure", async () => {
    readVaultNoteContent.mockRejectedValueOnce(new Error("Not Found"));
    const runTool = makeToolRunner({ plan: [], dataset, externalVault });
    const result = await runTool("read_vault_note", { path: "Missing.md" });
    expect(result.connected).toBe(true);
    expect(result.error).toContain("Not Found");
  });

  it("search_vault returns real matches", async () => {
    searchVaultNotes.mockResolvedValueOnce({ count: 1, matches: [{ path: "Decisions/X.md", snippet: "..." }] });
    const runTool = makeToolRunner({ plan: [], dataset, externalVault });
    const result = await runTool("search_vault", { query: "growth" });
    expect(result).toEqual({ connected: true, count: 1, matches: [{ path: "Decisions/X.md", snippet: "..." }] });
  });

  it("audit_vault returns real broken-link/isolated-note findings", async () => {
    auditVaultNotes.mockResolvedValueOnce({ notes_scanned: 3, notes_total: 3, broken_links: [{ from: "A.md", broken_link: "missing" }], isolated_notes: [] });
    const liveTrace = [];
    const runTool = makeToolRunner({ plan: [], liveTrace, dataset, externalVault });
    const result = await runTool("audit_vault", {});
    expect(result.broken_links).toHaveLength(1);
    expect(liveTrace[0].label).toBe("audit_vault() — 1 broken link, 0 isolated");
  });

  it("WRITE_VAULT_NOTE is a staged tool — queues instead of touching GitHub here", async () => {
    const plan = [];
    const runTool = makeToolRunner({ plan, dataset, externalVault });
    const result = await runTool("WRITE_VAULT_NOTE", { path: "Daily/2026-07-28.md", content: "# Today" });
    expect(result.queued).toBe(true);
    expect(plan).toEqual([{ action: "WRITE_VAULT_NOTE", args: { path: "Daily/2026-07-28.md", content: "# Today" } }]);
  });
});

describe("toolRunner: read_project_link (plain client-side fetch, no paid integration)", () => {
  const dataset = { areas: [], products: [], projects: [], archivedProjects: [], tasks: [], archivedTasks: [], stakeholders: [], notes: [] };

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it("fetches real HTML and strips it down to readable text", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: { get: () => "text/html; charset=utf-8" },
      text: async () => "<html><head><style>.x{}</style></head><body><script>evil()</script><h1>Hello &amp; welcome</h1><p>Real content.</p></body></html>",
    });
    const runTool = makeToolRunner({ plan: [], dataset });
    const result = await runTool("read_project_link", { url: "https://example.com/spec", focus: "pricing" });
    expect(result.content).toBe("Hello & welcome Real content.");
    expect(result.url).toBe("https://example.com/spec");
    expect(result.focus).toBe("pricing");
  });

  it("returns a plain error, not a throw, when the fetch itself rejects (the real CORS case)", async () => {
    global.fetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const runTool = makeToolRunner({ plan: [], dataset });
    const result = await runTool("read_project_link", { url: "https://blocked.example.com" });
    expect(result.error).toContain("Failed to fetch");
    expect(result.error).toMatch(/CORS/);
  });

  it("returns a plain error on a non-2xx HTTP response instead of pretending it read something", async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, status: 404, statusText: "Not Found" });
    const runTool = makeToolRunner({ plan: [], dataset });
    const result = await runTool("read_project_link", { url: "https://example.com/missing" });
    expect(result.error).toContain("404");
  });

  it("records a liveTrace entry the same as any other live tool call", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true, status: 200, statusText: "OK",
      headers: { get: () => "text/plain" },
      text: async () => "plain text body",
    });
    const liveTrace = [];
    const runTool = makeToolRunner({ plan: [], liveTrace, dataset });
    await runTool("read_project_link", { url: "https://example.com/readme.txt" });
    expect(liveTrace[0].label).toBe('read_project_link("https://example.com/readme.txt")');
  });
});

describe("toolRunner: analyze_attachment (plain client-side fetch, image or plain-text only)", () => {
  const dataset = { areas: [], products: [], projects: [], archivedProjects: [], tasks: [], archivedTasks: [], stakeholders: [], notes: [] };

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it("base64-encodes a real image so the adapters can hand it to the model directly", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true, status: 200, statusText: "OK",
      headers: { get: () => "image/png" },
      arrayBuffer: async () => new Uint8Array([65, 66, 67]).buffer,
    });
    const runTool = makeToolRunner({ plan: [], dataset });
    const result = await runTool("analyze_attachment", { file_url: "https://x/chart.png", focus: "Q3" });
    expect(result).toEqual({ file_url: "https://x/chart.png", focus: "Q3", is_image: true, media_type: "image/png", image_base64: "QUJD" });
  });

  it("reads a plain-text attachment's real content directly", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true, status: 200, statusText: "OK",
      headers: { get: () => "text/plain; charset=utf-8" },
      text: async () => "Real file contents.",
    });
    const runTool = makeToolRunner({ plan: [], dataset });
    const result = await runTool("analyze_attachment", { file_url: "https://x/notes.txt" });
    expect(result.extracted_text).toBe("Real file contents.");
  });

  it("returns an honest error for a file type with no client-side parser (e.g. a Word doc), instead of guessing", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true, status: 200, statusText: "OK",
      headers: { get: () => "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
    });
    const runTool = makeToolRunner({ plan: [], dataset });
    const result = await runTool("analyze_attachment", { file_url: "https://x/doc.docx" });
    expect(result.error).toMatch(/document parser/);
  });

  it("extracts real text from a PDF attachment via pdf.js", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true, status: 200, statusText: "OK",
      headers: { get: () => "application/pdf" },
      arrayBuffer: async () => new ArrayBuffer(4),
    });
    extractPdfText.mockResolvedValueOnce({ text: "Real PDF text.", pageCount: 2, truncated: false });
    const runTool = makeToolRunner({ plan: [], dataset });
    const result = await runTool("analyze_attachment", { file_url: "https://x/doc.pdf" });
    expect(result.extracted_text).toBe("Real PDF text.");
    expect(result.page_count).toBe(2);
  });

  it("returns an honest error when PDF parsing itself fails, instead of guessing", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true, status: 200, statusText: "OK",
      headers: { get: () => "application/pdf" },
      arrayBuffer: async () => new ArrayBuffer(4),
    });
    extractPdfText.mockRejectedValueOnce(new Error("corrupt PDF"));
    const runTool = makeToolRunner({ plan: [], dataset });
    const result = await runTool("analyze_attachment", { file_url: "https://x/doc.pdf" });
    expect(result.error).toMatch(/corrupt PDF/);
  });

  it("never leaks the raw base64 blob into the UI-facing liveTrace entry", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true, status: 200, statusText: "OK",
      headers: { get: () => "image/jpeg" },
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    });
    const liveTrace = [];
    const runTool = makeToolRunner({ plan: [], liveTrace, dataset });
    await runTool("analyze_attachment", { file_url: "https://x/photo.jpg" });
    expect(liveTrace[0].detail.image_base64).toBeUndefined();
    expect(liveTrace[0].detail.is_image).toBe(true);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

// Minimal in-memory localStorage shim — Vitest's "node" environment has no
// browser storage globals, and localDb.js talks to localStorage directly.
function makeLocalStorage() {
  let store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => (store = new Map()),
  };
}
globalThis.localStorage = makeLocalStorage();

const { executeAction, executeActionSequence, DESTRUCTIVE_ACTIONS } = await import("./chatActions.js");
const { localDb } = await import("./localDb.js");
const { writeKey, removeKey } = await import("./deviceStorage.js");
const { VAULT_CONNECTION_KEY } = await import("./vaultConnection.js");

beforeEach(() => {
  globalThis.localStorage.clear();
  // localDb caches collections in-module-scope memory too, not just
  // localStorage — clearing storage alone leaves stale cached arrays behind
  // between tests, since it's the same module instance across the whole
  // file. Re-importing isn't practical here, so drain each collection via
  // its own API instead.
  return Promise.all(
    Object.values(localDb).map(async (col) => {
      const items = await col.list();
      await Promise.all(items.map((i) => col.delete?.(i.id) ?? col.update(i.id, { deleted_at: new Date().toISOString() })));
    })
  );
});

describe("chatActions: single actions write to localDb", () => {
  it("CREATE_AREA creates a real area record", async () => {
    const result = await executeAction("CREATE_AREA", { title: "Work", description: "" });
    expect(result.toolResult.area.title).toBe("Work");
    const areas = await localDb.areas.list();
    expect(areas).toHaveLength(1);
    expect(areas[0].title).toBe("Work");
  });

  it("CREATE_TASK then UPDATE_TASK_STATUS actually changes status", async () => {
    const { toolResult } = await executeAction("CREATE_TASK", { project_id: "p1", description: "Do the thing" });
    const taskId = toolResult.task.id;
    await executeAction("UPDATE_TASK_STATUS", { task_id: taskId, status: "IN_PROGRESS" });
    const task = await localDb.tasks.get(taskId);
    expect(task.status).toBe("IN_PROGRESS");
  });
});

describe("chatActions: cascades match the UI's own mutation hooks", () => {
  it("DELETE_AREA soft-deletes the area, its products, projects, and tasks", async () => {
    const { toolResult: { area } } = await executeAction("CREATE_AREA", { title: "Area", description: "" });
    const { toolResult: { product } } = await executeAction("CREATE_PRODUCT", { parent_area_id: area.id, title: "Product" });
    const { toolResult: { project } } = await executeAction("CREATE_PROJECT", { parent_area_id: area.id, parent_product_id: product.id, title: "Project" });
    const { toolResult: { task } } = await executeAction("CREATE_TASK", { project_id: project.id, description: "Task" });

    await executeAction("DELETE_AREA", { area_id: area.id });

    expect((await localDb.areas.get(area.id)).deleted_at).toBeTruthy();
    expect((await localDb.products.get(product.id)).deleted_at).toBeTruthy();
    expect((await localDb.projects.get(project.id)).deleted_at).toBeTruthy();
    expect((await localDb.tasks.get(task.id)).deleted_at).toBeTruthy();
  });
});

describe("chatActions: multi-step plans with temp_id placeholders", () => {
  it("resolves $temp_id references from earlier steps in the same plan", async () => {
    const steps = await executeActionSequence([
      { action: "CREATE_AREA", args: { title: "Platform", description: "" }, temp_id: "area1" },
      { action: "CREATE_PRODUCT", args: { parent_area_id: "$area1", title: "Core" }, temp_id: "product1" },
      { action: "CREATE_PROJECT", args: { parent_area_id: "$area1", parent_product_id: "$product1", title: "Launch" } },
    ]);

    expect(steps).toHaveLength(3);
    const area = steps[0].toolResult.area;
    const product = steps[1].toolResult.product;
    const project = steps[2].toolResult.project;
    expect(product.parent_area_id).toBe(area.id);
    expect(project.parent_area_id).toBe(area.id);
    expect(project.parent_product_id).toBe(product.id);
  });

  it("BULK_CREATE creates multiple records of the same type", async () => {
    const { toolResult: { area } } = await executeAction("CREATE_AREA", { title: "Area", description: "" });
    const { toolResult: { project } } = await executeAction("CREATE_PROJECT", { parent_area_id: area.id, title: "Project" });

    const result = await executeAction("BULK_CREATE", {
      entity_type: "task",
      items: [
        { project_id: project.id, description: "Task 1" },
        { project_id: project.id, description: "Task 2" },
      ],
    });

    expect(result.toolResult.count).toBe(2);
    const tasks = await localDb.tasks.filter({ project_id: project.id });
    expect(tasks).toHaveLength(2);
  });
});

describe("chatActions: destructive-action classification", () => {
  it("flags deletes and bulk operations as destructive", () => {
    expect(DESTRUCTIVE_ACTIONS.has("DELETE_PROJECT")).toBe(true);
    expect(DESTRUCTIVE_ACTIONS.has("BULK_DELETE")).toBe(true);
    expect(DESTRUCTIVE_ACTIONS.has("ARCHIVE_DONE_TASKS")).toBe(true);
  });

  it("does not flag ordinary creates/updates as destructive", () => {
    expect(DESTRUCTIVE_ACTIONS.has("CREATE_TASK")).toBe(false);
    expect(DESTRUCTIVE_ACTIONS.has("UPDATE_PROJECT")).toBe(false);
    expect(DESTRUCTIVE_ACTIONS.has("ARCHIVE_PROJECT")).toBe(false);
  });

  it("does not flag WRITE_VAULT_NOTE as destructive — git provides its own undo", () => {
    expect(DESTRUCTIVE_ACTIONS.has("WRITE_VAULT_NOTE")).toBe(false);
  });
});

describe("chatActions: WRITE_VAULT_NOTE", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  it("throws without ever calling fetch when no vault is connected", async () => {
    await expect(executeAction("WRITE_VAULT_NOTE", { path: "Daily/2026-07-22.md", content: "x" })).rejects.toThrow(/no external vault connected/i);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("writes to the connected repo using the stored token", async () => {
    await writeKey(VAULT_CONNECTION_KEY, { owner: "me", repo: "vault", branch: "main", token: "t" });
    globalThis.fetch
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ content: { sha: "abc" }, commit: { html_url: "https://github.com/me/vault/commit/abc" } }) });

    const { toolResult } = await executeAction("WRITE_VAULT_NOTE", { path: "Daily/2026-07-22.md", content: "# Today\nDid stuff." });

    expect(toolResult.vaultNote.path).toBe("Daily/2026-07-22.md");
    expect(toolResult.vaultNote.commitUrl).toBe("https://github.com/me/vault/commit/abc");
    await removeKey(VAULT_CONNECTION_KEY);
  });
});

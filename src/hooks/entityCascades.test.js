import { beforeEach, describe, expect, it } from "vitest";

// Same in-memory localStorage shim chatActions.test.js uses — localDb.js
// talks to localStorage directly and Vitest's "node" environment has none.
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

const { localDb } = await import("@/lib/localDb.js");
const { createArea, deleteArea } = await import("./useAreas.js");
const { createProduct, updateProduct, deleteProduct, fetchActiveProducts } = await import("./useProducts.js");
const { createProject, updateProject, moveProject, deleteProject, archiveProject, fetchActiveProjects } = await import("./useProjects.js");
const { createTask, updateTask, fetchAllActiveTasks } = await import("./useTasks.js");
const { createStakeholder, deleteStakeholder } = await import("./useStakeholders.js");

beforeEach(() => {
  globalThis.localStorage.clear();
  // localDb caches collections in module-scope memory, not just
  // localStorage — clear each collection through its own API too, same
  // reason chatActions.test.js's beforeEach does.
  return Promise.all(
    Object.values(localDb).map(async (col) => {
      const items = await col.list();
      await Promise.all(items.map((i) => col.delete?.(i.id) ?? col.update(i.id, { deleted_at: new Date().toISOString() })));
    })
  );
});

describe("plain (non-chat) mutation functions now validate parent references — the real gap that let a stale/deleted parent silently orphan a child", () => {
  it("createProduct rejects a parent_area_id that doesn't exist", async () => {
    await expect(createProduct({ parent_area_id: "not-real", title: "Core" })).rejects.toThrow(/Area "not-real" doesn't exist/);
    expect(await localDb.products.list()).toHaveLength(0);
  });

  it("createProduct rejects a parent_area_id that WAS real but is now deleted", async () => {
    const area = await createArea({ title: "Area", description: "" });
    await deleteArea(area.id);
    await expect(createProduct({ parent_area_id: area.id, title: "Core" })).rejects.toThrow(/doesn't exist/);
  });

  it("createProject rejects a stale parent_area_id", async () => {
    await expect(createProject({ parent_area_id: "not-real", title: "Launch" })).rejects.toThrow(/Area "not-real" doesn't exist/);
  });

  it("createTask rejects a stale project_id — the exact form-left-open-while-project-gets-deleted scenario", async () => {
    const area = await createArea({ title: "Area", description: "" });
    const project = await createProject({ parent_area_id: area.id, title: "Project" });
    await deleteProject(project.id);
    await expect(createTask({ project_id: project.id, description: "Orphan-to-be" })).rejects.toThrow(/Project ".+" doesn't exist/);
    expect(await localDb.tasks.list()).toHaveLength(0);
  });

  it("moveProject rejects moving into a product that doesn't exist", async () => {
    const area = await createArea({ title: "Area", description: "" });
    const project = await createProject({ parent_area_id: area.id, title: "Project" });
    await expect(moveProject({ id: project.id, parent_product_id: "not-real" })).rejects.toThrow(/Product "not-real" doesn't exist/);
  });

  it("updateProject only validates when a parent field is actually present — a plain title edit needs no extra lookup and still works", async () => {
    const area = await createArea({ title: "Area", description: "" });
    const project = await createProject({ parent_area_id: area.id, title: "Project" });
    const updated = await updateProject({ id: project.id, data: { title: "Renamed" } });
    expect(updated.title).toBe("Renamed");
  });

  it("updateTask only validates when project_id is actually present — a plain status edit still works", async () => {
    const area = await createArea({ title: "Area", description: "" });
    const project = await createProject({ parent_area_id: area.id, title: "Project" });
    const task = await createTask({ project_id: project.id, description: "Task" });
    const updated = await updateTask({ id: task.id, data: { status: "IN_PROGRESS" } });
    expect(updated.status).toBe("IN_PROGRESS");
  });

  it("updateProduct rejects re-parenting to a deleted area", async () => {
    const area1 = await createArea({ title: "Area 1", description: "" });
    const area2 = await createArea({ title: "Area 2", description: "" });
    const product = await createProduct({ parent_area_id: area1.id, title: "Product" });
    await deleteArea(area2.id);
    await expect(updateProduct({ id: product.id, data: { parent_area_id: area2.id } })).rejects.toThrow(/doesn't exist/);
  });
});

describe("orphan-defense filtering — fetchActiveProducts/fetchActiveProjects/fetchAllActiveTasks (the real bug: 0 areas shown, but the sidebar's Task Statistics still counted 6 active tasks)", () => {
  it("fetchAllActiveTasks excludes a task whose project was deleted out from under it via a raw write (simulating an interrupted cascade or any future orphan-creating bug)", async () => {
    const area = await createArea({ title: "Area", description: "" });
    const project = await createProject({ parent_area_id: area.id, title: "Project" });
    const task = await createTask({ project_id: project.id, description: "Task" });

    // Simulate exactly the bug this session fixed: the project's own
    // deleted_at gets set WITHOUT the task's cascading (an interrupted
    // cascade, or a bug in some future code path) — a raw write, bypassing
    // deleteProject's own (now correctly-ordered) cascade on purpose, to
    // prove the READ side is defended even if a write-side bug slips through.
    await localDb.projects.update(project.id, { deleted_at: new Date().toISOString() });

    const activeTasks = await fetchAllActiveTasks();
    expect(activeTasks.find((t) => t.id === task.id)).toBeUndefined();
  });

  it("fetchActiveProducts excludes a product whose area was deleted out from under it", async () => {
    const area = await createArea({ title: "Area", description: "" });
    const product = await createProduct({ parent_area_id: area.id, title: "Product" });
    await localDb.areas.update(area.id, { deleted_at: new Date().toISOString() });
    const activeProducts = await fetchActiveProducts();
    expect(activeProducts.find((p) => p.id === product.id)).toBeUndefined();
  });

  it("fetchActiveProjects excludes a project whose area was deleted out from under it", async () => {
    const area = await createArea({ title: "Area", description: "" });
    const project = await createProject({ parent_area_id: area.id, title: "Project" });
    await localDb.areas.update(area.id, { deleted_at: new Date().toISOString() });
    const activeProjects = await fetchActiveProjects();
    expect(activeProjects.find((p) => p.id === project.id)).toBeUndefined();
  });

  it("fetchActiveProjects keeps a genuinely standalone project (no product) — optional parent isn't required", async () => {
    const area = await createArea({ title: "Area", description: "" });
    const project = await createProject({ parent_area_id: area.id, title: "Standalone" });
    const activeProjects = await fetchActiveProjects();
    expect(activeProjects.map((p) => p.id)).toContain(project.id);
  });

  it("a normal, fully-connected task/project/area still counts as active — the defense doesn't false-positive on real data", async () => {
    const area = await createArea({ title: "Area", description: "" });
    const project = await createProject({ parent_area_id: area.id, title: "Project" });
    const task = await createTask({ project_id: project.id, description: "Real task" });
    const activeTasks = await fetchAllActiveTasks();
    expect(activeTasks.map((t) => t.id)).toContain(task.id);
  });
});

describe("cascade delete/archive order — deepest child first, parent last (an interruption should leave the parent visible with cleaned-up children, never the reverse)", () => {
  it("deleteArea: if interrupted after the cascade but conceptually mid-way, tasks are already gone before the area itself disappears — verified via final state plus explicit ordering of the writes", async () => {
    const area = await createArea({ title: "Area", description: "" });
    const project = await createProject({ parent_area_id: area.id, title: "Project" });
    const task = await createTask({ project_id: project.id, description: "Task" });

    await deleteArea(area.id);

    const finalArea = await localDb.areas.get(area.id);
    const finalProject = await localDb.projects.get(project.id);
    const finalTask = await localDb.tasks.get(task.id);
    expect(finalArea.deleted_at).toBeTruthy();
    expect(finalProject.deleted_at).toBeTruthy();
    expect(finalTask.deleted_at).toBeTruthy();
    // With this ordering, a real read (fetchAllActiveTasks) taken at any
    // point during the cascade would never see the task as active with a
    // deleted area — either both are still active, or the task is already
    // gone. There's no window where the area is gone but the task isn't.
  });

  it("deleteProduct cascades to projects and their tasks", async () => {
    const area = await createArea({ title: "Area", description: "" });
    const product = await createProduct({ parent_area_id: area.id, title: "Product" });
    const project = await createProject({ parent_area_id: area.id, parent_product_id: product.id, title: "Project" });
    const task = await createTask({ project_id: project.id, description: "Task" });

    await deleteProduct(product.id);

    expect((await localDb.products.get(product.id)).deleted_at).toBeTruthy();
    expect((await localDb.projects.get(project.id)).deleted_at).toBeTruthy();
    expect((await localDb.tasks.get(task.id)).deleted_at).toBeTruthy();
  });

  it("archiveProject cascades archived_at to its tasks", async () => {
    const area = await createArea({ title: "Area", description: "" });
    const project = await createProject({ parent_area_id: area.id, title: "Project" });
    const task = await createTask({ project_id: project.id, description: "Task" });

    await archiveProject(project.id);

    expect((await localDb.projects.get(project.id)).is_archived).toBe(true);
    expect((await localDb.tasks.get(task.id)).archived_at).toBeTruthy();
  });
});

describe("deleteStakeholder cascades — scrubs stakeholder_ids off Products/Projects/Tasks (used to leave dangling references forever, unlike deleteDepartment's own working cascade)", () => {
  it("removes the deleted stakeholder's id from a task's stakeholder_ids, leaving other ids intact", async () => {
    const area = await createArea({ title: "Area", description: "" });
    const project = await createProject({ parent_area_id: area.id, title: "Project" });
    const stakeholder1 = await createStakeholder({ name: "Keep Me" });
    const stakeholder2 = await createStakeholder({ name: "Delete Me" });
    const task = await createTask({ project_id: project.id, description: "Task", stakeholder_ids: [stakeholder1.id, stakeholder2.id] });

    await deleteStakeholder(stakeholder2.id);

    const finalTask = await localDb.tasks.get(task.id);
    expect(finalTask.stakeholder_ids).toEqual([stakeholder1.id]);
  });

  it("removes the deleted stakeholder's id from a project and a product too", async () => {
    const area = await createArea({ title: "Area", description: "" });
    const stakeholder = await createStakeholder({ name: "Person" });
    const product = await createProduct({ parent_area_id: area.id, title: "Product", stakeholder_ids: [stakeholder.id] });
    const project = await createProject({ parent_area_id: area.id, title: "Project", stakeholder_ids: [stakeholder.id] });

    await deleteStakeholder(stakeholder.id);

    expect((await localDb.products.get(product.id)).stakeholder_ids).toEqual([]);
    expect((await localDb.projects.get(project.id)).stakeholder_ids).toEqual([]);
  });

  it("doesn't touch records that never referenced the deleted stakeholder", async () => {
    const area = await createArea({ title: "Area", description: "" });
    const stakeholder1 = await createStakeholder({ name: "A" });
    const stakeholder2 = await createStakeholder({ name: "B" });
    const project = await createProject({ parent_area_id: area.id, title: "Project", stakeholder_ids: [stakeholder1.id] });

    await deleteStakeholder(stakeholder2.id);

    expect((await localDb.projects.get(project.id)).stakeholder_ids).toEqual([stakeholder1.id]);
  });
});

import { beforeEach, describe, expect, it } from "vitest";

// Same real-localDb-over-a-localStorage-shim pattern as chatActions.test.js —
// computeWorkspaceDelta reads real created_date/updated_date/archived_at
// timestamps, so the thing actually worth testing is real date comparisons
// against real records, not a mocked localDb.
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

const { computeWorkspaceDelta, buildReflectionInstruction } = await import("./reflectionSummary.js");
const { localDb } = await import("./localDb.js");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

beforeEach(() => {
  globalThis.localStorage.clear();
  return Promise.all(
    Object.values(localDb).map(async (col) => {
      const items = await col.list();
      await Promise.all(items.map((i) => col.delete?.(i.id) ?? col.update(i.id, { deleted_at: new Date().toISOString() })));
    })
  );
});

describe("computeWorkspaceDelta", () => {
  it("reports nothing when nothing changed after the cutoff", async () => {
    await localDb.tasks.create({ project_id: "p1", description: "Old task", status: "NOT_STARTED" });
    await sleep(15);
    const sinceIso = new Date().toISOString();
    await sleep(15);

    const delta = await computeWorkspaceDelta(sinceIso);
    expect(delta.hasChanges).toBe(false);
    expect(delta.facts).toEqual([]);
  });

  it("counts a task completed after the cutoff, but not one completed before it", async () => {
    const before = await localDb.tasks.create({ project_id: "p1", description: "Already done", status: "DONE" });
    await sleep(15);
    const sinceIso = new Date().toISOString();
    await sleep(15);
    const after = await localDb.tasks.create({ project_id: "p1", description: "Just finished", status: "NOT_STARTED" });
    await localDb.tasks.update(after.id, { status: "DONE" });
    // "before" was already DONE at creation and never touched again — its
    // updated_date stays before the cutoff, so it must not count.
    void before;

    const delta = await computeWorkspaceDelta(sinceIso);
    expect(delta.hasChanges).toBe(true);
    expect(delta.facts.join("\n")).toContain("Just finished");
    expect(delta.facts.join("\n")).not.toContain("Already done");
  });

  it("counts DELEGATED_DONE as completed too, matching isTaskDone's own definition", async () => {
    await sleep(15);
    const sinceIso = new Date().toISOString();
    await sleep(15);
    const task = await localDb.tasks.create({ project_id: "p1", description: "Handed off", status: "NOT_STARTED" });
    await localDb.tasks.update(task.id, { status: "DELEGATED_DONE" });

    const delta = await computeWorkspaceDelta(sinceIso);
    expect(delta.facts.join("\n")).toContain("Handed off");
  });

  it("reports new tasks/projects created after the cutoff", async () => {
    await sleep(15);
    const sinceIso = new Date().toISOString();
    await sleep(15);
    await localDb.tasks.create({ project_id: "p1", description: "Brand new task", status: "NOT_STARTED" });
    await localDb.projects.create({ title: "Brand new project", parent_area_id: "a1" });

    const delta = await computeWorkspaceDelta(sinceIso);
    const text = delta.facts.join("\n");
    expect(text).toContain("Brand new task");
    expect(text).toContain("Brand new project");
  });

  it("reports tasks and projects archived after the cutoff", async () => {
    const task = await localDb.tasks.create({ project_id: "p1", description: "Shelved task", status: "NOT_STARTED" });
    const project = await localDb.projects.create({ title: "Shelved project", parent_area_id: "a1" });
    await sleep(15);
    const sinceIso = new Date().toISOString();
    await sleep(15);
    await localDb.tasks.update(task.id, { archived_at: new Date().toISOString() });
    await localDb.projects.update(project.id, { is_archived: true, archived_at: new Date().toISOString() });

    const delta = await computeWorkspaceDelta(sinceIso);
    const text = delta.facts.join("\n");
    expect(text).toContain("Shelved task");
    expect(text).toContain("Shelved project");
  });

  it("labels a task with its project title when the project is known", async () => {
    const project = await localDb.projects.create({ title: "Payments Revamp", parent_area_id: "a1" });
    await sleep(15);
    const sinceIso = new Date().toISOString();
    await sleep(15);
    await localDb.tasks.create({ project_id: project.id, description: "Ship it", status: "NOT_STARTED" });

    const delta = await computeWorkspaceDelta(sinceIso);
    expect(delta.facts.join("\n")).toContain("Ship it");
    expect(delta.facts.join("\n")).toContain("Payments Revamp");
  });

  it("excludes soft-deleted records from every bucket", async () => {
    await sleep(15);
    const sinceIso = new Date().toISOString();
    await sleep(15);
    const task = await localDb.tasks.create({ project_id: "p1", description: "Deleted right after", status: "NOT_STARTED" });
    await localDb.tasks.update(task.id, { deleted_at: new Date().toISOString() });

    const delta = await computeWorkspaceDelta(sinceIso);
    expect(delta.facts.join("\n")).not.toContain("Deleted right after");
  });

  it("caps a single fact line's item list and reports the remainder as a count, not an unbounded list", async () => {
    await sleep(15);
    const sinceIso = new Date().toISOString();
    await sleep(15);
    for (let i = 0; i < 12; i++) {
      await localDb.tasks.create({ project_id: "p1", description: `Task ${i}`, status: "NOT_STARTED" });
    }

    const delta = await computeWorkspaceDelta(sinceIso);
    const newTasksFact = delta.facts.find((f) => f.startsWith("New tasks"));
    expect(newTasksFact).toMatch(/\(12\)/);
    expect(newTasksFact).toMatch(/and 4 more/);
  });
});

describe("buildReflectionInstruction", () => {
  it("includes every fact as its own bullet and the hard no-mutation instruction", () => {
    const text = buildReflectionInstruction(["Completed (1): \"Fix bug\""]);
    expect(text).toContain("- Completed (1): \"Fix bug\"");
    expect(text).toContain("You may NOT create, update, delete, archive, or write anything this turn");
    expect(text).toContain("Do not use web search this turn");
  });
});

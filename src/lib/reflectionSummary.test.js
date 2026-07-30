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
const { SELF_NOTE_TARGET_MAX_CHARS } = await import("./githubApi.js");

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
  it("includes every fact as its own bullet and the hard no-mutation instruction, with no vault guidance when not connected", () => {
    const text = buildReflectionInstruction(["Completed (1): \"Fix bug\""]);
    expect(text).toContain("- Completed (1): \"Fix bug\"");
    expect(text).toContain("you may NOT create, update, delete, archive, or write anything this turn");
    expect(text).toContain("Do not use web search this turn");
    expect(text).not.toContain("Vaea Self.md");
  });

  it("names both auto-executing vault paths, and restates that anything else still needs confirmation, when connected", () => {
    const text = buildReflectionInstruction(["Completed (1): \"Fix bug\""], { vaultConnected: true });
    const today = new Date().toISOString().slice(0, 10);
    expect(text).toContain('"Vaea Self.md"');
    expect(text).toContain(`"Daily/${today}.md"`);
    expect(text).toContain("no confirmation needed");
    expect(text).toContain("Any other vault path still needs the user's confirmation");
    expect(text).toContain("never a read on the user");
  });

  it("says nothing about pruning when the self-note is small or absent", () => {
    const text = buildReflectionInstruction(["fact"], { vaultConnected: true, selfNoteLength: 100 });
    expect(text).not.toContain("consolidate");
  });

  it("tells the model to consolidate rather than keep appending once the self-note is nearing the size target", () => {
    const text = buildReflectionInstruction(["fact"], {
      vaultConnected: true,
      selfNoteLength: Math.ceil(SELF_NOTE_TARGET_MAX_CHARS * 0.75),
    });
    expect(text).toContain("Your Notes section is already getting long");
    expect(text).toContain("consolidate rather than append");
  });

  it("names the Identity/Notes section split and tells the model to carry Identity forward unchanged", () => {
    const text = buildReflectionInstruction(["fact"], { vaultConnected: true });
    expect(text).toContain('"## Identity"');
    expect(text).toContain('"## Notes"');
    expect(text).toContain("never yours to edit");
    expect(text).toContain("carry that section forward EXACTLY as shown above");
  });

  it("includes vault-tidy guidance only when includeVaultTidy is true", () => {
    const withTidy = buildReflectionInstruction(["fact"], { vaultConnected: true, includeVaultTidy: true });
    const withoutTidy = buildReflectionInstruction(["fact"], { vaultConnected: true, includeVaultTidy: false });
    expect(withTidy).toContain("audit_vault");
    expect(withTidy).toContain("still needs the user's confirmation");
    expect(withoutTidy).not.toContain("audit_vault");
  });

  it("never mentions vault-tidy when vault isn't connected, even if includeVaultTidy is true", () => {
    const text = buildReflectionInstruction(["fact"], { vaultConnected: false, includeVaultTidy: true });
    expect(text).not.toContain("audit_vault");
  });

  it("never mentions pruning when vault isn't connected, regardless of selfNoteLength", () => {
    const text = buildReflectionInstruction(["fact"], { vaultConnected: false, selfNoteLength: 999999 });
    expect(text).not.toContain("consolidate");
  });

  it("defaults to not-connected wording when the second argument is omitted entirely", () => {
    expect(buildReflectionInstruction(["x"])).toBe(buildReflectionInstruction(["x"], { vaultConnected: false }));
  });

  it("includes dream guidance only when includeDream is true and vault is connected", () => {
    const withDream = buildReflectionInstruction(["fact"], { vaultConnected: true, includeDream: true, dreamTranscript: "USER: hi" });
    const withoutDream = buildReflectionInstruction(["fact"], { vaultConnected: true, includeDream: false });
    const dreamNotConnected = buildReflectionInstruction(["fact"], { vaultConnected: false, includeDream: true, dreamTranscript: "USER: hi" });
    expect(withDream).toContain("[DAILY REVIEW");
    expect(withDream).toContain("USER: hi");
    expect(withoutDream).not.toContain("[DAILY REVIEW");
    expect(dreamNotConnected).not.toContain("[DAILY REVIEW");
  });

  it("degrades gracefully when facts is empty but a dream cycle is due", () => {
    const text = buildReflectionInstruction([], { vaultConnected: true, includeDream: true, dreamTranscript: "USER: hi" });
    expect(text).toContain("periodic self-review");
    expect(text).not.toContain("Here is what actually changed");
    expect(text).toContain("[DAILY REVIEW");
  });

  it("passes userAnalysisConsent through to the dream instruction", () => {
    const consented = buildReflectionInstruction(["fact"], {
      vaultConnected: true,
      includeDream: true,
      dreamTranscript: "t",
      userAnalysisConsent: true,
    });
    const notConsented = buildReflectionInstruction(["fact"], {
      vaultConnected: true,
      includeDream: true,
      dreamTranscript: "t",
      userAnalysisConsent: false,
    });
    expect(consented).toContain('"## User Notes"');
    expect(notConsented).not.toContain('"## User Notes"');
  });
});

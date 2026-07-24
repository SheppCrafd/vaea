import { beforeEach, describe, expect, it } from "vitest";

const { createSnapshot, listSnapshots, restoreSnapshot } = await import("./backupSnapshots.js");
const { executeAction, executeActionSequence } = await import("./chatActions.js");
const { localDb } = await import("./localDb.js");
const { __resetManualStoreForTests } = await import("./deviceStorage.js");

beforeEach(() => {
  // deviceStorage's manual-mode store (what localDb.js and backupSnapshots.js
  // both read/write in this "node" test environment, which has no File
  // System Access API) is module-scope state — reset it directly, since
  // vitest imports the module once per file and a later test would
  // otherwise see a prior test's snapshots/collections.
  __resetManualStoreForTests();
  // localDb also caches collections in its own module-scope memory —
  // clear that too. replaceAll(name, []) rather than deleting item-by-item:
  // concurrent per-item deletes on the same collection race (each does its
  // own read-modify-write off the same stale array, so the last write
  // clobbers the rest) whenever a test leaves more than one item behind.
  return Promise.all(Object.values(localDb).map((col) => col.replaceAll([])));
});

describe("backupSnapshots: create/list/restore round-trip", () => {
  it("captures every collection and lists it back with counts", async () => {
    await executeAction("CREATE_AREA", { title: "Area A", description: "" });
    await executeAction("CREATE_AREA", { title: "Area B", description: "" });

    const id = await createSnapshot("manual test snapshot");
    expect(id).toBeTruthy();

    const snapshots = await listSnapshots();
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].label).toBe("manual test snapshot");
    expect(snapshots[0].counts.areas).toBe(2);
  });

  it("restores collections to exactly the snapshot's state, undoing changes made after it", async () => {
    const { toolResult: { area } } = await executeAction("CREATE_AREA", { title: "Original", description: "" });
    const id = await createSnapshot("before the mistake");

    // Simulate a bad bulk change after the snapshot: delete the area, add junk.
    await executeAction("DELETE_AREA", { area_id: area.id });
    await executeAction("CREATE_AREA", { title: "Accidental", description: "" });

    await restoreSnapshot(id);

    const areas = await localDb.areas.list();
    expect(areas).toHaveLength(1);
    expect(areas[0].title).toBe("Original");
    expect(areas[0].id).toBe(area.id);
  });

  it("restoring itself is undoable via the auto 'before restore' snapshot", async () => {
    await executeAction("CREATE_AREA", { title: "Keep me", description: "" });
    const goodId = await createSnapshot("good state");
    await executeAction("CREATE_AREA", { title: "Extra", description: "" });

    await restoreSnapshot(goodId);
    expect(await localDb.areas.list()).toHaveLength(1);

    const snapshots = await listSnapshots();
    const autoSnapshot = snapshots.find((s) => s.label === "Before restore (auto)");
    expect(autoSnapshot).toBeTruthy();

    // The auto-snapshot captured the 2-area state right before the restore —
    // restoring it should bring "Extra" back.
    await restoreSnapshot(autoSnapshot.id);
    const restored = (await localDb.areas.list()).map((a) => a.title).sort();
    expect(restored).toEqual(["Extra", "Keep me"]);
  });

  it("prunes to the 8 most recent snapshots", async () => {
    for (let i = 0; i < 10; i++) await createSnapshot(`snapshot ${i}`);
    const snapshots = await listSnapshots();
    expect(snapshots).toHaveLength(8);
    // Newest first, and the two oldest (0 and 1) were pruned.
    expect(snapshots[0].label).toBe("snapshot 9");
    expect(snapshots.map((s) => s.label)).not.toContain("snapshot 0");
    expect(snapshots.map((s) => s.label)).not.toContain("snapshot 1");
  });
});

describe("backupSnapshots: wired into chatActions' executeActionSequence", () => {
  it("auto-snapshots before a multi-step plan", async () => {
    await executeActionSequence([
      { action: "CREATE_AREA", args: { title: "Platform", description: "" }, temp_id: "area1" },
      { action: "CREATE_PRODUCT", args: { parent_area_id: "$area1", title: "Core" } },
    ]);
    const snapshots = await listSnapshots();
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].label).toContain("2-step plan");
  });

  it("auto-snapshots before a BULK_CREATE even as a single-step plan", async () => {
    const { toolResult: { area } } = await executeAction("CREATE_AREA", { title: "Area", description: "" });
    const { toolResult: { project } } = await executeAction("CREATE_PROJECT", { parent_area_id: area.id, title: "Project" });
    // The two setup actions above are single-step plans (via executeAction
    // directly, not executeActionSequence) and shouldn't have snapshotted.
    expect(await listSnapshots()).toHaveLength(0);

    await executeActionSequence([
      { action: "BULK_CREATE", args: { entity_type: "task", items: [{ project_id: project.id, description: "T1" }] } },
    ]);
    const snapshots = await listSnapshots();
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].label).toBe("Before BULK_CREATE");
  });

  it("does not snapshot a single ordinary action", async () => {
    await executeActionSequence([{ action: "CREATE_AREA", args: { title: "Solo", description: "" } }]);
    expect(await listSnapshots()).toHaveLength(0);
  });
});

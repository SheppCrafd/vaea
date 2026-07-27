import { beforeEach, describe, expect, it } from "vitest";

// Same in-memory localStorage shim as chatActions.test.js — this test
// environment has no browser storage globals, and deviceStorage.js's
// getStorageMode()/hasStorageModeBeenChosen() call it directly (readKey/
// writeKey themselves route to the in-memory manual store here, since
// supportsFileSystemAccess is false with no `window`).
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

const { localDb } = await import("./localDb.js");

beforeEach(() => {
  globalThis.localStorage.clear();
  return Promise.all(
    Object.values(localDb).map(async (col) => {
      const items = await col.list();
      await Promise.all(items.map((i) => col.delete(i.id)));
    })
  );
});

describe("localDb: concurrent writes to the same collection don't race", () => {
  it("two create() calls fired without awaiting between them both survive", async () => {
    // Mirrors a real observed failure: a chat plan's own multi-step
    // execution and an ordinary UI mutation (this app keeps Dashboard/Chat/
    // Settings mounted as persistent tabs, not separate page loads, so both
    // really can fire around the same moment) both read the collection
    // before either had written back, then each wrote its own copy —
    // whichever writeCollection resolved last silently discarded the
    // other's record. In File System Access mode this surfaces as a real
    // browser error: "An operation that depends on state cached in an
    // interface object was made but the state had changed since it was
    // read from disk." Fired without awaiting between them (not
    // sequentially) so they actually interleave at the same await points a
    // real race would hit.
    const pA = localDb.areas.create({ title: "Area A" });
    const pB = localDb.areas.create({ title: "Area B" });
    await Promise.all([pA, pB]);

    const areas = await localDb.areas.list();
    expect(areas.map((a) => a.title).sort()).toEqual(["Area A", "Area B"]);
  });

  it("a create() and an update() racing on the same collection both apply", async () => {
    const existing = await localDb.areas.create({ title: "Existing" });

    const pCreate = localDb.areas.create({ title: "New Area" });
    const pUpdate = localDb.areas.update(existing.id, { description: "Updated" });
    await Promise.all([pCreate, pUpdate]);

    const areas = await localDb.areas.list();
    expect(areas).toHaveLength(2);
    expect(areas.find((a) => a.id === existing.id).description).toBe("Updated");
    expect(areas.some((a) => a.title === "New Area")).toBe(true);
  });

  it("a failed op doesn't wedge the queue for whoever's waiting behind it", async () => {
    const pBadUpdate = localDb.areas.update("does-not-exist", { title: "x" }).catch(() => "failed");
    const pCreate = localDb.areas.create({ title: "Still Works" });

    const [updateResult] = await Promise.all([pBadUpdate, pCreate]);
    expect(updateResult).toBe("failed");
    const areas = await localDb.areas.list();
    expect(areas.some((a) => a.title === "Still Works")).toBe(true);
  });
});

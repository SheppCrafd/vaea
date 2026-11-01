import { beforeEach, describe, expect, it, vi } from "vitest";

// A fake storage backend the test controls: `store` is what's "on disk",
// `failReads` makes the next reads throw (a corrupt file, a revoked folder,
// a network error in cloud mode).
const store = new Map();
let failReads = 0;
vi.mock("@/lib/deviceStorage", () => ({
  isFileBackedModeAvailable: async () => false,
  supportsFileSystemAccess: false,
  seedManual: () => {},
  readKey: async (key) => {
    if (failReads > 0) { failReads--; throw new Error("unreadable"); }
    return store.has(key) ? structuredClone(store.get(key)) : null;
  },
  writeKey: async (key, value) => { store.set(key, structuredClone(value)); },
}));

const { localDb, retryUnreadable, unreadableCollections, CollectionReadError } = await import("./localDb.js");

beforeEach(() => {
  store.clear();
  failReads = 0;
  retryUnreadable();
});

describe("localDb: data that can't be read is never overwritten", () => {
  it("a failed read is an error, not an empty list, and blocks writes until a retry", async () => {
    store.set("tasks", [{ id: "1", title: "One" }, { id: "2", title: "Two" }, { id: "3", title: "Three" }]);
    failReads = 1;
    await expect(localDb.tasks.list()).rejects.toBeInstanceOf(CollectionReadError);
    expect(unreadableCollections()).toContain("tasks");
    await expect(localDb.tasks.create({ title: "New" })).rejects.toBeInstanceOf(CollectionReadError);
    // The stored tasks are untouched.
    expect(store.get("tasks").map((t) => t.title)).toEqual(["One", "Two", "Three"]);
    retryUnreadable();
    await localDb.tasks.create({ title: "New" });
    expect(store.get("tasks").map((t) => t.title)).toEqual(["One", "Two", "Three", "New"]);
  });

  it("a collection that was never saved still reads as empty", async () => {
    expect(await localDb.areas.list()).toEqual([]);
    expect(unreadableCollections()).toEqual([]);
  });
});

describe("localDb: a write never erases another tab's or device's change", () => {
  it("re-reads the stored copy before writing instead of trusting this tab's cache", async () => {
    await localDb.tasks.create({ title: "From this tab" });
    await localDb.tasks.list(); // this tab's cache now holds one task
    // Another tab (or device) adds a task directly to storage.
    store.set("tasks", [...store.get("tasks"), { id: "other", title: "From another tab" }]);
    await localDb.tasks.create({ title: "Second from this tab" });
    expect(store.get("tasks").map((t) => t.title)).toEqual(["From this tab", "From another tab", "Second from this tab"]);
  });
});

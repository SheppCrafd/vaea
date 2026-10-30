import { describe, it, expect, vi } from "vitest";

// localDb.js talks to localStorage directly at import time — same shim
// pattern chatActions.test.js/entityCascades.test.js use.
globalThis.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

const { destinationHasData, copyAllKeys, replaceAllKeys, readBoardSnapshot } = await import("./storageMigration.js");

describe("destinationHasData — the guard behind Settings' cloud/device storage switch (real bug: switching used to unconditionally overwrite a destination that already had real data, no warning)", () => {
  it("returns false for a genuinely empty destination", async () => {
    const read = vi.fn(async () => []);
    expect(await destinationHasData({ read })).toBe(false);
  });

  it("returns false when a key is missing/null entirely", async () => {
    const read = vi.fn(async () => null);
    expect(await destinationHasData({ read })).toBe(false);
  });

  it("returns true when ANY checked collection (areas/products/projects/tasks) already has real records", async () => {
    const read = vi.fn(async (key) => (key === "tasks" ? [{ id: "t1" }] : []));
    expect(await destinationHasData({ read })).toBe(true);
  });

  it("returns true on the very first non-empty collection without needing to check the rest", async () => {
    const seen = [];
    const read = vi.fn(async (key) => {
      seen.push(key);
      return key === "areas" ? [{ id: "a1" }] : [];
    });
    expect(await destinationHasData({ read })).toBe(true);
    expect(seen).toEqual(["areas"]);
  });
});

describe("copyAllKeys — unchanged behavior, still unconditionally overwrites (the caller in StorageSection.jsx is what's now expected to check destinationHasData FIRST)", () => {
  it("writes every real (non-null) value read from the source", async () => {
    const store = {};
    const read = vi.fn(async (key) => (key === "areas" ? [{ id: "a1" }] : null));
    const write = vi.fn(async (key, value) => {
      store[key] = value;
    });
    await copyAllKeys({ read, write });
    expect(store.areas).toEqual([{ id: "a1" }]);
    // Every other key read as null was never written.
    expect(Object.keys(store)).toEqual(["areas"]);
  });
});

describe("replaceAllKeys — the Replace choice when both places already hold a board", () => {
  it("keeps the destination's settings when the source has none", async () => {
    const dest = { areas: [{ id: "old" }], vaea_ai_identity: { name: "Ada" }, vaea_external_vault: { repo: "me/notes" } };
    const read = vi.fn(async (key) => (key === "areas" ? [{ id: "a1" }] : null));
    const write = vi.fn(async (key, value) => { dest[key] = value; });
    const remove = vi.fn(async (key) => { delete dest[key]; });
    await replaceAllKeys({ read, write, remove });
    expect(dest).toEqual({ areas: [{ id: "a1" }], vaea_ai_identity: { name: "Ada" }, vaea_external_vault: { repo: "me/notes" } });
  });

  it("makes the destination's board an exact copy, removing collections the source doesn't have", async () => {
    const dest = { areas: [{ id: "old" }], stakeholders: [{ id: "cloud-only" }] };
    const read = vi.fn(async (key) => (key === "areas" ? [{ id: "a1" }] : null));
    const write = vi.fn(async (key, value) => { dest[key] = value; });
    const remove = vi.fn(async (key) => { delete dest[key]; });
    await replaceAllKeys({ read, write, remove });
    expect(dest).toEqual({ areas: [{ id: "a1" }] });
  });
});

describe("readBoardSnapshot — the copy downloaded before a board is replaced", () => {
  it("collects every stored key in the file format Vaea can open again", async () => {
    const read = vi.fn(async (key) => (key === "tasks" ? [{ id: "t1" }] : null));
    const snapshot = await readBoardSnapshot({ read });
    expect(snapshot.version).toBe(1);
    expect(snapshot.data).toEqual({ tasks: [{ id: "t1" }] });
    expect(typeof snapshot.exportedAt).toBe("string");
  });
});

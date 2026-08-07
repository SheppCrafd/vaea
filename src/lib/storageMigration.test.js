import { describe, it, expect, vi } from "vitest";

// localDb.js talks to localStorage directly at import time — same shim
// pattern chatActions.test.js/entityCascades.test.js use.
globalThis.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

const { destinationHasData, copyAllKeys } = await import("./storageMigration.js");

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

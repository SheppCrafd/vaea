import { describe, it, expect } from "vitest";
import { sortByPosition, reorderPositions, sanitizeReturnTo, requireLiveParent, allowOptionalLiveParent, assertLiveParent } from "./entityUtils.js";

describe("sortByPosition", () => {
  it("sorts ascending by position", () => {
    const items = [{ id: "a", position: 2 }, { id: "b", position: 0 }, { id: "c", position: 1 }];
    expect(sortByPosition(items).map((i) => i.id)).toEqual(["b", "c", "a"]);
  });

  it("keeps original relative order when nothing has a position yet", () => {
    const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(sortByPosition(items).map((i) => i.id)).toEqual(["a", "b", "c"]);
  });

  it("sorts positioned items first, unpositioned ones after in original order", () => {
    const items = [{ id: "a" }, { id: "b", position: 0 }, { id: "c" }];
    expect(sortByPosition(items).map((i) => i.id)).toEqual(["b", "a", "c"]);
  });
});

describe("reorderPositions", () => {
  it("moves the dragged id to sit right before the target, renumbering the rest", () => {
    const result = reorderPositions(["a", "b", "c", "d"], "d", "b");
    expect(result).toEqual({ a: 0, d: 1, b: 2, c: 3 });
  });

  it("dragging an item onto its own immediate successor is a no-op order-wise", () => {
    const result = reorderPositions(["a", "b", "c"], "a", "b");
    expect(result).toEqual({ a: 0, b: 1, c: 2 });
  });

  it("appends at the end when the target isn't in the list", () => {
    const result = reorderPositions(["a", "b"], "a", "missing");
    expect(result).toEqual({ b: 0, a: 1 });
  });
});

describe("sanitizeReturnTo", () => {
  it("allows a plain same-origin relative path", () => {
    expect(sanitizeReturnTo("/app/chat")).toBe("/app/chat");
  });

  it("allows a relative path with a query string", () => {
    expect(sanitizeReturnTo("/app/settings?tab=account")).toBe("/app/settings?tab=account");
  });

  it("falls back for a missing value", () => {
    expect(sanitizeReturnTo(null)).toBe("/app");
    expect(sanitizeReturnTo(undefined)).toBe("/app");
    expect(sanitizeReturnTo("")).toBe("/app");
  });

  it("falls back for a full external URL", () => {
    expect(sanitizeReturnTo("https://evil.com")).toBe("/app");
    expect(sanitizeReturnTo("http://evil.com/phish")).toBe("/app");
  });

  it("falls back for a protocol-relative URL", () => {
    expect(sanitizeReturnTo("//evil.com")).toBe("/app");
  });

  it("falls back for a backslash-prefixed path (browsers normalize \\ to // before parsing)", () => {
    expect(sanitizeReturnTo("/\\evil.com")).toBe("/app");
    expect(sanitizeReturnTo("\\\\evil.com")).toBe("/app");
  });

  it("falls back for a javascript: URI", () => {
    expect(sanitizeReturnTo("javascript:alert(1)")).toBe("/app");
  });

  it("falls back for a non-string value", () => {
    expect(sanitizeReturnTo(123)).toBe("/app");
    expect(sanitizeReturnTo({})).toBe("/app");
  });

  it("respects a custom fallback", () => {
    expect(sanitizeReturnTo("https://evil.com", "/safe")).toBe("/safe");
  });
});

// The orphan-defense helpers behind the real bug this session fixed: a
// dashboard showing "No areas found" while the sidebar's Task Statistics
// still counted active tasks whose whole parent chain had already
// disappeared — see useTasks.js's fetchAllActiveTasks, useProducts.js's
// fetchActiveProducts, useProjects.js's fetchActiveProjects.
describe("requireLiveParent", () => {
  it("keeps items whose parent id is in the live set", () => {
    const items = [{ id: "t1", project_id: "p1" }, { id: "t2", project_id: "p2" }];
    const live = new Set(["p1"]);
    expect(requireLiveParent(items, "project_id", live).map((i) => i.id)).toEqual(["t1"]);
  });

  it("drops an item whose parent id doesn't resolve at all", () => {
    const items = [{ id: "t1", project_id: "does-not-exist" }];
    expect(requireLiveParent(items, "project_id", new Set())).toEqual([]);
  });

  it("drops an item with no parent id set — a required parent can't be missing", () => {
    const items = [{ id: "t1" }];
    expect(requireLiveParent(items, "project_id", new Set(["p1"]))).toEqual([]);
  });
});

describe("allowOptionalLiveParent", () => {
  it("keeps an item with no value set at all (a standalone project has no product)", () => {
    const items = [{ id: "proj1", parent_product_id: null }, { id: "proj2" }];
    expect(allowOptionalLiveParent(items, "parent_product_id", new Set()).map((i) => i.id)).toEqual(["proj1", "proj2"]);
  });

  it("keeps an item whose SET value resolves", () => {
    const items = [{ id: "proj1", parent_product_id: "prod1" }];
    expect(allowOptionalLiveParent(items, "parent_product_id", new Set(["prod1"])).map((i) => i.id)).toEqual(["proj1"]);
  });

  it("drops an item whose SET value doesn't resolve", () => {
    const items = [{ id: "proj1", parent_product_id: "deleted-product" }];
    expect(allowOptionalLiveParent(items, "parent_product_id", new Set())).toEqual([]);
  });
});

describe("assertLiveParent", () => {
  const makeCollection = (records) => ({ get: async (id) => records.find((r) => r.id === id) || null });

  it("resolves without throwing for a real, non-deleted record", async () => {
    const areas = makeCollection([{ id: "a1", title: "Home" }]);
    await expect(assertLiveParent(areas, "a1", "Area")).resolves.toBeUndefined();
  });

  it("throws a clear error for an id that doesn't exist", async () => {
    const areas = makeCollection([]);
    await expect(assertLiveParent(areas, "ghost", "Area")).rejects.toThrow(/Area "ghost" doesn't exist/);
  });

  it("throws for an id that exists but is soft-deleted", async () => {
    const areas = makeCollection([{ id: "a1", deleted_at: "2026-01-01T00:00:00.000Z" }]);
    await expect(assertLiveParent(areas, "a1", "Area")).rejects.toThrow(/Area "a1" doesn't exist/);
  });
});

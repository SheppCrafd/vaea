import { describe, it, expect } from "vitest";
import { sortByPosition, reorderPositions, sanitizeReturnTo } from "./entityUtils.js";

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

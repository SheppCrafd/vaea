import { describe, it, expect } from "vitest";
import { isHighlightMatch } from "./useHighlightDim";

describe("isHighlightMatch", () => {
  it("never matches anything when no highlight is active", () => {
    expect(isHighlightMatch([], "tasks", [])).toBe(false);
    expect(isHighlightMatch([], "tasks", ["alice"])).toBe(false);
  });

  it("doesn't match when a highlight is active in the category but the entity doesn't match it", () => {
    const highlights = [{ stakeholderId: "alice", category: "tasks" }];
    expect(isHighlightMatch(highlights, "tasks", ["bob"])).toBe(false);
    expect(isHighlightMatch(highlights, "tasks", [])).toBe(false);
  });

  it("matches when the entity's stakeholder matches an active highlight", () => {
    const highlights = [{ stakeholderId: "alice", category: "tasks" }];
    expect(isHighlightMatch(highlights, "tasks", ["alice"])).toBe(true);
  });

  it("ignores highlights from a different category entirely — this is the root of the per-checkbox design", () => {
    // Alice's "projects" checkbox is checked, but this is a task-row check —
    // it must not be affected by a category it doesn't belong to.
    const highlights = [{ stakeholderId: "alice", category: "projects" }];
    expect(isHighlightMatch(highlights, "tasks", ["alice"])).toBe(false); // no active "tasks" highlight, so nothing matches
  });

  it("accepts multiple categories at once (Project/Product/Area cards react to both 'projects' and 'products')", () => {
    const highlights = [{ stakeholderId: "alice", category: "products" }];
    expect(isHighlightMatch(highlights, ["projects", "products"], ["alice"])).toBe(true);
    expect(isHighlightMatch(highlights, ["projects", "products"], ["bob"])).toBe(false);
  });

  it("matches if ANY active highlighted stakeholder (of multiple) matches", () => {
    const highlights = [
      { stakeholderId: "alice", category: "tasks" },
      { stakeholderId: "bob", category: "tasks" },
    ];
    expect(isHighlightMatch(highlights, "tasks", ["bob"])).toBe(true);
    expect(isHighlightMatch(highlights, "tasks", ["carol"])).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import { computeHistoryStep } from "./useChatInputHistory";

const ENTRIES = ["most recent", "middle one", "oldest"]; // already newest-first, as the hook builds it

describe("computeHistoryStep", () => {
  it("ignores every key except ArrowUp/ArrowDown", () => {
    expect(computeHistoryStep({ key: "Enter", index: null, entries: ENTRIES, input: "draft", draft: "" })).toBeNull();
    expect(computeHistoryStep({ key: "a", index: null, entries: ENTRIES, input: "draft", draft: "" })).toBeNull();
  });

  it("ArrowUp with no history does nothing", () => {
    expect(computeHistoryStep({ key: "ArrowUp", index: null, entries: [], input: "draft", draft: "" })).toBeNull();
  });

  it("first ArrowUp saves the current draft and jumps to the most recent entry", () => {
    const step = computeHistoryStep({ key: "ArrowUp", index: null, entries: ENTRIES, input: "my draft", draft: "" });
    expect(step).toEqual({ index: 0, input: "most recent", draft: "my draft" });
  });

  it("repeated ArrowUp walks backward through older entries", () => {
    const step = computeHistoryStep({ key: "ArrowUp", index: 0, entries: ENTRIES, input: "most recent", draft: "my draft" });
    expect(step).toEqual({ index: 1, input: "middle one", draft: "my draft" });
  });

  it("ArrowUp stops at the oldest entry instead of wrapping around", () => {
    const step = computeHistoryStep({ key: "ArrowUp", index: 2, entries: ENTRIES, input: "oldest", draft: "my draft" });
    expect(step).toBeNull();
  });

  it("ArrowDown while not browsing does nothing", () => {
    expect(computeHistoryStep({ key: "ArrowDown", index: null, entries: ENTRIES, input: "draft", draft: "" })).toBeNull();
  });

  it("ArrowDown walks forward toward more recent entries", () => {
    const step = computeHistoryStep({ key: "ArrowDown", index: 1, entries: ENTRIES, input: "middle one", draft: "my draft" });
    expect(step).toEqual({ index: 0, input: "most recent", draft: "my draft" });
  });

  it("ArrowDown past the most recent entry restores the original draft and stops browsing", () => {
    const step = computeHistoryStep({ key: "ArrowDown", index: 0, entries: ENTRIES, input: "most recent", draft: "my draft" });
    expect(step).toEqual({ index: null, input: "my draft", draft: "my draft" });
  });
});

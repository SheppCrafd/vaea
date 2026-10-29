import { describe, it, expect } from "vitest";
import { toMinutes, timeAtLine } from "./storyTime";

describe("story timeline", () => {
  it("reads beat times", () => {
    expect(toMinutes("8:52 AM")).toBe(8 * 60 + 52);
    expect(toMinutes("12:10 PM")).toBe(12 * 60 + 10);
    expect(toMinutes("12:05 AM")).toBe(5);
    expect(toMinutes("6:10 PM")).toBe(18 * 60 + 10);
    expect(toMinutes("noon")).toBeNull();
  });

  it("moves the time between beats in proportion to the scroll", () => {
    const beats = [
      { minutes: 520, top: 100 }, // 8:40
      { minutes: 532, top: 500 }, // 8:52
      { minutes: 545, top: 900 }, // 9:05
    ];
    expect(timeAtLine(beats, 50)).toBe(520); // before the first beat
    expect(timeAtLine(beats, 300)).toBe(526); // halfway from 8:40 to 8:52
    expect(timeAtLine(beats, 500)).toBe(532);
    expect(timeAtLine(beats, 2000)).toBe(545); // past the last beat
    expect(timeAtLine([], 10)).toBeNull();
  });
});

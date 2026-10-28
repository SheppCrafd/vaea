import { describe, it, expect } from "vitest";
import { QUADRANTS, getQuadrant, quadrantLabel } from "@/lib/quadrants";

describe("quadrants", () => {
  it("defines the four Eisenhower quadrants in order", () => {
    expect(QUADRANTS.map((q) => q.value)).toEqual([1, 2, 3, 4]);
    expect(QUADRANTS[0].meaning).toBe("Urgent and important");
  });

  it("accepts numbers or numeric strings", () => {
    expect(getQuadrant(2)?.name).toBe("Schedule");
    expect(getQuadrant("3")?.name).toBe("Delegate");
  });

  it("labels missing or invalid quadrants plainly", () => {
    expect(quadrantLabel(1)).toBe("1 · Do first");
    expect(quadrantLabel(null)).toBe("No quadrant");
    expect(quadrantLabel(undefined)).toBe("No quadrant");
    expect(quadrantLabel(7)).toBe("No quadrant");
  });
});

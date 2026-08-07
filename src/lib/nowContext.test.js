import { describe, it, expect } from "vitest";
import { getNowContext } from "./nowContext.js";

// The real bug this replaced: base44-hosted chat only ever saw a bare UTC
// date computed server-side, wrong for any user not near that timezone —
// especially close to midnight, where a task due "today" could already
// read as tomorrow. getNowContext is the one real source of truth for
// "what time/date is it right now, for THIS user."
describe("getNowContext", () => {
  it("returns the real LOCAL calendar date — the local-time Date constructor form (not an ISO/UTC string) makes this deterministic regardless of the test runner's own timezone", () => {
    const fixed = new Date(2026, 7, 7, 15, 30); // August 7, 2026, 3:30 PM local
    expect(getNowContext(fixed).isoDate).toBe("2026-08-07");
  });

  it("pads single-digit month/day", () => {
    const fixed = new Date(2026, 0, 5, 9, 0); // January 5
    expect(getNowContext(fixed).isoDate).toBe("2026-01-05");
  });

  it("display includes the real weekday, the date, a real clock time, and a timezone name", () => {
    const fixed = new Date(2026, 7, 7, 15, 30);
    const { display, timeZone } = getNowContext(fixed);
    const expectedWeekday = fixed.toLocaleDateString("en-US", { weekday: "long" });
    expect(display).toContain(expectedWeekday);
    expect(display).toContain("2026-08-07");
    expect(display).toContain(timeZone);
    expect(display).toMatch(/\d{1,2}:\d{2}/);
  });

  it("timeZone is a real, non-empty zone name", () => {
    const { timeZone } = getNowContext();
    expect(typeof timeZone).toBe("string");
    expect(timeZone.length).toBeGreaterThan(0);
  });

  it("defaults to the real current time when called with no argument", () => {
    const before = Date.now();
    const { isoDate } = getNowContext();
    const todayLocal = new Date(before);
    const pad = (n) => String(n).padStart(2, "0");
    const expected = `${todayLocal.getFullYear()}-${pad(todayLocal.getMonth() + 1)}-${pad(todayLocal.getDate())}`;
    expect(isoDate).toBe(expected);
  });
});

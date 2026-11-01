import { describe, it, expect } from "vitest";
import { localDayKey, dateFromDayKey, parseCalendarDate } from "./dayKey";

describe("day keys", () => {
  it("uses the local date, late evening included", () => {
    expect(localDayKey(new Date(2026, 10, 1, 23, 30))).toBe("2026-11-01");
    expect(localDayKey(new Date(2026, 0, 5, 0, 5))).toBe("2026-01-05");
  });

  it("reads a key back as that day's local midnight", () => {
    const d = dateFromDayKey("2026-11-01");
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 10, 1, 0]);
    expect(localDayKey(d)).toBe("2026-11-01");
  });

  it("keeps an all-day date on its own day and parses timed values as given", () => {
    expect(localDayKey(parseCalendarDate("2026-11-14"))).toBe("2026-11-14");
    expect(parseCalendarDate("2026-11-14T15:00:00Z").toISOString()).toBe("2026-11-14T15:00:00.000Z");
  });
});

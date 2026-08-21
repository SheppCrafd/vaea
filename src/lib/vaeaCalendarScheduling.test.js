import { describe, it, expect } from "vitest";
import { findFreeSlot, findRecurringSlots, findConflicts, VAEA_TAG } from "./vaeaCalendarScheduling.js";

function ev(startIso, endIso, description) {
  return { start: { dateTime: startIso }, end: { dateTime: endIso }, description };
}

describe("vaeaCalendarScheduling: findFreeSlot", () => {
  it("finds the first open slot around an existing busy block", () => {
    const busy = [ev("2026-08-24T09:00:00", "2026-08-24T10:00:00")];
    const slot = findFreeSlot(busy, { durationMinutes: 30, earliest: "2026-08-24T09:00:00", latest: "2026-08-24T18:00:00" });
    expect(slot.start.getHours()).toBe(10);
    expect(slot.start.getDate()).toBe(24);
  });

  it("returns null when nothing free turns up in the window", () => {
    const busy = [ev("2026-08-24T09:00:00", "2026-08-24T18:00:00")];
    const slot = findFreeSlot(busy, { durationMinutes: 30, earliest: "2026-08-24T09:00:00", latest: "2026-08-24T18:00:00" });
    expect(slot).toBeNull();
  });

  it("rolls over to the next day's work hours instead of an off-hours slot", () => {
    const busy = [];
    const slot = findFreeSlot(busy, { durationMinutes: 30, earliest: "2026-08-24T19:00:00", latest: "2026-08-26T18:00:00" });
    expect(slot.start.getHours()).toBe(9);
    expect(slot.start.getDate()).toBe(25);
  });
});

describe("vaeaCalendarScheduling: findRecurringSlots", () => {
  it("returns one slot per requested occurrence", () => {
    const slots = findRecurringSlots([], { durationMinutes: 60, occurrences: 3, startingFrom: "2026-08-24T00:00:00" });
    expect(slots).toHaveLength(3);
  });

  it("only places slots on the requested days of week", () => {
    const slots = findRecurringSlots([], { durationMinutes: 30, occurrences: 2, daysOfWeek: [1], startingFrom: "2026-08-24T00:00:00" });
    for (const s of slots) expect(s.start.getDay()).toBe(1);
  });
});

describe("vaeaCalendarScheduling: findConflicts", () => {
  it("flags a Vaea-tagged event overlapping a real (untagged) meeting", () => {
    const events = [
      ev("2026-08-24T10:00:00", "2026-08-24T11:00:00", VAEA_TAG.focus),
      ev("2026-08-24T10:30:00", "2026-08-24T11:30:00", "Real meeting"),
    ];
    const conflicts = findConflicts(events);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].conflictsWith).toHaveLength(1);
  });

  it("never flags two Vaea-tagged events overlapping each other", () => {
    const events = [
      ev("2026-08-24T10:00:00", "2026-08-24T11:00:00", VAEA_TAG.focus),
      ev("2026-08-24T10:30:00", "2026-08-24T11:30:00", VAEA_TAG.habit),
    ];
    expect(findConflicts(events)).toHaveLength(0);
  });
});

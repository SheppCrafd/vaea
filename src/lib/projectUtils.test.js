import { describe, it, expect } from "vitest";
import { getDueDateColorClass, formatDueDate, getProjectOwner } from "./projectUtils";

const daysFromNow = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
};

describe("getDueDateColorClass", () => {
  it("is the neutral theme-aware color when estimated, regardless of due date", () => {
    const project = { due_date_status: "ESTIMATED", due_date: daysFromNow(-30) };
    expect(getDueDateColorClass(project)).toContain("text-foreground");
  });

  it("is the neutral theme-aware color when there's no due date at all", () => {
    expect(getDueDateColorClass({ due_date_status: "COMMITTED", due_date: null })).toContain("text-foreground");
  });

  it("is green when committed and comfortably on track", () => {
    const project = { due_date_status: "COMMITTED", due_date: daysFromNow(30) };
    expect(getDueDateColorClass(project)).toContain("text-green");
  });

  it("is orange when committed and due within the at-risk window", () => {
    const project = { due_date_status: "COMMITTED", due_date: daysFromNow(3) };
    expect(getDueDateColorClass(project)).toContain("text-orange");
  });

  it("is red when committed and overdue (missed/impacted)", () => {
    const project = { due_date_status: "COMMITTED", due_date: daysFromNow(-1) };
    expect(getDueDateColorClass(project)).toContain("text-red");
  });

  it("is blue whenever all active tasks are done, overriding every other state", () => {
    const overdueButDone = { due_date_status: "COMMITTED", due_date: daysFromNow(-30) };
    expect(getDueDateColorClass(overdueButDone, true)).toContain("text-blue");
  });
});

describe("formatDueDate / getProjectOwner", () => {
  it("reports 'No due date' when unset", () => {
    expect(formatDueDate({ due_date: null })).toBe("No due date");
  });

  it("falls back to null (rendered as 'Unassigned' by the UI) when no owner is set", () => {
    expect(getProjectOwner({})).toBeNull();
    expect(getProjectOwner({ owner_name: "Jordan" })).toBe("Jordan");
  });
});

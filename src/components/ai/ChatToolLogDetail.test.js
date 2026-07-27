import { describe, it, expect } from "vitest";
import { humanizeAction, humanizeKey, resultLabel } from "./ChatToolLogDetail.jsx";

describe("humanizeAction", () => {
  it("turns a SCREAMING_SNAKE_CASE action into Title Case words", () => {
    expect(humanizeAction("CREATE_AREA")).toBe("Create Area");
    expect(humanizeAction("BULK_CREATE")).toBe("Bulk Create");
    expect(humanizeAction("UPDATE_TASK_STATUS")).toBe("Update Task Status");
  });
});

describe("humanizeKey", () => {
  it("drops a trailing _id and title-cases the rest", () => {
    expect(humanizeKey("parent_area_id")).toBe("Parent Area");
    expect(humanizeKey("project_id")).toBe("Project");
  });

  it("title-cases a plain snake_case key with no _id suffix", () => {
    expect(humanizeKey("due_date_status")).toBe("Due Date Status");
    expect(humanizeKey("title")).toBe("Title");
  });
});

describe("resultLabel", () => {
  it("pulls a title or name off the first nameable entity in a toolResult", () => {
    expect(resultLabel({ area: { id: "a1", title: "Q3 Growth Initiatives" } })).toBe("Q3 Growth Initiatives");
    expect(resultLabel({ stakeholder: { id: "s1", name: "Alice" } })).toBe("Alice");
  });

  it("returns null when there's nothing nameable (a count-only bulk result)", () => {
    expect(resultLabel({ entity_type: "task", count: 5 })).toBeNull();
    expect(resultLabel(null)).toBeNull();
    expect(resultLabel(undefined)).toBeNull();
  });
});

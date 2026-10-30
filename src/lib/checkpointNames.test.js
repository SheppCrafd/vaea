import { describe, it, expect } from "vitest";
import { nameCheckpoint } from "./checkpointNames.js";

const data = {
  areas: [{ id: "a1", title: "Marketing" }, { id: "a2", title: "Engineering" }],
  products: [{ id: "p1", title: "Website", parent_area_id: "a1" }],
  projects: [
    { id: "j1", title: "Q1 Newsletter", parent_area_id: "a1", parent_product_id: null },
    { id: "j2", title: "Launch plan", parent_area_id: "a1", parent_product_id: "p1" },
    { id: "j3", title: "API v2", parent_area_id: "a2", parent_product_id: null },
  ],
  tasks: [
    { id: "t1", description: "Write the brief", project_id: "j2" },
    { id: "t2", description: "Book the venue", project_id: "j2" },
    { id: "t3", description: "Ship the endpoint", project_id: "j3" },
  ],
  projectNotes: [],
  stakeholders: [{ id: "s1", name: "Dana Kim" }],
  departments: [],
};

describe("nameCheckpoint", () => {
  it("names a single delete with the item and where it was", () => {
    expect(nameCheckpoint([{ action: "DELETE_PROJECT", args: { project_id: "j1" } }], data)).toBe(
      'Deleted project "Q1 Newsletter" from Marketing'
    );
  });

  it("uses the product, not the area, when a project sits in one", () => {
    expect(nameCheckpoint([{ action: "ARCHIVE_PROJECT", args: { project_id: "j2" } }], data)).toBe(
      'Archived project "Launch plan" in Website'
    );
  });

  it("counts several of the same change in one place", () => {
    const plan = [
      { action: "CREATE_TASK", args: { project_id: "j2", description: "Draft copy" } },
      { action: "CREATE_TASK", args: { project_id: "j2", description: "Pick images" } },
      { action: "CREATE_TASK", args: { project_id: "j2", description: "Send for review" } },
    ];
    expect(nameCheckpoint(plan, data)).toBe('Added 3 tasks to Launch plan');
  });

  it("falls back to the shared area when the places differ", () => {
    const plan = [
      { action: "DELETE_TASK", args: { task_id: "t1" } },
      { action: "DELETE_PROJECT", args: { project_id: "j1" } },
      { action: "DELETE_PROJECT", args: { project_id: "j2" } },
      { action: "DELETE_TASK", args: { task_id: "t2" } },
    ];
    expect(nameCheckpoint(plan, data)).toBe("Deleted 2 tasks and 2 projects in Marketing");
  });

  it("names two different changes one by one", () => {
    const plan = [
      { action: "CREATE_TASK", args: { project_id: "j2", description: "New brief" } },
      { action: "DELETE_TASK", args: { task_id: "t1" } },
    ];
    expect(nameCheckpoint(plan, data)).toBe('Added task "New brief" and deleted task "Write the brief" in Launch plan');
  });

  it("follows temp ids to things made earlier in the same plan", () => {
    const plan = [
      { action: "CREATE_AREA", args: { title: "Sales" }, temp_id: "area" },
      { action: "CREATE_PRODUCT", args: { parent_area_id: "$area", title: "CRM" } },
    ];
    expect(nameCheckpoint(plan, data)).toBe('Added area "Sales" and product "CRM"');
  });

  it("expands bulk steps into what they touch", () => {
    const plan = [{ action: "BULK_DELETE", args: { entity_type: "task", ids: ["t1", "t2"] } }];
    expect(nameCheckpoint(plan, data)).toBe('Deleted 2 tasks from Launch plan');
  });

  it("uses the app's status names", () => {
    expect(nameCheckpoint([{ action: "UPDATE_TASK_STATUS", args: { task_id: "t3", status: "DONE" } }], data)).toBe(
      'Marked task "Ship the endpoint" Done in API v2'
    );
  });

  it("words a CSV import as an import", () => {
    const plan = [
      { action: "CREATE_TASK", args: { project_id: "j3", description: "A" } },
      { action: "CREATE_TASK", args: { project_id: "j3", description: "B" } },
    ];
    expect(nameCheckpoint(plan, data, { source: "csv" })).toBe("Imported 2 tasks from a CSV file");
  });

  it("names connected-app steps in plain words", () => {
    expect(nameCheckpoint([{ action: "SEND_GMAIL_MESSAGE", args: { subject: "Quote" } }], data)).toBe('Sent Gmail message "Quote"');
  });

  it("never runs long", () => {
    const long = "x".repeat(200);
    const name = nameCheckpoint([{ action: "CREATE_AREA", args: { title: long } }], data);
    expect(name.length).toBeLessThanOrEqual(90);
  });

  it("has a plain fallback for an empty plan", () => {
    expect(nameCheckpoint([], data)).toBe("Change from Vaea Chat");
  });
});

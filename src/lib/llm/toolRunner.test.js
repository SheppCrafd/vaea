import { describe, it, expect } from "vitest";
import { makeToolRunner, MAX_ACTIONS_PER_REQUEST } from "./toolRunner.js";
import { MAX_BULK_ITEMS_PER_CALL } from "./toolCatalog.js";

describe("toolRunner: staged tools queue instead of executing", () => {
  it("pushes {action, args} onto plan and returns a queued ack", () => {
    const plan = [];
    const runTool = makeToolRunner({ plan, dataset: {} });
    const result = runTool("CREATE_AREA", { title: "Marketing", description: "" });
    expect(result.queued).toBe(true);
    expect(plan).toEqual([{ action: "CREATE_AREA", args: { title: "Marketing", description: "" } }]);
  });

  it("strips temp_id out of args but keeps it as its own plan field, and hints the model how to reference it", () => {
    const plan = [];
    const runTool = makeToolRunner({ plan, dataset: {} });
    const result = runTool("CREATE_AREA", { title: "Marketing", temp_id: "area1" });
    expect(plan[0]).toEqual({ action: "CREATE_AREA", args: { title: "Marketing" }, temp_id: "area1" });
    expect(result.temp_id_registered).toBe("area1");
    expect(result.hint).toContain("$area1");
  });

  it("refuses to queue past MAX_ACTIONS_PER_REQUEST", () => {
    const plan = Array.from({ length: MAX_ACTIONS_PER_REQUEST }, () => ({ action: "CREATE_AREA", args: {} }));
    const runTool = makeToolRunner({ plan, dataset: {} });
    const result = runTool("CREATE_AREA", { title: "One too many" });
    expect(result.queued).toBe(false);
    expect(plan).toHaveLength(MAX_ACTIONS_PER_REQUEST);
  });

  // Rejected right here, at staging time — not left to surface later as a
  // chatActions.js runtime error only once the plan actually executes on
  // the user's device (see chatActions.js's own MAX_BULK_ITEMS_PER_CALL
  // comment for why that was too late).
  it("refuses to queue a BULK_CREATE over MAX_BULK_ITEMS_PER_CALL, without touching the plan", () => {
    const plan = [];
    const runTool = makeToolRunner({ plan, dataset: {} });
    const items = Array.from({ length: MAX_BULK_ITEMS_PER_CALL + 1 }, (_, i) => ({ description: `Task ${i}` }));
    const result = runTool("BULK_CREATE", { entity_type: "task", items });
    expect(result.queued).toBe(false);
    expect(result.error).toMatch(new RegExp(`up to ${MAX_BULK_ITEMS_PER_CALL}`));
    expect(plan).toHaveLength(0);
  });

  it("refuses to queue a BULK_DELETE over MAX_BULK_ITEMS_PER_CALL, without touching the plan", () => {
    const plan = [];
    const runTool = makeToolRunner({ plan, dataset: {} });
    const ids = Array.from({ length: MAX_BULK_ITEMS_PER_CALL + 1 }, (_, i) => `id-${i}`);
    const result = runTool("BULK_DELETE", { entity_type: "task", ids });
    expect(result.queued).toBe(false);
    expect(result.error).toMatch(new RegExp(`up to ${MAX_BULK_ITEMS_PER_CALL}`));
    expect(plan).toHaveLength(0);
  });

  it("tells the model a non-destructive action runs immediately with no confirm step", () => {
    // The tool's own returned note used to unconditionally say "Do not tell
    // the user this already happened" for every action, contradicting the
    // system instructions for the (far more common) non-destructive case —
    // a real, verified contributor to the model describing plain creates as
    // "queued"/"pending confirmation."
    const plan = [];
    const runTool = makeToolRunner({ plan, dataset: {} });
    const result = runTool("CREATE_TASK", { project_id: "p1", description: "Do the thing" });
    expect(result.note).toMatch(/runs automatically, immediately/);
    expect(result.note).not.toMatch(/confirm click before this runs/);
  });

  it("tells the model a destructive action needs a real confirm click first", () => {
    const plan = [];
    const runTool = makeToolRunner({ plan, dataset: {} });
    const result = runTool("DELETE_TASK", { task_id: "t1" });
    expect(result.note).toMatch(/confirm click before this runs/);
  });

  it("still queues a BULK_CREATE/BULK_DELETE at exactly the limit", () => {
    const plan = [];
    const runTool = makeToolRunner({ plan, dataset: {} });
    const items = Array.from({ length: MAX_BULK_ITEMS_PER_CALL }, (_, i) => ({ description: `Task ${i}` }));
    const result = runTool("BULK_CREATE", { entity_type: "task", items });
    expect(result.queued).toBe(true);
    expect(plan).toHaveLength(1);
  });
});

describe("toolRunner: local (non-staged) tools run for real against the dataset", () => {
  it("search_workspace finds a real match instead of being queued", () => {
    const plan = [];
    const dataset = {
      areas: [{ id: "a1", title: "Growth", description: "" }],
      products: [], projects: [], archivedProjects: [], tasks: [], archivedTasks: [], stakeholders: [], notes: [],
    };
    const runTool = makeToolRunner({ plan, dataset });
    const result = runTool("search_workspace", { query: "growth" });
    expect(plan).toHaveLength(0);
    expect(result.count).toBe(1);
    expect(result.matches[0]).toMatchObject({ type: "area", id: "a1" });
  });
});

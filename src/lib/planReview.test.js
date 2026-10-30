import { describe, it, expect } from "vitest";
import { reviewPlan, connectorHoldReason, isConnectorStep, AUTO_APPROVE_MAX_REMOVED } from "./planReview.js";

const data = {
  areas: [{ id: "a1", title: "Marketing" }],
  products: [{ id: "p1", title: "Website", parent_area_id: "a1" }],
  projects: [
    { id: "j1", title: "Launch", parent_area_id: "a1", parent_product_id: "p1" },
    { id: "gone", title: "Old", parent_area_id: "a1", deleted_at: "2026-10-01" },
  ],
  tasks: [
    { id: "t1", project_id: "j1", status: "DONE" },
    { id: "t2", project_id: "j1", status: "NOT_STARTED" },
  ],
  projectNotes: [],
  stakeholders: [],
  departments: [],
};

describe("reviewPlan", () => {
  it("passes a board delete whose target exists", () => {
    const review = reviewPlan([{ action: "DELETE_PROJECT", args: { project_id: "j1" } }], data);
    expect(review.ok).toBe(true);
    expect(review.removed).toBe(3); // the project and its two tasks
  });

  it("holds a delete of something not on the board", () => {
    const review = reviewPlan([{ action: "DELETE_PROJECT", args: { project_id: "gone" } }], data);
    expect(review.ok).toBe(false);
    expect(review.summary).toBe("It deletes a project that isn't on your board.");
  });

  it("holds anything a checkpoint can't undo", () => {
    const review = reviewPlan([{ action: "SEND_GMAIL_MESSAGE", args: {} }], data);
    expect(review.ok).toBe(false);
    expect(review.summary).toBe("It sends a Gmail message, which a checkpoint can't undo.");
    expect(reviewPlan([{ action: "DELETE_WORKFLOW_CARD", args: {} }], data, { waitingActions: () => true }).ok).toBe(false);
  });

  it("counts everything a delete takes with it", () => {
    expect(reviewPlan([{ action: "DELETE_AREA", args: { area_id: "a1" } }], data).removed).toBe(5); // area, product, live project, 2 tasks
  });

  it("holds a plan that removes too much at once", () => {
    const tasks = Array.from({ length: AUTO_APPROVE_MAX_REMOVED + 1 }, (_, i) => ({ id: `x${i}`, project_id: "j1" }));
    const review = reviewPlan([{ action: "DELETE_PROJECT", args: { project_id: "j1" } }], { ...data, tasks });
    expect(review.ok).toBe(false);
    expect(review.summary).toMatch(/and the limit is 50/);
  });

  it("checks only the steps that would wait", () => {
    const review = reviewPlan(
      [{ action: "CREATE_TASK", args: { project_id: "j1" } }, { action: "DELETE_TASK", args: { task_id: "t2" } }],
      data
    );
    expect(review.ok).toBe(true);
    expect(review.removed).toBe(1);
  });

  it("accepts a delete of something made earlier in the plan", () => {
    expect(reviewPlan([{ action: "DELETE_TASK", args: { task_id: "$new" } }], data).ok).toBe(true);
  });
});

describe("connectorHoldReason", () => {
  const readEmail = [{ label: 'read_gmail_message("Quote")' }];

  it("holds connected-app changes in a turn that read email", () => {
    expect(connectorHoldReason([{ action: "CREATE_CALENDAR_EVENT", args: {} }], readEmail)).toBe(
      "This chat read email, so changes to your connected apps wait for your yes."
    );
  });

  it("lets board changes through in the same turn", () => {
    expect(connectorHoldReason([{ action: "CREATE_TASK", args: {} }], readEmail)).toBeNull();
  });

  it("doesn't hold when nothing outside was read", () => {
    expect(connectorHoldReason([{ action: "CREATE_CALENDAR_EVENT", args: {} }], [{ label: "search_workspace(\"x\")" }])).toBeNull();
  });

  it("names every outside source", () => {
    const trace = [{ label: "web_search(\"x\")" }, { label: "list_slack_messages(\"#general\")" }];
    expect(connectorHoldReason([{ action: "WRITE_VAULT_NOTE", args: {} }], trace)).toBe(
      "This chat read a web page and Slack messages, so changes to your connected apps wait for your yes."
    );
  });

  it("treats any reader it doesn't know as outside content", () => {
    expect(connectorHoldReason([{ action: "CREATE_CLICKUP_TASK", args: {} }], [{ label: 'read_google_doc("Plan")' }])).toBe(
      "This chat read content from outside Vaea, so changes to your connected apps wait for your yes."
    );
  });

  it("trusts the user's own notes", () => {
    expect(connectorHoldReason([{ action: "WRITE_VAULT_NOTE", args: {} }], [{ label: 'read_vault_note("Vaea Memory.md")' }])).toBeNull();
  });

  it("knows which steps touch a connected app", () => {
    expect(isConnectorStep("SEND_SLACK_MESSAGE")).toBe(true);
    expect(isConnectorStep("CREATE_CLICKUP_TASK")).toBe(true);
    expect(isConnectorStep("DELETE_TASK")).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import { reviewPlan, connectorHoldReason, isConnectorStep, AUTO_APPROVE_MAX_REMOVED, REVIEW_RULES, DEFAULT_REVIEW_RULES, normalizeReviewRules, namesItem } from "./planReview.js";

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

const ruleOf = (review) => review.problems[0]?.rule;

// The board rules on their own; the conversation rules have their own tests below.
const plain = { ...DEFAULT_REVIEW_RULES, asked: { on: false }, named: { on: false }, count: { on: false } };
const check = (plan, board, opts = {}) => reviewPlan(plan, board, { rules: plain, ...opts });

describe("reviewPlan: passing plans", () => {
  it("passes a board delete whose target exists", () => {
    const review = check([{ action: "DELETE_PROJECT", args: { project_id: "j1" } }], data);
    expect(review.ok).toBe(true);
    expect(review.removed).toBe(3); // the project and its two tasks
    expect(review.summary).toBe("Passed 8 review rules for 1 step. It removes 3 items, and a checkpoint can undo all of it.");
  });

  it("passes board changes alongside the delete", () => {
    const review = check(
      [{ action: "CREATE_TASK", args: { project_id: "j1" } }, { action: "UPDATE_TASK", args: { task_id: "t1" } }, { action: "DELETE_TASK", args: { task_id: "t2" } }],
      data
    );
    expect(review.ok).toBe(true);
    expect(review.removed).toBe(1);
  });

  it("accepts changes to something made earlier in the plan", () => {
    expect(check([{ action: "UPDATE_TASK", args: { task_id: "$new" } }, { action: "DELETE_TASK", args: { task_id: "$new" } }], data).ok).toBe(true);
  });

  it("lets steps that change nothing ride along", () => {
    expect(check([{ action: "CREATE_BACKUP", args: {} }, { action: "DELETE_TASK", args: { task_id: "t2" } }], data).ok).toBe(true);
  });

  it("has a plain sentence for every rule", () => {
    expect(REVIEW_RULES.map((r) => r.id)).toEqual(["board-only", "asked", "named", "count", "exists", "no-repeats", "kinds", "limit", "share", "restore-alone", "inside-only"]);
    const rules = normalizeReviewRules();
    REVIEW_RULES.forEach((r) => expect(r.text(rules)).toMatch(/^[A-Z].*\.$/));
    expect(REVIEW_RULES.find((r) => r.id === "limit").text(rules)).toBe("It removes at most 50 items, counting everything each delete takes with it.");
  });
});

describe("reviewPlan rule 1: board-only", () => {
  it("holds a sent message", () => {
    const review = check([{ action: "SEND_GMAIL_MESSAGE", args: {} }], data);
    expect(ruleOf(review)).toBe("board-only");
    expect(review.summary).toBe("It sends a Gmail message, which a checkpoint can't undo.");
  });

  it("checks every step, not just the one that would have waited", () => {
    const review = check([{ action: "DELETE_TASK", args: { task_id: "t2" } }, { action: "CREATE_CALENDAR_EVENT", args: {} }], data);
    expect(review.ok).toBe(false);
    expect(review.summary).toBe("It creates a calendar event, which a checkpoint can't undo.");
  });

  it("holds settings, agents and workflow cards, which checkpoints don't save", () => {
    for (const action of ["SET_APPEARANCE", "DELETE_AGENT", "DELETE_WORKFLOW_CARD", "WRITE_VAULT_NOTE", "SET_AI_IDENTITY"]) {
      expect(ruleOf(check([{ action, args: {} }], data))).toBe("board-only");
    }
  });

  it("holds a step it doesn't know", () => {
    const review = check([{ action: "FROBNICATE", args: {} }], data);
    expect(review.summary).toBe("It takes a step Vaea's reviewer doesn't know, which a checkpoint can't undo.");
  });
});

describe("reviewPlan rule 2: exists", () => {
  it("holds a delete of something not on the board", () => {
    const review = check([{ action: "DELETE_PROJECT", args: { project_id: "gone" } }], data);
    expect(ruleOf(review)).toBe("exists");
    expect(review.summary).toBe("It deletes a project that isn't on your board.");
  });

  it("holds a change to something not on the board", () => {
    const review = check([{ action: "DELETE_TASK", args: { task_id: "t2" } }, { action: "UPDATE_TASK", args: { task_id: "nope" } }], data);
    expect(review.summary).toBe("It changes a task that isn't on your board.");
  });

  it("holds a step that doesn't say which item", () => {
    expect(check([{ action: "DELETE_TASK", args: {} }], data).summary).toBe("It changes a task without saying which one.");
    expect(ruleOf(check([{ action: "BULK_DELETE", args: { entity_type: "task" } }], data))).toBe("exists");
  });

  it("holds a bulk delete of an unknown kind", () => {
    expect(check([{ action: "BULK_DELETE", args: { entity_type: "planet", ids: ["x"] } }], data).summary).toBe(
      'It changes a kind of item Vaea doesn\'t know ("planet").'
    );
  });
});

describe("reviewPlan rule 3: no-repeats", () => {
  it("holds a plan that deletes the same item twice", () => {
    const review = check([{ action: "DELETE_TASK", args: { task_id: "t1" } }, { action: "BULK_DELETE", args: { entity_type: "task", ids: ["t1"] } }], data);
    expect(ruleOf(review)).toBe("no-repeats");
    expect(review.summary).toBe("It deletes the same task twice.");
  });
});

describe("reviewPlan rule 4: limit", () => {
  it("counts everything a delete takes with it", () => {
    expect(check([{ action: "DELETE_AREA", args: { area_id: "a1" } }], data).removed).toBe(5); // area, product, live project, 2 tasks
  });

  it("counts a child removed by two deletes once", () => {
    expect(check([{ action: "DELETE_AREA", args: { area_id: "a1" } }, { action: "DELETE_PROJECT", args: { project_id: "j1" } }], data).removed).toBe(5);
  });

  it("holds a plan that removes too much at once", () => {
    const tasks = Array.from({ length: AUTO_APPROVE_MAX_REMOVED + 1 }, (_, i) => ({ id: `x${i}`, project_id: "j1" }));
    const projects = [...data.projects, { id: "j2" }, { id: "j3" }];
    const review = check([{ action: "DELETE_PROJECT", args: { project_id: "j1" } }], { ...data, projects, tasks: [...tasks, ...tasks.map((t) => ({ ...t, id: `y${t.id}`, project_id: "j2" }))] });
    expect(review.problems.map((p) => p.rule)).toContain("limit");
    expect(review.summary).toMatch(/and the limit is 50/);
  });
});

describe("reviewPlan rule 5: share", () => {
  const tasks = Array.from({ length: 6 }, (_, i) => ({ id: `s${i}`, project_id: "j1" }));
  const board = { ...data, tasks };

  it("holds a plan that removes more than half of a kind", () => {
    const review = check([{ action: "BULK_DELETE", args: { entity_type: "task", ids: ["s0", "s1", "s2", "s3"] } }], board);
    expect(ruleOf(review)).toBe("share");
    expect(review.summary).toBe("It removes 4 of your 6 tasks, more than half.");
  });

  it("allows half or less", () => {
    expect(check([{ action: "BULK_DELETE", args: { entity_type: "task", ids: ["s0", "s1", "s2"] } }], board).ok).toBe(true);
  });

  it("allows small removals even from a small board", () => {
    expect(check([{ action: "DELETE_TASK", args: { task_id: "t1" } }, { action: "DELETE_TASK", args: { task_id: "t2" } }], data).ok).toBe(true);
  });
});

describe("reviewPlan rule 6: restore-alone", () => {
  const checkpoints = [{ id: "c1", label: "Deleted the Launch project" }];

  it("passes a restore of a saved checkpoint on its own", () => {
    expect(check([{ action: "RESTORE_BACKUP", args: { snapshot_id: "c1" } }], data, { checkpoints }).ok).toBe(true);
  });

  it("holds a restore of a checkpoint that isn't saved", () => {
    expect(check([{ action: "RESTORE_BACKUP", args: { snapshot_id: "c9" } }], data, { checkpoints }).summary).toBe("It restores a checkpoint that isn't saved.");
  });

  it("holds a restore mixed with other changes", () => {
    const review = check([{ action: "RESTORE_BACKUP", args: { snapshot_id: "c1" } }, { action: "DELETE_TASK", args: { task_id: "t1" } }], data, { checkpoints });
    expect(ruleOf(review)).toBe("restore-alone");
  });
});

describe("reviewPlan rule 7: inside-only", () => {
  it("holds a board delete made after reading email", () => {
    const review = check([{ action: "DELETE_TASK", args: { task_id: "t1" } }], data, { liveTrace: [{ label: 'read_gmail_message("Quote")' }] });
    expect(ruleOf(review)).toBe("inside-only");
    expect(review.summary).toBe("The chat read email while making this plan, and you didn't name the \"untitled\" task yourself.");
  });

  it("trusts the board and the user's own notes", () => {
    const liveTrace = [{ label: 'search_workspace("launch")' }, { label: 'read_vault_note("Vaea Memory.md")' }];
    expect(check([{ action: "DELETE_TASK", args: { task_id: "t1" } }], data, { liveTrace }).ok).toBe(true);
  });
});

describe("reviewPlan: the user's rule settings", () => {
  const del = [{ action: "DELETE_TASK", args: { task_id: "t1" } }];
  const set = (patch) => ({ ...plain, ...patch });

  it("holds removals of a kind the user took off the list, children included", () => {
    const rules = set({ kinds: { on: true, allowed: ["areas", "products", "projects"] } });
    expect(check(del, data, { rules }).summary).toBe("It removes a task, and auto-approve is set not to remove tasks.");
    expect(check([{ action: "DELETE_PROJECT", args: { project_id: "j1" } }], data, { rules }).summary).toBe(
      "It removes 2 tasks, and auto-approve is set not to remove tasks."
    );
  });

  it("uses the user's removal limit", () => {
    const rules = set({ limit: { on: true, max: 2 } });
    expect(check([{ action: "DELETE_PROJECT", args: { project_id: "j1" } }], data, { rules }).summary).toBe("It removes 3 items at once, and the limit is 2.");
  });

  it("uses the user's share", () => {
    const tasks = Array.from({ length: 10 }, (_, i) => ({ id: `s${i}`, project_id: "j1" }));
    const plan = [{ action: "BULK_DELETE", args: { entity_type: "task", ids: ["s0", "s1", "s2"] } }];
    expect(check(plan, { ...data, tasks }).ok).toBe(true);
    expect(check(plan, { ...data, tasks }, { rules: set({ share: { on: true, percent: 20 } }) }).summary).toBe("It removes 3 of your 10 tasks, more than 20%.");
  });

  it("skips a rule the user switched off", () => {
    const liveTrace = [{ label: 'read_gmail_message("Quote")' }];
    expect(check(del, data, { liveTrace }).ok).toBe(false);
    expect(check(del, data, { liveTrace, rules: set({ "inside-only": { on: false } }) }).ok).toBe(true);
    expect(check(del, data, { liveTrace, rules: set({ "inside-only": { on: false } }) }).summary).toMatch(/^Passed 7 review rules/);
  });

  it("never lets the user switch off board-only", () => {
    const rules = { ...set({}), "board-only": { on: false } };
    expect(check([{ action: "SEND_SLACK_MESSAGE", args: {} }], data, { rules }).ok).toBe(false);
  });

  it("pulls stored numbers back inside their bounds", () => {
    const r = normalizeReviewRules({ limit: { on: true, max: 0 }, share: { on: true, percent: 900 }, kinds: { on: true, allowed: ["tasks", "planets"] } });
    expect(r.limit.max).toBe(1);
    expect(r.share.percent).toBe(100);
    expect(r.kinds.allowed).toEqual(["tasks"]);
    expect(normalizeReviewRules({ limit: { max: "lots" } }).limit.max).toBe(50);
    expect(normalizeReviewRules(null)).toEqual(DEFAULT_REVIEW_RULES);
  });
});

describe("reviewPlan: reading the conversation", () => {
  const board = {
    ...data,
    projects: [...data.projects, { id: "j2", title: "Q1 Newsletter", parent_area_id: "a1" }],
    tasks: [...data.tasks, { id: "t3", project_id: "j2", title: "Draft copy" }, { id: "t4", project_id: "j2", title: "Pick photos" }],
  };
  const talk = (latest, before = []) => ({ conversation: { latest, history: [...before, { role: "user", content: latest }] } });
  const delNewsletter = [{ action: "DELETE_PROJECT", args: { project_id: "j2" } }];

  it("passes a delete the user asked for by name", () => {
    expect(reviewPlan(delNewsletter, board, talk("Delete the Q1 Newsletter project, it's done")).ok).toBe(true);
  });

  it("holds a delete the user didn't ask for", () => {
    const review = reviewPlan(delNewsletter, board, talk("Add a task to the Q1 Newsletter"));
    expect(review.problems[0]).toEqual({ rule: "asked", text: "Your last message doesn't ask to remove anything.", step: 0 });
  });

  it("reads a negative as no", () => {
    expect(reviewPlan(delNewsletter, board, talk("Don't delete the newsletter, just rename it")).problems[0].rule).toBe("asked");
  });

  it("holds an item the user didn't name and points at its step", () => {
    const plan = [{ action: "DELETE_TASK", args: { task_id: "t3" } }, { action: "DELETE_PROJECT", args: { project_id: "j1" } }];
    const review = reviewPlan(plan, board, talk("Delete the Draft copy task"));
    expect(review.problems[0]).toEqual({ rule: "named", text: 'It deletes the "Launch" project, which your messages don\'t name.', step: 1 });
  });

  it("follows \"all\" down from something the user named", () => {
    const plan = [{ action: "BULK_DELETE", args: { entity_type: "task", ids: ["t3", "t4"] } }];
    expect(reviewPlan(plan, board, talk("Remove all the tasks in Q1 Newsletter")).ok).toBe(true);
    expect(reviewPlan(plan, board, talk("Remove the tasks in Q1 Newsletter")).problems[0].rule).toBe("named");
  });

  it("follows \"them\" back to the reply the user is answering", () => {
    const before = [{ role: "user", content: "What's stale?" }, { role: "assistant", content: "Q1 Newsletter hasn't moved in 6 weeks." }];
    expect(reviewPlan(delNewsletter, board, talk("ok delete it", before)).ok).toBe(true);
    expect(reviewPlan(delNewsletter, board, talk("ok delete something", before)).problems[0].rule).toBe("named");
  });

  it("holds a plan whose count doesn't match the user's number", () => {
    const plan = [{ action: "BULK_DELETE", args: { entity_type: "task", ids: ["t3", "t4"] } }];
    expect(reviewPlan(plan, board, talk("Delete 3 tasks from Q1 Newsletter: all of them")).summary).toBe("You asked to remove 3 tasks, and it removes 2.");
    expect(reviewPlan(plan, board, talk("Delete the two tasks, all of them in Q1 Newsletter")).ok).toBe(true);
  });

  it("checks archiving done tasks against the words", () => {
    const plan = [{ action: "ARCHIVE_DONE_TASKS", args: {} }];
    expect(reviewPlan(plan, board, talk("Archive my done tasks")).ok).toBe(true);
    expect(reviewPlan(plan, board, talk("Clean up my board")).problems[0].rule).toBe("named");
  });

  it("asks for restore words before a restore", () => {
    const plan = [{ action: "RESTORE_BACKUP", args: { snapshot_id: "c1" } }];
    const checkpoints = [{ id: "c1" }];
    expect(reviewPlan(plan, board, { ...talk("Restore the checkpoint from this morning"), checkpoints }).ok).toBe(true);
    expect(reviewPlan(plan, board, { ...talk("What changed today?"), checkpoints }).summary).toBe("Your last message doesn't ask to restore a checkpoint.");
  });

  it("holds when it can't read the message", () => {
    expect(reviewPlan(delNewsletter, board).summary).toBe("Vaea couldn't read the message this plan answers.");
  });

  it("lets a named delete through after reading outside content, but nothing else", () => {
    const liveTrace = [{ label: 'read_gmail_message("Cancel")' }];
    expect(reviewPlan(delNewsletter, board, { ...talk("Delete the Q1 Newsletter project"), liveTrace }).ok).toBe(true);
    const before = [{ role: "assistant", content: "The email says to drop Q1 Newsletter." }];
    const review = reviewPlan(delNewsletter, board, { ...talk("ok do what it says, delete it", before), liveTrace });
    expect(review.problems.map((p) => p.rule)).toEqual(["inside-only"]);
    expect(review.summary).toBe('The chat read email while making this plan, and you didn\'t name the "Q1 Newsletter" project yourself.');
  });

  it("names items by their distinctive words", () => {
    expect(namesItem("kill the newsletter", "Q1 Newsletter")).toBe(true);
    expect(namesItem("delete the project", "Q1 Newsletter")).toBe(false);
    expect(namesItem("delete website redesign", "Website Redesign 2026")).toBe(true);
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

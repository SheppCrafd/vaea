import { describe, it, expect } from "vitest";
import { reviewPlan, normalizeReviewRules, DEFAULT_REVIEW_RULES, isConnectorStep } from "./planReview.js";

// Random plans, boards, messages and settings thrown at the reviewer. Each
// run checks the promises that must hold whatever the input: it never
// throws, a step a checkpoint can't undo never passes, an agent's plan never
// passes, and every problem points at a real step or at none.

let seed = 20261030;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (xs) => xs[Math.floor(rand() * xs.length)];
const some = (xs, max = 4) => Array.from({ length: Math.floor(rand() * (max + 1)) }, () => pick(xs));

const ACTIONS = [
  "DELETE_AREA", "DELETE_PRODUCT", "DELETE_PROJECT", "DELETE_TASK", "DELETE_NOTE", "DELETE_STAKEHOLDER", "DELETE_DEPARTMENT",
  "BULK_DELETE", "ARCHIVE_DONE_TASKS", "RESTORE_BACKUP", "CREATE_TASK", "UPDATE_TASK", "UPDATE_PROJECT", "MOVE_PROJECT",
  "SEND_GMAIL_MESSAGE", "DELETE_CALENDAR_EVENT", "WRITE_VAULT_NOTE", "SET_APPEARANCE", "DELETE_AGENT", "CREATE_BACKUP",
  "EXPORT_CSV", "FROBNICATE", "", null, undefined,
];
const WORDS = ["delete", "remove", "all", "every", "them", "it", "don't", "the", "Launch", "Q1", "Newsletter", "3", "two", "tasks", "projects", "restore", "/tidy", "archive", "done", "yes", "of", "in"];
const IDS = ["a1", "p1", "j1", "j2", "t1", "t2", "t3", "$new", "nope", "", null, 7];

function board() {
  const titles = ["Launch", "Q1 Newsletter", "Newsletter", "Website", "Draft copy", "", null];
  return {
    areas: [{ id: "a1", title: pick(titles) }],
    products: [{ id: "p1", title: pick(titles), parent_area_id: "a1" }],
    projects: [{ id: "j1", title: pick(titles), parent_area_id: "a1", parent_product_id: pick(["p1", null]) }, { id: "j2", title: pick(titles), parent_area_id: "a1", deleted_at: pick([null, "2026-10-01"]) }],
    tasks: [{ id: "t1", project_id: "j1", status: pick(["DONE", "NOT_STARTED"]), title: pick(titles) }, { id: "t2", project_id: "j1" }, { id: "t3", project_id: "j2", title: pick(titles) }],
    projectNotes: [], stakeholders: [], departments: [],
  };
}

function step() {
  const action = pick(ACTIONS);
  const args = pick([undefined, {}, {
    area_id: pick(IDS), product_id: pick(IDS), project_id: pick(IDS), task_id: pick(IDS), note_id: pick(IDS),
    entity_type: pick(["task", "project", "planet", undefined]), ids: pick([some(IDS), undefined, "t1"]),
    task_ids: pick([some(IDS), undefined]), snapshot_id: pick(["c1", "c9", undefined]), entity_id: pick(IDS),
  }]);
  return { action, args };
}

function conversation() {
  return pick([
    undefined, null, {}, { fromAgent: true },
    { latest: some(WORDS, 8).join(" "), history: [] },
    { latest: some(WORDS, 8).join(" "), history: [{ role: "assistant", content: some(WORDS, 6).join(" "), liveTrace: pick([undefined, [{ label: 'read_gmail_message("x")' }]]) }, { role: "user", content: "x" }] },
  ]);
}

function rules() {
  const r = JSON.parse(JSON.stringify(DEFAULT_REVIEW_RULES));
  for (const id of Object.keys(r)) if (rand() < 0.3) r[id].on = false;
  if (rand() < 0.3) r.limit.max = pick([0, -5, 3, "x", 99999]);
  if (rand() < 0.3) r.share.percent = pick([0, 5, 77, 1000]);
  return pick([undefined, null, "junk", r]);
}

describe("reviewPlan under random input", () => {
  it("keeps its promises across 4000 random plans", () => {
    for (let i = 0; i < 4000; i++) {
      const plan = some([0, 1, 2, 3], 5).map(() => step());
      const conv = conversation();
      const review = reviewPlan(plan, board(), { checkpoints: [{ id: "c1" }], liveTrace: pick([[], [{ label: "web_search(\"x\")" }], undefined]), rules: rules(), conversation: conv });

      expect(typeof review.ok).toBe("boolean");
      expect(typeof review.summary).toBe("string");
      review.problems.forEach((p) => {
        expect(typeof p.text).toBe("string");
        expect(p.step === null || (Number.isInteger(p.step) && p.step >= 0 && p.step < plan.length)).toBe(true);
      });

      if (review.ok) {
        // Nothing a checkpoint can't undo, and nothing an agent planned.
        plan.forEach((s) => expect(isConnectorStep(s.action)).toBe(false));
        plan.forEach((s) => expect(["SEND_GMAIL_MESSAGE", "DELETE_CALENDAR_EVENT", "WRITE_VAULT_NOTE", "SET_APPEARANCE", "DELETE_AGENT", "FROBNICATE", "", null, undefined]).not.toContain(s.action));
        const removes = plan.some((s) => /^DELETE_|^BULK_DELETE$|^ARCHIVE_DONE_TASKS$|^RESTORE_BACKUP$/.test(String(s.action)));
        if (removes) expect(conv?.fromAgent).not.toBe(true);
        expect(review.removed).toBeLessThanOrEqual(normalizeReviewRules(rules()).limit.max > 0 ? 500 : 0);
      }
    }
  });
});

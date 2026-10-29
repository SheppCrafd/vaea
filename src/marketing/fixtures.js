// Fixed sample data for the marketing demos, fed through the app's own real
// derivation functions so the demos render the exact same components with
// the exact same computed shapes the product uses — not hand-drawn
// lookalikes. Nothing here is interactive (see DemoStage) and nothing here
// is persisted.
//
// Every demo shows one invented user's week, so they agree with each other:
// Juan Morales, head of product at Harborline, a small software company
// that makes the Harbor app. His people: Dana Kim (design lead), Lee Park
// (engineer on Auth rework), Priya Shah at Lumen Studio (the launch vendor)
// and Marta Ruiz (Finance). The board, inbox, calendar, chat and notes map
// (VaultGraph.jsx DEMO_GRAPH) all refer to the same projects and people;
// change one and check the others still line up. Juan is a sample user,
// never presented as a customer or quoted.

import { getQuadrantCounts, getMiniStatusCounts } from "@/lib/taskUtils";

// Minimal task records — only the fields getQuadrantCounts /
// getMiniStatusCounts read (quadrant, status, is_weekly_focus).
const T = (quadrant, status, focus = false) => ({
  id: Math.random().toString(36).slice(2),
  quadrant,
  status,
  is_weekly_focus: focus,
});

// One fixture project. Keeps its raw `tasks` (what the real TaskStatistics
// bar reads) alongside the ProjectMiniStats props, derived the same way
// ProjectCard.jsx derives them. `risks`/`questions` are the note texts, in
// the real useProjectNotes shape, so the flags and their hover text behave
// exactly as they do in-app.
let seq = 0;
function project(title, tasks, { risks = [], questions = [] } = {}) {
  const quadrants = getQuadrantCounts(tasks, []);
  const miniStats = getMiniStatusCounts(tasks);
  const miniTotal = miniStats.reduce((s, c) => s + c.count, 0);
  const riskNotes = risks.map((content) => ({ type: "RISK", content }));
  const questionNotes = questions.map((content) => ({ type: "QUESTION", content }));
  return {
    id: `demo-project-${++seq}`,
    title,
    tasks,
    quadrants,
    miniStats,
    miniTotal,
    riskNotes,
    questionNotes,
  };
}

// A fixture area/product entity in the shape the real card shells read:
// `display_on_card_fields` empty (so the real CardCustomFields renders
// nothing, same as an entity with no card fields), `custom_data` empty.
function entity(id, description) {
  return { id, description, display_on_card_fields: [], custom_data: {} };
}

const MARKETING = {
  ...entity("demo-product-marketing", "Launches, brand, and the site"),
  name: "Marketing",
  projects: [
    project("Website relaunch", [T(1, "IN_PROGRESS", true), T(1, "NOT_STARTED"), T(2, "IN_PROGRESS"), T(2, "DONE"), T(3, "DONE"), T(4, "NOT_STARTED"), T(4, "DONE")], {
      risks: ["Dana's final QA pass could push the launch past Nov 14"],
    }),
    project("Brand refresh", [T(2, "NOT_STARTED"), T(2, "IN_PROGRESS"), T(3, "NOT_STARTED"), T(4, "DONE")]),
  ],
};
const PLATFORM = {
  ...entity("demo-product-platform", "The Harbor app and its APIs"),
  name: "Platform",
  projects: [
    project("Auth rework", [T(1, "BLOCKED"), T(1, "IN_PROGRESS", true), T(2, "IN_PROGRESS"), T(3, "DONE"), T(4, "NOT_STARTED"), T(4, "DONE")], {
      questions: ["Do staff accounts get passkeys too, or only customers?", "Who signs off on keeping SMS codes as a fallback?"],
    }),
    project("API v2", [T(1, "NOT_STARTED"), T(1, "IN_PROGRESS"), T(2, "NOT_STARTED"), T(4, "DONE"), T(4, "NOT_STARTED"), T(4, "NOT_STARTED")]),
  ],
};
const OPS = {
  ...entity("demo-product-ops", "Vendors, onboarding, and internal process"),
  name: "Ops",
  projects: [
    project("Onboarding refresh", [T(1, "DONE"), T(2, "DONE"), T(2, "IN_PROGRESS"), T(3, "DONE"), T(4, "DONE")]),
    project("Vendor review", [T(1, "NOT_STARTED", true), T(2, "NOT_STARTED"), T(4, "NOT_STARTED")], {
      risks: ["Lumen Studio's first quote came in over budget"],
      questions: ["Can Marta approve the revised quote before Friday?"],
    }),
  ],
};

const ADDED = project("Harbor 2.0 launch", [T(2, "NOT_STARTED"), T(1, "NOT_STARTED"), T(3, "NOT_STARTED")]);

export const BOARD = {
  ...entity("demo-area-work", "Everything I'm on the hook for"),
  area: "Work",
  products: [MARKETING, PLATFORM, OPS],
  // The card the assistant adds mid-demo, into Marketing.
  added: ADDED,
};

// All the tasks under one product / the whole area — what the product- and
// area-level TaskStatistics bars read, aggregated the same way the real
// ProductCard / AreaCard aggregate their subtree.
export const tasksOfProduct = (product, includeAdded = false) =>
  [...product.projects, ...(includeAdded && product === MARKETING ? [ADDED] : [])].flatMap((p) => p.tasks);
export const tasksOfBoard = (includeAdded = false) =>
  BOARD.products.flatMap((p) => tasksOfProduct(p, includeAdded));

export const CHAT_PROMPT = "Set up “Harbor 2.0 launch” under Marketing with three tasks";

// The Vaea Chat demo's request. Not CHAT_PROMPT (the hero board's): by
// default only plans that remove something or send a message stop for
// "Yes, do it" (chatActions.js DESTRUCTIVE_ACTIONS), so a confirm card over a
// plain create would show something the app doesn't do. Archiving done tasks
// is gated, and a mixed plan is gated as a whole.
export const CHAT_DEMO_PROMPT = "Clear the finished tasks out of Website relaunch and move it to next Friday";

export const CHAT_MESSAGES = [
  { id: "u1", role: "user", content: CHAT_DEMO_PROMPT },
  {
    id: "a1",
    role: "assistant",
    // A real staged turn's shape (see useChatController.js buildLoggedContent):
    // a dim ```tool-log summary line, then the plain-English reply. The step
    // list itself isn't re-typed here — pending_action.actions below is what
    // ChatMessageList renders as the confirm card, each with its target, so
    // the plan is stated once, not twice. The tool-log line is exactly
    // chatActions.js describePlan() output for these two steps.
    content:
      "```tool-log\nplan · 2 steps across 1 project\n```\n\nThis will archive the 3 finished tasks in Website relaunch and move its due date to next Friday. Archived tasks stay in View Archive if you need them back.",
    pending_action: {
      actions: [
        { action: "ARCHIVE_DONE_TASKS", args: { title: "Website relaunch" } },
        { action: "UPDATE_PROJECT", args: { title: "Website relaunch" } },
      ],
    },
  },
];

// InboxFrame message shape.
const now = Date.now();
export const VMAIL_MESSAGES = [
  { provider: "gmail", id: "m1", unread: true, label: "Gmail", from: "Priya Shah", subject: "Juan, revised quote for the Harbor 2.0 launch", date: new Date(now - 22 * 60000).toISOString() },
  { provider: "outlook", id: "m2", unread: true, label: "Outlook", from: "Dana Kim", subject: "Launch designs, round 2 (4 new)", date: new Date(now - 95 * 60000).toISOString() },
  { provider: "gmail", id: "m3", unread: false, label: "Gmail", from: "Lee Park", subject: "Auth rework: passkeys PR is ready for review", date: new Date(now - 5 * 3600000).toISOString() },
  { provider: "outlook", id: "m4", unread: false, label: "Outlook", from: "Marta Ruiz", subject: "Re: Lumen Studio budget. Send me the revised quote", date: new Date(now - 26 * 3600000).toISOString() },
];

// CalendarView `groups`: [dayKey, items[]] with item.date a real Date.
function day(offset, items) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  const key = d.toISOString().slice(0, 10);
  return [
    key,
    items.map((it, i) => ({
      id: `${key}-${i}`,
      date: new Date(d.getTime() + it.h * 3600000 + (it.m || 0) * 60000),
      title: it.title,
      source: it.source,
      meetLink: it.meet || undefined,
    })),
  ];
}

export const CALENDAR_GROUPS = [
  day(0, [
    { h: 9, title: "Standup", source: "Google", meet: true },
    { h: 13, title: "Design review with Dana: Harbor 2.0 launch", source: "Microsoft 365", meet: true },
    { h: 16, title: "Due: API v2", source: "Vaea" },
  ]),
  day(1, [
    { h: 11, title: "Vendor call: Priya, Lumen Studio", source: "Google", meet: true },
    { h: 14, title: "1:1 with Lee: Auth rework", source: "Google", meet: true },
    { h: 16, title: "Focus block", source: "Google" },
  ]),
  day(3, [{ h: 10, title: "Due: Website relaunch", source: "Vaea" }]),
];

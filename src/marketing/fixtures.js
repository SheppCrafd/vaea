// Fixed sample data for the marketing demos, fed through the app's own real
// derivation functions so the demos render the exact same components with
// the exact same computed shapes the product uses — not hand-drawn
// lookalikes. Nothing here is interactive (see DemoStage) and nothing here
// is persisted.

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
// ProjectCard.jsx derives them. `notes` mirrors the real useProjectNotes
// shape so risk/question flags light up exactly as they do in-app.
let seq = 0;
function project(title, tasks, { risks = 0, questions = 0 } = {}) {
  const quadrants = getQuadrantCounts(tasks, []);
  const miniStats = getMiniStatusCounts(tasks);
  const miniTotal = miniStats.reduce((s, c) => s + c.count, 0);
  const riskNotes = Array.from({ length: risks }, (_, i) => ({ type: "RISK", content: `Risk ${i + 1}` }));
  const questionNotes = Array.from({ length: questions }, (_, i) => ({ type: "QUESTION", content: `Open question ${i + 1}` }));
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
    project("Website relaunch", [T(1, "IN_PROGRESS", true), T(1, "NOT_STARTED"), T(2, "IN_PROGRESS"), T(2, "DONE"), T(3, "DONE"), T(4, "NOT_STARTED"), T(4, "DONE")], { risks: 1 }),
    project("Brand refresh", [T(2, "NOT_STARTED"), T(2, "IN_PROGRESS"), T(3, "NOT_STARTED"), T(4, "DONE")]),
  ],
};
const PLATFORM = {
  ...entity("demo-product-platform", "The app itself and its APIs"),
  name: "Platform",
  projects: [
    project("Auth rework", [T(1, "BLOCKED"), T(1, "IN_PROGRESS", true), T(2, "IN_PROGRESS"), T(3, "DONE"), T(4, "NOT_STARTED"), T(4, "DONE")], { questions: 2 }),
    project("API v2", [T(1, "NOT_STARTED"), T(1, "IN_PROGRESS"), T(2, "NOT_STARTED"), T(4, "DONE"), T(4, "NOT_STARTED"), T(4, "NOT_STARTED")]),
  ],
};
const OPS = {
  ...entity("demo-product-ops", "Vendors, onboarding, and internal process"),
  name: "Ops",
  projects: [
    project("Onboarding refresh", [T(1, "DONE"), T(2, "DONE"), T(2, "IN_PROGRESS"), T(3, "DONE"), T(4, "DONE")]),
    project("Vendor review", [T(1, "NOT_STARTED", true), T(2, "NOT_STARTED"), T(4, "NOT_STARTED")], { risks: 1, questions: 1 }),
  ],
};

const ADDED = project("Q3 launch", [T(2, "NOT_STARTED"), T(1, "NOT_STARTED"), T(3, "NOT_STARTED")]);

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

export const CHAT_PROMPT = "Set up “Q3 launch” under Marketing with three tasks";

export const CHAT_MESSAGES = [
  { id: "u1", role: "user", content: CHAT_PROMPT },
  {
    id: "a1",
    role: "assistant",
    // A real staged turn's shape (see useChatController.js buildLoggedContent):
    // a dim ```tool-log summary line, then the plain-English reply. The step
    // list itself isn't re-typed here — pending_action.actions below is what
    // ChatMessageList renders as the confirm card, each with its target, so
    // the plan is stated once, not twice. The tool-log line is exactly
    // chatActions.js describePlan() output for 1 project + 3 tasks.
    content:
      "```tool-log\nplan · 4 steps across 1 project, 3 tasks\n```\n\nHere's a Q3 launch project mapped out under Marketing, with the three tasks you asked for. Nothing's been created yet — look it over and approve.",
    pending_action: {
      actions: [
        { action: "CREATE_PROJECT", args: { title: "Q3 launch" } },
        { action: "CREATE_TASK", args: { title: "Draft the announcement" } },
        { action: "CREATE_TASK", args: { title: "Brief the design review" } },
        { action: "CREATE_TASK", args: { title: "Schedule the send" } },
      ],
    },
  },
];

// InboxFrame message shape.
const now = Date.now();
export const VMAIL_MESSAGES = [
  { provider: "gmail", id: "m1", unread: true, label: "Gmail", from: "Priya (vendor)", subject: "Re: Q3 launch quote — revised", date: new Date(now - 22 * 60000).toISOString() },
  { provider: "outlook", id: "m2", unread: true, label: "Outlook", from: "Design review", subject: "Launch thread (4 new)", date: new Date(now - 95 * 60000).toISOString() },
  { provider: "gmail", id: "m3", unread: false, label: "Gmail", from: "Weekly report", subject: "Portfolio status — week of the 24th", date: new Date(now - 5 * 3600000).toISOString() },
  { provider: "outlook", id: "m4", unread: false, label: "Outlook", from: "Finance", subject: "PO approved", date: new Date(now - 26 * 3600000).toISOString() },
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
    { h: 13, title: "Design review — Q3 launch", source: "Microsoft 365", meet: true },
    { h: 16, title: "Due: API v2", source: "Vaea" },
  ]),
  day(1, [
    { h: 11, title: "Vendor call — Priya", source: "Google", meet: true },
    { h: 15, title: "Focus block", source: "Google" },
  ]),
  day(3, [{ h: 10, title: "Due: Website relaunch", source: "Vaea" }]),
];

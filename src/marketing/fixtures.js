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

// Real project -> the props ProjectMiniStats expects, built the same way
// ProjectCard.jsx builds them.
function project(title, tasks, { risks = 0, questions = 0 } = {}) {
  const quadrants = getQuadrantCounts(tasks, []);
  const miniStats = getMiniStatusCounts(tasks);
  const miniTotal = miniStats.reduce((s, c) => s + c.count, 0);
  return {
    title,
    quadrants,
    miniStats,
    miniTotal,
    riskNotes: Array.from({ length: risks }, (_, i) => ({ content: `Risk ${i + 1}` })),
    questionNotes: Array.from({ length: questions }, (_, i) => ({ content: `Open question ${i + 1}` })),
  };
}

export const BOARD = {
  area: "Work",
  products: [
    {
      name: "Marketing",
      projects: [
        project("Website relaunch", [T(1, "IN_PROGRESS", true), T(1, "NOT_STARTED"), T(2, "IN_PROGRESS"), T(2, "DONE"), T(3, "DONE"), T(4, "NOT_STARTED"), T(4, "DONE")], { risks: 1 }),
        project("Brand refresh", [T(2, "NOT_STARTED"), T(2, "IN_PROGRESS"), T(3, "NOT_STARTED"), T(4, "DONE")]),
      ],
    },
    {
      name: "Platform",
      projects: [
        project("Auth rework", [T(1, "BLOCKED"), T(1, "IN_PROGRESS", true), T(2, "IN_PROGRESS"), T(3, "DONE"), T(4, "NOT_STARTED"), T(4, "DONE")], { questions: 2 }),
        project("API v2", [T(1, "NOT_STARTED"), T(1, "IN_PROGRESS"), T(2, "NOT_STARTED"), T(4, "DONE"), T(4, "NOT_STARTED"), T(4, "NOT_STARTED")]),
      ],
    },
    {
      name: "Ops",
      projects: [
        project("Onboarding refresh", [T(1, "DONE"), T(2, "DONE"), T(2, "IN_PROGRESS"), T(3, "DONE"), T(4, "DONE")]),
        project("Vendor review", [T(1, "NOT_STARTED", true), T(2, "NOT_STARTED"), T(4, "NOT_STARTED")], { risks: 1, questions: 1 }),
      ],
    },
  ],
  // The card the assistant adds mid-demo, into Marketing.
  added: project("Q3 launch", [T(2, "NOT_STARTED"), T(1, "NOT_STARTED"), T(3, "NOT_STARTED")]),
};

export const CHAT_PROMPT = "Set up “Q3 launch” under Marketing with three tasks";

export const CHAT_MESSAGES = [
  { id: "u1", role: "user", content: CHAT_PROMPT },
  {
    id: "a1",
    role: "assistant",
    content:
      "plan · read Marketing, 1 project\n\nHere's what I'll do — nothing runs until you approve:\n\n- **Create project** “Q3 launch” in Marketing\n- **Add task** Draft the announcement · quadrant 2\n- **Add task** Brief the design review · quadrant 1\n- **Add task** Schedule the send · quadrant 3",
    // Shape must match a real staged turn: ChatMessageList reads
    // pending_action.actions and lists each one in the confirm card.
    pending_action: {
      actions: [
        { action: "CREATE_PROJECT" },
        { action: "CREATE_TASK" },
        { action: "CREATE_TASK" },
        { action: "CREATE_TASK" },
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

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { describePlan } from "@/lib/chatActions";
import { toMinutes } from "./components/storyTime";
import { CHAT_MESSAGES, BRIEF_MESSAGES, CALENDAR_GROUPS } from "./fixtures";

// The pages and story.jsx touch `window` at import, so their times are
// read from the source instead.
const source = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const timesIn = (text) => [...text.matchAll(/time[=:]\s*"(\d{1,2}:\d{2} [AP]M)"/g)].map((m) => toMinutes(m[1]));
const PAGES = ["Home", "VaeaChat", "Workplace", "Brain"];

const toolLog = (content) => content.match(/```tool-log\n([\s\S]*?)\n```/)?.[1].split("\n") ?? [];

describe("marketing fixtures", () => {
  it("the plan demo's tool-log line is what the app writes for that plan", () => {
    const reply = CHAT_MESSAGES[1];
    expect(toolLog(reply.content)[0]).toBe(describePlan(reply.pending_action.actions));
  });

  it("the brief only reads, so it carries no plan and no confirm card", () => {
    const reply = BRIEF_MESSAGES[1];
    expect(reply.pending_action).toBeUndefined();
    expect(toolLog(reply.content).some((l) => l.startsWith("plan ·"))).toBe(false);
    expect(BRIEF_MESSAGES[0].content).toBe("/daily-brief");
  });

  it("Bob's day runs from 9:00 to 5:00, in order", () => {
    const chapters = timesIn(source("./components/story.jsx"));
    expect(chapters).toHaveLength(PAGES.length);
    expect(chapters[0]).toBe(9 * 60);
    expect([...chapters].sort((a, b) => a - b)).toEqual(chapters);

    const all = [];
    for (const page of PAGES) {
      const times = timesIn(source(`./pages/${page}.jsx`));
      expect(times.length, page).toBeGreaterThan(2);
      // Beats run in page order: the timeline reads them top to bottom.
      expect([...times].sort((a, b) => a - b), page).toEqual(times);
      all.push(...times);
    }
    expect(Math.min(...all)).toBe(9 * 60);
    expect(Math.max(...all)).toBe(17 * 60);
  });

  it("today's agenda sits inside the working day", () => {
    const [, today] = CALENDAR_GROUPS[0];
    for (const item of today.filter((i) => i.source !== "Vaea project")) {
      const h = item.date.getHours() + item.date.getMinutes() / 60;
      expect(h).toBeGreaterThanOrEqual(9);
      expect(h).toBeLessThan(17);
    }
  });
});

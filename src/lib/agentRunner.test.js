import { describe, expect, it } from "vitest";
import { buildAgentInstruction, getDueAgents } from "./agentRunner.js";

describe("buildAgentInstruction", () => {
  it("includes the agent's name and purpose", () => {
    const text = buildAgentInstruction({ name: "Risk Watcher", purpose: "Flag at-risk projects" });
    expect(text).toContain("Risk Watcher");
    expect(text).toContain("Flag at-risk projects");
  });

  it("falls back to a plain note when purpose is empty", () => {
    const text = buildAgentInstruction({ name: "Untitled", purpose: "" });
    expect(text).toContain("no purpose set");
  });

  it("frames a cadence-triggered run differently from a manual one", () => {
    const auto = buildAgentInstruction({ name: "A", purpose: "p", cadenceHours: 24 });
    const manual = buildAgentInstruction({ name: "A", purpose: "p" });
    expect(auto).toContain("automatically on its own schedule");
    expect(manual).toContain("on request");
  });
});

describe("getDueAgents", () => {
  const HOUR = 60 * 60 * 1000;
  const now = Date.now();

  it("excludes agents with no cadence set", () => {
    expect(getDueAgents([{ id: "1", cadenceHours: null, lastRunAt: null }], now)).toEqual([]);
    expect(getDueAgents([{ id: "1", lastRunAt: null }], now)).toEqual([]);
  });

  it("includes a cadenced agent that has never run", () => {
    const agent = { id: "1", cadenceHours: 6, lastRunAt: null };
    expect(getDueAgents([agent], now)).toEqual([agent]);
  });

  it("includes a cadenced agent past its interval, excludes one within it", () => {
    const overdue = { id: "1", cadenceHours: 6, lastRunAt: new Date(now - 7 * HOUR).toISOString() };
    const fresh = { id: "2", cadenceHours: 6, lastRunAt: new Date(now - 1 * HOUR).toISOString() };
    expect(getDueAgents([overdue, fresh], now)).toEqual([overdue]);
  });

  it("handles an empty/undefined agent list", () => {
    expect(getDueAgents([], now)).toEqual([]);
    expect(getDueAgents(undefined, now)).toEqual([]);
  });
});

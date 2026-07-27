import { describe, it, expect } from "vitest";
import { splitToolLogPrefix, detailForLogLine } from "./ChatMessageList.jsx";

describe("splitToolLogPrefix", () => {
  it("splits a leading tool-log fence from the reply that follows it", () => {
    const content = '```tool-log\nsearch_workspace("q") — 1 match\nplan · 2 steps across 2 areas\ncreate_area("A")\ncreate_area("B")\n```\n\nAdding two Areas.';
    const { prefix, reply } = splitToolLogPrefix(content);
    expect(prefix).toBe('```tool-log\nsearch_workspace("q") — 1 match\nplan · 2 steps across 2 areas\ncreate_area("A")\ncreate_area("B")\n```\n\n');
    expect(reply).toBe("Adding two Areas.");
  });

  it("leaves a plain reply with no fence untouched", () => {
    const { prefix, reply } = splitToolLogPrefix("Just a plain reply, nothing ran.");
    expect(prefix).toBe("");
    expect(reply).toBe("Just a plain reply, nothing ran.");
  });
});

describe("detailForLogLine", () => {
  const toolLogDetail = {
    liveTrace: [{ label: 'search_workspace("q")', detail: { count: 1 } }],
    plan: { action: "CREATE_AREA" },
    steps: [{ action: "CREATE_AREA", toolResult: { area: { title: "A" } } }],
  };

  it("maps a live-trace line to its own detail", () => {
    expect(detailForLogLine(toolLogDetail, 0)).toEqual({ count: 1 });
  });

  it("maps the line right after live-trace lines to the plan", () => {
    expect(detailForLogLine(toolLogDetail, 1)).toBe(toolLogDetail.plan);
  });

  it("maps later lines to their own executed step", () => {
    expect(detailForLogLine(toolLogDetail, 2)).toBe(toolLogDetail.steps[0]);
  });

  it("works with no live trace at all (plan is line 0)", () => {
    const detail = { plan: { action: "CREATE_AREA" }, steps: [{ action: "CREATE_AREA" }] };
    expect(detailForLogLine(detail, 0)).toBe(detail.plan);
    expect(detailForLogLine(detail, 1)).toBe(detail.steps[0]);
  });
});

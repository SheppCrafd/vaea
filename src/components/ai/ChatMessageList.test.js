import { describe, it, expect } from "vitest";
import { splitToolLogSuffix, detailForLogLine } from "./ChatMessageList.jsx";

describe("splitToolLogSuffix", () => {
  it("splits the reply from a trailing tool-log fence", () => {
    const content = 'Adding two Areas.\n\n```tool-log\nsearch_workspace("q") — 1 match\nplan · 2 steps across 2 areas\ncreate_area("A")\ncreate_area("B")\n```';
    const { reply, suffix } = splitToolLogSuffix(content);
    expect(reply).toBe("Adding two Areas.");
    expect(suffix).toBe('\n\n```tool-log\nsearch_workspace("q") — 1 match\nplan · 2 steps across 2 areas\ncreate_area("A")\ncreate_area("B")\n```');
  });

  it("leaves a plain reply with no fence untouched", () => {
    const { reply, suffix } = splitToolLogSuffix("Just a plain reply, nothing ran.");
    expect(reply).toBe("Just a plain reply, nothing ran.");
    expect(suffix).toBe("");
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

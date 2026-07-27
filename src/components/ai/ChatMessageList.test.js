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
    plan: [{ action: "CREATE_AREA" }],
    reply: "I'll add that area for you.",
    steps: [{ action: "CREATE_AREA", toolResult: { area: { title: "A" } } }],
  };

  it("maps a live-trace line to its own detail", () => {
    expect(detailForLogLine(toolLogDetail, 0)).toEqual({ count: 1 });
  });

  it("maps the line right after live-trace lines to {reply, actions} — the plan line's natural-language detail", () => {
    expect(detailForLogLine(toolLogDetail, 1)).toEqual({ reply: toolLogDetail.reply, actions: toolLogDetail.plan });
  });

  it("maps later lines to their own executed step", () => {
    expect(detailForLogLine(toolLogDetail, 2)).toBe(toolLogDetail.steps[0]);
  });

  it("works with no live trace at all (plan is line 0)", () => {
    const detail = { plan: [{ action: "CREATE_AREA" }], reply: "Done.", steps: [{ action: "CREATE_AREA" }] };
    expect(detailForLogLine(detail, 0)).toEqual({ reply: detail.reply, actions: detail.plan });
    expect(detailForLogLine(detail, 1)).toBe(detail.steps[0]);
  });

  it("still returns {reply: undefined, actions: undefined} for a message persisted before tool_log_detail carried them", () => {
    expect(detailForLogLine(undefined, 0)).toEqual({ reply: undefined, actions: undefined });
  });
});

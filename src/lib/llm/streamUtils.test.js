import { describe, it, expect } from "vitest";
import { readNdjson, readSse, extractPlan } from "./streamUtils.js";

function streamFromChunks(chunks) {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

describe("readNdjson", () => {
  it("parses one JSON object per line", async () => {
    const response = { body: streamFromChunks(['{"a":1}\n{"a":2}\n']) };
    const lines = [];
    await readNdjson(response, (line) => lines.push(line));
    expect(lines).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it("reassembles a line split across two chunks", async () => {
    const response = { body: streamFromChunks(['{"a":', '1}\n']) };
    const lines = [];
    await readNdjson(response, (line) => lines.push(line));
    expect(lines).toEqual([{ a: 1 }]);
  });

  it("flushes a final line with no trailing newline", async () => {
    const response = { body: streamFromChunks(['{"a":1}']) };
    const lines = [];
    await readNdjson(response, (line) => lines.push(line));
    expect(lines).toEqual([{ a: 1 }]);
  });

  it("skips blank lines", async () => {
    const response = { body: streamFromChunks(['{"a":1}\n\n{"a":2}\n']) };
    const lines = [];
    await readNdjson(response, (line) => lines.push(line));
    expect(lines).toEqual([{ a: 1 }, { a: 2 }]);
  });
});

describe("readSse", () => {
  it("parses data: lines into JSON events", async () => {
    const response = { body: streamFromChunks(['data: {"a":1}\n\ndata: {"a":2}\n\n']) };
    const events = [];
    await readSse(response, (e) => events.push(e));
    expect(events).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it("reassembles an event split across two chunks", async () => {
    const response = { body: streamFromChunks(['data: {"a":', '1}\n\n']) };
    const events = [];
    await readSse(response, (e) => events.push(e));
    expect(events).toEqual([{ a: 1 }]);
  });

  it("ignores non-data fields (event:, id:) within an event", async () => {
    const response = { body: streamFromChunks(['event: message\ndata: {"a":1}\n\n']) };
    const events = [];
    await readSse(response, (e) => events.push(e));
    expect(events).toEqual([{ a: 1 }]);
  });

  it("swallows a [DONE] sentinel instead of parsing it as JSON", async () => {
    const response = { body: streamFromChunks(['data: {"a":1}\n\ndata: [DONE]\n\n']) };
    const events = [];
    await readSse(response, (e) => events.push(e));
    expect(events).toEqual([{ a: 1 }]);
  });

  it("flushes a final event with no trailing blank line", async () => {
    const response = { body: streamFromChunks(['data: {"a":1}']) };
    const events = [];
    await readSse(response, (e) => events.push(e));
    expect(events).toEqual([{ a: 1 }]);
  });
});

describe("extractPlan", () => {
  it("returns the text unchanged with a null plan when there's no <plan> tag", () => {
    expect(extractPlan("Just a normal reply.")).toEqual({ text: "Just a normal reply.", plan: null });
  });

  it("pulls the plan block out and trims the surrounding text", () => {
    const result = extractPlan("Before.\n\n<plan>Step one. Step two.</plan>\n\nAfter.");
    expect(result).toEqual({ text: "Before.\n\nAfter.", plan: "Step one. Step two." });
  });

  it("is case-insensitive and matches across newlines", () => {
    const result = extractPlan("<PLAN>\nline one\nline two\n</PLAN>\nreply text");
    expect(result).toEqual({ text: "reply text", plan: "line one\nline two" });
  });

  it("collapses to an empty string when the whole message is the plan tag", () => {
    expect(extractPlan("<plan>only a plan</plan>")).toEqual({ text: "", plan: "only a plan" });
  });

  it("handles null/undefined input the same as empty text", () => {
    expect(extractPlan(null)).toEqual({ text: "", plan: null });
    expect(extractPlan(undefined)).toEqual({ text: "", plan: null });
  });
});

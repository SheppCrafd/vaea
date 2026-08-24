import { describe, it, expect } from "vitest";
import { readNdjson, readSse, extractResponse, stripLiveResponsePreview } from "./streamUtils.js";

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

describe("extractResponse", () => {
  it("pulls the response block's content out and trims it", () => {
    expect(extractResponse("<response>Here's the answer.</response>")).toBe("Here's the answer.");
  });

  it("is case-insensitive and matches across newlines", () => {
    expect(extractResponse("<RESPONSE>\nline one\nline two\n</RESPONSE>")).toBe("line one\nline two");
  });

  it("falls back to the raw trimmed text when the tag is missing entirely", () => {
    expect(extractResponse("Just a normal reply, no tag.")).toBe("Just a normal reply, no tag.");
  });

  it("handles null/undefined input the same as empty text", () => {
    expect(extractResponse(null)).toBe("");
    expect(extractResponse(undefined)).toBe("");
  });
});

describe("stripLiveResponsePreview", () => {
  it("strips the tag markup while keeping the content, closed or not", () => {
    expect(stripLiveResponsePreview("<response>Here's the ans")).toBe("Here's the ans");
    expect(stripLiveResponsePreview("<response>Here's the answer.</response>")).toBe("Here's the answer.");
  });

  it("leaves untagged text untouched", () => {
    expect(stripLiveResponsePreview("Still typing")).toBe("Still typing");
  });

  it("handles null/undefined input the same as empty text", () => {
    expect(stripLiveResponsePreview(null)).toBe("");
    expect(stripLiveResponsePreview(undefined)).toBe("");
  });
});

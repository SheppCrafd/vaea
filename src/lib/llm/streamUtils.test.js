import { describe, it, expect } from "vitest";
import { readNdjson, readSse } from "./streamUtils.js";

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

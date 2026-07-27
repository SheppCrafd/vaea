// Two small transport-parsing helpers shared by every streaming consumer of
// a fetch() Response — the base44-hosted chat stream (readNdjson, our own
// wire format, one JSON object per line, since we control both ends) and
// both BYOK adapters (readSse, the providers' own real Server-Sent Events
// wire format). Neither provider guarantees a chunk boundary lines up with a
// line/event boundary, so both buffer partial data across reads.

// One JSON object per line, newline-delimited. Used for
// base44/functions/aiChatStream/entry.ts's own streaming response.
export async function readNdjson(response, onLine) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (line.trim()) onLine(JSON.parse(line));
    }
  }
  if (buffer.trim()) onLine(JSON.parse(buffer));
}

// Real Server-Sent Events framing: events are separated by a blank line,
// each made of one or more "field: value" lines. Only "data:" is used by
// either provider here, so every other field is ignored. A "data: [DONE]"
// sentinel (OpenAI's own end-of-stream marker) is swallowed rather than
// JSON.parse'd. Multiple "data:" lines within one event are joined with
// "\n" per the SSE spec, though neither provider in this codebase sends more
// than one per event today.
export async function readSse(response, onEvent) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  function flushEvent(rawEvent) {
    const dataLines = rawEvent
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart());
    if (!dataLines.length) return;
    const data = dataLines.join("\n");
    if (data === "[DONE]") return;
    onEvent(JSON.parse(data));
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const rawEvent = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      if (rawEvent.trim()) flushEvent(rawEvent);
    }
  }
  if (buffer.trim()) flushEvent(buffer);
}

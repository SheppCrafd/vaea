// Two small transport-parsing helpers shared by every streaming consumer of
// a fetch() Response — the base44-hosted chat stream (readNdjson, our own
// wire format, one JSON object per line, since we control both ends) and
// both BYOK adapters (readSse, the providers' own real Server-Sent Events
// wire format). Neither provider guarantees a chunk boundary lines up with a
// line/event boundary, so both buffer partial data across reads.

// A private, non-printable sentinel injected into the client's own
// `streamingText` accumulator (useChatController.js's onEvent) every time a
// "round-boundary" event arrives — the one unambiguous signal that a
// tool-loop round genuinely ended, as opposed to a blank line the model's
// own prose can legitimately contain. ChatMessageList.jsx splits its live
// preview on this instead of "\n\n" so a real multi-paragraph answer isn't
// mistaken for multiple rounds mid-stream. U+E000 is in the Unicode Private
// Use Area — never produced by a real model's text.
export const ROUND_BOUNDARY_MARKER = "";

// Pulls the model's real reply out of a `<response>...</response>` block
// (see the RESPONSE FORMAT instruction in systemPrompt.js / entry.ts) — the
// model's entire final-round output is required to be wrapped in this tag,
// full stop; nothing else it writes outside a tool call is ever shown. A
// `<plan>` block is never written by the model itself anymore (see
// planMicroAgents.js/entry.ts's own micro-agent calls, which generate that
// separately once the real tool-call plan is known) — this only ever pulls
// out `<response>`.
// Case-insensitive and tolerant of whitespace inside the tags; matches
// across newlines since the block is prose, not one line. Falls back to the
// raw trimmed text when the tag is missing entirely (a model formatting
// slip) rather than showing a blank reply — the contract is enforced by the
// system prompt, not by silently dropping a real answer the model forgot to
// wrap.
const RESPONSE_TAG_RE = /<response>([\s\S]*?)<\/response>/i;
export function extractResponse(text) {
  const match = (text || "").match(RESPONSE_TAG_RE);
  if (match) return match[1].trim();
  return (text || "").trim();
}

// For the LIVE streaming preview only (ChatMessageList.jsx's `streamingText`
// render) — strips the `<response>`/`</response>` tag markup itself out of
// text that's still arriving, without hiding the content between them (that
// content IS the reply, unlike the old `<plan>` block which was never meant
// to appear in the chat bubble at all). An unclosed opening tag mid-stream
// just has its own characters dropped; everything after it still shows,
// growing live the same as any other streamed text.
const RESPONSE_TAG_ONLY_RE = /<\/?response\b[^>]*>/gi;
export function stripLiveResponsePreview(text) {
  return (text || "").replace(RESPONSE_TAG_ONLY_RE, "");
}

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

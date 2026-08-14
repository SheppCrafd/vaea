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

// Pulls a `<plan>...</plan>` block (see the PLAN TAG instruction in
// systemPrompt.js / entry.ts) out of one round's raw text. The model is told
// to wrap its step-by-step narration in these tags for any turn with more
// than 5 tool-call actions, so that narration can be shown verbatim as the
// plan-detail modal's content (ChatToolLogDetail.jsx's PlanReasoning)
// instead of being guessed from whichever round happened to have text —
// the guess degenerates to "identical to the reply" for a single-round turn,
// a real bug a user hit ("clicking the plan thing just is the response").
// Case-insensitive and tolerant of whitespace inside the tags; matches
// across newlines since the block is prose, not one line. Returns the
// surrounding text with the tag (and its content) removed and trimmed, plus
// the tag's inner content, or `null` if this round had no plan tag at all —
// most rounds won't, and that's fine, existing reasoning/reply behavior
// covers the rest.
const PLAN_TAG_RE = /<plan>([\s\S]*?)<\/plan>/i;
export function extractPlan(text) {
  const match = (text || "").match(PLAN_TAG_RE);
  if (!match) return { text: text || "", plan: null };
  return {
    text: (text.slice(0, match.index) + text.slice(match.index + match[0].length)).replace(/\n{3,}/g, "\n\n").trim(),
    plan: match[1].trim(),
  };
}

// For the LIVE streaming preview only (ChatMessageList.jsx's `streamingText`
// render) — extractPlan above only handles a *complete* `<plan>...</plan>`
// pair, which is exactly right once a round has finished, but mid-stream the
// opening tag can already have arrived with its closing tag not yet in.
// Rather than flash the raw `<plan>` characters (and everything typed after
// it) on screen for however many words it takes the closing tag to arrive,
// this also truncates right before an as-yet-unclosed opening tag. This is
// the same category of accepted streaming trade-off ChatMessageList.jsx's
// own comment already documents for an unclosed "**" — the plan content
// itself simply doesn't appear live; it shows up like any other completed
// round once the closing tag lands and extractPlan takes over for good.
const OPEN_PLAN_TAG_RE = /<plan\b[^>]*>?/i;
export function stripLivePlanPreview(text) {
  const { text: withoutClosed } = extractPlan(text);
  const openMatch = withoutClosed.match(OPEN_PLAN_TAG_RE);
  return openMatch ? withoutClosed.slice(0, openMatch.index).trimEnd() : withoutClosed;
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

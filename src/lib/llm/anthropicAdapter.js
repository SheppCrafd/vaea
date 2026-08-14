// Direct browser -> Anthropic Messages API, no server in between — the
// user's own key never leaves their machine except to Anthropic itself.
// `anthropic-dangerous-direct-browser-access` is Anthropic's own required
// opt-in header for this (the API blocks browser-origin calls by default,
// as a warning to anyone building a real product that a client-exposed key
// is generally unsafe — but that's exactly the trade a BYOK local-first
// tool like this one is making deliberately, same as this app's local-only
// GitHub vault token).
import { readSse, extractPlan } from "@/lib/llm/streamUtils";

const MAX_TOOL_ROUNDS = 15;

// Anthropic's own hosted, server-executed web search — declared here (not
// in toolCatalog.js, which is only ever the client-executed/staged JSON
// schema every provider shares) since it's Anthropic-specific and the
// server runs it itself: no tool_use block for the model to call and no
// runTool dispatch on our end at all, unlike every other tool in this
// codebase. Confidence: documented, but unverified against a live key in
// this environment — if Anthropic's own wire shape for this has moved on
// since, the defensive block handling in streamOnce below is what keeps an
// unrecognized block from crashing the turn rather than this exact shape
// being load-bearing.
const ANTHROPIC_WEB_SEARCH_TOOL = { type: "web_search_20250305", name: "web_search", max_uses: 5 };

// Streams one round via `stream: true` + Anthropic's own SSE format
// (message_start/content_block_start/content_block_delta/content_block_stop/
// message_stop — see https://docs.anthropic.com/en/api/messages-streaming),
// reconstructing the exact same `{content: [...]}` shape the old blocking
// (non-streamed) response body had — every text block's `text` accumulated
// from its own text_delta events, every tool_use block's `input`
// reconstructed by JSON.parsing its accumulated input_json_delta fragments
// once its content_block_stop arrives. Reconstructing that same shape (not
// a new one) is deliberate: every line below this function — the tool-call
// loop, the round-text join, the message history — never needed to change,
// only *how* one round's response is obtained did. `onEvent`, if provided,
// fires live as each text_delta actually arrives.
async function streamOnce({ apiKey, model, systemPrompt, messages, tools, onEvent }) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({ model, max_tokens: 4096, system: systemPrompt, messages, tools: [...tools, ANTHROPIC_WEB_SEARCH_TOOL], stream: true }),
  });
  if (!res.ok) {
    // A non-2xx response is a normal (non-streamed) JSON error body, same
    // as before streaming — Anthropic only ever switches to SSE framing
    // once it's committed to a 200.
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || `Anthropic API error (${res.status}).`);
  }

  const blocks = [];
  let streamError = null;
  await readSse(res, (event) => {
    if (event.type === "content_block_start") {
      const block = event.content_block;
      if (block.type === "tool_use") {
        blocks[event.index] = { type: "tool_use", id: block.id, name: block.name, jsonParts: [] };
      } else if (block.type === "text") {
        blocks[event.index] = { type: "text", text: "" };
      } else {
        // web_search_20250305 runs entirely server-side — its own
        // "server_tool_use" (streams like tool_use, via input_json_delta)
        // and "web_search_tool_result" (arrives whole, no delta) block
        // types are neither ours to execute nor to narrate as our own
        // text. Passed through completely as-received (jsonParts kept in
        // case it streams like tool_use) so the API's own multi-turn
        // history stays coherent, without this code needing to understand
        // every field of a shape it never has to act on. Never picked up by
        // the tool_use filter below, so runTool is never called for it.
        blocks[event.index] = { ...block, jsonParts: [] };
      }
    } else if (event.type === "content_block_delta") {
      const block = blocks[event.index];
      if (!block) return;
      if (event.delta.type === "text_delta") {
        block.text += event.delta.text;
        onEvent?.({ type: "thinking-delta", text: event.delta.text });
      } else if (event.delta.type === "input_json_delta") {
        block.jsonParts.push(event.delta.partial_json);
      }
    } else if (event.type === "error") {
      streamError = event.error?.message || "Anthropic stream error.";
    }
  });
  if (streamError) throw new Error(streamError);

  return {
    content: blocks.map((block) => {
      if (block.type === "tool_use") {
        return { type: "tool_use", id: block.id, name: block.name, input: JSON.parse(block.jsonParts.join("") || "{}") };
      }
      if (block.type === "text") {
        return { type: "text", text: block.text };
      }
      const { jsonParts, ...rest } = block;
      return jsonParts.length ? { ...rest, input: JSON.parse(jsonParts.join("") || "{}") } : rest;
    }),
  };
}

// Runs the full plan-then-tools loop for one turn and returns
// {reply, reasoning} — `runTool` (toolRunner.js) is what actually
// stages/executes each call.
export async function callAnthropic({ apiKey, model, systemPrompt, contextPrompt, tools, runTool, onEvent }) {
  const messages = [{ role: "user", content: contextPrompt }];
  // Every round's own text — not just the final round's — is real thinking
  // the model produced as it worked through the request (see THINK OUT LOUD
  // AS YOU GO in systemPrompt.js): "I'll check the workspace first...",
  // then after results come back, "Found two matches, now creating the
  // plan...". Streamed live via onEvent as each round's text actually
  // arrives; also collected here as `thinking` so the caller gets both the
  // full multi-round narrative (`reasoning` — real deliberation, including
  // any self-correction) AND just the last round's own text (`reply` — the
  // actual conversational answer). These used to be collapsed into one
  // string returned as the reply, which is what a real user was pointing at
  // saying "the plan is VERBATIM the text in chat" — the chat bubble and
  // the plan-detail modal literally showed the identical string, since both
  // read from the same joined blob.
  //
  // `reply` is the LAST round's own text, taken whole — no further
  // paragraph-splitting inside it. An earlier version tried to guess "the
  // real answer" by taking only the final blank-line-separated paragraph of
  // the full multi-round narrative, on the theory that a model often writes
  // build-up narration and its actual conclusion in the very same round with
  // no tool call forcing them apart. That heuristic can't tell a throwaway
  // build-up sentence from a genuine multi-paragraph answer — they're the
  // same shape — so it kept silently truncating real multi-paragraph replies
  // (a bug/architecture explanation, a comparison of two approaches) down to
  // their last paragraph. The fix is a real, unambiguous signal instead of a
  // guess: only the LAST round is ever "the reply" (every earlier round, by
  // definition, made at least one tool call — see the loop below — so it was
  // narration, not the final answer), and once inside that last round, ALL
  // of its text belongs to the reply, however many paragraphs it takes.
  // onEvent's "round-boundary" event (fired below, right before a new round
  // starts) is what lets the client draw the same line live while streaming
  // — see ChatMessageList.jsx.
  const thinking = [];
  // Any round can wrap part of its own text in <plan>...</plan> (see the
  // PLAN TAG instruction in systemPrompt.js/entry.ts, required once a turn
  // has more than 5 actions) — collected across every round the same way
  // `thinking` is, and preferred over it wholesale as the plan-detail
  // modal's content when present, since it's the model's own deliberate
  // "this is the plan" framing rather than a guess stitched from whichever
  // rounds happened to have text. `<plan>` itself is always stripped from
  // what actually reaches `thinking`/`reply` — it's never meant to be seen
  // in the chat bubble.
  const planParts = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await streamOnce({ apiKey, model, systemPrompt, messages, tools, onEvent });
    const content = response.content || [];
    const toolUseBlocks = content.filter((block) => block.type === "tool_use");
    const rawRoundText = content.filter((block) => block.type === "text").map((block) => block.text).join("\n").trim();
    const { text: roundText, plan } = extractPlan(rawRoundText);
    if (plan) planParts.push(plan);
    if (roundText) thinking.push(roundText);

    if (toolUseBlocks.length === 0) {
      return {
        reply: roundText || "I couldn't come up with a reply — could you rephrase?",
        reasoning: planParts.length ? planParts.join("\n\n") : thinking.join("\n\n"),
      };
    }

    onEvent?.({ type: "round-boundary" });
    messages.push({ role: "assistant", content });
    // Sequential, not Promise.all — runTool is async now (vault tools,
    // read_project_link, analyze_attachment all make real network calls),
    // and running them one at a time matches executeActionSequence's own
    // sequential model elsewhere in this codebase rather than introducing
    // a new concurrent-tool-calls code path this app has never had.
    const toolResults = [];
    for (const block of toolUseBlocks) {
      const result = await runTool(block.name, block.input);
      // analyze_attachment's image case: Anthropic's tool_result content can
      // itself be a content array, so the actual image rides along as a
      // real image block right here — the model genuinely SEES it next
      // round, not just a text description of it. image_base64 is stripped
      // from the JSON text half so it isn't duplicated (and so the model
      // isn't asked to read pixels as a giant base64 string).
      const { image_base64, media_type, ...rest } = result || {};
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: image_base64
          ? [
              { type: "text", text: JSON.stringify(rest) },
              { type: "image", source: { type: "base64", media_type, data: image_base64 } },
            ]
          : JSON.stringify(result),
      });
    }
    messages.push({ role: "user", content: toolResults });
  }

  throw new Error(`Gave up after ${MAX_TOOL_ROUNDS} tool-call rounds without a final reply.`);
}

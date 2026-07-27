// Direct browser -> Anthropic Messages API, no server in between — the
// user's own key never leaves their machine except to Anthropic itself.
// `anthropic-dangerous-direct-browser-access` is Anthropic's own required
// opt-in header for this (the API blocks browser-origin calls by default,
// as a warning to anyone building a real product that a client-exposed key
// is generally unsafe — but that's exactly the trade a BYOK local-first
// tool like this one is making deliberately, same as this app's local-only
// GitHub vault token).
import { readSse } from "@/lib/llm/streamUtils";

const MAX_TOOL_ROUNDS = 15;

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
    body: JSON.stringify({ model, max_tokens: 4096, system: systemPrompt, messages, tools, stream: true }),
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
      blocks[event.index] = block.type === "tool_use"
        ? { type: "tool_use", id: block.id, name: block.name, jsonParts: [] }
        : { type: "text", text: "" };
    } else if (event.type === "content_block_delta") {
      const block = blocks[event.index];
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
    content: blocks.map((block) => block.type === "tool_use"
      ? { type: "tool_use", id: block.id, name: block.name, input: JSON.parse(block.jsonParts.join("") || "{}") }
      : { type: "text", text: block.text }),
  };
}

// Runs the full plan-then-tools loop for one turn and returns the final
// reply text — `runTool` (toolRunner.js) is what actually stages/executes
// each call.
export async function callAnthropic({ apiKey, model, systemPrompt, contextPrompt, tools, runTool, onEvent }) {
  const messages = [{ role: "user", content: contextPrompt }];
  // Every round's own text — not just the final round's — is real thinking
  // the model produced as it worked through the request (see THINK OUT LOUD
  // AS YOU GO in systemPrompt.js): "I'll check the workspace first...",
  // then after results come back, "Found two matches, now creating the
  // plan...". Discarding every round but the last one was throwing that
  // away entirely. Now streamed live via onEvent as each round's text
  // actually arrives, not just collected here for the final joined string.
  const thinking = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await streamOnce({ apiKey, model, systemPrompt, messages, tools, onEvent });
    const content = response.content || [];
    const toolUseBlocks = content.filter((block) => block.type === "tool_use");
    const roundText = content.filter((block) => block.type === "text").map((block) => block.text).join("\n").trim();
    if (roundText) thinking.push(roundText);

    if (toolUseBlocks.length === 0) {
      return thinking.join("\n\n") || "I couldn't come up with a reply — could you rephrase?";
    }

    messages.push({ role: "assistant", content });
    const toolResults = toolUseBlocks.map((block) => ({
      type: "tool_result",
      tool_use_id: block.id,
      content: JSON.stringify(runTool(block.name, block.input)),
    }));
    messages.push({ role: "user", content: toolResults });
  }

  throw new Error(`Gave up after ${MAX_TOOL_ROUNDS} tool-call rounds without a final reply.`);
}

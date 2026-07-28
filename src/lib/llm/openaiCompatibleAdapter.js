// Direct browser -> provider, no server in between, same trade-off as
// anthropicAdapter.js's own comment. Shared by OpenAI, Google (Gemini's own
// v1beta/openai compatibility endpoint), and xAI (Grok's native
// OpenAI-compatible API) — all three speak the same chat-completions
// request/response shape (streaming included), just a different base
// URL/model catalog (providers.js), so one adapter covers all three
// companies.
import { readSse } from "@/lib/llm/streamUtils";

const MAX_TOOL_ROUNDS = 15;

// xAI's own hosted web search — a top-level request parameter (not a tool
// the model calls, unlike Anthropic's — see anthropicAdapter.js's own
// comment), so it's added directly to the request body below, only for
// xAI, never OpenAI/Google: it runs transparently whenever the model
// decides it's useful, with no tool_use-shaped block for this code to
// react to either way. Confidence: documented, but unverified against a
// live key in this environment. OpenAI's own hosted browsing needs its
// separate Responses API (a different endpoint/request shape than the
// chat-completions one this whole adapter speaks) and Google's support
// through this OpenAI-compatibility endpoint specifically is unconfirmed —
// both are left out rather than guessed at.
const XAI_SEARCH_PARAMETERS = { mode: "auto" };

// See anthropicAdapter.js's matching comment: the closing paragraph of the
// full narrative, split on blank lines WITHIN the text rather than on
// tool-loop round boundaries, since a model very often puts its entire
// narration in a single round (all its reasoning plus every tool call it
// doesn't need an intermediate result for, in one completion).
function lastParagraph(text) {
  const paragraphs = text.split(/\n\n+/).filter(Boolean);
  return paragraphs[paragraphs.length - 1] || "";
}

// Streams one round via `stream: true` + the chat-completions SSE format
// (each event a "chat.completion.chunk" carrying one incremental `delta`,
// terminated by a `data: [DONE]` sentinel readSse already swallows),
// reconstructing the exact same `{choices: [{message}]}` shape the old
// blocking response body had: `content` accumulated from each chunk's own
// `delta.content` fragment, and each `tool_calls[i]` (`i` = the chunk's own
// stable `index`, since several calls can interleave in one round)
// reassembled from its `function.arguments` fragments, concatenated then
// JSON.parsed once assembled by the round-loop below exactly as before.
// Reconstructing that same shape (not a new one) is deliberate — the
// tool-call loop, round-text join, and message history below never needed
// to change; only *how* one round's response is obtained did. `onEvent`, if
// provided, fires live as each content fragment actually arrives.
async function streamOnce({ baseUrl, apiKey, model, messages, tools, onEvent, searchParameters }) {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model, messages, tools, tool_choice: "auto", stream: true,
      ...(searchParameters ? { search_parameters: searchParameters } : {}),
    }),
  });
  if (!res.ok) {
    // A non-2xx response is a normal (non-streamed) JSON error body, same
    // as before streaming.
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || `API error (${res.status}).`);
  }

  let content = "";
  const toolCallsByIndex = [];
  let streamError = null;
  await readSse(res, (chunk) => {
    if (chunk.error) {
      streamError = chunk.error?.message || "Provider stream error.";
      return;
    }
    const delta = chunk.choices?.[0]?.delta;
    if (!delta) return;
    if (delta.content) {
      content += delta.content;
      onEvent?.({ type: "thinking-delta", text: delta.content });
    }
    for (const tc of delta.tool_calls || []) {
      const i = tc.index ?? 0;
      if (!toolCallsByIndex[i]) toolCallsByIndex[i] = { id: "", type: "function", function: { name: "", arguments: "" } };
      if (tc.id) toolCallsByIndex[i].id = tc.id;
      if (tc.function?.name) toolCallsByIndex[i].function.name += tc.function.name;
      if (tc.function?.arguments) toolCallsByIndex[i].function.arguments += tc.function.arguments;
    }
  });
  if (streamError) throw new Error(streamError);

  const tool_calls = toolCallsByIndex.filter(Boolean);
  return { choices: [{ message: { role: "assistant", content: content || null, ...(tool_calls.length ? { tool_calls } : {}) } }] };
}

// Returns {reply, reasoning} for one turn — `reply` is just the last
// round's own text (the actual conversational answer), `reasoning` is every
// round's own text joined (the full deliberation, self-corrections
// included) — see anthropicAdapter.js's matching comment for why these
// need to be two different strings, not the same one returned twice.
export async function callOpenAiCompatible({ baseUrl, apiKey, model, systemPrompt, contextPrompt, tools, runTool, onEvent, providerId }) {
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: contextPrompt },
  ];
  const searchParameters = providerId === "xai" ? XAI_SEARCH_PARAMETERS : undefined;
  // Every round's own text — not just the final round's — is real thinking
  // the model produced as it worked through the request (see THINK OUT LOUD
  // AS YOU GO in systemPrompt.js): "I'll check the workspace first...",
  // then after results come back, "Found two matches, now creating the
  // plan...". Now streamed live via onEvent as each round's text actually
  // arrives, not just collected here for the final joined string.
  const thinking = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await streamOnce({ baseUrl, apiKey, model, messages, tools, onEvent, searchParameters });
    const message = response.choices?.[0]?.message;
    if (!message) throw new Error("Empty response from the model.");
    const roundText = message.content?.trim();
    if (roundText) thinking.push(roundText);

    if (!message.tool_calls?.length) {
      const reasoning = thinking.join("\n\n");
      return {
        reply: lastParagraph(reasoning) || "I couldn't come up with a reply — could you rephrase?",
        reasoning,
      };
    }

    messages.push(message);
    for (const call of message.tool_calls) {
      let args = {};
      try {
        args = JSON.parse(call.function.arguments || "{}");
      } catch {
        // malformed JSON from the model — surface it as a normal tool
        // error rather than crashing the whole turn
      }
      const result = await runTool(call.function.name, args);
      // analyze_attachment's image case: unlike Anthropic, the chat-
      // completions "tool" role only accepts a plain string, so the image
      // can't ride inside the tool result itself — it goes out as its own
      // immediately-following user message (a normal image_url content
      // part, the same shape a user's own image upload would use), which
      // every vision-capable model on this shared wire format already
      // understands. image_base64 is stripped from the tool result's JSON
      // text so it isn't duplicated there.
      const { image_base64, media_type, ...rest } = result || {};
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(rest) });
      if (image_base64) {
        messages.push({
          role: "user",
          content: [
            { type: "text", text: "(Image from the analyze_attachment call above — analyze it directly.)" },
            { type: "image_url", image_url: { url: `data:${media_type};base64,${image_base64}` } },
          ],
        });
      }
    }
  }

  throw new Error(`Gave up after ${MAX_TOOL_ROUNDS} tool-call rounds without a final reply.`);
}

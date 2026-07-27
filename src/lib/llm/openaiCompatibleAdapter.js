// Direct browser -> provider, no server in between, same trade-off as
// anthropicAdapter.js's own comment. Shared by OpenAI, Google (Gemini's own
// v1beta/openai compatibility endpoint), and xAI (Grok's native
// OpenAI-compatible API) — all three speak the same chat-completions
// request/response shape (streaming included), just a different base
// URL/model catalog (providers.js), so one adapter covers all three
// companies.
import { readSse } from "@/lib/llm/streamUtils";

const MAX_TOOL_ROUNDS = 15;

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
async function streamOnce({ baseUrl, apiKey, model, messages, tools, onEvent }) {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, tools, tool_choice: "auto", stream: true }),
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

export async function callOpenAiCompatible({ baseUrl, apiKey, model, systemPrompt, contextPrompt, tools, runTool, onEvent }) {
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: contextPrompt },
  ];
  // Every round's own text — not just the final round's — is real thinking
  // the model produced as it worked through the request (see THINK OUT LOUD
  // AS YOU GO in systemPrompt.js): "I'll check the workspace first...",
  // then after results come back, "Found two matches, now creating the
  // plan...". Discarding every round but the last one was throwing that
  // away entirely. Now streamed live via onEvent as each round's text
  // actually arrives, not just collected here for the final joined string.
  const thinking = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await streamOnce({ baseUrl, apiKey, model, messages, tools, onEvent });
    const message = response.choices?.[0]?.message;
    if (!message) throw new Error("Empty response from the model.");
    const roundText = message.content?.trim();
    if (roundText) thinking.push(roundText);

    if (!message.tool_calls?.length) {
      return thinking.join("\n\n") || "I couldn't come up with a reply — could you rephrase?";
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
      const result = runTool(call.function.name, args);
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }

  throw new Error(`Gave up after ${MAX_TOOL_ROUNDS} tool-call rounds without a final reply.`);
}

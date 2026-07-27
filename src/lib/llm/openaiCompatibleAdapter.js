// Direct browser -> provider, no server in between, same trade-off as
// anthropicAdapter.js's own comment. Shared by OpenAI, Google (Gemini's own
// v1beta/openai compatibility endpoint), and xAI (Grok's native
// OpenAI-compatible API) — all three speak the same chat-completions
// request/response shape, just a different base URL/model catalog
// (providers.js), so one adapter covers all three companies.
const MAX_TOOL_ROUNDS = 15;

async function callOnce({ baseUrl, apiKey, model, messages, tools }) {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, tools, tool_choice: "auto" }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error?.message || `API error (${res.status}).`);
  }
  return body;
}

export async function callOpenAiCompatible({ baseUrl, apiKey, model, systemPrompt, contextPrompt, tools, runTool }) {
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: contextPrompt },
  ];
  // Every round's own text — not just the final round's — is real thinking
  // the model produced as it worked through the request (see THINK OUT LOUD
  // AS YOU GO in systemPrompt.js): "I'll check the workspace first...",
  // then after results come back, "Found two matches, now creating the
  // plan...". Discarding every round but the last one was throwing that
  // away entirely.
  const thinking = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await callOnce({ baseUrl, apiKey, model, messages, tools });
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

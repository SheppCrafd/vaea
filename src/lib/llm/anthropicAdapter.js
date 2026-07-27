// Direct browser -> Anthropic Messages API, no server in between — the
// user's own key never leaves their machine except to Anthropic itself.
// `anthropic-dangerous-direct-browser-access` is Anthropic's own required
// opt-in header for this (the API blocks browser-origin calls by default,
// as a warning to anyone building a real product that a client-exposed key
// is generally unsafe — but that's exactly the trade a BYOK local-first
// tool like this one is making deliberately, same as this app's local-only
// GitHub vault token).
const MAX_TOOL_ROUNDS = 15;

async function callOnce({ apiKey, model, systemPrompt, messages, tools }) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({ model, max_tokens: 4096, system: systemPrompt, messages, tools }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error?.message || `Anthropic API error (${res.status}).`);
  }
  return body;
}

// Runs the full plan-then-tools loop for one turn and returns the final
// reply text — `runTool` (toolRunner.js) is what actually stages/executes
// each call.
export async function callAnthropic({ apiKey, model, systemPrompt, contextPrompt, tools, runTool }) {
  const messages = [{ role: "user", content: contextPrompt }];
  // Every round's own text — not just the final round's — is real thinking
  // the model produced as it worked through the request (see THINK OUT LOUD
  // AS YOU GO in systemPrompt.js): "I'll check the workspace first...",
  // then after results come back, "Found two matches, now creating the
  // plan...". Discarding every round but the last one was throwing that
  // away entirely.
  const thinking = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await callOnce({ apiKey, model, systemPrompt, messages, tools });
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

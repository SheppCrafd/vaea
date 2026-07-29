import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { runByokChat } from "./byokChat.js";

vi.mock("./localBridgeStorage.js", () => ({
  getBridgeStatus: vi.fn(),
  writeRequestFile: vi.fn(async () => {}),
  pollForResponseFile: vi.fn(),
  archiveProcessedRound: vi.fn(async () => {}),
}));

import { getBridgeStatus, writeRequestFile, pollForResponseFile } from "./localBridgeStorage.js";

beforeEach(() => {
  vi.clearAllMocks();
});

const baseContextArgs = {
  activeProjectId: null,
  userText: "archive the Q1 Newsletter project",
  conversationHistory: "",
  aiIdentity: {},
  areas: [], products: [], projects: [{ id: "p1", title: "Q1 Newsletter" }],
  archivedProjects: [], tasks: [], archivedTasks: [], stakeholders: [], departments: [], notes: [],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

// Both adapters now speak real SSE (stream: true) — these helpers build a
// fetch Response whose body is a one-shot ReadableStream of Anthropic's or
// the chat-completions API's own streaming event shape, reconstructing to
// exactly the round each test wants without re-testing the SSE framing
// itself (see anthropicAdapter.test.js / openaiCompatibleAdapter.test.js
// for that).
function anthropicStream(blocks) {
  const events = [];
  blocks.forEach((block, index) => {
    if (block.type === "text") {
      events.push({ type: "content_block_start", index, content_block: { type: "text", text: "" } });
      events.push({ type: "content_block_delta", index, delta: { type: "text_delta", text: block.text } });
    } else {
      events.push({ type: "content_block_start", index, content_block: { type: "tool_use", id: block.id, name: block.name } });
      events.push({ type: "content_block_delta", index, delta: { type: "input_json_delta", partial_json: JSON.stringify(block.input) } });
    }
    events.push({ type: "content_block_stop", index });
  });
  events.push({ type: "message_stop" });
  const text = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("");
  const encoder = new TextEncoder();
  return {
    ok: true, status: 200,
    body: new ReadableStream({ start(controller) { controller.enqueue(encoder.encode(text)); controller.close(); } }),
  };
}

function openAiStream({ content, toolCalls = [] }) {
  const chunks = [];
  if (content) chunks.push({ choices: [{ delta: { content } }] });
  toolCalls.forEach((call, index) => {
    chunks.push({ choices: [{ delta: { tool_calls: [{ index, id: call.id, function: { name: call.name, arguments: JSON.stringify(call.args) } }] } }] });
  });
  chunks.push({ choices: [{ delta: {}, finish_reason: toolCalls.length ? "tool_calls" : "stop" }] });
  const text = chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join("") + "data: [DONE]\n\n";
  const encoder = new TextEncoder();
  return {
    ok: true, status: 200,
    body: new ReadableStream({ start(controller) { controller.enqueue(encoder.encode(text)); controller.close(); } }),
  };
}

describe("runByokChat: validation before ever making a request", () => {
  it("rejects an unknown provider", async () => {
    await expect(runByokChat({ providerConfig: { provider: "notreal" }, contextArgs: baseContextArgs })).rejects.toThrow('Unknown AI provider "notreal"');
  });

  it("rejects a configured provider with no API key", async () => {
    await expect(
      runByokChat({ providerConfig: { provider: "anthropic", model: "claude-sonnet-5", apiKey: "" }, contextArgs: baseContextArgs })
    ).rejects.toThrow("Add your Anthropic API key");
  });

  it("rejects a configured provider with no model chosen", async () => {
    await expect(
      runByokChat({ providerConfig: { provider: "openai", model: "", apiKey: "sk-test" }, contextArgs: baseContextArgs })
    ).rejects.toThrow("Pick a OpenAI model");
  });
});

describe("runByokChat: end-to-end against a mocked provider response", () => {
  it("stages a real ARCHIVE_PROJECT action from a tool call and returns {reply, actions}", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url, init) => {
      const body = JSON.parse(init.body);
      if (!body.messages.some((m) => m.role === "user" && Array.isArray(m.content))) {
        return anthropicStream([{ type: "tool_use", id: "toolu_1", name: "ARCHIVE_PROJECT", input: { project_id: "p1" } }]);
      }
      return anthropicStream([{ type: "text", text: "I'll archive Q1 Newsletter." }]);
    }));

    const result = await runByokChat({
      providerConfig: { provider: "anthropic", model: "claude-sonnet-5", apiKey: "sk-ant-test" },
      contextArgs: baseContextArgs,
    });

    expect(result.reply).toBe("I'll archive Q1 Newsletter.");
    expect(result.actions).toEqual([{ action: "ARCHIVE_PROJECT", args: { project_id: "p1" } }]);
  });

  it("Anthropic: liveTrace and the protocol reminder both flow through the real Messages-API request/response shape", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
      const body = JSON.parse(init.body);
      // First round only: confirm the reminder actually reached the real
      // request Anthropic would receive, not just systemPrompt.js's own output.
      if (body.messages.length === 1) {
        expect(body.messages[0].content).toContain("[PROTOCOL REMINDER]");
        return anthropicStream([{ type: "tool_use", id: "t1", name: "search_workspace", input: { query: "growth" } }]);
      }
      return anthropicStream([{ type: "text", text: "Found one match." }]);
    }));

    const result = await runByokChat({
      providerConfig: { provider: "anthropic", model: "claude-sonnet-5", apiKey: "sk-ant-test" },
      contextArgs: { ...baseContextArgs, userText: "there's a bug with growth tracking", protocolReminderRequested: true },
    });

    expect(result.reply).toBe("Found one match.");
    expect(result.liveTrace).toHaveLength(1);
    expect(result.liveTrace[0].label).toMatch(/^search_workspace\("growth"\)/);
  });

  it("OpenAI-compatible (also covers Google/xAI — same adapter, only baseUrl differs): liveTrace and the protocol reminder both flow through the real chat-completions shape", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
      const body = JSON.parse(init.body);
      const systemMsg = body.messages.find((m) => m.role === "system");
      const userMsg = body.messages.find((m) => m.role === "user");
      if (body.messages.length === 2) {
        expect(userMsg.content).toContain("[PROTOCOL REMINDER]");
        return openAiStream({ toolCalls: [{ id: "t1", name: "search_workspace", args: { query: "growth" } }] });
      }
      expect(systemMsg).toBeTruthy();
      return openAiStream({ content: "Found one match." });
    }));

    const result = await runByokChat({
      providerConfig: { provider: "openai", model: "gpt-5", apiKey: "sk-test" },
      contextArgs: { ...baseContextArgs, userText: "there's a bug with growth tracking", protocolReminderRequested: true },
    });

    expect(result.reply).toBe("Found one match.");
    expect(result.liveTrace).toHaveLength(1);
    expect(result.liveTrace[0].label).toMatch(/^search_workspace\("growth"\)/);
  });

  it("fires onEvent live for both thinking-delta and tool-call, for a real (non-simulated) HTTP provider", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
      const body = JSON.parse(init.body);
      if (body.messages.length === 1) {
        return anthropicStream([
          { type: "text", text: "Let me check." },
          { type: "tool_use", id: "t1", name: "search_workspace", input: { query: "growth" } },
        ]);
      }
      return anthropicStream([{ type: "text", text: "Found one match." }]);
    }));

    const events = [];
    const result = await runByokChat({
      providerConfig: { provider: "anthropic", model: "claude-sonnet-5", apiKey: "sk-ant-test" },
      contextArgs: { ...baseContextArgs, userText: "what do we have on growth" },
      onEvent: (e) => events.push(e),
    });

    expect(events).toContainEqual({ type: "thinking-delta", text: "Let me check." });
    expect(events.some((e) => e.type === "tool-call" && e.label.startsWith('search_workspace("growth")'))).toBe(true);
    expect(events).toContainEqual({ type: "thinking-delta", text: "Found one match." });

    // reply (chat-facing) is ONLY the final round's own text; reasoning
    // (the plan modal's own detail) is every round's own text, including
    // the earlier "Let me check." deliberation — these must NOT be the
    // same string, or the modal is just a pointless echo of the chat
    // bubble, which is exactly what a real user caught.
    expect(result.reply).toBe("Found one match.");
    expect(result.reasoning).toBe("Let me check.\n\nFound one match.");
    expect(result.reasoning).not.toBe(result.reply);
  });
});

describe("runByokChat: local-bridge (Backdoor Mode) dispatch", () => {
  it("rejects when the bridge folder isn't connected, without ever writing a request file", async () => {
    getBridgeStatus.mockResolvedValueOnce("disconnected");
    await expect(
      runByokChat({ providerConfig: { provider: "local-bridge" }, contextArgs: baseContextArgs })
    ).rejects.toThrow("Connect your Backdoor Mode folder");
    expect(writeRequestFile).not.toHaveBeenCalled();
  });

  it("needs no API key or model — a connected folder is enough", async () => {
    getBridgeStatus.mockResolvedValueOnce("connected");
    pollForResponseFile.mockResolvedValueOnce({
      content: [{ type: "tool_use", id: "toolu_1", name: "ARCHIVE_PROJECT", input: { project_id: "p1" } }],
    });
    pollForResponseFile.mockResolvedValueOnce({ content: [{ type: "text", text: "I'll archive Q1 Newsletter." }] });

    const result = await runByokChat({ providerConfig: { provider: "local-bridge" }, contextArgs: baseContextArgs });

    expect(result.reply).toBe("I'll archive Q1 Newsletter.");
    expect(result.actions).toEqual([{ action: "ARCHIVE_PROJECT", args: { project_id: "p1" } }]);
    expect(writeRequestFile).toHaveBeenCalledTimes(2);
  });

  it("returns real liveTrace entries from a search_workspace call, same as every other provider", async () => {
    // liveTrace is built by makeToolRunner (toolRunner.js), shared by every
    // adapter — this confirms Backdoor Mode actually gets it too, not just
    // Anthropic/OpenAI-compatible, since it's easy for a shared-plumbing
    // feature like this to silently only get exercised by the one adapter
    // whose own tests happen to cover it.
    getBridgeStatus.mockResolvedValueOnce("connected");
    pollForResponseFile
      .mockResolvedValueOnce({
        content: [{ type: "tool_use", id: "toolu_1", name: "search_workspace", input: { query: "growth" } }],
      })
      .mockResolvedValueOnce({ content: [{ type: "text", text: "Found one match." }] });

    const result = await runByokChat({
      providerConfig: { provider: "local-bridge" },
      contextArgs: { ...baseContextArgs, userText: "what do we have on growth" },
    });

    expect(result.liveTrace).toHaveLength(1);
    expect(result.liveTrace[0].label).toMatch(/^search_workspace\("growth"\)/);
  });

  it("carries the protocol reminder into the context prompt sent to the local watcher script", async () => {
    // The reminder is client-decided (matchesProtocolTrigger, useChatController.js)
    // and threaded through contextArgs.protocolReminderRequested — this
    // confirms systemPrompt.js's buildContextPrompt actually renders it for
    // Backdoor Mode too, not just the two HTTP-based adapters.
    getBridgeStatus.mockResolvedValueOnce("connected");
    pollForResponseFile.mockResolvedValueOnce({ content: [{ type: "text", text: "Here's what I found." }] });

    await runByokChat({
      providerConfig: { provider: "local-bridge" },
      contextArgs: { ...baseContextArgs, userText: "there's a bug in the sync", protocolReminderRequested: true },
    });

    const [, , body] = writeRequestFile.mock.calls[0];
    expect(body.messages[0].content).toContain("[PROTOCOL REMINDER]");
  });

  it("with onEvent: paced-replays liveTrace then the reasoning text as the same event vocabulary real streaming uses, without ever touching the file contract", async () => {
    getBridgeStatus.mockResolvedValueOnce("connected");
    pollForResponseFile
      .mockResolvedValueOnce({ content: [{ type: "tool_use", id: "toolu_1", name: "search_workspace", input: { query: "growth" } }] })
      .mockResolvedValueOnce({ content: [{ type: "text", text: "Found one match." }] });

    const events = [];
    const result = await runByokChat({
      providerConfig: { provider: "local-bridge" },
      contextArgs: { ...baseContextArgs, userText: "what do we have on growth" },
      onEvent: (e) => events.push(e),
    });

    // writeRequestFile/pollForResponseFile were called exactly as they
    // always are — no protocol change, no onEvent threaded into the file
    // contract itself.
    expect(writeRequestFile).toHaveBeenCalledTimes(2);

    const toolCallEvents = events.filter((e) => e.type === "tool-call");
    const thinkingEvents = events.filter((e) => e.type === "thinking-delta");
    expect(toolCallEvents).toHaveLength(1);
    expect(toolCallEvents[0].label).toMatch(/^search_workspace\("growth"\)/);
    // Tool-call reveal happens entirely before any reasoning text starts.
    expect(events.indexOf(toolCallEvents[0])).toBeLessThan(events.indexOf(thinkingEvents[0]));
    expect(thinkingEvents.map((e) => e.text).join("")).toBe(result.reasoning);
  });

  it("without onEvent: resolves exactly as before, no pacing delay incurred", async () => {
    getBridgeStatus.mockResolvedValueOnce("connected");
    pollForResponseFile.mockResolvedValueOnce({ content: [{ type: "text", text: "Here's what I found." }] });

    const result = await runByokChat({ providerConfig: { provider: "local-bridge" }, contextArgs: baseContextArgs });
    expect(result.reply).toBe("Here's what I found.");
  });

  it("keeps reply (last round only) and reasoning (every round, deliberation included) as two different strings, same as every other provider", async () => {
    getBridgeStatus.mockResolvedValueOnce("connected");
    pollForResponseFile
      .mockResolvedValueOnce({
        content: [
          { type: "text", text: "Let me check." },
          { type: "tool_use", id: "toolu_1", name: "search_workspace", input: { query: "growth" } },
        ],
      })
      .mockResolvedValueOnce({ content: [{ type: "text", text: "Found one match." }] });

    const result = await runByokChat({
      providerConfig: { provider: "local-bridge" },
      contextArgs: { ...baseContextArgs, userText: "what do we have on growth" },
    });

    expect(result.reply).toBe("Found one match.");
    expect(result.reasoning).toBe("Let me check.\n\nFound one match.");
  });
});

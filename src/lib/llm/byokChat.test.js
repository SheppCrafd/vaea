import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { runByokChat } from "./byokChat.js";

vi.mock("./localBridgeStorage.js", () => ({
  getBridgeStatus: vi.fn(),
  writeRequestFile: vi.fn(async () => {}),
  pollForResponseFile: vi.fn(),
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
        return {
          ok: true,
          json: async () => ({
            content: [{ type: "tool_use", id: "toolu_1", name: "ARCHIVE_PROJECT", input: { project_id: "p1" } }],
          }),
        };
      }
      return { ok: true, json: async () => ({ content: [{ type: "text", text: "I'll archive Q1 Newsletter." }] }) };
    }));

    const result = await runByokChat({
      providerConfig: { provider: "anthropic", model: "claude-sonnet-5", apiKey: "sk-ant-test" },
      contextArgs: baseContextArgs,
    });

    expect(result.reply).toBe("I'll archive Q1 Newsletter.");
    expect(result.actions).toEqual([{ action: "ARCHIVE_PROJECT", args: { project_id: "p1" } }]);
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
});

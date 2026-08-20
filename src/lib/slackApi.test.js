import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listChannels, listMessages, sendMessage, testSlackConnection } from "./slackApi.js";

const CONNECTION = { accessToken: "xoxp-token-1", workspaceId: "T123", workspaceName: "MyTeam" };

describe("slackApi: listChannels", () => {
  beforeEach(() => { globalThis.fetch = vi.fn(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it("returns shaped channel objects", async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, json: async () => ({
      ok: true,
      channels: [{ id: "C1", name: "general", topic: { value: "Announcements" }, num_members: 12, is_private: false }],
    })});
    const channels = await listChannels(CONNECTION);
    expect(channels).toEqual([{ id: "C1", name: "general", topic: "Announcements", memberCount: 12, isPrivate: false }]);
    const [url, init] = globalThis.fetch.mock.calls[0];
    expect(url).toContain("conversations.list");
    expect(init.headers.Authorization).toBe("Bearer xoxp-token-1");
  });

  it("throws a clear error on token rejection", async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, json: async () => ({ ok: false, error: "invalid_auth" }) });
    await expect(listChannels(CONNECTION)).rejects.toThrow(/reconnecting/);
  });
});

describe("slackApi: listMessages", () => {
  beforeEach(() => { globalThis.fetch = vi.fn(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it("filters to real messages and shapes them", async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, json: async () => ({
      ok: true,
      messages: [
        { type: "message", ts: "1234.0", user: "U1", text: "Hello", reply_count: 2 },
        { type: "message", subtype: "channel_join", ts: "1233.0", user: "U2", text: "joined" },
      ],
    })});
    const messages = await listMessages(CONNECTION, "C1");
    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual({ ts: "1234.0", userId: "U1", text: "Hello", replyCount: 2 });
    expect(globalThis.fetch.mock.calls[0][0]).toContain("conversations.history?channel=C1");
  });
});

describe("slackApi: sendMessage", () => {
  beforeEach(() => { globalThis.fetch = vi.fn(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it("POSTs to chat.postMessage and returns ts", async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true, ts: "9999.0", channel: "C1" }) });
    const result = await sendMessage(CONNECTION, "C1", "Hello world");
    expect(result.ts).toBe("9999.0");
    const [url, init] = globalThis.fetch.mock.calls[0];
    expect(url).toContain("chat.postMessage");
    expect(JSON.parse(init.body)).toEqual({ channel: "C1", text: "Hello world" });
  });
});

describe("slackApi: testSlackConnection", () => {
  beforeEach(() => { globalThis.fetch = vi.fn(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it("returns workspace info on success", async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, json: async () => ({
      ok: true, team_id: "T123", team: "MyTeam", user_id: "U1", user: "alice",
    })});
    const result = await testSlackConnection("xoxp-token-1");
    expect(result).toEqual({ workspaceId: "T123", workspaceName: "MyTeam", userId: "U1", username: "alice" });
  });
});

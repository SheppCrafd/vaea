import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listMessages, readMessage, sendMessage, testGmailConnection, refreshAccessToken } from "./gmailApi.js";

const FRESH_CONNECTION = { accessToken: "fresh-token", refreshToken: "refresh-1", expiresAt: Date.now() + 60 * 60 * 1000, emailAddress: "me@example.com" };
const EXPIRED_CONNECTION = { accessToken: "stale-token", refreshToken: "refresh-1", expiresAt: Date.now() - 1000, emailAddress: "me@example.com" };

describe("gmailApi: refreshAccessToken", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exchanges a refresh token for a new access token, no client secret sent", async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, json: async () => ({ access_token: "new-token", expires_in: 3600 }) });
    const result = await refreshAccessToken("refresh-1");
    expect(result.accessToken).toBe("new-token");
    expect(result.expiresAt).toBeGreaterThan(Date.now());
    const [url, init] = globalThis.fetch.mock.calls[0];
    expect(url).toBe("https://oauth2.googleapis.com/token");
    const body = String(init.body);
    expect(body).toContain("refresh_token=refresh-1");
    expect(body).not.toContain("client_secret");
  });

  it("throws a clear error when Google rejects the refresh", async () => {
    globalThis.fetch.mockResolvedValue({ ok: false, status: 400, json: async () => ({ error_description: "Token has been expired or revoked." }) });
    await expect(refreshAccessToken("dead")).rejects.toThrow(/expired or revoked/);
  });
});

describe("gmailApi: listMessages", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses the connection's access token directly when it isn't expired, and shapes each message", async () => {
    globalThis.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ messages: [{ id: "m1" }] }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "m1",
          threadId: "t1",
          snippet: "Hey there",
          labelIds: ["UNREAD", "INBOX"],
          payload: { headers: [{ name: "Subject", value: "Hello" }, { name: "From", value: "a@b.com" }, { name: "Date", value: "Mon" }] },
        }),
      });
    const { messages, connection } = await listMessages(FRESH_CONNECTION);
    expect(messages).toEqual([{ id: "m1", threadId: "t1", subject: "Hello", from: "a@b.com", date: "Mon", snippet: "Hey there", unread: true }]);
    expect(connection).toEqual(FRESH_CONNECTION);
    const [listUrl, listInit] = globalThis.fetch.mock.calls[0];
    expect(listUrl).toContain("/messages?");
    expect(listInit.headers.Authorization).toBe("Bearer fresh-token");
  });

  it("refreshes an expired token first, then uses the new one for the real calls", async () => {
    globalThis.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "refreshed-token", expires_in: 3600 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ messages: [] }) });
    const { connection } = await listMessages(EXPIRED_CONNECTION);
    expect(connection.accessToken).toBe("refreshed-token");
    const [, listInit] = globalThis.fetch.mock.calls[1];
    expect(listInit.headers.Authorization).toBe("Bearer refreshed-token");
  });

  it("throws a clear error on a rejected token", async () => {
    globalThis.fetch.mockResolvedValue({ ok: false, status: 401 });
    await expect(listMessages(FRESH_CONNECTION)).rejects.toThrow(/reconnecting/);
  });
});

describe("gmailApi: readMessage / sendMessage / testGmailConnection", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("readMessage decodes a plain-text body", async () => {
    const encoded = btoa(unescape(encodeURIComponent("Hi there")));
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "m1",
        payload: {
          headers: [{ name: "Subject", value: "Hello" }, { name: "From", value: "a@b.com" }, { name: "To", value: "me@example.com" }, { name: "Date", value: "Mon" }],
          mimeType: "text/plain",
          body: { data: encoded },
        },
        snippet: "Hi there",
      }),
    });
    const { message } = await readMessage(FRESH_CONNECTION, "m1");
    expect(message.body).toBe("Hi there");
    expect(message.subject).toBe("Hello");
  });

  it("sendMessage POSTs a base64url-encoded raw email", async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, json: async () => ({ id: "sent-1" }) });
    const { id } = await sendMessage(FRESH_CONNECTION, { to: "a@b.com", subject: "Hi", body: "Body text" });
    expect(id).toBe("sent-1");
    const [url, init] = globalThis.fetch.mock.calls[0];
    expect(url).toContain("/messages/send");
    expect(init.method).toBe("POST");
    const raw = JSON.parse(init.body).raw;
    expect(raw).not.toContain("+");
    expect(raw).not.toContain("/");
  });

  it("testGmailConnection returns the real address on success", async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, json: async () => ({ emailAddress: "me@example.com" }) });
    const { emailAddress } = await testGmailConnection(FRESH_CONNECTION);
    expect(emailAddress).toBe("me@example.com");
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listEvents, createEvent, updateEvent, deleteEvent, listMessages, readMessage, sendMessage, testMicrosoftConnection } from "./microsoftGraphApi.js";

vi.mock("@/lib/microsoftOAuthPkce", () => ({
  refreshAccessToken: vi.fn(async () => ({ accessToken: "refreshed-token", refreshToken: "refresh-1", expiresAt: Date.now() + 3600 * 1000 })),
}));

const FRESH_CONNECTION = { accessToken: "fresh-token", refreshToken: "refresh-1", expiresAt: Date.now() + 60 * 60 * 1000, emailAddress: "me@example.com" };
const EXPIRED_CONNECTION = { accessToken: "stale-token", refreshToken: "refresh-1", expiresAt: Date.now() - 1000, emailAddress: "me@example.com" };

describe("microsoftGraphApi: listEvents", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses the connection's access token directly when it isn't expired", async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, json: async () => ({ value: [{ id: "e1", subject: "Standup", start: { dateTime: "2026-08-20T09:00:00", timeZone: "UTC" } }] }) });
    const { events, connection } = await listEvents(FRESH_CONNECTION);
    expect(events).toEqual([{ id: "e1", subject: "Standup", start: "2026-08-20T09:00:00 (UTC)", end: undefined, location: undefined, onlineMeetingUrl: undefined, isOnlineMeeting: false }]);
    expect(connection).toEqual(FRESH_CONNECTION);
    const [url, init] = globalThis.fetch.mock.calls[0];
    expect(url).toContain("/calendarView?");
    expect(init.headers.Authorization).toBe("Bearer fresh-token");
  });

  it("refreshes an expired token first, then uses the new one for the real call", async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, json: async () => ({ value: [] }) });
    const { connection } = await listEvents(EXPIRED_CONNECTION);
    expect(connection.accessToken).toBe("refreshed-token");
    const [, init] = globalThis.fetch.mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer refreshed-token");
  });

  it("throws a clear error on a rejected token", async () => {
    globalThis.fetch.mockResolvedValue({ ok: false, status: 401 });
    await expect(listEvents(FRESH_CONNECTION)).rejects.toThrow(/reconnecting/);
  });
});

describe("microsoftGraphApi: createEvent / updateEvent / deleteEvent", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("createEvent POSTs the event body, with a Teams link request when asked", async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, json: async () => ({ id: "new-1", subject: "Lunch", isOnlineMeeting: true, onlineMeeting: { joinUrl: "https://teams.microsoft.com/x" } }) });
    const { event } = await createEvent(FRESH_CONNECTION, { subject: "Lunch", start: { dateTime: "2026-08-20T12:00:00", timeZone: "UTC" }, teamsMeeting: true });
    expect(event.id).toBe("new-1");
    expect(event.onlineMeetingUrl).toBe("https://teams.microsoft.com/x");
    const [url, init] = globalThis.fetch.mock.calls[0];
    expect(url).toContain("/events");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body);
    expect(body.isOnlineMeeting).toBe(true);
    expect(body.onlineMeetingProvider).toBe("teamsForBusiness");
  });

  it("updateEvent PATCHes only the given fields", async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, json: async () => ({ id: "e1", subject: "Renamed" }) });
    await updateEvent(FRESH_CONNECTION, "e1", { subject: "Renamed" });
    const [url, init] = globalThis.fetch.mock.calls[0];
    expect(url).toContain("/events/e1");
    expect(init.method).toBe("PATCH");
  });

  it("deleteEvent DELETEs and tolerates an already-gone (404) event", async () => {
    globalThis.fetch.mockResolvedValue({ ok: false, status: 404 });
    await expect(deleteEvent(FRESH_CONNECTION, "gone")).resolves.toEqual({ connection: FRESH_CONNECTION });
  });

  it("deleteEvent still throws on a real error", async () => {
    globalThis.fetch.mockResolvedValue({ ok: false, status: 403 });
    await expect(deleteEvent(FRESH_CONNECTION, "e1")).rejects.toThrow(/denied/);
  });
});

describe("microsoftGraphApi: mail", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("listMessages shapes each message", async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, json: async () => ({ value: [{ id: "m1", subject: "Hi", from: { emailAddress: { address: "a@b.com" } }, receivedDateTime: "2026-08-20", bodyPreview: "Hey", isRead: false }] }) });
    const { messages } = await listMessages(FRESH_CONNECTION);
    expect(messages).toEqual([{ id: "m1", subject: "Hi", from: "a@b.com", receivedDateTime: "2026-08-20", bodyPreview: "Hey", unread: true }]);
  });

  it("readMessage returns the full body", async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, json: async () => ({ id: "m1", subject: "Hi", from: { emailAddress: { address: "a@b.com" } }, toRecipients: [{ emailAddress: { address: "me@example.com" } }], body: { contentType: "text", content: "Full body" } }) });
    const { message } = await readMessage(FRESH_CONNECTION, "m1");
    expect(message.body).toBe("Full body");
    expect(message.to).toBe("me@example.com");
  });

  it("sendMessage POSTs to sendMail", async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, status: 202 });
    const { sent } = await sendMessage(FRESH_CONNECTION, { to: "a@b.com", subject: "Hi", body: "Body text" });
    expect(sent).toBe(true);
    const [url, init] = globalThis.fetch.mock.calls[0];
    expect(url).toContain("/sendMail");
    expect(init.method).toBe("POST");
  });

  it("testMicrosoftConnection returns the real address on success", async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, json: async () => ({ mail: "me@example.com" }) });
    const { emailAddress } = await testMicrosoftConnection(FRESH_CONNECTION);
    expect(emailAddress).toBe("me@example.com");
  });
});

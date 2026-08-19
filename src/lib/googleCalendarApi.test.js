import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listEvents, createEvent, updateEvent, deleteEvent, testCalendarConnection, refreshAccessToken } from "./googleCalendarApi.js";

const FRESH_CONNECTION = { accessToken: "fresh-token", refreshToken: "refresh-1", expiresAt: Date.now() + 60 * 60 * 1000, calendarId: "primary" };
const EXPIRED_CONNECTION = { accessToken: "stale-token", refreshToken: "refresh-1", expiresAt: Date.now() - 1000, calendarId: "primary" };

describe("googleCalendarApi: refreshAccessToken", () => {
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
    expect(body).toContain("grant_type=refresh_token");
    expect(body).not.toContain("client_secret");
  });

  it("throws a clear error when Google rejects the refresh", async () => {
    globalThis.fetch.mockResolvedValue({ ok: false, status: 400, json: async () => ({ error_description: "Token has been expired or revoked." }) });
    await expect(refreshAccessToken("dead")).rejects.toThrow(/expired or revoked/);
  });
});

describe("googleCalendarApi: listEvents", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses the connection's access token directly when it isn't expired", async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, json: async () => ({ items: [{ id: "e1", summary: "Standup" }] }) });
    const { events, connection } = await listEvents(FRESH_CONNECTION);
    expect(events).toEqual([{ id: "e1", summary: "Standup" }]);
    expect(connection).toEqual(FRESH_CONNECTION);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = globalThis.fetch.mock.calls[0];
    expect(url).toContain("/calendars/primary/events");
    expect(init.headers.Authorization).toBe("Bearer fresh-token");
  });

  it("refreshes an expired token first, then uses the new one for the real call", async () => {
    globalThis.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "refreshed-token", expires_in: 3600 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [] }) });

    const { connection } = await listEvents(EXPIRED_CONNECTION);
    expect(connection.accessToken).toBe("refreshed-token");
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    const [, listInit] = globalThis.fetch.mock.calls[1];
    expect(listInit.headers.Authorization).toBe("Bearer refreshed-token");
  });

  it("throws a clear error on a rejected token", async () => {
    globalThis.fetch.mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });
    await expect(listEvents(FRESH_CONNECTION)).rejects.toThrow(/reconnecting/);
  });
});

describe("googleCalendarApi: createEvent / updateEvent / deleteEvent", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("createEvent POSTs the event body to the connected calendar", async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, json: async () => ({ id: "new-1", summary: "Lunch" }) });
    const { event } = await createEvent(FRESH_CONNECTION, { summary: "Lunch", start: { dateTime: "2026-08-20T12:00:00-04:00" } });
    expect(event.id).toBe("new-1");
    const [url, init] = globalThis.fetch.mock.calls[0];
    expect(url).toContain("/calendars/primary/events");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body).summary).toBe("Lunch");
  });

  it("updateEvent PATCHes only the given fields", async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, json: async () => ({ id: "e1", summary: "Renamed" }) });
    await updateEvent(FRESH_CONNECTION, "e1", { summary: "Renamed" });
    const [url, init] = globalThis.fetch.mock.calls[0];
    expect(url).toContain("/events/e1");
    expect(init.method).toBe("PATCH");
  });

  it("deleteEvent DELETEs and tolerates an already-gone (410) event", async () => {
    globalThis.fetch.mockResolvedValue({ ok: false, status: 410 });
    await expect(deleteEvent(FRESH_CONNECTION, "gone")).resolves.toEqual({ connection: FRESH_CONNECTION });
  });

  it("deleteEvent still throws on a real error", async () => {
    globalThis.fetch.mockResolvedValue({ ok: false, status: 403, json: async () => ({}) });
    await expect(deleteEvent(FRESH_CONNECTION, "e1")).rejects.toThrow(/denied/);
  });
});

describe("googleCalendarApi: testCalendarConnection", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the calendar's summary/timeZone on success", async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, json: async () => ({ summary: "me@example.com", timeZone: "America/New_York" }) });
    const result = await testCalendarConnection(FRESH_CONNECTION);
    expect(result.summary).toBe("me@example.com");
    expect(result.timeZone).toBe("America/New_York");
  });
});

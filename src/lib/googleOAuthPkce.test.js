import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function makeSessionStorage() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
}

globalThis.sessionStorage = makeSessionStorage();
globalThis.window = { location: { origin: "https://vaea.base44.app" } };

const { buildAuthorizationUrl, exchangeCodeForTokens } = await import("./googleOAuthPkce.js");

describe("googleOAuthPkce: buildAuthorizationUrl", () => {
  beforeEach(() => {
    globalThis.sessionStorage.clear();
  });

  it("builds a Google consent URL with a PKCE challenge, no client secret, and stashes verifier+state", async () => {
    const url = await buildAuthorizationUrl();
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(parsed.searchParams.get("redirect_uri")).toBe("https://vaea.base44.app/app/settings/calendar-callback");
    expect(parsed.searchParams.get("code_challenge_method")).toBe("S256");
    expect(parsed.searchParams.get("access_type")).toBe("offline");
    expect(parsed.searchParams.has("client_secret")).toBe(false);
    expect(parsed.searchParams.get("state")).toBe(globalThis.sessionStorage.getItem("vaea_calendar_pkce_state"));
    expect(globalThis.sessionStorage.getItem("vaea_calendar_pkce_verifier")).toBeTruthy();
  });

  it("generates a fresh verifier/state on every call", async () => {
    const first = new URL(await buildAuthorizationUrl()).searchParams.get("state");
    const second = new URL(await buildAuthorizationUrl()).searchParams.get("state");
    expect(first).not.toBe(second);
  });
});

describe("googleOAuthPkce: exchangeCodeForTokens", () => {
  beforeEach(() => {
    globalThis.sessionStorage.clear();
    globalThis.fetch = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects a state that doesn't match what buildAuthorizationUrl stored (CSRF/mixed-tab guard)", async () => {
    await buildAuthorizationUrl();
    const params = new URLSearchParams({ code: "real-code", state: "not-the-real-state" });
    await expect(exchangeCodeForTokens(params)).rejects.toThrow(/doesn't match/);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("surfaces Google's own denial message plainly", async () => {
    await buildAuthorizationUrl();
    const state = globalThis.sessionStorage.getItem("vaea_calendar_pkce_state");
    const params = new URLSearchParams({ error: "access_denied", state });
    await expect(exchangeCodeForTokens(params)).rejects.toThrow(/wasn't granted/);
  });

  it("exchanges a valid code for tokens using the stashed verifier, no client secret sent", async () => {
    await buildAuthorizationUrl();
    const state = globalThis.sessionStorage.getItem("vaea_calendar_pkce_state");
    const verifier = globalThis.sessionStorage.getItem("vaea_calendar_pkce_verifier");
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "at-1", refresh_token: "rt-1", expires_in: 3600 }),
    });

    const params = new URLSearchParams({ code: "real-code", state });
    const tokens = await exchangeCodeForTokens(params);

    expect(tokens.accessToken).toBe("at-1");
    expect(tokens.refreshToken).toBe("rt-1");
    expect(tokens.expiresAt).toBeGreaterThan(Date.now());

    const [url, init] = globalThis.fetch.mock.calls[0];
    expect(url).toBe("https://oauth2.googleapis.com/token");
    const body = String(init.body);
    expect(body).toContain("code=real-code");
    expect(body).toContain(`code_verifier=${verifier}`);
    expect(body).toContain("grant_type=authorization_code");
    expect(body).not.toContain("client_secret");

    // One-time use: verifier/state cleared after a successful exchange.
    expect(globalThis.sessionStorage.getItem("vaea_calendar_pkce_verifier")).toBeNull();
    expect(globalThis.sessionStorage.getItem("vaea_calendar_pkce_state")).toBeNull();
  });

  it("throws a clear error when Google rejects the code exchange", async () => {
    await buildAuthorizationUrl();
    const state = globalThis.sessionStorage.getItem("vaea_calendar_pkce_state");
    globalThis.fetch.mockResolvedValue({ ok: false, status: 400, json: async () => ({ error_description: "Malformed auth code." }) });
    const params = new URLSearchParams({ code: "bad-code", state });
    await expect(exchangeCodeForTokens(params)).rejects.toThrow(/Malformed auth code/);
  });
});

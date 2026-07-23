import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { base64ToUtf8, utf8ToBase64, testVaultConnection, writeVaultFile } from "./githubApi.js";

describe("githubApi: base64 round-trip handles real UTF-8, not just ASCII", () => {
  it("round-trips plain text", () => {
    expect(base64ToUtf8(utf8ToBase64("hello world"))).toBe("hello world");
  });

  it("round-trips non-Latin1 characters (emoji, accents) that plain btoa/atob would mangle", () => {
    const text = "café 🧠 [[Some Note]] —日本語";
    expect(base64ToUtf8(utf8ToBase64(text))).toBe(text);
  });
});

describe("githubApi: testVaultConnection", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the repo's default branch on success", async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, json: async () => ({ default_branch: "main" }) });
    const result = await testVaultConnection({ owner: "me", repo: "vault", token: "t" });
    expect(result.defaultBranch).toBe("main");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://api.github.com/repos/me/vault",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer t" }) })
    );
  });

  it("throws a clear error on 404", async () => {
    globalThis.fetch.mockResolvedValue({ ok: false, status: 404 });
    await expect(testVaultConnection({ owner: "me", repo: "nope", token: "t" })).rejects.toThrow(/not found/i);
  });

  it("throws a clear error on 401", async () => {
    globalThis.fetch.mockResolvedValue({ ok: false, status: 401 });
    await expect(testVaultConnection({ owner: "me", repo: "vault", token: "bad" })).rejects.toThrow(/rejected/i);
  });
});

describe("githubApi: writeVaultFile", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a new file (no sha) when none exists yet", async () => {
    globalThis.fetch
      .mockResolvedValueOnce({ ok: false, status: 404 }) // GET existing -> not found
      .mockResolvedValueOnce({ ok: true, json: async () => ({ content: { sha: "abc123" }, commit: { html_url: "https://github.com/me/vault/commit/abc123" } }) });

    const result = await writeVaultFile({ owner: "me", repo: "vault", branch: "main", token: "t", path: "Daily/2026-07-22.md", content: "# Today" });

    expect(result).toEqual({ path: "Daily/2026-07-22.md", sha: "abc123", commitUrl: "https://github.com/me/vault/commit/abc123" });
    const putCall = globalThis.fetch.mock.calls[1];
    expect(putCall[1].method).toBe("PUT");
    const body = JSON.parse(putCall[1].body);
    expect(body.sha).toBeUndefined();
    expect(body.content).toBe(btoa("# Today"));
  });

  it("includes the existing sha when updating a file that already exists", async () => {
    globalThis.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ sha: "existing-sha" }) }) // GET existing
      .mockResolvedValueOnce({ ok: true, json: async () => ({ content: { sha: "new-sha" }, commit: {} }) });

    await writeVaultFile({ owner: "me", repo: "vault", branch: "main", token: "t", path: "Daily/2026-07-22.md", content: "updated" });

    const putCall = globalThis.fetch.mock.calls[1];
    const body = JSON.parse(putCall[1].body);
    expect(body.sha).toBe("existing-sha");
  });

  it("surfaces GitHub's own message when the existence check itself fails (e.g. 403)", async () => {
    globalThis.fetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ message: "API rate limit exceeded for xxx.xxx.xxx.xxx." }),
    });

    await expect(
      writeVaultFile({ owner: "me", repo: "vault", branch: "main", token: "t", path: "x.md", content: "x" })
    ).rejects.toThrow("API rate limit exceeded");
  });

  it("falls back to the bare status when GitHub's error body has no message", async () => {
    globalThis.fetch.mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({}) });

    await expect(
      writeVaultFile({ owner: "me", repo: "vault", branch: "main", token: "t", path: "x.md", content: "x" })
    ).rejects.toThrow(/403/);
  });

  it("throws GitHub's own error message on a failed write", async () => {
    globalThis.fetch
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ message: "sha does not match" }) });

    await expect(
      writeVaultFile({ owner: "me", repo: "vault", branch: "main", token: "t", path: "x.md", content: "x" })
    ).rejects.toThrow("sha does not match");
  });

  it("encodes path segments but preserves the '/' separators", async () => {
    globalThis.fetch
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ content: {}, commit: {} }) });

    await writeVaultFile({ owner: "me", repo: "vault", branch: "main", token: "t", path: "Decisions/A Real Decision.md", content: "x" });

    const getUrl = globalThis.fetch.mock.calls[0][0];
    expect(getUrl).toBe("https://api.github.com/repos/me/vault/contents/Decisions/A%20Real%20Decision.md?ref=main");
  });
});

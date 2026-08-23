import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { base64ToUtf8, utf8ToBase64, testVaultConnection, writeVaultFile, fetchVaultOverview, auditVaultNotes } from "./githubApi.js";

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

describe("githubApi: fetchVaultOverview", () => {
  const contentResponse = (text) => ({ ok: true, json: async () => ({ content: utf8ToBase64(text) }) });

  beforeEach(() => {
    globalThis.fetch = vi.fn(async (url) => {
      const u = String(url);
      if (u.includes("/contents/vault.md")) return contentResponse("# Vault Summary\nrolling summary content");
      if (u.includes("/search/code")) {
        return { ok: true, json: async () => ({ items: [{ path: "Decisions/Important.md" }, { path: "notignored.png" }] }) };
      }
      if (u.includes("/contents/Decisions/Important.md")) return contentResponse("# Important\npriority content");
      if (u.includes("/commits?")) {
        return { ok: true, json: async () => [{ sha: "c1" }, { sha: "c2" }] };
      }
      if (u.endsWith("/commits/c1")) {
        return { ok: true, json: async () => ({ files: [{ filename: "Daily/2026-07-27.md", status: "modified" }] }) };
      }
      if (u.endsWith("/commits/c2")) {
        return { ok: true, json: async () => ({ files: [{ filename: "removed.md", status: "removed" }, { filename: "vault.md", status: "modified" }] }) };
      }
      if (u.includes("/contents/Daily/2026-07-27.md")) return contentResponse("# Today\nrecent content");
      return { ok: false, status: 404 };
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches vault.md, priority-marked notes, and recently-touched notes together", async () => {
    const overview = await fetchVaultOverview({ owner: "me", repo: "vault", branch: "main", token: "t" });
    expect(overview.summary).toBe("# Vault Summary\nrolling summary content");
    expect(overview.priorityNotes).toEqual([{ path: "Decisions/Important.md", content: "# Important\npriority content" }]);
    expect(overview.recentNotes.map((n) => n.path)).toContain("Daily/2026-07-27.md");
    // vault.md itself gets touched by recent commits in a real vault (the
    // nightly Routine rewrites it) but is already surfaced as `summary` —
    // no requirement to dedupe here, just confirming the removed file never
    // shows up.
    expect(overview.recentNotes.some((n) => n.path === "removed.md")).toBe(false);
  });

  it("is fully best-effort — a missing vault.md and a failed search still return whatever else is available", async () => {
    globalThis.fetch = vi.fn(async (url) => {
      const u = String(url);
      if (u.includes("/contents/vault.md")) return { ok: false, status: 404 };
      if (u.includes("/search/code")) return { ok: false, status: 403 };
      if (u.includes("/commits?")) return { ok: false, status: 500 };
      return { ok: false, status: 404 };
    });
    const overview = await fetchVaultOverview({ owner: "me", repo: "vault", branch: "main", token: "t" });
    expect(overview).toEqual({ summary: null, priorityNotes: [], recentNotes: [], selfNote: null, memory: null });
  });
});

describe("githubApi: auditVaultNotes suggested_priority", () => {
  // Five real, resolved incoming links (the PRIORITY_BACKLINK_THRESHOLD) to
  // both Hub.md and AlreadyMarked.md, from five separate Spoke notes — same
  // backlink-count-as-importance-proxy heuristic a well-run personal vault's
  // own nightly maintenance uses instead of real semantic search.
  const NOTES = {
    "Hub.md": "# Hub\n",
    "AlreadyMarked.md": "# Already marked\n**Priority: high**\n",
    "LowTraffic.md": "# Low traffic\n[[Hub]]\n", // only 1 incoming link — below threshold
    "Spoke1.md": "[[Hub]]\n[[AlreadyMarked]]\n",
    "Spoke2.md": "[[Hub]]\n[[AlreadyMarked]]\n",
    "Spoke3.md": "[[Hub]]\n[[AlreadyMarked]]\n",
    "Spoke4.md": "[[Hub]]\n[[AlreadyMarked]]\n",
    "Spoke5.md": "[[Hub]]\n[[AlreadyMarked]]\n",
  };

  beforeEach(() => {
    globalThis.fetch = vi.fn(async (url) => {
      const u = String(url);
      if (u.includes("/git/trees/")) {
        return { ok: true, json: async () => ({ tree: Object.keys(NOTES).map((path) => ({ path, type: "blob" })) }) };
      }
      const contentsMatch = u.match(/\/contents\/([^?]+)/);
      if (contentsMatch) {
        const path = decodeURIComponent(contentsMatch[1]);
        return { ok: true, json: async () => ({ content: utf8ToBase64(NOTES[path] || "") }) };
      }
      return { ok: false, status: 404 };
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("flags a note with 5+ real incoming links and no Priority marker yet, and excludes one that's already marked or below the threshold", async () => {
    const result = await auditVaultNotes({ owner: "me", repo: "vault", branch: "main", token: "t" });
    expect(result.suggested_priority).toEqual(["Hub.md"]);
    expect(result.suggested_priority).not.toContain("AlreadyMarked.md");
    expect(result.suggested_priority).not.toContain("LowTraffic.md");
  });
});

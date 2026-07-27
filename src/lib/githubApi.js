// Minimal client-side GitHub REST API helpers for the connected external
// vault (vaultConnection.js). Deliberately separate from the read-side
// GitHub calls in base44/functions/aiChatStream/entry.ts — that's a
// different (Deno) runtime and can't share a module with browser code,
// same reasoning as chatCommands.js's split from entry.ts's
// SLASH_COMMAND_GUIDE. This file only covers what the client actually
// needs to do itself: test a connection, and write a file (chatActions.js's
// WRITE_VAULT_NOTE) — reads run server-side, inside the model's own tool
// loop, so they can feed results back into its next reasoning step.
const API_BASE = "https://api.github.com";

function headers(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

// Encode each path segment separately — encodeURIComponent alone would
// also escape the "/" separators a repo path needs to keep.
function encodePath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

// btoa/atob only handle Latin1 — this is the standard workaround for
// round-tripping arbitrary UTF-8 text (note content) through them.
export function utf8ToBase64(text) {
  return btoa(unescape(encodeURIComponent(text)));
}

export function base64ToUtf8(b64) {
  return decodeURIComponent(escape(atob(b64)));
}

// Reads one file's raw content via the Contents API, tolerant of it not
// existing — used by fetchVaultOverview below. Not exported alongside
// writeVaultFile's own existence check since that one needs the sha too;
// this one only ever needs the content.
async function readVaultFile({ owner, repo, branch, token, path }) {
  const url = `${API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodePath(path)}?ref=${encodeURIComponent(branch)}`;
  const res = await fetch(url, { headers: headers(token) });
  if (!res.ok) return null;
  const data = await res.json();
  return base64ToUtf8(data.content);
}

const MAX_PRIORITY_NOTES = 5;
const MAX_RECENT_NOTES = 9;
const MAX_COMMITS_SCANNED = 15;

// Same "**Priority: high**" convention a connected personal vault might
// already use for its own important notes — found via GitHub code search
// rather than reading every file in the vault, the same way search_vault
// (entry.ts) already searches note content instead of scanning it all.
async function fetchPriorityNotes({ owner, repo, branch, token }) {
  const q = `"Priority: high" repo:${owner}/${repo}`;
  const res = await fetch(`${API_BASE}/search/code?q=${encodeURIComponent(q)}`, { headers: headers(token) });
  if (!res.ok) return [];
  const data = await res.json();
  const paths = (data.items || [])
    .filter((item) => item.path.endsWith(".md"))
    .slice(0, MAX_PRIORITY_NOTES)
    .map((item) => item.path);
  const contents = await Promise.all(paths.map((path) => readVaultFile({ owner, repo, branch, token, path }).catch(() => null)));
  return paths.map((path, i) => ({ path, content: contents[i] })).filter((n) => n.content);
}

// No single GitHub endpoint lists "N most recently modified files" — walks
// the commit list newest-first, reading each commit's own changed-files
// list (only the single-commit endpoint includes that, not the list one),
// until enough distinct markdown paths are collected or MAX_COMMITS_SCANNED
// is reached, whichever comes first. Bounded on both sides so a big, chatty
// commit history can't turn "load recent context" into an unbounded crawl.
async function fetchRecentNotes({ owner, repo, branch, token }) {
  const listRes = await fetch(
    `${API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?sha=${encodeURIComponent(branch)}&per_page=${MAX_COMMITS_SCANNED}`,
    { headers: headers(token) }
  );
  if (!listRes.ok) return [];
  const commits = await listRes.json();

  const seen = new Set();
  for (const commit of commits) {
    if (seen.size >= MAX_RECENT_NOTES) break;
    const detailRes = await fetch(`${API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits/${commit.sha}`, { headers: headers(token) });
    if (!detailRes.ok) continue;
    const detail = await detailRes.json();
    for (const file of detail.files || []) {
      if (seen.size >= MAX_RECENT_NOTES) break;
      if (file.status !== "removed" && file.filename.endsWith(".md")) seen.add(file.filename);
    }
  }

  const paths = [...seen];
  const contents = await Promise.all(paths.map((path) => readVaultFile({ owner, repo, branch, token, path }).catch(() => null)));
  return paths.map((path, i) => ({ path, content: contents[i] })).filter((n) => n.content);
}

// Force-loaded vault context — the Vaea analog of a Claude Code CLI's own
// SessionStart hook: fetched once per chat session (useChatController.js
// caches it, keyed by session, rather than re-fetching every message) and
// sent to the model unconditionally in every turn's prompt from then on,
// the same way [DATABASE STATE] already is — not left to the model's own
// discretion to decide whether to go read the vault. Everything here is
// best-effort: a vault with no vault.md, no priority-marked notes, or a
// GitHub call that fails just yields less context, never an error the user
// sees — this is enrichment on top of the on-demand vault_* tools, not a
// required capability those tools depend on.
export async function fetchVaultOverview({ owner, repo, branch, token }) {
  const [summary, priorityNotes, recentNotes] = await Promise.all([
    readVaultFile({ owner, repo, branch, token, path: "vault.md" }).catch(() => null),
    fetchPriorityNotes({ owner, repo, branch, token }).catch(() => []),
    fetchRecentNotes({ owner, repo, branch, token }).catch(() => []),
  ]);
  return { summary, priorityNotes, recentNotes };
}

// GET /repos/{owner}/{repo} — used by ExternalVaultSection's "Test
// connection" button. Returns the repo's default branch so the form can
// offer to fill in "branch" when the user leaves it blank.
export async function testVaultConnection({ owner, repo, token }) {
  const res = await fetch(`${API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, { headers: headers(token) });
  if (!res.ok) {
    if (res.status === 404) throw new Error("Repo not found — check the owner/repo names, and that this token can see it.");
    if (res.status === 401) throw new Error("GitHub rejected that token.");
    throw new Error(`GitHub error (${res.status}).`);
  }
  const data = await res.json();
  return { defaultBranch: data.default_branch };
}

// Creates or updates a file via the Contents API. Looks up the current
// file's sha itself when it already exists — the model is never trusted
// to have tracked it correctly across turns, and a missing/stale sha is
// exactly the kind of thing that turns "log a note" into a confusing
// 409 conflict instead of just working.
export async function writeVaultFile({ owner, repo, branch, token, path, content, commitMessage }) {
  const url = `${API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodePath(path)}`;
  let sha;
  const existing = await fetch(`${url}?ref=${encodeURIComponent(branch)}`, { headers: headers(token) });
  if (existing.ok) {
    sha = (await existing.json()).sha;
  } else if (existing.status !== 404) {
    // A bare status code here is useless for telling apart the three real
    // causes GitHub uses 403 for on this endpoint (rate limit exceeded, the
    // token has no Contents permission on this repo, org SSO not
    // authorized for the token) — each has its own distinct `message` in
    // the body. The PUT below already reads its own error body; this GET
    // never did.
    const body = await existing.json().catch(() => ({}));
    throw new Error(body.message || `Couldn't check for an existing file (${existing.status}).`);
  }

  const res = await fetch(url, {
    method: "PUT",
    headers: { ...headers(token), "Content-Type": "application/json" },
    body: JSON.stringify({
      message: commitMessage || `Update ${path} via Vaea`,
      content: utf8ToBase64(content),
      branch,
      ...(sha ? { sha } : {}),
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `GitHub write failed (${res.status}).`);
  }
  const result = await res.json();
  return { path, sha: result.content?.sha, commitUrl: result.commit?.html_url };
}

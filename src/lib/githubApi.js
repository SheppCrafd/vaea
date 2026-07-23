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

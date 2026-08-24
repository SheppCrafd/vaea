// Minimal client-side GitHub REST API helpers for the connected external
// vault (vaultConnection.js). Deliberately separate from the equivalent
// GitHub calls in base44/functions/aiChatStream/entry.ts — that's a
// different (Deno) runtime and can't share a module with browser code,
// same reasoning as chatCommands.js's split from entry.ts's
// SLASH_COMMAND_GUIDE. Originally this file only covered what the client
// needed for itself (connection test, write, the once-per-session force-
// loaded overview) since base44-hosted chat's own vault_* tools ran
// server-side, inside the model's own tool loop. BYOK/Local Mode have no
// server at all, so their own tool loop (localTools.js) now calls the
// listVaultNoteRepo/readVaultNoteContent/searchVaultNotes/auditVaultNotes
// exports below directly — the client-side twins of entry.ts's own
// list_vault_notes/read_vault_note/search_vault/audit_vault tool bodies.
const API_BASE = "https://api.github.com";

function headers(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

// Encode each path segment separately — encodeURIComponent alone would
// also escape the "/" separators a repo path needs to keep. Rejects '.',
// '..', and empty segments before they reach GitHub's Contents API — the
// same defense-in-depth guard entry.ts's own encodeRepoPath has (mirror
// this file's own comment there: not a fix for an exploitable bug, since
// the API resolves paths within the repo the token is already scoped to,
// not a filesystem, but a cheap guard against a constructed path resolving
// somewhere unintended within that repo). Was missed here when the other
// one was added — same fix, just applied to its client-side sibling.
function encodePath(path) {
  const segments = path.split("/");
  if (segments.some((s) => s === "" || s === "." || s === "..")) {
    throw new Error(`Invalid vault path "${path}"`);
  }
  return segments.map(encodeURIComponent).join("/");
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

// read_vault_note's own throwing twin of readVaultFile above — a tool call
// needs a real, honest error message on failure (quoted verbatim to the
// user per systemPrompt.js's VAEA VAULT rule), not a silent null meant for
// best-effort context-loading.
export async function readVaultNoteContent({ owner, repo, branch, token, path }) {
  const url = `${API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodePath(path)}?ref=${encodeURIComponent(branch)}`;
  const res = await fetch(url, { headers: headers(token) });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `GitHub error (${res.status}).`);
  }
  const data = await res.json();
  return base64ToUtf8(data.content);
}

// list_vault_notes' own client-side twin of entry.ts's listVaultNoteRepo —
// every markdown note's path, via the Git Trees API (recursive), the only
// GitHub endpoint that lists a whole repo's files in one call.
export async function listVaultNoteRepo({ owner, repo, branch, token }) {
  const url = `${API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(branch)}?recursive=1`;
  const res = await fetch(url, { headers: headers(token) });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `GitHub error (${res.status}).`);
  }
  const data = await res.json();
  return (data.tree || []).filter((entry) => entry.type === "blob" && entry.path.endsWith(".md")).map((entry) => entry.path);
}

// search_vault's own client-side twin of entry.ts's own GitHub code search.
export async function searchVaultNotes({ owner, repo, token }, query) {
  const q = `${query} repo:${owner}/${repo}`;
  const res = await fetch(`${API_BASE}/search/code?q=${encodeURIComponent(q)}`, {
    headers: { ...headers(token), Accept: "application/vnd.github.text-match+json" },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `GitHub error (${res.status}).`);
  }
  const data = await res.json();
  const matches = (data.items || []).slice(0, 15).map((item) => ({
    path: item.path,
    snippet: (item.text_matches || []).map((m) => m.fragment).join(" … ").slice(0, 400),
  }));
  return { count: data.total_count ?? matches.length, matches };
}

// audit_vault's own client-side twin of entry.ts's own wikilink audit:
// broken links (pointing at a note that doesn't exist) and isolated notes
// (zero incoming or outgoing [[links]]). Reads every scanned note's content
// once, same MAX_NOTES cap as the server-side version.
const MAX_AUDIT_NOTES = 80;
// A small stopword list, not a real NLP pipeline — good enough to keep
// "the"/"and"/"with" out of auto-generated tags and keyword-overlap checks
// without pulling in a dependency for it. Deliberately short; false
// negatives here just mean a common word slips into a tag, not a crash.
const STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "have", "has", "was",
  "were", "are", "not", "but", "you", "your", "our", "their", "its", "into",
  "about", "when", "what", "which", "who", "how", "will", "would", "could",
  "should", "there", "here", "than", "then", "them", "they", "been", "being",
  "over", "under", "some", "more", "most", "such", "each", "every", "any",
]);

function extractWords(text) {
  return (text.toLowerCase().match(/[a-z][a-z'-]{2,}/g) || []).filter((w) => !STOPWORDS.has(w));
}

// Auto-tagging (no cloud API, no embeddings — a plain word-frequency
// heuristic, consistent with the rest of this app's local-first model): the
// N most frequent non-stopword words in a note, title words weighted higher
// since a note's own title is usually its best topic signal.
const TAGS_PER_NOTE = 5;
function extractTags(title, content) {
  const counts = new Map();
  for (const w of extractWords(title)) counts.set(w, (counts.get(w) || 0) + 3);
  for (const w of extractWords(content)) counts.set(w, (counts.get(w) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, TAGS_PER_NOTE).map(([w]) => w);
}

// Jaccard similarity of each note's word set — a plain, explainable
// near-duplicate signal (no embeddings/cloud call) good enough to flag "you
// might have written this twice," not a semantic-similarity engine.
const DUPLICATE_THRESHOLD = 0.6;
function jaccard(a, b) {
  let intersection = 0;
  for (const w of a) if (b.has(w)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export async function auditVaultNotes({ owner, repo, branch, token }) {
  const paths = await listVaultNoteRepo({ owner, repo, branch, token });
  const scanned = paths.slice(0, MAX_AUDIT_NOTES);
  const titleByPath = new Map(scanned.map((p) => [p, p.split("/").pop().replace(/\.md$/, "").toLowerCase()]));
  const pathByTitle = new Map([...titleByPath.entries()].map(([p, t]) => [t, p]));

  const outgoing = new Map(); // path -> Set(linked titles, lowercased)
  const wordSets = new Map(); // path -> Set(words) — reused for suggested_links and possible_duplicates below
  const tags = {}; // path -> string[]
  const hasPriorityMarker = new Map(); // path -> boolean, for suggested_priority below
  const linkRegex = /\[\[([^\]|#]+)/g;
  for (const path of scanned) {
    const content = await readVaultNoteContent({ owner, repo, branch, token, path });
    const links = new Set();
    let m;
    while ((m = linkRegex.exec(content))) links.add(m[1].trim().toLowerCase());
    outgoing.set(path, links);
    wordSets.set(path, new Set(extractWords(content)));
    tags[path] = extractTags(titleByPath.get(path), content);
    hasPriorityMarker.set(path, /\*\*Priority:\s*high\*\*/i.test(content));
  }

  const broken_links = [];
  const links = []; // {from, to} — every wikilink that resolved to a real note, the Mind Map page's edge list
  const hasIncoming = new Set();
  const incomingCount = new Map(); // path -> number of real, resolved incoming links — feeds suggested_priority below
  for (const [path, linkTitles] of outgoing) {
    for (const linkedTitle of linkTitles) {
      const target = pathByTitle.get(linkedTitle);
      if (target) {
        hasIncoming.add(target);
        incomingCount.set(target, (incomingCount.get(target) || 0) + 1);
        links.push({ from: path, to: target });
      } else {
        broken_links.push({ from: path, broken_link: linkedTitle });
      }
    }
  }
  const isolated_notes = scanned.filter((p) => outgoing.get(p).size === 0 && !hasIncoming.has(p));
  // A note real other notes link to a lot is a real "this matters" signal —
  // same proxy-for-importance heuristic a well-run personal vault's own
  // nightly maintenance uses (backlink count, not manual tagging) instead of
  // real semantic search, which would be overkill at this scale. Vaea has no
  // server-side cron to run that automatically (see reflectionTrigger.js's
  // own honesty note on the same limitation) — this only ever surfaces as a
  // real, user-confirmable /vault-tidy proposal, never a silent auto-tag.
  const PRIORITY_BACKLINK_THRESHOLD = 5;
  const suggested_priority = scanned.filter(
    (p) => (incomingCount.get(p) || 0) >= PRIORITY_BACKLINK_THRESHOLD && !hasPriorityMarker.get(p)
  );

  // Auto-linking suggestions and duplicate detection share one O(n^2) pass
  // over the scanned set (bounded by MAX_AUDIT_NOTES, so at most ~3,200
  // pairs) — a note pair with real word overlap that ISN'T already linked
  // either direction is a suggestion; a pair past DUPLICATE_THRESHOLD is a
  // possible duplicate instead (a much higher bar — most related notes
  // should never trip this).
  const suggested_links = [];
  const possible_duplicates = [];
  for (let i = 0; i < scanned.length; i++) {
    for (let j = i + 1; j < scanned.length; j++) {
      const pathA = scanned[i];
      const pathB = scanned[j];
      const similarity = jaccard(wordSets.get(pathA), wordSets.get(pathB));
      if (similarity < 0.15) continue;
      const titleA = titleByPath.get(pathA);
      const titleB = titleByPath.get(pathB);
      const alreadyLinked = outgoing.get(pathA).has(titleB) || outgoing.get(pathB).has(titleA);
      if (similarity >= DUPLICATE_THRESHOLD) {
        possible_duplicates.push({ a: pathA, b: pathB, similarity: Math.round(similarity * 100) / 100 });
      } else if (!alreadyLinked) {
        suggested_links.push({ a: pathA, b: pathB, similarity: Math.round(similarity * 100) / 100 });
      }
    }
  }
  suggested_links.sort((a, b) => b.similarity - a.similarity);
  possible_duplicates.sort((a, b) => b.similarity - a.similarity);

  return {
    notes_scanned: scanned.length,
    notes_total: paths.length,
    broken_links,
    links,
    isolated_notes,
    tags,
    suggested_priority,
    suggested_links: suggested_links.slice(0, 20),
    possible_duplicates: possible_duplicates.slice(0, 20),
  };
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
// "Vaea Self.md" — the reflection feature's (reflectionSummary.js) home for
// the assistant's own accumulating notes about itself, force-loaded the same
// way vault.md is, so it's always current without a tool round-trip.
// Deliberately not named "identity.md"/"self.md" — a vault connected here
// might be the same one someone already uses for another AI assistant's own
// identity notes, and a bare generic name would risk colliding with that.
export const SELF_NOTE_PATH = "Vaea Self.md";

// Size management for Vaea Self.md — three layers, each independent, each a
// real backstop rather than trusting the layer before it:
//  1. reflectionSummary.js's buildReflectionInstruction tells the model to
//     consolidate rather than keep appending once the file's already near
//     SELF_NOTE_TARGET_MAX_CHARS — a soft, prompt-level nudge.
//  2. chatActions.js's isReflectionAutoExecutable refuses to auto-execute a
//     write past SELF_NOTE_HARD_CAP_CHARS (demotes it to a normal confirm-
//     gated action instead) — catches a runaway generation the prompt
//     guidance failed to prevent, before it's ever silently committed.
//  3. renderVaultOverview (systemPrompt.js / entry.ts) hard-truncates
//     whatever's actually in the file to SELF_NOTE_TARGET_MAX_CHARS before
//     including it in any prompt — holds even if a user pastes something
//     huge into the file by hand outside of Vaea entirely, so no failure
//     mode anywhere in this chain can silently blow up every future prompt.
export const SELF_NOTE_TARGET_MAX_CHARS = 6000; // ~1500 tokens — a real "working notes" budget, not a hard wall
export const SELF_NOTE_HARD_CAP_CHARS = 20000; // well past "the model is misbehaving," not a normal size

// "Vaea Memory.md" — durable facts/preferences the assistant learns about
// the user and their work, distinct from Vaea Self.md's "how I should
// operate" standing instructions. Organized under "## General" plus one
// "## <Project title>" section per project a fact is scoped to (so a detail
// learned about one project never bleeds into another), same force-loaded
// pattern as vault.md/Vaea Self.md — always current, no tool round-trip.
// Cross-device sync is a free side effect of being vault-backed: this is a
// GitHub repo, so it already follows the user everywhere Vaea Brain does.
export const MEMORY_NOTE_PATH = "Vaea Memory.md";
export const MEMORY_NOTE_TARGET_MAX_CHARS = 6000;

export async function fetchVaultOverview({ owner, repo, branch, token }) {
  const [summary, priorityNotes, recentNotes, selfNote, memory] = await Promise.all([
    readVaultFile({ owner, repo, branch, token, path: "vault.md" }).catch(() => null),
    fetchPriorityNotes({ owner, repo, branch, token }).catch(() => []),
    fetchRecentNotes({ owner, repo, branch, token }).catch(() => []),
    readVaultFile({ owner, repo, branch, token, path: SELF_NOTE_PATH }).catch(() => null),
    readVaultFile({ owner, repo, branch, token, path: MEMORY_NOTE_PATH }).catch(() => null),
  ]);
  return { summary, priorityNotes, recentNotes, selfNote, memory };
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

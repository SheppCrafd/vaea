// Vaea Self.md's internal structure — two coexisting sections with two
// different owners, so neither writer has to know or preserve the other's
// exact content, just call mergeSelfNoteSection with its own:
//   ## Identity — Settings/`/setup`-owned (name/identity/soul/about-you,
//     the same fields aiPreferences.js already persists) — mirrored here so
//     the vault file is a real, human-readable, git-backed reflection of who
//     the assistant is, not just its own free-form working notes.
//   ## Notes — reflectionSummary.js/the reflection turn's own accumulating
//     observations about itself. Never touches Identity; told explicitly to
//     carry it forward unchanged (see buildReflectionInstruction).
import { loadVaultConnection, isVaultConnected } from "@/lib/vaultConnection";
import { listVaultNoteRepo, readVaultNoteContent, writeVaultFile, SELF_NOTE_PATH } from "@/lib/githubApi";

export const SELF_NOTE_IDENTITY_HEADER = "Identity";
export const SELF_NOTE_NOTES_HEADER = "Notes";
// A dream cycle's consented-only user-behavior observations (see
// dreamSummary.js's buildDreamInstruction) — kept strictly separate from
// "## Notes", which stays self-only regardless of consent.
export const SELF_NOTE_USER_HEADER = "User Notes";

// Splits markdown content into an ordered list of {header, lines} sections
// on "## " headers — header is null for any content before the first one
// (a title line, stray notes, etc.), preserved as-is rather than dropped.
function parseSections(content) {
  const lines = (content || "").split("\n");
  const sections = [];
  let current = { header: null, lines: [] };
  for (const line of lines) {
    const m = line.match(/^## (.+)$/);
    if (m) {
      sections.push(current);
      current = { header: m[1].trim(), lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  sections.push(current);
  return sections;
}

function stringifySections(sections) {
  const rendered = sections
    .map((s) => {
      const body = s.lines.join("\n").trim();
      if (!body) return s.header ? "" : ""; // an empty section (header with nothing under it) contributes nothing
      return s.header ? `## ${s.header}\n${body}` : body;
    })
    .filter(Boolean);
  return rendered.length ? `${rendered.join("\n\n")}\n` : "";
}

// Replaces (or appends, if missing) one named "## <header>" section's body,
// preserving every other section verbatim and in its original position.
// Pure and synchronous — the actual read-current/write-back happens in the
// callers below (and, for the reflection turn's own Notes updates, via a
// plain WRITE_VAULT_NOTE the model issues after being told the same rule in
// its instructions — see reflectionSummary.js).
export function mergeSelfNoteSection(content, header, body) {
  const sections = parseSections(content);
  const idx = sections.findIndex((s) => s.header === header);
  const newSection = { header, lines: body.split("\n") };
  if (idx === -1) sections.push(newSection);
  else sections[idx] = newSection;
  return stringifySections(sections);
}

// Structurally removes the "## User Notes" section from a full self-note
// body, regardless of what the model actually wrote there — the real
// backstop behind userAnalysisConsent, not just the prompt instruction
// telling the model not to write it (see dreamSummary.js's
// buildDreamInstruction). Called by useChatController.js's runReflectionTurn
// on every reflection-turn WRITE_VAULT_NOTE to SELF_NOTE_PATH whenever
// userAnalysisConsent isn't true, BEFORE the write is ever allowed to
// auto-execute — a consent-false model output that tries to smuggle
// user-behavior content into the file anyway cannot succeed, since the
// client rewrites the content it actually persists. No-op if the section
// isn't present.
export function stripUserNotesSection(content) {
  const sections = parseSections(content).filter((s) => s.header !== SELF_NOTE_USER_HEADER);
  return stringifySections(sections);
}

// Bare vault filenames each identity field cross-links to when the connected
// vault happens to keep an assistant-identity note under that name — the
// same three-way identity/soul/user split a Claude Code vault already
// documents in its own CLAUDE.md. Matched by basename only (case-
// insensitive, any folder), same convention auditVaultNotes' own
// titleByPath uses, since that's how Obsidian itself resolves a bare
// [[wikilink]] regardless of which folder the target actually lives in.
const IDENTITY_LINK_FILES = { identity: "identity.md", soul: "soul.md", userProfile: "user.md" };

// Looks up, for each field in IDENTITY_LINK_FILES, whether a matching file
// actually exists anywhere in the vault's own file list — never assumed.
// Linking to a file that isn't there would hand [[wikilink]]s straight to
// audit_vault to flag as broken, which defeats the point of a feature meant
// to keep the vault tidy in the first place.
function findIdentityLinkTargets(vaultPaths) {
  const links = {};
  for (const [field, filename] of Object.entries(IDENTITY_LINK_FILES)) {
    const match = (vaultPaths || []).find((p) => p.split("/").pop().toLowerCase() === filename);
    if (match) links[field] = match.split("/").pop().replace(/\.md$/i, "");
  }
  return links;
}

// `links` (optional) is field -> the real basename to wikilink to, e.g.
// { identity: "identity" } — see findIdentityLinkTargets above. Left empty
// by default so this stays a pure, no-network function callable from tests
// and anywhere else that just wants the plain rendered section.
export function buildIdentitySection(identity, links = {}) {
  const i = identity || {};
  const withLink = (text, field) => (links[field] ? `${text} (see [[${links[field]}]])` : text);
  return [
    `**Name:** ${i.name || "(not set)"}`,
    `**Identity:** ${withLink(i.identity || "(not set)", "identity")}`,
    `**Soul (tone & protocol):** ${withLink(i.soul || "(not set)", "soul")}`,
    `**About you:** ${withLink(i.userProfile || "(not set)", "userProfile")}`,
  ].join("\n");
}

// Called after aiIdentity is saved (Settings' own Save button, or `/setup`'s
// SET_AI_IDENTITY tool call — both call the same underlying saveAiIdentity,
// but this is invoked from each of those two call sites individually rather
// than from inside saveAiIdentity itself, keeping that module a plain
// storage primitive with no network/vault dependency of its own). Best-
// effort and silent on failure, matching every other vault write in this
// app — syncing to the vault must never be the reason an identity save
// itself appears to fail.
export async function syncIdentityToSelfNote(identity) {
  try {
    const connection = await loadVaultConnection();
    if (!isVaultConnected(connection)) return;
    const [current, vaultPaths] = await Promise.all([
      readVaultNoteContent({ ...connection, path: SELF_NOTE_PATH }).catch(() => ""),
      listVaultNoteRepo(connection).catch(() => []),
    ]);
    const links = findIdentityLinkTargets(vaultPaths);
    const merged = mergeSelfNoteSection(current, SELF_NOTE_IDENTITY_HEADER, buildIdentitySection(identity, links));
    await writeVaultFile({
      ...connection,
      path: SELF_NOTE_PATH,
      content: merged,
      commitMessage: "Update Vaea Self.md (identity)",
    });
  } catch {
    // best-effort — the identity save itself already succeeded regardless
  }
}

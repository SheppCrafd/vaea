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
import { readVaultNoteContent, writeVaultFile, SELF_NOTE_PATH } from "@/lib/githubApi";

export const SELF_NOTE_IDENTITY_HEADER = "Identity";
export const SELF_NOTE_NOTES_HEADER = "Notes";

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

export function buildIdentitySection(identity) {
  const i = identity || {};
  return [
    `**Name:** ${i.name || "(not set)"}`,
    `**Identity:** ${i.identity || "(not set)"}`,
    `**Soul (tone & protocol):** ${i.soul || "(not set)"}`,
    `**About you:** ${i.userProfile || "(not set)"}`,
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
    const current = await readVaultNoteContent({ ...connection, path: SELF_NOTE_PATH }).catch(() => "");
    const merged = mergeSelfNoteSection(current, SELF_NOTE_IDENTITY_HEADER, buildIdentitySection(identity));
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

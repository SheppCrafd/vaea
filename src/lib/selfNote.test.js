import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/vaultConnection", () => ({
  loadVaultConnection: vi.fn(),
  isVaultConnected: vi.fn(),
}));
vi.mock("@/lib/githubApi", () => ({
  listVaultNoteRepo: vi.fn(),
  readVaultNoteContent: vi.fn(),
  writeVaultFile: vi.fn(),
  SELF_NOTE_PATH: "Vaea Self.md",
}));

import { loadVaultConnection, isVaultConnected } from "@/lib/vaultConnection";
import { listVaultNoteRepo, readVaultNoteContent, writeVaultFile } from "@/lib/githubApi";
import {
  mergeSelfNoteSection,
  stripUserNotesSection,
  buildIdentitySection,
  syncIdentityToSelfNote,
  SELF_NOTE_IDENTITY_HEADER,
  SELF_NOTE_NOTES_HEADER,
  SELF_NOTE_USER_HEADER,
} from "./selfNote.js";

beforeEach(() => {
  vi.clearAllMocks();
  listVaultNoteRepo.mockResolvedValue([]); // no identity/soul/user.md by default — no wikilinks
});

describe("mergeSelfNoteSection", () => {
  it("appends a brand-new section to empty content", () => {
    const result = mergeSelfNoteSection("", "Identity", "**Name:** Vaea Chat");
    expect(result).toBe("## Identity\n**Name:** Vaea Chat\n");
  });

  it("replaces an existing section's body while leaving every other section untouched", () => {
    const content = "## Identity\nold identity\n\n## Notes\nsome notes I wrote myself\n";
    const result = mergeSelfNoteSection(content, "Identity", "new identity");
    expect(result).toContain("## Identity\nnew identity");
    expect(result).toContain("## Notes\nsome notes I wrote myself");
    expect(result).not.toContain("old identity");
  });

  it("preserves section order — updating the first section doesn't move it after the second", () => {
    const content = "## Identity\nidentity body\n\n## Notes\nnotes body\n";
    const result = mergeSelfNoteSection(content, "Identity", "updated identity");
    expect(result.indexOf("## Identity")).toBeLessThan(result.indexOf("## Notes"));
  });

  it("appends a missing section after existing ones rather than replacing anything", () => {
    const content = "## Identity\nidentity body\n";
    const result = mergeSelfNoteSection(content, "Notes", "first note");
    expect(result).toContain("## Identity\nidentity body");
    expect(result).toContain("## Notes\nfirst note");
  });

  it("preserves untitled content before the first '## ' header", () => {
    const content = "# Vaea Self\n\n## Notes\nold note\n";
    const result = mergeSelfNoteSection(content, "Notes", "new note");
    expect(result).toContain("# Vaea Self");
    expect(result).toContain("## Notes\nnew note");
  });

  it("drops a section entirely when its merged body is empty, rather than leaving a bare header", () => {
    const content = "## Identity\nidentity body\n\n## Notes\nold note\n";
    const result = mergeSelfNoteSection(content, "Notes", "");
    expect(result).not.toContain("## Notes");
    expect(result).toContain("## Identity\nidentity body");
  });
});

describe("stripUserNotesSection", () => {
  it("removes the User Notes section while leaving Identity and Notes untouched", () => {
    const content = `## ${SELF_NOTE_IDENTITY_HEADER}\nidentity body\n\n## ${SELF_NOTE_NOTES_HEADER}\nself note\n\n## ${SELF_NOTE_USER_HEADER}\nuser behaves like X`;
    const result = stripUserNotesSection(content);
    expect(result).toContain(`## ${SELF_NOTE_IDENTITY_HEADER}\nidentity body`);
    expect(result).toContain(`## ${SELF_NOTE_NOTES_HEADER}\nself note`);
    expect(result).not.toContain(SELF_NOTE_USER_HEADER);
    expect(result).not.toContain("user behaves like X");
  });

  it("is a no-op when the User Notes section isn't present", () => {
    const content = `## ${SELF_NOTE_IDENTITY_HEADER}\nidentity body\n\n## ${SELF_NOTE_NOTES_HEADER}\nself note\n`;
    expect(stripUserNotesSection(content)).toBe(content);
  });

  it("returns empty content unchanged", () => {
    expect(stripUserNotesSection("")).toBe("");
  });
});

describe("buildIdentitySection", () => {
  it("renders every field with a placeholder for anything unset", () => {
    const text = buildIdentitySection({ name: "Vaea Chat", identity: "", soul: null, userProfile: undefined });
    expect(text).toContain("**Name:** Vaea Chat");
    expect(text).toContain("**Identity:** (not set)");
    expect(text).toContain("**Soul (tone & protocol):** (not set)");
    expect(text).toContain("**About you:** (not set)");
  });

  it("handles a null/undefined identity the same as an empty one", () => {
    expect(buildIdentitySection(null)).toBe(buildIdentitySection({}));
  });

  it("appends a wikilink to a field only when one was actually found", () => {
    const text = buildIdentitySection(
      { identity: "A helpful assistant", soul: "Direct", userProfile: "Solo dev" },
      { identity: "identity", userProfile: "user" }
    );
    expect(text).toContain("A helpful assistant (see [[identity]])");
    expect(text).toContain("Solo dev (see [[user]])");
    expect(text).toContain("**Soul (tone & protocol):** Direct");
    expect(text).not.toContain("Direct (see");
  });

  it("adds no wikilinks at all when links is omitted", () => {
    const text = buildIdentitySection({ identity: "A helpful assistant" });
    expect(text).not.toContain("[[");
  });
});

describe("syncIdentityToSelfNote", () => {
  it("no-ops silently when no vault is connected", async () => {
    loadVaultConnection.mockResolvedValue({});
    isVaultConnected.mockReturnValue(false);

    await syncIdentityToSelfNote({ name: "Vaea Chat" });

    expect(readVaultNoteContent).not.toHaveBeenCalled();
    expect(writeVaultFile).not.toHaveBeenCalled();
  });

  it("merges the Identity section into whatever the vault file already has, preserving its Notes section", async () => {
    loadVaultConnection.mockResolvedValue({ owner: "me", repo: "vault", branch: "main", token: "tok" });
    isVaultConnected.mockReturnValue(true);
    readVaultNoteContent.mockResolvedValue("## Identity\nold\n\n## Notes\nmy own note\n");

    await syncIdentityToSelfNote({ name: "Vaea Chat", identity: "A helpful assistant" });

    expect(writeVaultFile).toHaveBeenCalledTimes(1);
    const written = writeVaultFile.mock.calls[0][0];
    expect(written.path).toBe("Vaea Self.md");
    expect(written.content).toContain(`## ${SELF_NOTE_IDENTITY_HEADER}\n**Name:** Vaea Chat`);
    expect(written.content).toContain(`## ${SELF_NOTE_NOTES_HEADER}\nmy own note`);
  });

  it("treats a missing/unreadable file the same as empty content rather than throwing", async () => {
    loadVaultConnection.mockResolvedValue({ owner: "me", repo: "vault", branch: "main", token: "tok" });
    isVaultConnected.mockReturnValue(true);
    readVaultNoteContent.mockRejectedValue(new Error("404"));

    await syncIdentityToSelfNote({ name: "Vaea Chat" });

    expect(writeVaultFile).toHaveBeenCalledTimes(1);
    expect(writeVaultFile.mock.calls[0][0].content).toContain("**Name:** Vaea Chat");
  });

  it("swallows a write failure rather than throwing — the identity save itself already succeeded", async () => {
    loadVaultConnection.mockResolvedValue({ owner: "me", repo: "vault", branch: "main", token: "tok" });
    isVaultConnected.mockReturnValue(true);
    readVaultNoteContent.mockResolvedValue("");
    writeVaultFile.mockRejectedValue(new Error("network down"));

    await expect(syncIdentityToSelfNote({ name: "Vaea Chat" })).resolves.toBeUndefined();
  });

  it("cross-links a field to its matching vault file, found anywhere in the repo, but only for fields with a real match", async () => {
    loadVaultConnection.mockResolvedValue({ owner: "me", repo: "vault", branch: "main", token: "tok" });
    isVaultConnected.mockReturnValue(true);
    readVaultNoteContent.mockResolvedValue("");
    listVaultNoteRepo.mockResolvedValue(["Identity.md", "People/soul.md", "vault.md"]); // no user.md

    await syncIdentityToSelfNote({ identity: "A helpful assistant", soul: "Direct", userProfile: "Solo dev" });

    const written = writeVaultFile.mock.calls[0][0].content;
    expect(written).toContain("A helpful assistant (see [[Identity]])"); // matched case-insensitively, real basename kept
    expect(written).toContain("Direct (see [[soul]])"); // matched despite living in a subfolder
    expect(written).toContain("**About you:** Solo dev"); // no user.md found — no link
    expect(written).not.toContain("Solo dev (see");
  });

  it("adds no wikilinks when the vault has none of identity.md/soul.md/user.md", async () => {
    loadVaultConnection.mockResolvedValue({ owner: "me", repo: "vault", branch: "main", token: "tok" });
    isVaultConnected.mockReturnValue(true);
    readVaultNoteContent.mockResolvedValue("");
    listVaultNoteRepo.mockResolvedValue(["vault.md", "Daily/2026-07-28.md"]);

    await syncIdentityToSelfNote({ identity: "A helpful assistant" });

    expect(writeVaultFile.mock.calls[0][0].content).not.toContain("[[");
  });

  it("still writes successfully even if the vault file listing itself fails", async () => {
    loadVaultConnection.mockResolvedValue({ owner: "me", repo: "vault", branch: "main", token: "tok" });
    isVaultConnected.mockReturnValue(true);
    readVaultNoteContent.mockResolvedValue("");
    listVaultNoteRepo.mockRejectedValue(new Error("rate limited"));

    await syncIdentityToSelfNote({ name: "Vaea Chat" });

    expect(writeVaultFile).toHaveBeenCalledTimes(1);
    expect(writeVaultFile.mock.calls[0][0].content).toContain("**Name:** Vaea Chat");
  });
});

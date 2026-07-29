import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/vaultConnection", () => ({
  loadVaultConnection: vi.fn(),
  isVaultConnected: vi.fn(),
}));
vi.mock("@/lib/githubApi", () => ({
  readVaultNoteContent: vi.fn(),
  writeVaultFile: vi.fn(),
  SELF_NOTE_PATH: "Vaea Self.md",
}));

import { loadVaultConnection, isVaultConnected } from "@/lib/vaultConnection";
import { readVaultNoteContent, writeVaultFile } from "@/lib/githubApi";
import {
  mergeSelfNoteSection,
  buildIdentitySection,
  syncIdentityToSelfNote,
  SELF_NOTE_IDENTITY_HEADER,
  SELF_NOTE_NOTES_HEADER,
} from "./selfNote.js";

beforeEach(() => {
  vi.clearAllMocks();
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
});

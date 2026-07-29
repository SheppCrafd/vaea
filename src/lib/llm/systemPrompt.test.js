import { describe, it, expect } from "vitest";
import { buildContextPrompt } from "./systemPrompt.js";

// Covers only the new Vaea Self.md size-management behavior added to
// renderVaultOverview (private — exercised here through buildContextPrompt's
// public output, not exported directly). No existing test file covered
// buildContextPrompt before this; not attempting to backfill full coverage
// of the rest of it here, out of scope for this change.
const baseArgs = {
  activeProjectId: null,
  areas: [], products: [], projects: [], archivedProjects: [],
  tasks: [], archivedTasks: [], stakeholders: [], departments: [], notes: [],
  conversationHistory: "", userText: "hi", aiIdentity: {}, protocolReminderRequested: false,
  externalVault: { owner: "me", repo: "vault", token: "t" },
};

describe("buildContextPrompt's vault self-note rendering — the hard read-time truncation backstop", () => {
  it("includes a short self-note in full, untruncated", () => {
    const prompt = buildContextPrompt({ ...baseArgs, vaultOverview: { selfNote: "Short note about myself." } });
    expect(prompt).toContain("--- Vaea Self.md (the assistant's own notes about itself) ---\nShort note about myself.");
    expect(prompt).not.toContain("truncated");
  });

  it("hard-truncates a self-note past the shared size cap, regardless of how it got that large", () => {
    const huge = "x".repeat(10000);
    const prompt = buildContextPrompt({ ...baseArgs, vaultOverview: { selfNote: huge } });
    expect(prompt).toContain("[...truncated — the full note is longer than fits here...]");
    // The included run of "x" characters is capped at the shared 6000-char
    // limit — not the full 10000 that was actually in the file.
    expect(prompt.match(/x+/)[0].length).toBe(6000);
  });

  it("omits the section entirely when there's no self-note yet", () => {
    const prompt = buildContextPrompt({ ...baseArgs, vaultOverview: { selfNote: null } });
    expect(prompt).not.toContain("Vaea Self.md");
  });
});

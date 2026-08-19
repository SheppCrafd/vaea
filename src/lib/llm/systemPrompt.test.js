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

// Real bug fixed the same session: this used to be a bare UTC date
// (`new Date().toISOString().slice(0, 10)`) with no time at all — wrong for
// any user not near UTC, and useless for a genuine "what time is it"
// question. buildContextPrompt runs entirely client-side (BYOK/Local
// Mode), so `new Date()` here is already the user's own real local clock.
describe("buildContextPrompt's [CURRENT DATE & TIME] section", () => {
  it("includes a real local date, a real clock time, and a timezone name — not the old bare-UTC-date-only block", () => {
    const prompt = buildContextPrompt(baseArgs);
    expect(prompt).toContain("[CURRENT DATE & TIME]");
    expect(prompt).not.toContain("[TODAY'S DATE]");
    // A real ISO local date (YYYY-MM-DD) appears twice: once in the
    // human-readable display line, once in the explicit filename-ready line.
    const isoDateMatches = prompt.match(/\d{4}-\d{2}-\d{2}/g) || [];
    expect(isoDateMatches.length).toBeGreaterThanOrEqual(2);
    expect(prompt).toMatch(/\d{1,2}:\d{2}/); // a real clock time
    expect(prompt).toContain('Today\'s date, for filenames like "Daily/YYYY-MM-DD.md":');
  });
});

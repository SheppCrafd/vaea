import { afterEach, describe, expect, it, vi } from "vitest";

// claimedThisPageLoad is real module-level, page-load-scoped state (by
// design — see the module's own comment) with no reset export, so each test
// gets a fully fresh module instance via resetModules + a dynamic import,
// same as if a new page load had happened. reflectionPreferences.js is
// mocked per test so each one controls exactly what "due" means without
// needing real deviceStorage or real elapsed time.
async function loadTriggerWith(prefs) {
  vi.resetModules();
  vi.doMock("@/lib/reflectionPreferences", () => ({
    loadReflectionPreferences: vi.fn().mockResolvedValue(prefs),
    saveReflectionPreferences: vi.fn().mockResolvedValue(undefined),
    REFLECTION_INTERVAL_MS: 3 * 60 * 60 * 1000,
    VAULT_TIDY_INTERVAL_MS: 24 * 60 * 60 * 1000,
    DREAM_INTERVAL_MS: 24 * 60 * 60 * 1000,
  }));
  const mod = await import("./reflectionTrigger.js");
  const prefsMod = await import("@/lib/reflectionPreferences");
  return { ...mod, saveReflectionPreferences: prefsMod.saveReflectionPreferences };
}

const hoursAgo = (h) => new Date(Date.now() - h * 60 * 60 * 1000).toISOString();

// A baseline where none of the three cadences are due — tests override just
// the one(s) they care about, so "not due" never accidentally means
// "field omitted, so treated as never-set-and-therefore-due."
const NOT_DUE = { lastReflectionAt: hoursAgo(1), lastVaultTidyAt: hoursAgo(1), lastDreamAt: hoursAgo(1) };

describe("runReflectionIfDue", () => {
  afterEach(() => {
    vi.doUnmock("@/lib/reflectionPreferences");
  });

  it("does not run when consent isn't true", async () => {
    const { runReflectionIfDue } = await loadTriggerWith({ consent: false, ...NOT_DUE, lastDreamAt: hoursAgo(30) });
    const runReflectionTurn = vi.fn();
    await runReflectionIfDue({ runReflectionTurn });
    expect(runReflectionTurn).not.toHaveBeenCalled();
  });

  it("runs when the base reflection cadence is due, even if vault-tidy and dream aren't", async () => {
    const { runReflectionIfDue } = await loadTriggerWith({ consent: true, ...NOT_DUE, lastReflectionAt: hoursAgo(4) });
    const runReflectionTurn = vi.fn().mockResolvedValue(undefined);
    await runReflectionIfDue({ runReflectionTurn });
    expect(runReflectionTurn).toHaveBeenCalledTimes(1);
  });

  it("runs when dream is due, even if the base 3-hour reflection cadence isn't — the actual bug this covers", async () => {
    const { runReflectionIfDue } = await loadTriggerWith({ consent: true, ...NOT_DUE, lastDreamAt: hoursAgo(30) });
    const runReflectionTurn = vi.fn().mockResolvedValue(undefined);
    await runReflectionIfDue({ runReflectionTurn });
    expect(runReflectionTurn).toHaveBeenCalledTimes(1);
  });

  it("runs when vault-tidy is due, even if the base 3-hour reflection cadence isn't — same bug, same fix", async () => {
    const { runReflectionIfDue } = await loadTriggerWith({ consent: true, ...NOT_DUE, lastVaultTidyAt: hoursAgo(25) });
    const runReflectionTurn = vi.fn().mockResolvedValue(undefined);
    await runReflectionIfDue({ runReflectionTurn });
    expect(runReflectionTurn).toHaveBeenCalledTimes(1);
  });

  it("does not run when none of the three cadences are due", async () => {
    const { runReflectionIfDue } = await loadTriggerWith({ consent: true, ...NOT_DUE });
    const runReflectionTurn = vi.fn();
    await runReflectionIfDue({ runReflectionTurn });
    expect(runReflectionTurn).not.toHaveBeenCalled();
  });

  it("treats a never-set lastDreamAt as due", async () => {
    const { runReflectionIfDue } = await loadTriggerWith({ consent: true, ...NOT_DUE, lastDreamAt: null });
    const runReflectionTurn = vi.fn().mockResolvedValue(undefined);
    await runReflectionIfDue({ runReflectionTurn });
    expect(runReflectionTurn).toHaveBeenCalledTimes(1);
  });

  it("only ever claims once per page load, regardless of which cadence is due", async () => {
    const { runReflectionIfDue } = await loadTriggerWith({ consent: true, lastReflectionAt: hoursAgo(30), lastVaultTidyAt: hoursAgo(30), lastDreamAt: hoursAgo(30) });
    const runReflectionTurn = vi.fn().mockResolvedValue(undefined);
    await runReflectionIfDue({ runReflectionTurn });
    await runReflectionIfDue({ runReflectionTurn });
    expect(runReflectionTurn).toHaveBeenCalledTimes(1);
  });
});

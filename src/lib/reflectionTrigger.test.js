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
const vaultConnected = () => true;
const vaultNotConnected = () => false;

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
    await runReflectionIfDue({ runReflectionTurn, checkVaultConnected: vaultConnected });
    expect(runReflectionTurn).not.toHaveBeenCalled();
  });

  it("runs when the base reflection cadence is due, even if vault-tidy and dream aren't", async () => {
    const { runReflectionIfDue } = await loadTriggerWith({ consent: true, ...NOT_DUE, lastReflectionAt: hoursAgo(4) });
    const runReflectionTurn = vi.fn().mockResolvedValue(undefined);
    await runReflectionIfDue({ runReflectionTurn, checkVaultConnected: vaultNotConnected });
    expect(runReflectionTurn).toHaveBeenCalledTimes(1);
  });

  it("runs when dream is due and the vault is connected, even if the base 3-hour reflection cadence isn't", async () => {
    const { runReflectionIfDue } = await loadTriggerWith({ consent: true, ...NOT_DUE, lastDreamAt: hoursAgo(30) });
    const runReflectionTurn = vi.fn().mockResolvedValue(undefined);
    await runReflectionIfDue({ runReflectionTurn, checkVaultConnected: vaultConnected });
    expect(runReflectionTurn).toHaveBeenCalledTimes(1);
  });

  it("runs when vault-tidy is due and the vault is connected, even if the base 3-hour reflection cadence isn't", async () => {
    const { runReflectionIfDue } = await loadTriggerWith({ consent: true, ...NOT_DUE, lastVaultTidyAt: hoursAgo(25) });
    const runReflectionTurn = vi.fn().mockResolvedValue(undefined);
    await runReflectionIfDue({ runReflectionTurn, checkVaultConnected: vaultConnected });
    expect(runReflectionTurn).toHaveBeenCalledTimes(1);
  });

  it("does not run when none of the three cadences are due", async () => {
    const { runReflectionIfDue } = await loadTriggerWith({ consent: true, ...NOT_DUE });
    const runReflectionTurn = vi.fn();
    await runReflectionIfDue({ runReflectionTurn, checkVaultConnected: vaultConnected });
    expect(runReflectionTurn).not.toHaveBeenCalled();
  });

  it("treats a never-set lastDreamAt as due when the vault is connected", async () => {
    const { runReflectionIfDue } = await loadTriggerWith({ consent: true, ...NOT_DUE, lastDreamAt: null });
    const runReflectionTurn = vi.fn().mockResolvedValue(undefined);
    await runReflectionIfDue({ runReflectionTurn, checkVaultConnected: vaultConnected });
    expect(runReflectionTurn).toHaveBeenCalledTimes(1);
  });

  // The actual bug this covers: runReflectionTurn only ever stamps
  // lastVaultTidyAt/lastDreamAt inside its own `if (vaultConnected)` branch,
  // so for a user who's never connected a vault those two fields stay
  // `null` forever. Without gating vaultTidyDue/dreamDue on the vault
  // actually being connected, a never-set field reads as "always due" and
  // this function stops respecting reflectionDue's 3-hour gate entirely —
  // it fires (and resets lastReflectionAt) on every single chat open, so
  // real check-ins never accumulate anything to say.
  it("does NOT treat never-set lastVaultTidyAt/lastDreamAt as due when the vault isn't connected", async () => {
    const { runReflectionIfDue } = await loadTriggerWith({ consent: true, ...NOT_DUE, lastVaultTidyAt: null, lastDreamAt: null });
    const runReflectionTurn = vi.fn();
    await runReflectionIfDue({ runReflectionTurn, checkVaultConnected: vaultNotConnected });
    expect(runReflectionTurn).not.toHaveBeenCalled();
  });

  it("only ever claims once per page load, regardless of which cadence is due", async () => {
    const { runReflectionIfDue } = await loadTriggerWith({ consent: true, lastReflectionAt: hoursAgo(30), lastVaultTidyAt: hoursAgo(30), lastDreamAt: hoursAgo(30) });
    const runReflectionTurn = vi.fn().mockResolvedValue(undefined);
    await runReflectionIfDue({ runReflectionTurn, checkVaultConnected: vaultConnected });
    await runReflectionIfDue({ runReflectionTurn, checkVaultConnected: vaultConnected });
    expect(runReflectionTurn).toHaveBeenCalledTimes(1);
  });
});

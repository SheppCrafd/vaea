// Consent + cadence state for Vaea Chat's proactive workspace reflection
// (see reflectionTrigger.js) — same deviceStorage-backed template as
// aiPreferences.js/aiProviderConfig.js. `consent` is a real tri-state, not a
// boolean: `null` means "never asked" (the one-time overlay shows), `false`
// means "asked and declined" (never shows again, only re-enabled from
// Settings), `true` means "opted in." The feature is OFF in every state
// except an explicit `true` — never inferred, never defaulted on.
import { readKey, writeKey } from "@/lib/deviceStorage";

export const REFLECTION_PREFS_KEY = "vaea_chat_reflection_prefs";

// How long Vaea Chat waits after the last reflection (or after opting in)
// before it's willing to check in again. Not a background timer — only
// ever evaluated when the user actually opens Vaea Chat (see
// reflectionTrigger.js's own comment for why "runs while you're away" isn't
// something this codebase can honestly promise).
export const REFLECTION_INTERVAL_MS = 3 * 60 * 60 * 1000;

// A separate, much longer cooldown for folding a "/vault-tidy"-style audit
// into a reflection cycle (see reflectionSummary.js's includeVaultTidy) —
// audit_vault reads every note in the vault once, real cost that rarely
// finds anything new between cycles just 3 hours apart, so this runs on its
// own slower cadence layered on top of the base reflection cycle, not every
// single time it fires.
export const VAULT_TIDY_INTERVAL_MS = 24 * 60 * 60 * 1000;

// How long a chat has to sit with no NEW message from the user before
// useChatController.js auto-logs it to the vault ("/vault-log", triggered
// the same way it would be if the user typed it). Unlike REFLECTION_INTERVAL_MS
// above, this one genuinely is a real, live client-side timer (setTimeout,
// armed while the tab is open) — a different honesty claim than "checked
// only when you reopen chat": this only needs the tab to STAY open for the
// hour, which a real in-page timer can actually do, not "runs even after
// you close it," which nothing here can.
export const VAULT_LOG_IDLE_MS = 60 * 60 * 1000;

export const DEFAULTS = {
  consent: null, // null = never asked, true = opted in, false = declined
  lastReflectionAt: null, // ISO string, or null before the first cycle starts
  lastVaultTidyAt: null, // ISO string, or null before the first vault-tidy-inclusive cycle
};

export async function loadReflectionPreferences() {
  try {
    const stored = await readKey(REFLECTION_PREFS_KEY);
    return { ...DEFAULTS, ...(stored || {}) };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function saveReflectionPreferences(prefs) {
  try {
    await writeKey(REFLECTION_PREFS_KEY, { ...DEFAULTS, ...prefs });
  } catch {
    // best-effort — the preference just won't survive a reload
  }
}

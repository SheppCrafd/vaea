import { loadReflectionPreferences, saveReflectionPreferences, REFLECTION_INTERVAL_MS, VAULT_TIDY_INTERVAL_MS, DREAM_INTERVAL_MS } from "@/lib/reflectionPreferences";

// Gates whether a reflection turn runs at all — consent, cadence, and
// dedupe — kept separate from the turn's own logic (which lives in
// useChatController.js's runReflectionTurn, since it needs real hook state:
// createSession/createMessage mutations, setActiveSessionId, etc.). This
// module only ever does plain reads/writes over reflectionPreferences.js,
// so it's safe to call from anywhere, not just inside a hook.
//
// Deliberately NOT a real background timer: there's no server cron or
// service worker anywhere in this app, so nothing here can honestly run
// while the tab is closed. This is checked once, synchronously with the
// moment the user actually opens Vaea Chat (see notifyChatOpened() in
// useChatController.js) — "next time you open the app," not "while you're
// away," and the consent copy says exactly that.
let claimedThisPageLoad = false;
// The consent overlay's own "×" (dismiss without deciding) vs. "Not now"
// (a real decision, persisted as consent:false) — dismiss just means don't
// re-show it every single time the panel opens within this same tab
// session; it does NOT persist consent:false, so a fresh reload is free to
// ask again. Lives here, not in the overlay component, so it survives the
// overlay unmounting/remounting as ChatBox opens and closes.
let dismissedThisPageLoad = false;

export function dismissReflectionConsentThisPageLoad() {
  dismissedThisPageLoad = true;
}

export function hasReflectionConsentBeenDismissedThisPageLoad() {
  return dismissedThisPageLoad;
}

// `runReflectionTurn(sinceIso)` is supplied by the caller (useChatController.js)
// since actually running a turn needs real hook state this module doesn't
// have. Failures are swallowed here, not surfaced — a reflection is a
// bonus, never something that should visibly break the chat experience.
export async function runReflectionIfDue({ runReflectionTurn }) {
  if (claimedThisPageLoad) return;
  const prefs = await loadReflectionPreferences();
  if (claimedThisPageLoad) return; // re-check after the await — single-threaded JS makes this race-free
  if (prefs.consent !== true) return;

  const previousReflectionAt = prefs.lastReflectionAt;
  const reflectionDue = !previousReflectionAt || Date.now() - new Date(previousReflectionAt).getTime() >= REFLECTION_INTERVAL_MS;
  // Vault-tidy and dream each run on their own, longer cadence
  // (reflectionPreferences.js's VAULT_TIDY_INTERVAL_MS/DREAM_INTERVAL_MS) —
  // checked here too, independently of the base 3-hour cycle. Gating a
  // once-daily pass behind "AND it's also been 3 hours since the last
  // check-in" means a real day can pass with it due the whole time, but
  // never actually running, just because chat kept getting reopened inside
  // that 3-hour window. Whether a due cycle actually finds anything to do
  // (vault connected, real messages/notes since last time) is still decided
  // inside runReflectionTurn — this is only "is it time to even look."
  const vaultTidyDue = !prefs.lastVaultTidyAt || Date.now() - new Date(prefs.lastVaultTidyAt).getTime() >= VAULT_TIDY_INTERVAL_MS;
  const dreamDue = !prefs.lastDreamAt || Date.now() - new Date(prefs.lastDreamAt).getTime() >= DREAM_INTERVAL_MS;
  if (!reflectionDue && !vaultTidyDue && !dreamDue) return;

  claimedThisPageLoad = true;
  // Advance the clock BEFORE the turn runs, not after — so a failed
  // reflection (network error, misconfigured provider, whatever) doesn't
  // leave the app retrying every single time chat is reopened; it just
  // tries again next cycle, same as a successful one would. Advanced
  // whenever ANY of the three cadences is due, even if reflectionDue itself
  // is false — a turn is actually happening now, so "since when" should
  // reset to now regardless of which cadence triggered it.
  await saveReflectionPreferences({ ...prefs, lastReflectionAt: new Date().toISOString() });

  // Granting consent itself sets lastReflectionAt to "now" (see
  // ChatReflectionConsent.jsx) specifically so opting in never
  // retroactively summarizes all of history — previousReflectionAt should
  // never actually be null here, but this is the honest fallback if it
  // somehow is (corrupted/edited storage), rather than computing a delta
  // "since the beginning of time."
  if (!previousReflectionAt) return;

  await runReflectionTurn(previousReflectionAt).catch(() => {});
}

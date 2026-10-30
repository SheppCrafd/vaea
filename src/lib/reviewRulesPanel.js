// Opens the Review Rules panel from anywhere: the /rules command, a held
// plan's card, the auto-approved line under a reply, or Settings. One panel
// is mounted for the whole app (ReviewRulesHost in AuthenticatedApp.jsx).
// `rule` names the rule to point at, e.g. the one that just held a plan.
import { useSyncExternalStore } from "react";

let state = { open: false, rule: null };
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

export function openReviewRules({ rule = null } = {}) {
  state = { open: true, rule };
  emit();
}

export function closeReviewRules() {
  state = { open: false, rule: null };
  emit();
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useReviewRulesPanel() {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

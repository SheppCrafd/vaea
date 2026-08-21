// User-defined threshold/status alert rules for the Notifications page —
// the real, buildable slice of "Triggers & Notifications": evaluated
// reactively whenever the page loads or its data changes, not a background
// daemon (this app has no always-on server to run one on — consistent with
// every other "reactive, not a background watcher" feature in this pass).
// Status-change triggers reduce to the same shape: "type: status_change" +
// a target status just evaluates against current data the same way a
// threshold does, so one rule engine covers both rather than two.
import { readKey, writeKey } from "@/lib/deviceStorage";

const RULES_KEY = "vaea_notification_rules";

// Presets for "Automation Recipes Library" — one-click-enable starting
// points, not a separate system from user-defined rules below.
export const RULE_PRESETS = [
  { name: "5+ projects overdue", metric: "overdue_projects", comparator: "gte", threshold: 5 },
  { name: "3+ projects at risk", metric: "at_risk_projects", comparator: "gte", threshold: 3 },
  { name: "10+ tasks not started", metric: "not_started_tasks", comparator: "gte", threshold: 10 },
];

export async function loadNotificationRules() {
  try {
    const stored = await readKey(RULES_KEY);
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

export async function saveNotificationRules(rules) {
  try {
    await writeKey(RULES_KEY, rules);
  } catch {
    // best-effort — rules just won't survive a reload
  }
}

const COMPARATORS = {
  gte: (a, b) => a >= b,
  lte: (a, b) => a <= b,
};

// metrics: a plain object of computed numbers (overdue_projects,
// at_risk_projects, not_started_tasks, ...) — NotificationsPage.jsx builds
// this from data it already has, no separate fetch for rules themselves.
export function evaluateRules(rules, metrics) {
  return rules
    .map((rule) => ({ rule, value: metrics[rule.metric] ?? 0, triggered: COMPARATORS[rule.comparator](metrics[rule.metric] ?? 0, rule.threshold) }))
    .filter((r) => r.triggered);
}

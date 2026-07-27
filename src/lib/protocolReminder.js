// Mirrors the user's own Claude Code UserPromptSubmit hook (crucible-
// reminder.ps1) — scans the user's own just-typed message for the same kind
// of trigger words, so that whether the assistant's own user-defined "soul"
// protocol applies isn't left to the model deciding case-by-case whether a
// message is "relevant" (the exact soft-suggestion weakness that hook was
// built to close for Claude Code itself). A match doesn't mean anything on
// its own if "soul" is empty — see aiIdentity.soul at the call site.
const TRIGGER_PATTERN =
  /\bbug\b|\berror\b|\bfail(?:s|ed|ing)?\b|\bcrash(?:es|ed|ing)?\b|\barchitecture\b|\bwhich approach\b|\bwhat'?s the best way\b|\bwhy (?:isn'?t|doesn'?t|won'?t|does(?:n'?t)?)\b|\bnot working\b|\bbroken\b/i;

export function matchesProtocolTrigger(text) {
  return TRIGGER_PATTERN.test(text || "");
}

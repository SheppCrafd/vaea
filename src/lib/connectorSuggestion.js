// Suggests connecting the matching connector(s) once, based on the email a
// user actually signed in with — a gmail.com address implies both Gmail and
// (frequently the same account's) Google Workspace; an Outlook/Hotmail/Live
// address implies Microsoft 365. This can only ever be a suggestion, not a
// silent auto-connect: base44's own "Continue with Google/Microsoft"
// sign-in only grants identity (name + email), never the broader
// Calendar/Drive/Mail API scopes Vaea's own connectors need — those require
// their own real OAuth consent screen, which a browser will only let a page
// open in response to an actual click (an unprompted popup right after the
// sign-in redirect gets silently blocked, which would make "automatic"
// connecting look like it's working while it's actually just failing quietly).
const DISMISSED_KEY = "vaea_connector_suggestion_dismissed";

const GOOGLE_SUGGESTION = { connectors: ["gmail", "googleWorkspace"], label: "Gmail and Google Workspace" };
const MICROSOFT_DOMAINS = new Set(["outlook.com", "hotmail.com", "live.com", "msn.com"]);
const MICROSOFT_SUGGESTION = { connectors: ["outlook", "microsoft"], label: "Outlook and Microsoft 365" };

export function suggestionForEmail(email) {
  if (!email || typeof email !== "string") return null;
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return null;
  if (domain === "gmail.com") return GOOGLE_SUGGESTION;
  if (MICROSOFT_DOMAINS.has(domain)) return MICROSOFT_SUGGESTION;
  return null;
}

function dismissedSet() {
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

export function isSuggestionDismissed(email) {
  return dismissedSet().has(email);
}

export function dismissSuggestion(email) {
  try {
    const set = dismissedSet();
    set.add(email);
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...set]));
  } catch {
    // Best-effort — worst case the banner reappears next session, not a
    // real failure.
  }
}

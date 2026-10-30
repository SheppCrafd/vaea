// Which connectors can actually connect in this build. Google, Microsoft and
// Slack sign-in each need an app registered with that company; until its
// client ID is pasted into the build's env file, the value is missing or a
// REPLACE_WITH_REAL_... placeholder and the sign-in page would only show an
// error. Those connectors stay listed, greyed out, with "Coming soon".
//
// Granola registers itself on first connect, the Vaea Brain uses a GitHub
// token, and ClickUp accepts a personal API token, so those three always work.

export function isRealClientId(value) {
  const id = typeof value === "string" ? value.trim() : "";
  return id.length > 0 && !/^REPLACE_WITH/i.test(id);
}

// The prerender step (scripts/prerender.mjs) runs outside Vite and passes
// the build's values in on globalThis instead.
const env = globalThis.__VAEA_ENV__ || import.meta.env || {};
const google = isRealClientId(env.VITE_GOOGLE_CALENDAR_CLIENT_ID);
const microsoft = isRealClientId(env.VITE_MICROSOFT_CLIENT_ID);

export const CONNECTOR_AVAILABLE = {
  "google-workspace": google,
  gmail: google,
  microsoft,
  outlook: microsoft,
  slack: isRealClientId(env.VITE_SLACK_CLIENT_ID),
  clickup: true,
  // ClickUp's one-click sign-in needs its own registered app; the
  // personal-token path doesn't.
  "clickup-oauth": isRealClientId(env.VITE_CLICKUP_CLIENT_ID),
  granola: true,
  brain: true,
};

export function isConnectorAvailable(key) {
  return CONNECTOR_AVAILABLE[key] === true;
}

// Mail and calendar pages offer whichever of these can connect.
export const ANY_MAIL_AVAILABLE = CONNECTOR_AVAILABLE.gmail || CONNECTOR_AVAILABLE.outlook;
export const ANY_CALENDAR_AVAILABLE = CONNECTOR_AVAILABLE["google-workspace"] || CONNECTOR_AVAILABLE.microsoft;

// Connection details for a user's own Slack workspace — same local-only,
// per-request trust model as every other connector. Slack OAuth requires a
// client secret for the token exchange (like ClickUp, unlike Google's
// public PKCE client), so token exchange goes through base44/functions/
// exchangeSlackToken, not directly from the browser.
import { readKey, writeKey, removeKey } from "@/lib/deviceStorage";

export const SLACK_CONNECTION_KEY = "vaea_slack";

export const DEFAULTS = {
  accessToken: "",
  workspaceId: "",
  workspaceName: "",
  userId: "",
  username: "",
};

export async function loadSlackConnection() {
  try {
    const stored = await readKey(SLACK_CONNECTION_KEY);
    return { ...DEFAULTS, ...(stored || {}) };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function saveSlackConnection(connection) {
  try {
    await writeKey(SLACK_CONNECTION_KEY, { ...DEFAULTS, ...connection });
  } catch {
    // best-effort
  }
}

export async function clearSlackConnection() {
  try {
    await removeKey(SLACK_CONNECTION_KEY);
  } catch {
    // best-effort
  }
}

export function isSlackConnected(connection) {
  return !!(connection?.accessToken && connection?.workspaceId);
}

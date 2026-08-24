// Connection details for a user's own Slack workspace — same local-only,
// per-request trust model as every other connector. Slack OAuth requires a
// client secret for the token exchange (like ClickUp, unlike Google's
// public PKCE client), so token exchange goes through base44/functions/
// exchangeSlackToken, not directly from the browser.
import { createDeviceKeyStore } from "@/lib/deviceKeyStore";

export const DEFAULTS = {
  accessToken: "",
  workspaceId: "",
  workspaceName: "",
  userId: "",
  username: "",
};

const store = createDeviceKeyStore("vaea_slack", DEFAULTS);

export const loadSlackConnection = store.load;
export const saveSlackConnection = store.save;
export const clearSlackConnection = store.clear;

export function isSlackConnected(connection) {
  return !!(connection?.accessToken && connection?.workspaceId);
}

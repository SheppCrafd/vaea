// Connection details for a user's own ClickUp workspace. Unlike Google
// Calendar, ClickUp's OAuth token exchange requires a real client secret
// (no public-client/PKCE option — confirmed against ClickUp's own OAuth
// docs) and issues a non-expiring access token with no refresh token at
// all. So the ONE piece of this flow that has to touch a server is the
// initial code->token exchange (base44/functions/exchangeClickUpToken,
// where the secret actually lives) — everything after that is exactly the
// same local-only shape as vaultConnection.js/calendarConnection.js: the
// resulting token lives in deviceStorage only, sent to aiChatStream
// transiently per-request, never stored server-side.
import { createDeviceKeyStore } from "@/lib/deviceKeyStore";

export const DEFAULTS = {
  accessToken: "",
  workspaceId: "",
  workspaceName: "",
  defaultListId: "",
  defaultListName: "",
};

const store = createDeviceKeyStore("vaea_clickup", DEFAULTS);

export const loadClickUpConnection = store.load;
export const saveClickUpConnection = store.save;
export const clearClickUpConnection = store.clear;

export function isClickUpConnected(connection) {
  return !!(connection?.accessToken && connection?.workspaceId);
}

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
import { readKey, writeKey, removeKey } from "@/lib/deviceStorage";

export const CLICKUP_CONNECTION_KEY = "vaea_clickup";

export const DEFAULTS = {
  accessToken: "",
  workspaceId: "",
  workspaceName: "",
  defaultListId: "",
  defaultListName: "",
};

export async function loadClickUpConnection() {
  try {
    const stored = await readKey(CLICKUP_CONNECTION_KEY);
    return { ...DEFAULTS, ...(stored || {}) };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function saveClickUpConnection(connection) {
  try {
    await writeKey(CLICKUP_CONNECTION_KEY, { ...DEFAULTS, ...connection });
  } catch {
    // best-effort — the connection just won't survive a reload
  }
}

export async function clearClickUpConnection() {
  try {
    await removeKey(CLICKUP_CONNECTION_KEY);
  } catch {
    // best-effort
  }
}

export function isClickUpConnected(connection) {
  return !!(connection?.accessToken && connection?.workspaceId);
}

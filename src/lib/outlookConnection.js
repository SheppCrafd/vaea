// Connection details for a user's Outlook/Exchange mail — split out from
// microsoftConnection.js (which now only covers Calendar + Teams) so a user
// can grant mail access without also granting calendar access, and vice
// versa. Same shared Azure AD app/client id as microsoftConnection.js, just
// a narrower Mail.Read/Mail.Send scope requested separately — see
// outlookOAuthPkce.js. Same trust model: local-only, sent to aiChatStream
// transiently per-request, never stored server-side.
import { readKey, writeKey, removeKey } from "@/lib/deviceStorage";

export const OUTLOOK_CONNECTION_KEY = "vaea_outlook";

export const DEFAULTS = {
  accessToken: "",
  refreshToken: "",
  expiresAt: 0,
  emailAddress: "",
};

export async function loadOutlookConnection() {
  try {
    const stored = await readKey(OUTLOOK_CONNECTION_KEY);
    return { ...DEFAULTS, ...(stored || {}) };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function saveOutlookConnection(connection) {
  try {
    await writeKey(OUTLOOK_CONNECTION_KEY, { ...DEFAULTS, ...connection });
  } catch {
    // best-effort — the connection just won't survive a reload
  }
}

export async function clearOutlookConnection() {
  try {
    await removeKey(OUTLOOK_CONNECTION_KEY);
  } catch {
    // best-effort
  }
}

export function isOutlookConnected(connection) {
  return !!(connection?.accessToken && connection?.refreshToken);
}

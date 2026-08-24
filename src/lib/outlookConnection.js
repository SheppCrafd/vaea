// Connection details for a user's Outlook/Exchange mail — split out from
// microsoftConnection.js (which now only covers Calendar + Teams) so a user
// can grant mail access without also granting calendar access, and vice
// versa. Same shared Azure AD app/client id as microsoftConnection.js, just
// a narrower Mail.Read/Mail.Send scope requested separately — see
// outlookOAuthPkce.js. Same trust model: local-only, sent to aiChatStream
// transiently per-request, never stored server-side.
import { createDeviceKeyStore } from "@/lib/deviceKeyStore";

export const DEFAULTS = {
  accessToken: "",
  refreshToken: "",
  expiresAt: 0,
  emailAddress: "",
};

const store = createDeviceKeyStore("vaea_outlook", DEFAULTS);

export const loadOutlookConnection = store.load;
export const saveOutlookConnection = store.save;
export const clearOutlookConnection = store.clear;

export function isOutlookConnected(connection) {
  return !!(connection?.accessToken && connection?.refreshToken);
}

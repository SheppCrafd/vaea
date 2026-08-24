// Connection details for a user's own Microsoft 365 / Outlook.com account —
// one connection covers Outlook Calendar, Outlook/Exchange mail, and Teams
// meeting links, the same way ClickUp's one connection covers tasks and
// ClickUp Chat (Microsoft Graph is the unified API for all three; there's
// no reason to make the user connect three separate things). Same trust
// model as calendarConnection.js/gmailConnection.js: local-only, sent to
// aiChatStream transiently per-request, never stored server-side.
import { createDeviceKeyStore } from "@/lib/deviceKeyStore";

export const DEFAULTS = {
  accessToken: "",
  refreshToken: "",
  expiresAt: 0,
  emailAddress: "",
};

const store = createDeviceKeyStore("vaea_microsoft", DEFAULTS);

export const loadMicrosoftConnection = store.load;
export const saveMicrosoftConnection = store.save;
export const clearMicrosoftConnection = store.clear;

export function isMicrosoftConnected(connection) {
  return !!(connection?.accessToken && connection?.refreshToken);
}

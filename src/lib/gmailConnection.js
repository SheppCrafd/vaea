// Connection details for a user's own Gmail. Same shape and trust model as
// calendarConnection.js — PKCE against Google's public "Desktop app"
// client (the same one Calendar uses; Gmail is just a different scope on
// the same OAuth client, not a different app), local-only, sent to
// aiChatStream transiently per-request, never stored server-side. Kept as
// its own independent connection (separate connect/disconnect, separate
// tokens) rather than folded into Calendar's, so a user can grant one
// without the other — Gmail read/send access is a materially bigger ask
// than calendar access and shouldn't be bundled into the same consent
// screen by default.
import { createDeviceKeyStore } from "@/lib/deviceKeyStore";

export const DEFAULTS = {
  accessToken: "",
  refreshToken: "",
  expiresAt: 0,
  emailAddress: "",
};

const store = createDeviceKeyStore("vaea_gmail", DEFAULTS);

export const loadGmailConnection = store.load;
export const saveGmailConnection = store.save;
export const clearGmailConnection = store.clear;

export function isGmailConnected(connection) {
  return !!(connection?.accessToken && connection?.refreshToken);
}

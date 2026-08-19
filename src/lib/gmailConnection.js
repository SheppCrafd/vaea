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
import { readKey, writeKey, removeKey } from "@/lib/deviceStorage";

export const GMAIL_CONNECTION_KEY = "vaea_gmail";

export const DEFAULTS = {
  accessToken: "",
  refreshToken: "",
  expiresAt: 0,
  emailAddress: "",
};

export async function loadGmailConnection() {
  try {
    const stored = await readKey(GMAIL_CONNECTION_KEY);
    return { ...DEFAULTS, ...(stored || {}) };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function saveGmailConnection(connection) {
  try {
    await writeKey(GMAIL_CONNECTION_KEY, { ...DEFAULTS, ...connection });
  } catch {
    // best-effort — the connection just won't survive a reload
  }
}

export async function clearGmailConnection() {
  try {
    await removeKey(GMAIL_CONNECTION_KEY);
  } catch {
    // best-effort
  }
}

export function isGmailConnected(connection) {
  return !!(connection?.accessToken && connection?.refreshToken);
}

// Connection details for a user's own Microsoft 365 / Outlook.com account —
// one connection covers Outlook Calendar, Outlook/Exchange mail, and Teams
// meeting links, the same way ClickUp's one connection covers tasks and
// ClickUp Chat (Microsoft Graph is the unified API for all three; there's
// no reason to make the user connect three separate things). Same trust
// model as calendarConnection.js/gmailConnection.js: local-only, sent to
// aiChatStream transiently per-request, never stored server-side.
import { readKey, writeKey, removeKey } from "@/lib/deviceStorage";

export const MICROSOFT_CONNECTION_KEY = "vaea_microsoft";

export const DEFAULTS = {
  accessToken: "",
  refreshToken: "",
  expiresAt: 0,
  emailAddress: "",
};

export async function loadMicrosoftConnection() {
  try {
    const stored = await readKey(MICROSOFT_CONNECTION_KEY);
    return { ...DEFAULTS, ...(stored || {}) };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function saveMicrosoftConnection(connection) {
  try {
    await writeKey(MICROSOFT_CONNECTION_KEY, { ...DEFAULTS, ...connection });
  } catch {
    // best-effort — the connection just won't survive a reload
  }
}

export async function clearMicrosoftConnection() {
  try {
    await removeKey(MICROSOFT_CONNECTION_KEY);
  } catch {
    // best-effort
  }
}

export function isMicrosoftConnected(connection) {
  return !!(connection?.accessToken && connection?.refreshToken);
}

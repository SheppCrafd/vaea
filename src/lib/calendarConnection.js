// Connection details for a user's own Google Calendar, connected via OAuth
// (PKCE, public "Desktop app" client — no client secret exists to protect,
// see googleCalendarApi.js). Local-only, same pattern as vaultConnection.js:
// nothing here is a Vaea entity, and the tokens are sent to aiChatStream
// transiently, per-request, only when a calendar tool actually needs them
// — never stored server-side. Backed by deviceStorage (real files in FSA
// mode, in-memory + manual export otherwise) — these tokens never sit in
// localStorage/IndexedDB.
import { readKey, writeKey, removeKey } from "@/lib/deviceStorage";

export const CALENDAR_CONNECTION_KEY = "vaea_google_calendar";

const DEFAULTS = {
  accessToken: "",
  refreshToken: "",
  expiresAt: 0,
  calendarId: "primary",
};

export async function loadCalendarConnection() {
  try {
    const stored = await readKey(CALENDAR_CONNECTION_KEY);
    return { ...DEFAULTS, ...(stored || {}) };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function saveCalendarConnection(connection) {
  try {
    await writeKey(CALENDAR_CONNECTION_KEY, { ...DEFAULTS, ...connection });
  } catch {
    // best-effort — the connection just won't survive a reload
  }
}

export async function clearCalendarConnection() {
  try {
    await removeKey(CALENDAR_CONNECTION_KEY);
  } catch {
    // best-effort
  }
}

export function isCalendarConnected(connection) {
  return !!(connection?.accessToken && connection?.refreshToken);
}

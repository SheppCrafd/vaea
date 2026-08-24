// Connection details for a user's own Google Workspace — one OAuth grant
// covering Calendar, Drive, Docs, Sheets, Slides, Tasks, and Forms (PKCE,
// public "Desktop app" client — no client secret exists, see
// googleWorkspaceOAuthPkce.js). Gmail is deliberately NOT part of this
// scope/connection — it keeps its own independent connect/disconnect via
// gmailConnection.js, since inbox read/send is a materially bigger ask than
// the rest of Workspace and shouldn't be bundled into the same consent
// screen by default. Local-only, same pattern as vaultConnection.js: nothing
// here is a Vaea entity, and the tokens are sent to aiChatStream transiently,
// per-request, only when a tool actually needs them — never stored
// server-side. Backed by deviceStorage (real files in FSA mode, in-memory +
// manual export otherwise) — these tokens never sit in localStorage/IndexedDB.
//
// This replaces the older, Calendar-only calendarConnection.js — same
// storage key, so an already-connected user's tokens keep working as-is for
// Calendar; they'll see a reconnect prompt the first time a Drive/Docs/
// Sheets/Slides/Tasks/Forms tool runs, since the old grant's scope doesn't
// cover the new products yet.
import { createDeviceKeyStore } from "@/lib/deviceKeyStore";

const DEFAULTS = {
  accessToken: "",
  refreshToken: "",
  expiresAt: 0,
  calendarId: "primary",
  email: "",
};

// Deliberately still the Calendar-era key, so an already-connected user's
// tokens keep working (see the note above).
const store = createDeviceKeyStore("vaea_google_calendar", DEFAULTS);

export const loadGoogleWorkspaceConnection = store.load;
export const saveGoogleWorkspaceConnection = store.save;
export const clearGoogleWorkspaceConnection = store.clear;

export function isGoogleWorkspaceConnected(connection) {
  return !!(connection?.accessToken && connection?.refreshToken);
}

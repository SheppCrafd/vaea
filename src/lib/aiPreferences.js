// The AI chat assistant's identity — the in-app analog of a personal
// user.md/soul.md/identity.md set, minus any external vault/CLI/git: a real
// user can write this by hand in Settings, or have the assistant interview
// them for it via the "/setup" chat command (see SET_AI_IDENTITY in
// base44/functions/aiChatStream/entry.ts), same as either path being
// available for the original three-file version. Sent as part of every
// chat message's context in useChatController.js. Backed by deviceStorage
// (real files in FSA mode, in-memory + manual export otherwise) — same as
// localDb.js's entity data, never localStorage.
import { createDeviceKeyStore } from "@/lib/deviceKeyStore";

export const AI_IDENTITY_KEY = "vaea_ai_identity";

export const DEFAULTS = {
  name: "",
  identity: "",
  soul: "",
  userProfile: "",
};

const store = createDeviceKeyStore(AI_IDENTITY_KEY, DEFAULTS);

export const loadAiIdentity = store.load;
export const saveAiIdentity = store.save;

// Pre-existing browser-storage copy from before device storage existed —
// read once so a returning user doesn't lose it. Cleared by
// DeviceStorageGate only once the data is durably persisted to the new
// backend (a real file, or a successful manual export).
export function readLegacyLocalStorageIdentity() {
  try {
    const raw = localStorage.getItem(AI_IDENTITY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearLegacyLocalStorageIdentity() {
  try {
    localStorage.removeItem(AI_IDENTITY_KEY);
  } catch {
    // best-effort
  }
}

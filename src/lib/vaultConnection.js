// Connection details for an external, git-backed Obsidian vault (a
// personal GitHub repo) that the Vaea assistant can read from and write
// to — the real analog of what a Claude Code + Obsidian vault setup does,
// brought into the app itself instead of living in a CLI. Local-only,
// same as aiPreferences.js: nothing here is a Vaea entity, and the token
// is sent to aiChatStream transiently, per-request, only when a vault
// tool actually needs it — never stored server-side. See
// ExternalVaultSection.jsx for the disclosure shown where this is set.
// Backed by deviceStorage (real files in FSA mode, in-memory + manual
// export otherwise) — this token never sits in localStorage/IndexedDB.
import { readKey, writeKey, removeKey } from "@/lib/deviceStorage";

export const VAULT_CONNECTION_KEY = "vaea_external_vault";

const DEFAULTS = {
  owner: "",
  repo: "",
  branch: "main",
  token: "",
};

export async function loadVaultConnection() {
  try {
    const stored = await readKey(VAULT_CONNECTION_KEY);
    return { ...DEFAULTS, ...(stored || {}) };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function saveVaultConnection(connection) {
  try {
    await writeKey(VAULT_CONNECTION_KEY, { ...DEFAULTS, ...connection });
  } catch {
    // best-effort — the connection just won't survive a reload
  }
}

export async function clearVaultConnection() {
  try {
    await removeKey(VAULT_CONNECTION_KEY);
  } catch {
    // best-effort
  }
}

export function isVaultConnected(connection) {
  return !!(connection?.owner && connection?.repo && connection?.token);
}

// Pre-existing browser-storage copy from before device storage existed —
// read once so a returning user doesn't lose their token. Cleared by
// DeviceStorageGate only once the data is durably persisted to the new
// backend (a real file, or a successful manual export).
export function readLegacyLocalStorageVaultConnection() {
  try {
    const raw = localStorage.getItem(VAULT_CONNECTION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearLegacyLocalStorageVaultConnection() {
  try {
    localStorage.removeItem(VAULT_CONNECTION_KEY);
  } catch {
    // best-effort
  }
}

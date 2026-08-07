// Copies every key this app actually stores from one deviceStorage backend
// to another — used when switching "where data lives" (Settings' Data
// Storage section, and DeviceStorageGate picking up cloud data once a
// device backend becomes available after a cloud->device switch). Not used
// for the pre-existing localStorage legacy migration (DeviceStorageGate.jsx
// has its own narrower readAllLegacyData/seedCollections for that, since
// that's a one-time carry-forward from before any of these backends
// existed, not a live switch between two already-working ones).
import { localDb } from "@/lib/localDb";
import { AI_IDENTITY_KEY } from "@/lib/aiPreferences";
import { VAULT_CONNECTION_KEY } from "@/lib/vaultConnection";

const ALL_KEYS = [...Object.keys(localDb), AI_IDENTITY_KEY, VAULT_CONNECTION_KEY];

// { read, write } pairs, not the mode-dispatching readKey/writeKey exports —
// those would just recurse into whichever backend is *currently* active,
// which during a switch is exactly the ambiguity this needs to avoid.
export async function copyAllKeys({ read, write }) {
  for (const key of ALL_KEYS) {
    const value = await read(key);
    if (value != null) await write(key, value);
  }
}

// Real entity collections only (not the AI identity/vault-connection keys
// above) — those are low-stakes to overwrite; a whole workspace of Areas/
// Products/Projects/Tasks is not. Checked BEFORE copyAllKeys runs in either
// direction (StorageSection.jsx) so a switch can never silently clobber real
// data already sitting at the destination — e.g. picking a folder that was
// used for a previous device-storage session, or switching back to cloud
// after it had already accumulated data from a different device. Without
// this, copyAllKeys's own unconditional overwrite-every-key loop just wins,
// with no warning and no way back once the tab reloads into the new mode.
const DESTINATION_CHECK_KEYS = ["areas", "products", "projects", "tasks"];

export async function destinationHasData({ read }) {
  for (const key of DESTINATION_CHECK_KEYS) {
    const value = await read(key);
    if (Array.isArray(value) && value.length > 0) return true;
  }
  return false;
}

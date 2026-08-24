// The storage shape every connector and preference module in this folder
// shares: one deviceStorage key holding a defaults-merged object. Reads fall
// back to the defaults rather than throwing (a missing/unavailable backend
// should read as "nothing configured," not break the caller), and writes are
// best-effort — a storage failure degrades to "won't survive a reload," which
// is always preferable here to failing the user's action outright.
//
// Domain logic deliberately stays in the calling module: each connector keeps
// its own `isXConnected` predicate next to its own DEFAULTS, so what counts as
// "connected" is readable where it's defined instead of hidden behind a
// config option here.
import { readKey, writeKey, removeKey } from "@/lib/deviceStorage";

export function createDeviceKeyStore(key, defaults) {
  return {
    async load() {
      try {
        const stored = await readKey(key);
        return { ...defaults, ...(stored || {}) };
      } catch {
        return { ...defaults };
      }
    },
    async save(value) {
      try {
        await writeKey(key, { ...defaults, ...value });
      } catch {
        // best-effort
      }
    },
    async clear() {
      try {
        await removeKey(key);
      } catch {
        // best-effort
      }
    },
  };
}

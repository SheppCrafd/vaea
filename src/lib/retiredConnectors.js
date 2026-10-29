// Connectors that are hidden from the app but may still have saved
// credentials from before. With no Settings section left, nobody could see
// or remove them, so they're deleted once storage is ready.
//
// Apple Mail: hidden until Vmail can read its messages. It held an iCloud
// app-specific password that nothing ever used; the user can make a new one
// at appleid.apple.com if the connector comes back.
import { getStatus, subscribeStatus, isFileBackedModeAvailable, readKey, removeKey } from "@/lib/deviceStorage";

export const RETIRED_KEYS = ["vaea_apple_mail"];

// Statuses where reads and writes reach the user's real data. Anything else
// (no folder yet, signed out of cloud mode, nothing imported) would read as
// empty, so the sweep waits for one of these.
const READY = new Set(["connected", "cloud-connected", "manual-ready"]);

async function storageReady() {
  if (await isFileBackedModeAvailable()) return true;
  return READY.has(await getStatus());
}

export function clearRetiredConnectorsWhenReady() {
  let done = false;
  let running = false;
  let again = false; // a status change arrived while a check was running
  let unsubscribe = () => {};

  const sweep = async () => {
    if (done) return;
    if (running) { again = true; return; }
    running = true;
    again = false;
    try {
      if (!(await storageReady())) return;
      done = true;
      unsubscribe();
      for (const key of RETIRED_KEYS) {
        try {
          if (await readKey(key)) await removeKey(key);
        } catch {
          // best-effort: a failed delete is retried on the next app load
        }
      }
    } finally {
      running = false;
    }
    if (again && !done) await sweep();
  };

  unsubscribe = subscribeStatus(() => { sweep(); });
  return sweep();
}

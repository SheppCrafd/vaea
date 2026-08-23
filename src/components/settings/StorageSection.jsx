import { useEffect, useState } from "react";
import { Cloud, HardDrive, Check } from "lucide-react";
import {
  getStorageMode,
  setStorageMode,
  supportsFileSystemAccess,
  connectFolder,
  readDeviceKey,
  writeDeviceKey,
  startFreshManual,
  downloadSnapshotFile,
} from "@/lib/deviceStorage";
import * as cloudStorage from "@/lib/cloudStorage";
import { copyAllKeys, destinationHasData } from "@/lib/storageMigration";
import { appParams } from "@/lib/app-params";
import { confirmThen } from "@/lib/entityUtils";

// Lets a user switch where their data lives after the initial choice
// (DeviceStorageGate) — not just view it. Both directions carry the current
// data over to the new backend rather than starting empty, mirroring the
// same "don't lose what's already there" care the legacy-localStorage
// migration takes.
export default function StorageSection() {
  // A successful switch always reloads the page (see switchToCloud/
  // switchToDevice below), so this only ever needs to reflect the mode at
  // mount — no setter needed, the reload is what keeps it honest.
  const [mode] = useState(getStorageMode());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!done) return undefined;
    const t = setTimeout(() => setDone(false), 2000);
    return () => clearTimeout(t);
  }, [done]);

  const switchToCloud = () => {
    if (!appParams.token) {
      setError("Sign in first — cloud storage is tied to your account.");
      return;
    }
    confirmThen(
      "Switch to cloud storage? Everything currently on this device will be copied to your account.",
      async () => {
        setError("");
        setBusy(true);
        try {
          // Refuse to silently overwrite real data already sitting in the
          // cloud (e.g. from a different device that already switched to
          // cloud storage) — copyAllKeys itself has no such check, it just
          // overwrites every key unconditionally. See storageMigration.js.
          if (await destinationHasData({ read: cloudStorage.readKey })) {
            setError("Your cloud storage already has data in it — switching would overwrite it. Back it up first (Settings → Backup & Restore), or clear the cloud data before switching.");
            setBusy(false);
            return;
          }
          await copyAllKeys({ read: readDeviceKey, write: cloudStorage.writeKey });
          setStorageMode("cloud");
          window.location.reload();
        } catch {
          setError("Couldn't copy your data to the cloud — try again.");
          setBusy(false);
        }
      }
    );
  };

  const switchToDevice = () => {
    confirmThen(
      "Switch to secure device storage? Everything currently in the cloud will be copied to this device.",
      async () => {
        setError("");
        setBusy(true);
        try {
          if (supportsFileSystemAccess) {
            await connectFolder(); // user-gesture-gated folder picker — can pick ANY folder, including one already full of real data from a previous device-storage session
            if (await destinationHasData({ read: readDeviceKey })) {
              setError("That folder already has Vaea data in it — switching would overwrite it. Choose an empty folder, or back up this folder's data first before reusing it.");
              setBusy(false);
              return;
            }
            await copyAllKeys({ read: cloudStorage.readKey, write: writeDeviceKey });
          } else {
            startFreshManual();
            await copyAllKeys({ read: cloudStorage.readKey, write: writeDeviceKey });
            // Manual mode has no automatic persistence — save the freshly
            // copied data to a real file now, or it only exists in this
            // tab's memory until the user remembers to export it.
            downloadSnapshotFile();
          }
          setStorageMode("device");
          window.location.reload();
        } catch (err) {
          if (err.name !== "AbortError") setError("Couldn't switch to device storage — try again.");
          setBusy(false);
        }
      }
    );
  };

  return (
    <div className="card-enter bg-card border border-foreground/[0.04] rounded-2xl shadow-md p-6">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Data Storage</p>
        {done && (
          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Check className="w-3.5 h-3.5" /> Switched
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Where your areas, products, projects, and tasks live — chosen once when you first set up Vaea, switchable
        here any time.
      </p>

      <div className="flex items-center gap-2 text-sm font-medium mb-4">
        {mode === "cloud" ? <Cloud className="w-4 h-4" /> : <HardDrive className="w-4 h-4" />}
        Currently: {mode === "cloud" ? "Save on cloud" : "Secure device storage"}
      </div>

      {mode === "cloud" ? (
        <button
          type="button"
          onClick={switchToDevice}
          disabled={busy}
          className="flex items-center gap-1.5 text-sm px-4 py-2 border border-input rounded-md hover:bg-accent transition-colors disabled:opacity-50"
        >
          <HardDrive className="w-3.5 h-3.5" /> {busy ? "Switching…" : "Switch to secure device storage"}
        </button>
      ) : (
        <button
          type="button"
          onClick={switchToCloud}
          disabled={busy}
          className="flex items-center gap-1.5 text-sm px-4 py-2 border border-input rounded-md hover:bg-accent transition-colors disabled:opacity-50"
        >
          <Cloud className="w-3.5 h-3.5" /> {busy ? "Switching…" : "Switch to save on cloud"}
        </button>
      )}

      {error && <p className="text-xs text-destructive mt-3">{error}</p>}
    </div>
  );
}

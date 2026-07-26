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
import { copyAllKeys } from "@/lib/storageMigration";
import { appParams } from "@/lib/app-params";
import { confirmThen } from "@/lib/entityUtils";

// Lets a user switch where their data lives after the initial choice
// (DeviceStorageGate) — not just view it. Both directions carry the current
// data over to the new backend rather than starting empty, mirroring the
// same "don't lose what's already there" care the legacy-localStorage
// migration takes.
export default function StorageSection() {
  const [mode, setMode] = useState(getStorageMode());
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
            await connectFolder(); // user-gesture-gated folder picker
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
    <div className="bg-card border border-border rounded-xl p-6">
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

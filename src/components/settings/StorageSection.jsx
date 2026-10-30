import { useEffect, useState } from "react";
import { Cloud, HardDrive, Check } from "lucide-react";
import {
  getStorageMode,
  setStorageMode,
  supportsFileSystemAccess,
  connectFolder,
  readDeviceKey,
  writeDeviceKey,
  removeDeviceKey,
  startFreshManual,
  downloadSnapshotFile,
} from "@/lib/deviceStorage";
import { SettingsCard } from "@/components/ui/settings-card";
import * as cloudStorage from "@/lib/cloudStorage";
import { copyAllKeys, destinationHasData, replaceAllKeys, readBoardSnapshot, downloadBoardSnapshot } from "@/lib/storageMigration";
import { appParams } from "@/lib/app-params";
import { confirmThen } from "@/lib/entityUtils";

// Lets a user switch where their data lives after the initial choice
// (DeviceStorageGate) — not just view it. Both directions carry the current
// data over to the new backend rather than starting empty, mirroring the
// same "don't lose what's already there" care the legacy-localStorage
// migration takes.
//
// When the destination already holds a board (the cloud, from another
// device; or a folder used before), the switch stops and offers a choice:
// use the board that's already there, or replace it. Replacing downloads a
// copy of the board being replaced first, so neither choice loses a board.

const today = () => new Date().toISOString().slice(0, 10);

// A download started by a link click can be cut off by an immediate reload.
const reloadSoon = () => setTimeout(() => window.location.reload(), 800);

const CHOICES = {
  cloud: {
    title: "Your account already has a board in the cloud",
    body: "It's probably from another device. Choose which board to keep.",
    use: {
      label: "Use the Cloud Board",
      note: supportsFileSystemAccess
        ? "Opens the cloud board here. This device's board stays in its folder."
        : "Opens the cloud board here. Vaea downloads a copy of this device's board first.",
    },
    replace: {
      label: "Replace It With This Device's Board",
      note: "Vaea downloads a copy of the cloud board first, then puts this device's board in its place.",
      confirm: "Replace the cloud board with this device's board? Vaea downloads a copy of the cloud board first.",
    },
  },
  folder: {
    title: "That folder already has a Vaea board",
    body: "Choose which board to keep.",
    use: {
      label: "Use the Folder's Board",
      note: "Opens that folder's board here. Your cloud board stays in your account.",
    },
    replace: {
      label: "Replace It With the Cloud Board",
      note: "Vaea downloads a copy of the folder's board first, then puts your cloud board in its place.",
      confirm: "Replace the board in that folder with your cloud board? Vaea downloads a copy of the folder's board first.",
    },
  },
};

export default function StorageSection() {
  // A successful switch always reloads the page (see switchToCloud/
  // switchToDevice below), so this only ever needs to reflect the mode at
  // mount — no setter needed, the reload is what keeps it honest.
  const [mode] = useState(getStorageMode());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  // "cloud" or "folder" while the user chooses between two boards.
  const [conflict, setConflict] = useState(null);

  useEffect(() => {
    if (!done) return undefined;
    const t = setTimeout(() => setDone(false), 2000);
    return () => clearTimeout(t);
  }, [done]);

  // Runs one storage change with the busy state and an error message on
  // failure. `work` returns true once it has started the reload.
  const run = async (work, failure) => {
    setError("");
    setBusy(true);
    try {
      if (!(await work())) setBusy(false);
    } catch (err) {
      if (err?.name !== "AbortError") setError(failure);
      setBusy(false);
    }
  };

  const switchToCloud = () => {
    if (!appParams.token) {
      setError("Sign in first — cloud storage is tied to your account.");
      return;
    }
    confirmThen(
      "Switch to cloud storage? Everything currently on this device will be copied to your account.",
      () => run(async () => {
        // copyAllKeys has no check of its own and would overwrite every key,
        // so a board already in the cloud gets a choice first.
        if (await destinationHasData({ read: cloudStorage.readKey })) {
          setConflict("cloud");
          return false;
        }
        await copyAllKeys({ read: readDeviceKey, write: cloudStorage.writeKey });
        setStorageMode("cloud");
        window.location.reload();
        return true;
      }, "Couldn't copy your data to the cloud. Nothing changed; try again.")
    );
  };

  const switchToDevice = () => {
    confirmThen(
      "Switch to secure device storage? Everything currently in the cloud will be copied to this device.",
      () => run(async () => {
        if (supportsFileSystemAccess) {
          await connectFolder(); // user-gesture-gated folder picker — can pick ANY folder, including one already full of real data from a previous device-storage session
          if (await destinationHasData({ read: readDeviceKey })) {
            setConflict("folder");
            return false;
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
        return true;
      }, "Couldn't switch to device storage. Nothing changed; try again.")
    );
  };

  // Keep the board that's already at the destination.
  const keepExisting = () => run(async () => {
    if (conflict === "cloud") {
      // Manual mode keeps this device's board only in this tab; save it first.
      if (!supportsFileSystemAccess) downloadSnapshotFile(`vaea-this-device-board-${today()}.json`);
      setStorageMode("cloud");
    } else {
      setStorageMode("device");
    }
    reloadSoon();
    return true;
  }, "Couldn't switch boards. Nothing changed; try again.");

  // Replace the board at the destination, after downloading a copy of it.
  const replaceExisting = () => {
    confirmThen(CHOICES[conflict].replace.confirm, () => run(async () => {
      if (conflict === "cloud") {
        downloadBoardSnapshot(await readBoardSnapshot({ read: cloudStorage.readKey }), `vaea-cloud-board-${today()}.json`);
        await replaceAllKeys({ read: readDeviceKey, write: cloudStorage.writeKey, remove: cloudStorage.removeKey });
        setStorageMode("cloud");
      } else {
        downloadBoardSnapshot(await readBoardSnapshot({ read: readDeviceKey }), `vaea-folder-board-${today()}.json`);
        await replaceAllKeys({ read: cloudStorage.readKey, write: writeDeviceKey, remove: removeDeviceKey });
        setStorageMode("device");
      }
      reloadSoon();
      return true;
    }, "Couldn't replace the board. Check the downloaded copy, then try again."));
  };

  const choice = conflict ? CHOICES[conflict] : null;

  return (
    <SettingsCard>
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

      {choice ? (
        <div className="rounded-lg border border-border overflow-hidden" role="group" aria-labelledby="storage-choice-title">
          <div className="px-4 py-3 bg-secondary/40 border-b border-border">
            <p id="storage-choice-title" className="text-sm font-medium">{choice.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{choice.body}</p>
          </div>
          <div className="divide-y divide-border">
            <ChoiceRow label={choice.use.label} note={choice.use.note} onClick={keepExisting} disabled={busy} />
            <ChoiceRow label={choice.replace.label} note={choice.replace.note} onClick={replaceExisting} disabled={busy} destructive />
          </div>
          <div className="px-4 py-2.5 border-t border-border">
            <button
              type="button"
              onClick={() => { setConflict(null); setError(""); }}
              disabled={busy}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              {busy ? "Switching…" : "Cancel"}
            </button>
          </div>
        </div>
      ) : mode === "cloud" ? (
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
    </SettingsCard>
  );
}

function ChoiceRow({ label, note, onClick, disabled, destructive = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full text-left px-4 py-3 hover:bg-accent/60 focus-visible:bg-accent/60 transition-colors disabled:opacity-50 disabled:pointer-events-none"
    >
      <span className={`block text-sm font-medium ${destructive ? "text-destructive" : ""}`}>{label}</span>
      <span className="block text-xs text-muted-foreground mt-0.5">{note}</span>
    </button>
  );
}

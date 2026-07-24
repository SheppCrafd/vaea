import { useEffect, useRef, useState } from "react";
import { Save } from "lucide-react";
import {
  supportsFileSystemAccess,
  getStatus,
  getRememberedFolderName,
  connectFolder,
  reconnectFolder,
  isManualDirty,
  subscribeStatus,
  downloadSnapshotFile,
  loadSnapshotFile,
  startFreshManual,
  writeKey,
} from "@/lib/deviceStorage";
import {
  isFileBackedModeAvailable,
  readLegacyLocalStorageData,
  clearLegacyLocalStorageData,
  seedCollections,
} from "@/lib/localDb";
import { readLegacyLocalStorageIdentity, clearLegacyLocalStorageIdentity, AI_IDENTITY_KEY } from "@/lib/aiPreferences";
import {
  readLegacyLocalStorageVaultConnection,
  clearLegacyLocalStorageVaultConnection,
  VAULT_CONNECTION_KEY,
} from "@/lib/vaultConnection";

// Reads every pre-existing browser-storage copy this rollout carries
// forward: entity collections, the AI chat identity, and the external
// vault's GitHub connection (including its token) — anything a returning
// user could lose if it were left behind. Returns null if there's nothing
// to carry over.
function readAllLegacyData() {
  const entities = readLegacyLocalStorageData();
  const identity = readLegacyLocalStorageIdentity();
  const vault = readLegacyLocalStorageVaultConnection();
  if (!entities && !identity && !vault) return null;
  return { entities, identity, vault };
}

function clearAllLegacyData() {
  clearLegacyLocalStorageData();
  clearLegacyLocalStorageIdentity();
  clearLegacyLocalStorageVaultConnection();
}

// Blocks the rest of the app from rendering (and from ever calling into
// localDb.js) until a device-storage backend is actually connected — so no
// read/write can hit deviceStorage before it's ready. Skips itself entirely
// when the dev file-backed store is available (localhost dev/preview),
// since that already writes real files with no browser storage involved.
//
// Handles three flows:
// - FSA supported, no remembered folder: pick one.
// - FSA supported, remembered folder: one-click permission re-grant.
// - FSA unsupported (Firefox/Safari/mobile): load a previously exported
//   file, or start fresh.
// In every case, if this is a returning user with data still sitting in
// localStorage from before device storage existed, it's carried forward
// automatically (and the old browser copy is cleared only once the data is
// durably on disk, or once the user has exported it to a file).
export default function DeviceStorageGate({ children }) {
  const [phase, setPhase] = useState("checking");
  const [folderName, setFolderName] = useState(null);
  const [legacyData, setLegacyData] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (await isFileBackedModeAvailable()) {
        if (!cancelled) setPhase("ready");
        return;
      }
      const status = await getStatus();
      if (cancelled) return;
      if (status === "connected" || status === "manual-ready") {
        setPhase("ready");
        return;
      }
      if (status === "needs-permission") {
        setFolderName(await getRememberedFolderName());
      }
      setPhase(status); // 'disconnected' | 'needs-permission' | 'manual-needed'
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Warn on tab close if a manual-mode session has changes that were never
  // exported — the only place this data exists is this tab's memory.
  useEffect(() => {
    if (phase !== "ready" || supportsFileSystemAccess) return undefined;
    const handler = (e) => {
      if (isManualDirty()) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [phase]);

  async function finishConnecting() {
    const legacy = readAllLegacyData();
    if (legacy) {
      if (legacy.entities) await seedCollections(legacy.entities);
      if (legacy.identity) await writeKey(AI_IDENTITY_KEY, legacy.identity);
      if (legacy.vault) await writeKey(VAULT_CONNECTION_KEY, legacy.vault);
      if (supportsFileSystemAccess) {
        // Already durably on disk — safe to clear the old browser copies now.
        clearAllLegacyData();
        setPhase("ready");
      } else {
        // Only in memory so far — hold the gate open until the user saves
        // it to a real file, so it's never lost.
        setLegacyData(legacy);
        setPhase("manual-legacy-found");
      }
      return;
    }
    setPhase("ready");
  }

  async function handleConnect() {
    setError(null);
    try {
      await connectFolder();
      await finishConnecting();
    } catch (err) {
      if (err.name !== "AbortError") setError("Couldn't get access to that folder. Try again.");
    }
  }

  async function handleReconnect() {
    setError(null);
    try {
      await reconnectFolder();
      await finishConnecting();
    } catch {
      setError("Permission wasn't granted. You can try again, or choose a different folder below.");
    }
  }

  async function handleImportFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    try {
      await loadSnapshotFile(file);
      // An imported file already IS the source of truth — any leftover
      // localStorage copies from before this device-storage rollout are now
      // redundant, so they can be cleared immediately rather than held open
      // on a save step.
      clearAllLegacyData();
      setPhase("ready");
    } catch {
      setError("That file isn't a valid Vaea data export.");
    }
  }

  async function handleStartFresh() {
    if (readAllLegacyData()) {
      await finishConnecting();
      return;
    }
    startFreshManual();
    setPhase("ready");
  }

  function handleSaveLegacyAndContinue() {
    downloadSnapshotFile();
    clearAllLegacyData();
    setPhase("ready");
  }

  if (phase === "checking") {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-border border-t-foreground rounded-full animate-spin"></div>
      </div>
    );
  }

  if (phase === "ready") {
    return (
      <>
        {children}
        {!supportsFileSystemAccess && <ManualSaveBar />}
      </>
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background px-4">
      <div className="max-w-sm w-full text-center space-y-4">
        {phase === "disconnected" && (
          <>
            <p className="text-sm font-medium">Choose where to keep your data</p>
            <p className="text-xs text-muted-foreground">
              Vaea stores everything as plain files on this device — nothing is sent to a server. Pick or create a folder to use.
            </p>
            <button onClick={handleConnect} className="text-sm px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md transition-colors">
              Choose a folder
            </button>
            <p className="text-[11px] text-muted-foreground/70">
              One exception: your chat conversations themselves stay with your account's login provider, not in this folder.
            </p>
          </>
        )}

        {phase === "needs-permission" && (
          <>
            <p className="text-sm font-medium">Resume access to your data</p>
            <p className="text-xs text-muted-foreground">
              Vaea remembers the folder "{folderName}" from last time. Your browser needs a one-click confirmation to use it again this session.
            </p>
            <div className="flex flex-col items-center gap-2 pt-1">
              <button onClick={handleReconnect} className="text-sm px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md transition-colors">
                Resume access
              </button>
              <button onClick={handleConnect} className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">
                Use a different folder instead
              </button>
            </div>
          </>
        )}

        {phase === "manual-needed" && (
          <>
            <p className="text-sm font-medium">Load your data</p>
            <p className="text-xs text-muted-foreground">
              This browser can't grant Vaea direct access to a folder on this device, so data lives only in this tab and is saved by exporting a file. Load a previous export, or start fresh.
            </p>
            <div className="flex flex-col items-center gap-2 pt-1">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-sm px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md transition-colors"
              >
                Load a data file
              </button>
              <button onClick={handleStartFresh} className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">
                Start fresh instead
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleImportFile} />
          </>
        )}

        {phase === "manual-legacy-found" && (
          <>
            <p className="text-sm font-medium">Save your existing data</p>
            <p className="text-xs text-muted-foreground">
              We found Vaea data still sitting in this browser from before. This browser can't save it to a folder automatically — download it as a file now so it isn't lost. Nothing is removed from the browser until you do.
            </p>
            <button onClick={handleSaveLegacyAndContinue} className="text-sm px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md transition-colors flex items-center gap-2 mx-auto">
              <Save className="w-4 h-4" /> Save to file and continue
            </button>
          </>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}

// Persistent affordance for manual-mode sessions: shows whenever there are
// changes since the last export, since that's the only durable save action
// available in this mode.
function ManualSaveBar() {
  const [dirty, setDirty] = useState(isManualDirty());

  useEffect(() => subscribeStatus(() => setDirty(isManualDirty())), []);

  if (!dirty) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 bg-card border border-border rounded-full pl-3 pr-1 py-1 shadow-lg">
      <span className="text-xs text-muted-foreground">Unsaved changes</span>
      <button
        onClick={() => downloadSnapshotFile()}
        className="text-xs px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-full transition-colors flex items-center gap-1.5"
      >
        <Save className="w-3.5 h-3.5" /> Save
      </button>
    </div>
  );
}

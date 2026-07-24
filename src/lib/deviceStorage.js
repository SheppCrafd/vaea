// A device-local storage backend for real user data (Vaea entities, backup
// snapshots) everywhere there's no dev-server behind the tab — see
// localDb.js's file-backed-mode comment. Replaces localStorage there so data
// lands as real files on the user's disk instead of inside the browser, even
// when they're just on the hosted site with no cloned repo.
//
// Two backends, chosen once by capability, not per session:
// - File System Access (Chromium desktop only — window.showDirectoryPicker):
//   a folder the user grants access to once; each key is written as
//   `${key}.json` inside it, same shape as the dev file-backed store's
//   `data/` folder. The *handle* (never any app data) is persisted in
//   IndexedDB so return visits only need a one-click permission re-grant
//   instead of re-picking the folder.
// - Manual mode (every other browser — Firefox, Safari, mobile, or a user
//   who declines the folder picker): nothing is persisted automatically.
//   Data lives in memory for the session; the user loads a previously
//   exported JSON file to start, and exports an updated one to save. This is
//   the only way to guarantee zero browser storage on browsers with no real
//   filesystem API at all.
//
// Callers never branch on which backend is active for reads/writes — only
// the connection UI (DeviceStorageGate) cares, via getStatus/subscribeStatus.

export const supportsFileSystemAccess =
  typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";

const HANDLE_DB_NAME = "vaea-device-storage";
const HANDLE_STORE = "handles";
const HANDLE_KEY = "directory";

function openHandleDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(HANDLE_DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(HANDLE_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getStoredHandle() {
  try {
    const db = await openHandleDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(HANDLE_STORE, "readonly");
      const req = tx.objectStore(HANDLE_STORE).get(HANDLE_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function setStoredHandle(handle) {
  try {
    const db = await openHandleDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(HANDLE_STORE, "readwrite");
      tx.objectStore(HANDLE_STORE).put(handle, HANDLE_KEY);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // best-effort — worst case the user re-picks the folder next visit
  }
}

async function clearStoredHandle() {
  try {
    const db = await openHandleDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(HANDLE_STORE, "readwrite");
      tx.objectStore(HANDLE_STORE).delete(HANDLE_KEY);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // best-effort
  }
}

async function hasPermission(handle) {
  const opts = { mode: "readwrite" };
  if ((await handle.queryPermission(opts)) === "granted") return true;
  return false;
}

// Must be called from a user-gesture handler (click) — the permission
// prompt this can trigger is spec'd to require one.
async function ensurePermission(handle) {
  const opts = { mode: "readwrite" };
  if ((await handle.queryPermission(opts)) === "granted") return true;
  return (await handle.requestPermission(opts)) === "granted";
}

// --- Connection state (FSA mode only) ---------------------------------

let dirHandle = null; // set once connected/reconnected this session
const statusListeners = new Set();

function notify() {
  statusListeners.forEach((fn) => fn());
}

export function subscribeStatus(fn) {
  statusListeners.add(fn);
  return () => statusListeners.delete(fn);
}

// 'connected'         — FSA mode, folder is live and writable this session
// 'needs-permission'  — FSA mode, a remembered folder exists but needs a re-grant click
// 'disconnected'      — FSA mode, no folder ever chosen
// 'manual-ready'      — manual mode, an import or "start fresh" has happened this session
// 'manual-needed'     — manual mode, nothing loaded yet
export async function getStatus() {
  if (supportsFileSystemAccess) {
    if (dirHandle) return "connected";
    const stored = await getStoredHandle();
    return stored ? "needs-permission" : "disconnected";
  }
  return manualLoaded ? "manual-ready" : "manual-needed";
}

// Returns the remembered folder's name for display ("Resume access to
// 'Vaea Data'?"), or null if none is remembered yet.
export async function getRememberedFolderName() {
  const stored = await getStoredHandle();
  return stored?.name ?? null;
}

// Must be called from a click handler — showDirectoryPicker requires a user
// gesture.
export async function connectFolder() {
  const handle = await window.showDirectoryPicker({ mode: "readwrite" });
  dirHandle = handle;
  await setStoredHandle(handle);
  notify();
  return handle;
}

// Must be called from a click handler — the underlying requestPermission
// call requires a user gesture.
export async function reconnectFolder() {
  const stored = await getStoredHandle();
  if (!stored) throw new Error("No remembered folder to reconnect to.");
  const granted = await ensurePermission(stored);
  if (!granted) throw new Error("Permission to the folder was not granted.");
  dirHandle = stored;
  notify();
  return stored;
}

export async function disconnectFolder() {
  dirHandle = null;
  await clearStoredHandle();
  notify();
}

// --- Manual-mode state --------------------------------------------------

const manualStore = new Map(); // key -> already-parsed JSON value
let manualLoaded = false; // true once an import or "start fresh" has run
let manualDirty = false; // true if there are unsaved changes since last export

export function isManualDirty() {
  return manualDirty;
}

export function startFreshManual() {
  manualStore.clear();
  manualLoaded = true;
  manualDirty = false;
  notify();
}

export function exportSnapshot() {
  const data = Object.fromEntries(manualStore.entries());
  return { version: 1, exportedAt: new Date().toISOString(), data };
}

function importSnapshotData(parsed) {
  manualStore.clear();
  const data = parsed?.data && typeof parsed.data === "object" ? parsed.data : {};
  Object.entries(data).forEach(([key, value]) => manualStore.set(key, value));
  manualLoaded = true;
  manualDirty = false;
  notify();
}

export async function loadSnapshotFile(file) {
  const text = await file.text();
  const parsed = JSON.parse(text);
  importSnapshotData(parsed);
}

export function downloadSnapshotFile(filename = "vaea-data.json") {
  const snapshot = exportSnapshot();
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  manualDirty = false;
  notify();
}

// Pulls values straight into the manual store without going through the
// export/import file round-trip (used to seed legacy localStorage data on
// first run — see migrateLegacyStorage.js). Marks dirty so the gate prompts
// the user to save it out to a real file.
export function seedManual(entries) {
  entries.forEach(([key, value]) => {
    if (value !== undefined && value !== null) manualStore.set(key, value);
  });
  manualLoaded = true;
  manualDirty = true;
  notify();
}

// --- Generic key/value read/write (mirrors localStorage.getItem/setItem's
// shape, but async and pre-parsed) --------------------------------------

async function fileHandleFor(key, { create }) {
  return dirHandle.getFileHandle(`${key}.json`, { create });
}

export async function readKey(key) {
  if (supportsFileSystemAccess) {
    if (!dirHandle) throw new Error("Device folder not connected.");
    try {
      const fh = await fileHandleFor(key, { create: false });
      const file = await fh.getFile();
      const text = await file.text();
      return text ? JSON.parse(text) : null;
    } catch (err) {
      if (err.name === "NotFoundError") return null;
      throw err;
    }
  }
  return manualStore.has(key) ? manualStore.get(key) : null;
}

export async function writeKey(key, value) {
  if (supportsFileSystemAccess) {
    if (!dirHandle) throw new Error("Device folder not connected.");
    const fh = await fileHandleFor(key, { create: true });
    const writable = await fh.createWritable();
    await writable.write(JSON.stringify(value, null, 2));
    await writable.close();
    return;
  }
  manualStore.set(key, value);
  manualDirty = true;
  notify();
}

export async function removeKey(key) {
  if (supportsFileSystemAccess) {
    if (!dirHandle) throw new Error("Device folder not connected.");
    try {
      await dirHandle.removeEntry(`${key}.json`);
    } catch (err) {
      if (err.name !== "NotFoundError") throw err;
    }
    return;
  }
  manualStore.delete(key);
  manualDirty = true;
  notify();
}

// Marks every currently-connected key as durably persisted — called after a
// successful legacy-localStorage seed writes straight to disk in FSA mode,
// where there's no separate "save" step for the user to trigger.
export function markManualSaved() {
  manualDirty = false;
  notify();
}

// Test-only: clears the in-memory manual store between test cases in the
// same file (module-scope state otherwise leaks across tests, since vitest
// imports the module once per file). Not used by app code.
export function __resetManualStoreForTests() {
  manualStore.clear();
  manualLoaded = false;
  manualDirty = false;
}

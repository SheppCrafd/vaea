// A device-local storage backend for real user data (Vaea entities, backup
// snapshots) everywhere there's no dev-server behind the tab — see
// localDb.js's file-backed-mode comment. Replaces localStorage there so data
// lands as real files on the user's disk instead of inside the browser, even
// when they're just on the hosted site with no cloned repo.
//
// Three backends. Which one is active is a user choice (see storage mode
// below), not just capability-detected:
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
// - Cloud (cloudStorage.js): data lives in a Base44-hosted entity instead of
//   this device, scoped to the signed-in user — the deliberate exception to
//   "nothing leaves the device," picked explicitly (DeviceStorageGate's
//   first-run choice, or switched later in Settings), never silently.
//
// Callers never branch on which backend is active for reads/writes — only
// the connection UI (DeviceStorageGate/StorageSection) cares, via
// getStatus/subscribeStatus and getStorageMode.

import * as cloudStorage from "@/lib/cloudStorage";
import { appParams } from "@/lib/app-params";

export const supportsFileSystemAccess =
  typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";

// Dev/preview-only escape hatch (see vite-localdb-plugin.js): when the Vite
// dev server's own file-backed middleware is present, every key this module
// stores — not just localDb.js's own entity collections, which already
// checked this same probe before this existed — round-trips through real
// files in the repo's own `data/` folder instead of requiring a real FSA
// folder grant or cloud sign-in. Without this, `npm run dev` could render
// the whole app (DeviceStorageGate itself already skips its folder-connect
// flow the same way) while every read/write here silently failed against a
// never-connected `dirHandle` — the app looked done setting up, but nothing
// written through readKey/writeKey (AI Model provider, AI identity, vault
// connection) ever actually persisted past that one render. A production
// build, the Base44-hosted preview, and the standalone distributions have no
// Node process behind them at all, so this probe always resolves false
// there and every call below falls through to the real cloud/device logic
// exactly as before. Single source of truth for the probe — localDb.js
// imports this same export rather than keeping its own copy.
const FILE_API_PREFIX = "/__localdb/";
let fileBackedModePromise = null;
export function isFileBackedModeAvailable() {
  if (!fileBackedModePromise) {
    fileBackedModePromise = fetch(`${FILE_API_PREFIX}__probe`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(() => true)
      .catch(() => false);
  }
  return fileBackedModePromise;
}

async function readFileBackedKey(key) {
  const res = await fetch(`${FILE_API_PREFIX}${key}`);
  if (!res.ok) return null;
  const value = await res.json();
  // The dev middleware answers a never-written key with `[]` (it's built
  // for localDb.js's own array-shaped collections) — every caller through
  // this module stores a single object, so treat that placeholder as "not
  // set yet", same as every other backend's null-for-missing contract.
  return Array.isArray(value) && value.length === 0 ? null : value;
}

async function writeFileBackedKey(key, value) {
  await fetch(`${FILE_API_PREFIX}${key}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
}

async function removeFileBackedKey(key) {
  await fetch(`${FILE_API_PREFIX}${key}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify([]),
  });
}

// Which backend readKey/writeKey/getStatus dispatch to — 'device' (FSA or
// manual, chosen by capability as before) or 'cloud'. This has to live
// outside every backend it's choosing between, so — like app-params.js's own
// session token — it's the one other deliberate exception to "no app data in
// browser storage": it isn't data, it's which storage holds the data.
// Defaults to 'device' for anyone who hasn't explicitly chosen 'cloud' yet,
// which is every pre-existing user — this backend was added after the fact,
// and must not change behavior for anyone who never sees the new choice
// screen (see DeviceStorageGate's hasStorageModeBeenChosen usage).
const STORAGE_MODE_KEY = "vaea_storage_mode";

export function hasStorageModeBeenChosen() {
  try {
    return localStorage.getItem(STORAGE_MODE_KEY) != null;
  } catch {
    return false;
  }
}

export function getStorageMode() {
  try {
    return localStorage.getItem(STORAGE_MODE_KEY) || "device";
  } catch {
    return "device";
  }
}

export function setStorageMode(mode) {
  try {
    localStorage.setItem(STORAGE_MODE_KEY, mode);
  } catch {
    // best-effort — worst case the choice doesn't survive a reload
  }
  notify();
}

function isCloudMode() {
  return getStorageMode() === "cloud";
}

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

// 'cloud-connected'   — cloud mode, a real session token is present
// 'cloud-needs-auth'  — cloud mode chosen, but nobody's signed in yet
// 'connected'         — device mode/FSA, folder is live and writable this session
// 'needs-permission'  — device mode/FSA, a remembered folder exists but needs a re-grant click
// 'disconnected'      — device mode/FSA, no folder ever chosen
// 'manual-ready'      — device mode/manual, an import or "start fresh" has happened this session
// 'manual-needed'     — device mode/manual, nothing loaded yet
export async function getStatus() {
  if (isCloudMode()) {
    // A lightweight presence check, not a live validity check — mirrors
    // AuthContext.jsx's own optimism (token present -> assume authenticated
    // until an actual API call proves otherwise). A stale/expired token
    // surfaces as a real failure the first time readKey/writeKey below
    // actually calls out, same as any other authenticated request in this
    // app.
    return appParams.token ? "cloud-connected" : "cloud-needs-auth";
  }
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

// The FSA/manual logic itself, exported directly under its own name too —
// used by storageMigration.js to read *from* the device backend specifically
// while switching to cloud, regardless of which mode is currently active
// (readKey/writeKey below would just recurse into whichever mode is current,
// which is no good mid-switch).
export async function readDeviceKey(key) {
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

// Our own writes to any one file are already fully serialized — see
// asyncKeyLock.js's withKeyLock, one lock per collection/key, wrapping every
// localDb.js mutation and this module's own writeKey/writeDeviceKey callers.
// Despite that, real-world use still hits Chromium's own FSA implementation
// throwing "An operation that depends on state cached in an interface object
// was made but the state had changed since it was read from disk." on a
// fresh createWritable() right after a *previous, already-closed* writable
// for that same file — an internal FSA handle-caching quirk (observed in
// practice on rapid back-to-back writes, e.g. a multi-step chat plan writing
// the same collection several times in quick succession), not evidence of
// an actual overlapping write on our side. A short bounded retry recovers
// from this transient case invisibly; a genuine, persistent problem
// (permission revoked, disk full, folder deleted) fails the same way on
// every attempt and still surfaces after retries are exhausted.
const FSA_WRITE_MAX_ATTEMPTS = 3;
const FSA_WRITE_RETRY_DELAY_MS = 120;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function withFsaRetry(fn, { attempts = FSA_WRITE_MAX_ATTEMPTS, delayMs = FSA_WRITE_RETRY_DELAY_MS } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < attempts) await sleep(delayMs * attempt);
    }
  }
  throw lastError;
}

export async function writeDeviceKey(key, value) {
  if (supportsFileSystemAccess) {
    if (!dirHandle) throw new Error("Device folder not connected.");
    const body = JSON.stringify(value, null, 2);
    return withFsaRetry(async () => {
      const fh = await fileHandleFor(key, { create: true });
      const writable = await fh.createWritable();
      await writable.write(body);
      await writable.close();
    });
  }
  manualStore.set(key, value);
  manualDirty = true;
  notify();
}

export async function readKey(key) {
  if (await isFileBackedModeAvailable()) return readFileBackedKey(key);
  if (isCloudMode()) return cloudStorage.readKey(key);
  return readDeviceKey(key);
}

export async function writeKey(key, value) {
  if (await isFileBackedModeAvailable()) return writeFileBackedKey(key, value);
  if (isCloudMode()) return cloudStorage.writeKey(key, value);
  return writeDeviceKey(key, value);
}

export async function removeDeviceKey(key) {
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

export async function removeKey(key) {
  if (await isFileBackedModeAvailable()) return removeFileBackedKey(key);
  if (isCloudMode()) return cloudStorage.removeKey(key);
  return removeDeviceKey(key);
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

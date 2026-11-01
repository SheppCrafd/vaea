// Local-first data layer for all non-AI app data (areas, products, projects,
// tasks, stakeholders, departments, project notes), plus chat sessions/
// messages specifically for Local Mode (see useChatSessions.js/
// useChatMessages.js — Base44-hosted ChatSession/ChatMessage stay the
// storage for every other provider, since those need a real account
// regardless). Mirrors the subset of the base44 entities API (list/get/
// filter/create/update/delete/subscribe) that the app's hooks used, so this
// is a drop-in swap behind those hooks — with one deliberate gap: no
// sort/limit/offset/operator support in `filter`, since chatMessages' own
// hook does that client-side over the (typically small) local result set
// instead of teaching this generic layer server-style querying for one
// caller.
//
// Two backing stores, chosen automatically per session:
// - File-backed (dev/preview only): real JSON files in a gitignored `data/`
//   folder in the cloned repo, read/written through vite-localdb-plugin.js's
//   dev-server middleware. Lets a developer running `npm run dev`/`npm run
//   preview` open their own data as plain files.
// - deviceStorage (everywhere else — production build, the base44-hosted
//   preview, the standalone .bat/.exe distributions): none of those have a
//   Node process behind them to serve the file-backed API. deviceStorage
//   itself is never browser storage — see its own header — so entity data
//   never lands in localStorage/IndexedDB regardless of which context the
//   app is running in. DeviceStorageGate (App.jsx) blocks all rendering
//   that could reach this module until deviceStorage reports ready, so
//   nothing here ever reads before a backend is actually connected.
// Both stores expose the exact same shape below; nothing outside this file
// needs to know or care which one is actually active.

import { readKey, writeKey, seedManual, supportsFileSystemAccess, isFileBackedModeAvailable } from "@/lib/deviceStorage";
import { withKeyLock } from "@/lib/asyncKeyLock";

// Re-exported for existing callers (DeviceStorageGate.jsx) — the probe
// itself now lives in deviceStorage.js since readKey/writeKey need it too
// (see that module's own comment), not just this file's collections.
export { isFileBackedModeAvailable };

const COLLECTIONS = ["areas", "products", "projects", "tasks", "stakeholders", "departments", "projectNotes", "notes", "chatSessions", "chatMessages"];

const FILE_API_PREFIX = "/__localdb/"; // collection reads/writes below still talk to this directly (array shape, not readKey/writeKey's single-object contract)

// Pre-existing browser-storage copy of entity data from before device
// storage existed (old prefix from when the app was named Portfolio
// Tracker, or the vaea_db_ prefix used up through the localStorage-fallback
// era) — read once so a returning user doesn't lose it, never written to
// again. Callers clear it only once the data has been durably persisted to
// the new backend (see DeviceStorageGate).
const LEGACY_STORAGE_PREFIXES = ["vaea_db_", "portfolio_tracker_db_"];

export function readLegacyLocalStorageData() {
  const found = {};
  let any = false;
  COLLECTIONS.forEach((name) => {
    for (const prefix of LEGACY_STORAGE_PREFIXES) {
      const raw = localStorage.getItem(prefix + name);
      if (raw) {
        try {
          found[name] = JSON.parse(raw);
          any = true;
          break;
        } catch {
          // corrupt entry — skip it
        }
      }
    }
  });
  return any ? found : null;
}

export function clearLegacyLocalStorageData() {
  COLLECTIONS.forEach((name) => {
    LEGACY_STORAGE_PREFIXES.forEach((prefix) => {
      try {
        localStorage.removeItem(prefix + name);
      } catch {
        // best-effort
      }
    });
  });
}

// Writes legacy data straight into whichever deviceStorage backend is
// active — real files in FSA mode, the in-memory manual store (and marks it
// loaded/dirty) otherwise — called by DeviceStorageGate right after a
// backend becomes available, before anything else reads a collection.
export async function seedCollections(data) {
  const entries = COLLECTIONS.filter((name) => data[name]).map((name) => [name, data[name]]);
  if (supportsFileSystemAccess) {
    for (const [name, items] of entries) await writeKey(name, items);
  } else {
    seedManual(entries);
  }
}

// In-memory mirror of each collection, populated once (from whichever store
// is active) and kept in sync on every write — so a read never has to hit
// the file API or re-parse localStorage more than once per collection. This
// app is single-tab/single-writer (no other process touches these files or
// keys — see writeCollection), so the cache can be trusted as the source of
// truth between writes.
const cache = new Map(); // name -> item[]
const loading = new Map(); // name -> in-flight Promise<item[]>

// A collection whose stored copy exists but couldn't be read (a corrupt
// file, a revoked folder permission, a network error in cloud mode). It is
// never treated as empty: an empty cache here used to let the next create()
// write `[newItem]` over the user's real data. Reads and writes to it throw
// until the user retries, and the app shows a banner (StorageReadErrorBanner).
export class CollectionReadError extends Error {
  constructor(name, cause) {
    super(`Vaea couldn't read your saved ${name}. Nothing has been changed. Check your connection or data folder, then try again.`, { cause });
    this.name = "CollectionReadError";
    this.title = "Couldn't read your saved data";
    this.collection = name;
  }
}
const unreadable = new Map(); // name -> CollectionReadError
const readErrorListeners = new Set();
function notifyReadErrors() {
  readErrorListeners.forEach((fn) => fn([...unreadable.keys()]));
}
export function subscribeReadErrors(fn) {
  readErrorListeners.add(fn);
  fn([...unreadable.keys()]);
  return () => readErrorListeners.delete(fn);
}
export function unreadableCollections() {
  return [...unreadable.keys()];
}
// Forget the failed reads so the next read tries storage again.
export function retryUnreadable() {
  for (const name of unreadable.keys()) cache.delete(name);
  unreadable.clear();
  notifyReadErrors();
}

// Reads straight from storage. Missing data (never written) is an empty
// collection; anything that fails to read throws CollectionReadError.
async function readStored(name) {
  try {
    if (await isFileBackedModeAvailable()) {
      const res = await fetch(`${FILE_API_PREFIX}${name}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const items = await res.json();
      if (!Array.isArray(items)) throw new Error("not a list");
      return items;
    }
    const items = (await readKey(name)) ?? [];
    if (!Array.isArray(items)) throw new Error("not a list");
    return items;
  } catch (err) {
    const error = new CollectionReadError(name, err);
    unreadable.set(name, error);
    notifyReadErrors();
    throw error;
  }
}

async function loadCollection(name) {
  if (unreadable.has(name)) throw unreadable.get(name);
  if (cache.has(name)) return cache.get(name);
  if (loading.has(name)) return loading.get(name);

  const promise = (async () => {
    try {
      const items = await readStored(name);
      cache.set(name, items);
      return items;
    } finally {
      loading.delete(name);
    }
  })();

  loading.set(name, promise);
  return promise;
}

// Returns a fresh array reference (shallow copy) every call — callers (React
// Query in particular) rely on getting a new array identity per read, and
// nothing here may hand out the live cached array itself, since create()
// mutates its local copy in place before writing it back.
async function readCollection(name) {
  const items = await loadCollection(name);
  return items.slice();
}

// For read-modify-write: always re-read the stored copy, never the cache.
// Another tab (or, in cloud mode, another device) may have written since
// this tab last read, and writing from a stale cache would erase its
// changes. Runs inside the collection lock, so this tab's own writes stay
// in order.
async function readForWrite(name) {
  if (unreadable.has(name)) throw unreadable.get(name);
  const items = await readStored(name);
  cache.set(name, items);
  return items.slice();
}

// Tells other open tabs which collection changed, so they drop their copy
// and re-read instead of showing (and later writing back) stale data.
const TAB_ID = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Math.random());
const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("vaea-localdb") : null;
const externalChangeListeners = new Set();
if (channel) {
  channel.onmessage = (event) => {
    const { name, from } = event.data || {};
    if (!name || from === TAB_ID) return;
    cache.delete(name);
    emit(name);
    externalChangeListeners.forEach((fn) => fn(name));
  };
}
// Called when another tab changed a collection (AuthenticatedApp refreshes
// its queries).
export function onExternalChange(fn) {
  externalChangeListeners.add(fn);
  return () => externalChangeListeners.delete(fn);
}

async function writeCollection(name, items) {
  // Persist first: if the write throws (a file-system error, localStorage
  // quota/private-browsing, etc.) the cache must not drift from what's
  // actually on disk, matching the prior (uncached) behavior where a failed
  // write left storage untouched.
  if (await isFileBackedModeAvailable()) {
    await fetch(`${FILE_API_PREFIX}${name}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(items),
    });
  } else {
    await writeKey(name, items);
  }
  cache.set(name, items);
  emit(name);
  channel?.postMessage({ name, from: TAB_ID });
}

// Serializes every read-modify-write cycle (create/update/updateMany/
// delete/replaceAll) per collection into one FIFO queue (see asyncKeyLock.js
// for the two real races this closes). Without this, two callers racing on
// the same collection (a chat plan's own multi-step executeActionSequence
// running at the same time as an ordinary UI mutation — a drag-reorder, an
// inline title edit's onBlur, another hook entirely; this app keeps
// Dashboard/Chat/Settings mounted as persistent tabs, not separate page
// loads, so any of those really can fire while chat is mid-plan) would both
// call readCollection and get the same cached array, then each
// independently push their own writeCollection. The "single-tab/single-
// writer" assumption on loadCollection's own comment above is only true per
// collection if writes to it are actually serialized — this is what makes
// that true, rather than just asserted. Namespaced ("localDb:" prefix) since
// the lock is keyed globally across every caller of withKeyLock, not just
// this module's own collections (see SET_AI_IDENTITY in chatActions.js for
// the other real caller).
function withCollectionLock(name, fn) {
  return withKeyLock(`localDb:${name}`, fn);
}

const listeners = new Map(); // name -> Set<fn>

function emit(name) {
  (listeners.get(name) || new Set()).forEach((fn) => fn());
}

function subscribe(name, fn) {
  if (!listeners.has(name)) listeners.set(name, new Set());
  listeners.get(name).add(fn);
  return () => listeners.get(name)?.delete(fn);
}

function matches(item, query) {
  return Object.entries(query).every(([key, value]) => item[key] === value);
}

function createCollection(name) {
  return {
    list: async () => readCollection(name),
    get: async (id) => (await readCollection(name)).find((item) => item.id === id) || null,
    filter: async (query = {}) => (await readCollection(name)).filter((item) => matches(item, query)),
    create: async (data) => withCollectionLock(name, async () => {
      const now = new Date().toISOString();
      const item = { id: crypto.randomUUID(), created_date: now, updated_date: now, ...data };
      const items = await readForWrite(name);
      items.push(item);
      await writeCollection(name, items);
      return item;
    }),
    update: async (id, patch) => withCollectionLock(name, async () => {
      const items = await readForWrite(name);
      const index = items.findIndex((item) => item.id === id);
      // Plain words for the toast; the id stays in the console-visible
      // `cause` for debugging, not the message a person reads.
      if (index === -1) throw new Error("That item no longer exists. It may have been deleted somewhere else.", { cause: `${name} ${id}` });
      const updated = { ...items[index], ...patch, updated_date: new Date().toISOString() };
      items[index] = updated;
      await writeCollection(name, items);
      return updated;
    }),
    // Applies the same patch (or a per-item patch function) to every item
    // whose id is in `ids`, in a single read+write cycle instead of one
    // read+write per id. Used by cascade updates (e.g. deleting an Area
    // soft-deletes every Product/Project/Task beneath it) where the naive
    // "map to update() calls" pattern re-serialized the entire collection to
    // storage once per affected item. Unknown ids are silently ignored
    // (cascades always derive `ids` from a just-read filter, so this mirrors
    // that caller's own view of what exists).
    updateMany: async (ids, patch) => withCollectionLock(name, async () => {
      if (!ids.length) return [];
      const idSet = new Set(ids);
      const now = new Date().toISOString();
      const updated = [];
      const items = (await readForWrite(name)).map((item) => {
        if (!idSet.has(item.id)) return item;
        const merged = { ...item, ...(typeof patch === "function" ? patch(item) : patch), updated_date: now };
        updated.push(merged);
        return merged;
      });
      await writeCollection(name, items);
      return updated;
    }),
    delete: async (id) => withCollectionLock(name, async () => {
      const items = await readForWrite(name);
      await writeCollection(name, items.filter((item) => item.id !== id));
      return { id };
    }),
    // Overwrites the entire collection with exactly the given items, no
    // per-item merge/timestamp logic — for restoring a prior snapshot
    // (backupSnapshots.js), where the point is putting the data back exactly
    // as it was, not running it back through create/update semantics.
    replaceAll: async (items) => withCollectionLock(name, () => writeCollection(name, items).then(() => items)),
    subscribe: (fn) => subscribe(name, fn),
  };
}

export const localDb = Object.fromEntries(COLLECTIONS.map((name) => [name, createCollection(name)]));

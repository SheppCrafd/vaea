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

const COLLECTIONS = ["areas", "products", "projects", "tasks", "stakeholders", "departments", "projectNotes", "chatSessions", "chatMessages"];

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

async function loadCollection(name) {
  if (cache.has(name)) return cache.get(name);
  if (loading.has(name)) return loading.get(name);

  const promise = (async () => {
    let items = [];
    if (await isFileBackedModeAvailable()) {
      try {
        const res = await fetch(`${FILE_API_PREFIX}${name}`);
        items = res.ok ? await res.json() : [];
      } catch {
        items = [];
      }
    } else {
      try {
        items = (await readKey(name)) ?? [];
      } catch {
        items = [];
      }
    }
    cache.set(name, items);
    loading.delete(name);
    return items;
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
      const items = await readCollection(name);
      items.push(item);
      await writeCollection(name, items);
      return item;
    }),
    update: async (id, patch) => withCollectionLock(name, async () => {
      const items = await readCollection(name);
      const index = items.findIndex((item) => item.id === id);
      if (index === -1) throw new Error(`${name} record ${id} not found`);
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
      const items = (await readCollection(name)).map((item) => {
        if (!idSet.has(item.id)) return item;
        const merged = { ...item, ...(typeof patch === "function" ? patch(item) : patch), updated_date: now };
        updated.push(merged);
        return merged;
      });
      await writeCollection(name, items);
      return updated;
    }),
    delete: async (id) => withCollectionLock(name, async () => {
      const items = await readCollection(name);
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

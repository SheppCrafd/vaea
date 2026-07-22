// Local-first data layer for all non-AI app data (areas, products, projects,
// tasks, stakeholders, departments, project notes). Mirrors the subset of
// the base44 entities API (list/get/filter/create/update/delete/subscribe)
// that the app's hooks used, so this is a drop-in swap behind those hooks.
// Chat data (ChatMessage/ChatSession) stays on base44 and does not go
// through this module.
//
// Two backing stores, chosen automatically per session:
// - File-backed (dev/preview only): real JSON files in a gitignored `data/`
//   folder in the cloned repo, read/written through vite-localdb-plugin.js's
//   dev-server middleware. Lets a developer running `npm run dev`/`npm run
//   preview` open their own data as plain files.
// - localStorage (everywhere else — production build, the base44-hosted
//   preview, the standalone .bat/.exe distributions): none of those have a
//   Node process behind them to serve the file-backed API, so this is the
//   fallback that keeps the app fully functional without one.
// Both stores expose the exact same shape below; nothing outside this file
// needs to know or care which one is actually active.

const COLLECTIONS = ["areas", "products", "projects", "tasks", "stakeholders", "departments", "projectNotes"];

const STORAGE_PREFIX = "portfolio_tracker_db_";
const FILE_API_PREFIX = "/__localdb/";

// A single shared probe, not one per collection — if the dev-server
// middleware isn't there, it isn't there for any collection. Memoized so
// every caller (every collection, every read) awaits the same in-flight
// check instead of each re-probing independently.
let fileBackedModePromise = null;
function isFileBackedModeAvailable() {
  if (!fileBackedModePromise) {
    fileBackedModePromise = fetch(`${FILE_API_PREFIX}__probe`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(() => true)
      .catch(() => false);
  }
  return fileBackedModePromise;
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
        const raw = localStorage.getItem(STORAGE_PREFIX + name);
        items = raw ? JSON.parse(raw) : [];
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
    localStorage.setItem(STORAGE_PREFIX + name, JSON.stringify(items));
  }
  cache.set(name, items);
  emit(name);
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
    create: async (data) => {
      const now = new Date().toISOString();
      const item = { id: crypto.randomUUID(), created_date: now, updated_date: now, ...data };
      const items = await readCollection(name);
      items.push(item);
      await writeCollection(name, items);
      return item;
    },
    update: async (id, patch) => {
      const items = await readCollection(name);
      const index = items.findIndex((item) => item.id === id);
      if (index === -1) throw new Error(`${name} record ${id} not found`);
      const updated = { ...items[index], ...patch, updated_date: new Date().toISOString() };
      items[index] = updated;
      await writeCollection(name, items);
      return updated;
    },
    // Applies the same patch (or a per-item patch function) to every item
    // whose id is in `ids`, in a single read+write cycle instead of one
    // read+write per id. Used by cascade updates (e.g. deleting an Area
    // soft-deletes every Product/Project/Task beneath it) where the naive
    // "map to update() calls" pattern re-serialized the entire collection to
    // storage once per affected item. Unknown ids are silently ignored
    // (cascades always derive `ids` from a just-read filter, so this mirrors
    // that caller's own view of what exists).
    updateMany: async (ids, patch) => {
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
    },
    delete: async (id) => {
      const items = await readCollection(name);
      await writeCollection(name, items.filter((item) => item.id !== id));
      return { id };
    },
    subscribe: (fn) => subscribe(name, fn),
  };
}

export const localDb = Object.fromEntries(COLLECTIONS.map((name) => [name, createCollection(name)]));

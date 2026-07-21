// Browser-localStorage-backed data layer for all non-AI app data (areas,
// products, projects, tasks, stakeholders, departments, project notes).
// Mirrors the subset of the base44 entities API (list/get/filter/create/
// update/delete/subscribe) that the app's hooks used, so this is a drop-in
// swap behind those hooks. Chat data (ChatMessage/ChatSession) stays on
// base44 and does not go through this module.

const COLLECTIONS = ["areas", "products", "projects", "tasks", "stakeholders", "departments", "projectNotes"];

const STORAGE_PREFIX = "portfolio_tracker_db_";

// In-memory mirror of each collection, lazily hydrated from localStorage on
// first access and kept in sync on every write. This app is single-tab/
// single-browser (no other writer touches these keys — see writeCollection),
// so the cache can be trusted as the source of truth between writes instead
// of re-parsing the full JSON blob from localStorage on every single read.
// That matters here: every useQuery in the entity hooks calls list()/filter()
// on mount and after every invalidation, so an uncached read was doing a full
// JSON.parse of the entire collection on the main thread for every one of
// those calls.
const cache = new Map(); // name -> item[]

function loadCollection(name) {
  if (!cache.has(name)) {
    let items = [];
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + name);
      items = raw ? JSON.parse(raw) : [];
    } catch {
      items = [];
    }
    cache.set(name, items);
  }
  return cache.get(name);
}

// Returns a fresh array reference (shallow copy) every call — callers (React
// Query in particular) rely on getting a new array identity per read, and
// nothing here may hand out the live cached array itself, since create()
// mutates its local copy in place before writing it back.
function readCollection(name) {
  return loadCollection(name).slice();
}

function writeCollection(name, items) {
  // Persist first: if localStorage throws (quota, private-browsing, etc.)
  // the cache must not drift from what's actually on disk, matching the
  // prior (uncached) behavior where a failed write left storage untouched.
  localStorage.setItem(STORAGE_PREFIX + name, JSON.stringify(items));
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
    get: async (id) => readCollection(name).find((item) => item.id === id) || null,
    filter: async (query = {}) => readCollection(name).filter((item) => matches(item, query)),
    create: async (data) => {
      const now = new Date().toISOString();
      const item = { id: crypto.randomUUID(), created_date: now, updated_date: now, ...data };
      const items = readCollection(name);
      items.push(item);
      writeCollection(name, items);
      return item;
    },
    update: async (id, patch) => {
      const items = readCollection(name);
      const index = items.findIndex((item) => item.id === id);
      if (index === -1) throw new Error(`${name} record ${id} not found`);
      const updated = { ...items[index], ...patch, updated_date: new Date().toISOString() };
      items[index] = updated;
      writeCollection(name, items);
      return updated;
    },
    // Applies the same patch (or a per-item patch function) to every item
    // whose id is in `ids`, in a single read+write cycle instead of one
    // read+write per id. Used by cascade updates (e.g. deleting an Area
    // soft-deletes every Product/Project/Task beneath it) where the naive
    // "map to update() calls" pattern re-serialized the entire collection to
    // localStorage once per affected item. Unknown ids are silently ignored
    // (cascades always derive `ids` from a just-read filter, so this mirrors
    // that caller's own view of what exists).
    updateMany: async (ids, patch) => {
      if (!ids.length) return [];
      const idSet = new Set(ids);
      const now = new Date().toISOString();
      const updated = [];
      const items = readCollection(name).map((item) => {
        if (!idSet.has(item.id)) return item;
        const merged = { ...item, ...(typeof patch === "function" ? patch(item) : patch), updated_date: now };
        updated.push(merged);
        return merged;
      });
      writeCollection(name, items);
      return updated;
    },
    delete: async (id) => {
      const items = readCollection(name);
      writeCollection(name, items.filter((item) => item.id !== id));
      return { id };
    },
    subscribe: (fn) => subscribe(name, fn),
  };
}

export const localDb = Object.fromEntries(COLLECTIONS.map((name) => [name, createCollection(name)]));

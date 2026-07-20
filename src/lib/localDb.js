// Browser-localStorage-backed data layer for all non-AI app data (areas,
// products, projects, tasks, stakeholders, departments, project notes).
// Mirrors the subset of the base44 entities API (list/get/filter/create/
// update/delete/subscribe) that the app's hooks used, so this is a drop-in
// swap behind those hooks. Chat data (ChatMessage/ChatSession) stays on
// base44 and does not go through this module.

const COLLECTIONS = ["areas", "products", "projects", "tasks", "stakeholders", "departments", "projectNotes"];

const STORAGE_PREFIX = "portfolio_tracker_db_";

function readCollection(name) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + name);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeCollection(name, items) {
  localStorage.setItem(STORAGE_PREFIX + name, JSON.stringify(items));
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
    delete: async (id) => {
      const items = readCollection(name);
      writeCollection(name, items.filter((item) => item.id !== id));
      return { id };
    },
    subscribe: (fn) => subscribe(name, fn),
  };
}

export const localDb = Object.fromEntries(COLLECTIONS.map((name) => [name, createCollection(name)]));

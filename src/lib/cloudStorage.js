// A third deviceStorage.js backend, alongside File System Access and manual
// mode: instead of a folder or an exported file on this device, data lives
// in a Base44-hosted `AppData` entity (one row per key, RLS-scoped to the
// signed-in user — see base44/entities/AppData.jsonc), so it's available
// from any device/browser the user signs into. Requires a real session —
// there's no anonymous/guest path here, unlike the rest of the app.
//
// Same generic key/value shape as deviceStorage.js's own readKey/writeKey
// (pre-parsed values, no JSON.stringify at the call site) so localDb.js and
// every other caller of that module's functions don't need to know or care
// this backend exists — deviceStorage.js is the only thing that imports
// this file, dispatching to it when the user has chosen "cloud" storage.
//
// AppData.value is schema-typed "object" (base44 requires some type, and
// enforces it as a real dict at write time), but real values are a mix of
// arrays (tasks/projects/areas/...) and plain objects (AI identity, vault
// connection). So every value is wrapped in a one-key envelope going in and
// unwrapped coming out, keeping the column honestly object-shaped while
// `value` stays whatever-shaped to every caller of this module.
import { base44 } from "@/api/base44Client";

// AppData row ids, once looked up, so a second write to the same key updates
// the existing row instead of re-querying for it every time.
const rowIdCache = new Map();

async function findRowId(key) {
  if (rowIdCache.has(key)) return rowIdCache.get(key);
  const rows = await base44.entities.AppData.filter({ key });
  const id = rows[0]?.id ?? null;
  if (id) rowIdCache.set(key, id);
  return id;
}

export async function readKey(key) {
  const rows = await base44.entities.AppData.filter({ key });
  if (rows.length === 0) return null;
  rowIdCache.set(key, rows[0].id);
  return rows[0].value?.data ?? null;
}

export async function writeKey(key, value) {
  const envelope = { data: value };
  const id = await findRowId(key);
  if (id) {
    await base44.entities.AppData.update(id, { value: envelope });
  } else {
    const row = await base44.entities.AppData.create({ key, value: envelope });
    rowIdCache.set(key, row.id);
  }
}

export async function removeKey(key) {
  const id = await findRowId(key);
  if (!id) return;
  await base44.entities.AppData.delete(id);
  rowIdCache.delete(key);
}

// Test-only: clears the id cache between test cases (module-scope state
// otherwise leaks across tests in the same file, same reason
// deviceStorage.js has its own __resetManualStoreForTests). Not used by app
// code.
export function __resetRowIdCacheForTests() {
  rowIdCache.clear();
}

// A same-day rollback safety net for local data — the in-app analog of the
// git-branch backup taken before risky vault changes. Local data has no
// version control of its own, and the existing UNDO_LAST_ACTION only pops a
// single action from in-memory state (gone on reload) — nothing protected
// against a bad multi-step AI plan or a bad CSV bulk-import. This snapshots
// every collection to deviceStorage before either of those run, and lets a
// user restore one from Settings. Same backend as localDb.js (real files in
// FSA mode, in-memory + manual export otherwise) — never localStorage.
import { localDb } from "@/lib/localDb";
import { readKey, writeKey, removeKey } from "@/lib/deviceStorage";

const COLLECTIONS = ["areas", "products", "projects", "tasks", "stakeholders", "departments", "projectNotes"];
const INDEX_KEY = "vaea_backups_index";
const SNAPSHOT_PREFIX = "vaea_backup_";
const MAX_SNAPSHOTS = 8;

async function readIndex() {
  try {
    return (await readKey(INDEX_KEY)) ?? [];
  } catch {
    return [];
  }
}

async function writeIndex(index) {
  try {
    await writeKey(INDEX_KEY, index);
  } catch {
    // best-effort — a failed index write just means this snapshot won't be listed
  }
}

// Snapshots every collection and prepends it to the index, newest first.
// Best-effort throughout: a failure here (storage quota, private browsing)
// must never block the AI action or CSV import it's protecting — losing the
// safety net is better than losing the ability to use the app.
export async function createSnapshot(label) {
  try {
    const entries = await Promise.all(COLLECTIONS.map(async (name) => [name, await localDb[name].list()]));
    const data = Object.fromEntries(entries);
    const counts = Object.fromEntries(entries.map(([name, items]) => [name, items.length]));
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const created_at = new Date().toISOString();

    await writeKey(SNAPSHOT_PREFIX + id, data);

    const index = [{ id, label, created_at, counts }, ...(await readIndex())];
    const kept = index.slice(0, MAX_SNAPSHOTS);
    const dropped = index.slice(MAX_SNAPSHOTS);
    await Promise.all(
      dropped.map(async (entry) => {
        try {
          await removeKey(SNAPSHOT_PREFIX + entry.id);
        } catch {
          // best-effort — an orphaned snapshot blob just sits unused
        }
      })
    );
    await writeIndex(kept);
    return id;
  } catch {
    return null;
  }
}

// Newest first — what Settings' backup list renders directly.
export async function listSnapshots() {
  return readIndex();
}

// Restores every collection to exactly the state a snapshot captured. Takes
// a fresh "before restore" snapshot of the *current* state first, so
// restoring is itself undoable instead of a one-way door.
export async function restoreSnapshot(id) {
  const data = await readKey(SNAPSHOT_PREFIX + id);
  if (!data) throw new Error("Backup not found — it may have been pruned.");

  await createSnapshot("Before restore (auto)");

  for (const name of COLLECTIONS) {
    await localDb[name].replaceAll(data[name] || []);
  }
}

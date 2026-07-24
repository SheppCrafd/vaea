import { useEffect, useState } from "react";
import { RotateCcw, Check } from "lucide-react";
import { listSnapshots, restoreSnapshot } from "@/lib/backupSnapshots";
import { confirmThen } from "@/lib/entityUtils";

const COLLECTION_LABELS = {
  areas: "areas", products: "products", projects: "projects", tasks: "tasks",
  stakeholders: "stakeholders", departments: "departments", projectNotes: "notes",
};

function summarizeCounts(counts) {
  return Object.entries(counts || {})
    .filter(([, count]) => count > 0)
    .map(([name, count]) => `${count} ${COLLECTION_LABELS[name] || name}`)
    .join(", ") || "empty";
}

// A same-day rollback safety net for local data — the in-app analog of the
// git-branch backup taken before risky vault changes. A snapshot is taken
// automatically before any multi-step AI plan, bulk create/delete, or CSV
// import (see backupSnapshots.js / chatActions.js), so this section is only
// for browsing and restoring one — nothing to configure.
export default function BackupRestoreSection() {
  const [snapshots, setSnapshots] = useState([]);
  const [restoringId, setRestoringId] = useState(null);
  const [justRestoredId, setJustRestoredId] = useState(null);

  useEffect(() => {
    listSnapshots().then(setSnapshots);
  }, []);

  const handleRestore = (id) => {
    confirmThen(
      "Restore this backup? Your current data will be replaced (a fresh backup of the current state is taken first, so this itself can be undone).",
      async () => {
        setRestoringId(id);
        try {
          await restoreSnapshot(id);
          setSnapshots(await listSnapshots());
          setJustRestoredId(id);
          setTimeout(() => setJustRestoredId(null), 2000);
        } finally {
          setRestoringId(null);
        }
      }
    );
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">Backups</p>
      <p className="text-xs text-muted-foreground mb-4">
        A snapshot of everything is taken automatically before any multi-step AI plan, bulk create/delete, or CSV import. Restore one below if something went wrong.
      </p>

      {snapshots.length === 0 ? (
        <p className="text-sm text-muted-foreground">No backups yet — one is created the first time a bulk change runs.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {snapshots.map((snap) => (
            <div key={snap.id} className="flex items-center justify-between gap-3 text-sm border border-border rounded-md px-3 py-2">
              <div className="min-w-0">
                <p className="font-medium truncate">{snap.label}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(snap.created_at).toLocaleString()} · {summarizeCounts(snap.counts)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleRestore(snap.id)}
                disabled={restoringId === snap.id}
                className="shrink-0 flex items-center gap-1.5 text-xs px-3 py-1.5 border border-input rounded-md hover:bg-accent transition-colors disabled:opacity-50"
              >
                {justRestoredId === snap.id ? (
                  <><Check className="w-3.5 h-3.5" /> Restored</>
                ) : (
                  <><RotateCcw className="w-3.5 h-3.5" /> {restoringId === snap.id ? "Restoring…" : "Restore"}</>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

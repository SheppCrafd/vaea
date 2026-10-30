import { useEffect, useState } from "react";
import { RotateCcw, Check } from "lucide-react";
import { listSnapshots, restoreSnapshot } from "@/lib/backupSnapshots";
import { confirmThen } from "@/lib/entityUtils";
import { useToast } from "@/components/ui/use-toast";
import { SettingsCard } from "@/components/ui/settings-card";

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
  const { toast } = useToast();

  useEffect(() => {
    listSnapshots().then(setSnapshots);
  }, []);

  const handleRestore = (id) => {
    const label = snapshots.find((s) => s.id === id)?.label;
    confirmThen(
      `Put your board back to how it was before "${label}"? Anything changed after it is undone too. Vaea saves a checkpoint of the board as it is now first, so you can undo this.`,
      async () => {
        setRestoringId(id);
        try {
          await restoreSnapshot(id);
          setSnapshots(await listSnapshots());
          setJustRestoredId(id);
          setTimeout(() => setJustRestoredId(null), 2000);
        } catch (error) {
          // Used to be a bare try/finally — a thrown restoreSnapshot error
          // became an unhandled promise rejection with the button just
          // silently resetting, no indication the restore didn't happen and
          // no way to tell what state the data was actually left in.
          toast({
            variant: "destructive",
            title: "Checkpoint not restored",
            description: error?.message || "The restore stopped partway. Check your board before relying on it.",
          });
        } finally {
          setRestoringId(null);
        }
      }
    );
  };

  return (
    <SettingsCard>
      <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">Checkpoints</p>
      <p className="text-xs text-muted-foreground mb-4">
        Vaea saves a checkpoint of your whole board before any multi-step change from Vaea Chat, any removal it auto-approves, and any CSV import. Each one is named after the change. Restore one to put the board back to how it was just before that change. Vaea keeps the 8 most recent.
      </p>

      {snapshots.length === 0 ? (
        <p className="text-sm text-muted-foreground">No checkpoints yet. The first one is saved the next time Vaea Chat makes a multi-step change.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {snapshots.map((snap) => (
            <div key={snap.id} className="flex items-center justify-between gap-3 text-sm border border-border rounded-md px-3 py-2">
              <div className="min-w-0">
                <p className="font-medium truncate">{snap.label}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(snap.created_at).toLocaleString()} · board before: {summarizeCounts(snap.counts)}
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
    </SettingsCard>
  );
}

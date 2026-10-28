import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { useArchivedProjects, useRestoreProject, useProject } from "@/hooks/useProjects";
import ProjectDetailModal from "@/components/projects/ProjectDetailModal";
import QueryError from "@/components/shared/QueryError";
import DateField from "@/components/shared/DateField";
import Spinner from "@/components/shared/Spinner";
import { QUADRANTS } from "@/lib/quadrants";

// "Jun 1, 2026" — date-only strings ("2026-06-01") are read as local dates,
// not UTC midnight, so they don't slip back a day west of Greenwich.
function formatDay(value) {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// Archive/history shell: ISO-8601 date range filter hitting the
// archivedProjects function, which reconstructs every project whose active
// window (created_date through archived_at, or now if still active)
// overlaps the given range — so this can surface currently-active projects
// too, not just archived ones, matching "projects that were or are active in
// that date range... even those archived". Returns quadrant counts but omits
// nested task arrays. Restore only applies to the archived rows. Clicking a
// row fetches the full project record on demand and opens the same detail
// modal used on the live dashboard, so these can be viewed and edited
// exactly like a project reached from the main dashboard.
export default function ArchiveView() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const startIso = startDate ? new Date(startDate).toISOString() : undefined;
  const endIso = endDate ? new Date(endDate).toISOString() : undefined;
  const { data, isLoading, isError, error, refetch } = useArchivedProjects(startIso, endIso);
  const restoreProject = useRestoreProject();
  const { data: selectedProject } = useProject(selectedProjectId);
  const archivedProjects = data?.projects || [];

  return (
    <div>
      <h1 className="font-heading text-2xl font-semibold mb-4">Archive</h1>

      <div className="flex items-end gap-4 mb-2">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Start date</label>
          <DateField value={startDate} onSave={(v) => setStartDate(v || "")} className="bg-card rounded" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">End date</label>
          <DateField value={endDate} onSave={(v) => setEndDate(v || "")} className="bg-card rounded" />
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        {startIso || endIso
          ? `Showing every project active ${startDate ? `from ${formatDay(startDate)}` : ""}${startDate && endDate ? " " : ""}${endDate ? `until ${formatDay(endDate)}` : ""}, archived or not.`
          : "Showing archived projects. Pick dates to see everything that was active in that window."}
      </p>

      <div className="space-y-3 mt-4">
        {isLoading ? (
          <div className="flex justify-center py-10"><Spinner className="w-6 h-6" /></div>
        ) : isError ? (
          <QueryError error={error} onRetry={refetch} label="Couldn't load the archive." />
        ) : archivedProjects.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {startIso || endIso
              ? "No projects were active in that window."
              : "Nothing archived yet. Archive a project from its expanded view and it moves here, where you can restore it any time."}
          </p>
        ) : (
          archivedProjects.map((item) => (
            <div
              key={item.id}
              onClick={() => setSelectedProjectId(item.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && setSelectedProjectId(item.id)}
              className="w-full flex items-center justify-between bg-card border border-border rounded-lg p-4 text-left hover:border-primary/40 transition-colors cursor-pointer"
            >
              <div>
                <p className="font-medium text-sm flex items-center gap-2">
                  {item.title}
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${item.is_archived ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}>
                    {item.is_archived ? "Archived" : "Active"}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {(item.quadrant_counts || [])
                    .map((n, i) => `${n} ${QUADRANTS[i]?.name.toLowerCase()}`)
                    .join(" · ")}
                  {item.updated_date ? ` · updated ${formatDay(item.updated_date)}` : ""}
                </p>
              </div>
              {item.is_archived && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    restoreProject.mutate(item.id);
                  }}
                  className="text-sm flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-secondary-foreground border border-border rounded-md hover:opacity-80"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Restore
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {selectedProject && (
        <ProjectDetailModal project={selectedProject} onClose={() => setSelectedProjectId(null)} />
      )}
    </div>
  );
}

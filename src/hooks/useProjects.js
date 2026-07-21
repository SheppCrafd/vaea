import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { localDb } from "@/lib/localDb";
import { excludeSoftDeleted } from "@/lib/entityUtils";

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const projects = await localDb.projects.list();
      return excludeSoftDeleted(projects).filter((p) => !p.is_archived);
    },
    // Local-only data — see the matching comment in useAreas.js.
    staleTime: Infinity,
  });
}

// Fetches a single full Project record by id — used by the Archive view,
// which otherwise only has the lightweight { id, title, quadrant_counts }
// shape from useArchivedProjects and needs the full record to open
// ProjectDetailModal.
export function useProject(id) {
  return useQuery({
    queryKey: ["project", id],
    queryFn: () => localDb.projects.get(id),
    enabled: !!id,
    // Local-only data — see the matching comment in useAreas.js.
    staleTime: Infinity,
  });
}

// "Reveal all projects that were or are active in that date range... even
// those archived" — this is a project-lifetime overlap check, not a simple
// is_archived filter. A project's active window is [created_date, archived_at
// ?? now]; it belongs in the result if that window overlaps [start, end].
// This deliberately includes currently active (non-archived) projects too,
// since "even those archived" implies archived projects are an addition to
// the otherwise-expected active set, not the whole result.
export function useArchivedProjects(start, end) {
  return useQuery({
    queryKey: ["archivedProjects", start, end],
    queryFn: async () => {
      const allProjects = await localDb.projects.list();
      const rangeStart = start ? new Date(start) : null;
      const rangeEnd = end ? new Date(end) : null;
      const filtered = allProjects.filter((p) => {
        if (p.deleted_at) return false;
        // No range picked yet: default to the archive's original purpose
        // (browse archived projects) rather than dumping the whole live
        // dashboard into this view.
        if (!rangeStart && !rangeEnd) return !!p.is_archived;
        const activeFrom = p.created_date ? new Date(p.created_date) : null;
        const activeUntil = p.is_archived && p.archived_at ? new Date(p.archived_at) : null; // null = still active
        if (rangeEnd && activeFrom && activeFrom > rangeEnd) return false; // didn't exist yet by end of range
        if (rangeStart && activeUntil && activeUntil < rangeStart) return false; // was archived before range started
        return true;
      });

      const withQuadrants = await Promise.all(
        filtered.map(async (p) => {
          const tasks = await localDb.tasks.filter({ project_id: p.id });
          const activeTasks = tasks.filter((t) => !t.deleted_at);
          const quadrantCounts = [1, 2, 3, 4].map((q) => activeTasks.filter((t) => (t.quadrant || 4) === q).length);
          return {
            id: p.id,
            title: p.title,
            objective: p.objective,
            due_date: p.due_date,
            parent_product_id: p.parent_product_id,
            parent_area_id: p.parent_area_id,
            updated_date: p.updated_date,
            is_archived: !!p.is_archived,
            archived_at: p.archived_at || null,
            quadrant_counts: quadrantCounts,
          };
        })
      );

      return { projects: withQuadrants };
    },
    // Local-only data — see the matching comment in useAreas.js.
    staleTime: Infinity,
  });
}

export function useMoveProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, parent_product_id }) => localDb.projects.update(id, { parent_product_id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => localDb.projects.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => localDb.projects.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });
}

// Cascading archive: tags the project is_archived, and cascades archived_at
// to every child task.
export function useArchiveProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const now = new Date().toISOString();
      const project = await localDb.projects.update(id, { is_archived: true, archived_at: now });
      const tasks = await localDb.tasks.filter({ project_id: id });
      await localDb.tasks.updateMany(tasks.map((t) => t.id), { archived_at: now });
      return project;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["archivedProjects"] });
      queryClient.invalidateQueries({ queryKey: ["allTasks"] });
    },
  });
}

// Soft delete: tags the project deleted_at, and cascades deleted_at to every
// child task.
export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const now = new Date().toISOString();
      const project = await localDb.projects.update(id, { deleted_at: now });
      const tasks = await localDb.tasks.filter({ project_id: id });
      await localDb.tasks.updateMany(tasks.filter((t) => !t.deleted_at).map((t) => t.id), { deleted_at: now });
      return project;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["archivedProjects"] });
      queryClient.invalidateQueries({ queryKey: ["allTasks"] });
    },
  });
}

// Restores a project and un-cascades archived_at from its tasks.
export function useRestoreProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const project = await localDb.projects.update(id, { is_archived: false, archived_at: null });
      const tasks = await localDb.tasks.filter({ project_id: id });
      await localDb.tasks.updateMany(tasks.filter((t) => t.archived_at).map((t) => t.id), { archived_at: null });
      return project;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["archivedProjects"] });
      queryClient.invalidateQueries({ queryKey: ["allTasks"] });
    },
  });
}

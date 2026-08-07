import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { localDb } from "@/lib/localDb";
import { excludeSoftDeleted, requireLiveParent, allowOptionalLiveParent, assertLiveParent } from "@/lib/entityUtils";

// A plain exported function, not just inlined in useProjects's queryFn below
// — same reason createProject/deleteProject/etc. already are: directly
// testable without needing to render the hook.
export async function fetchActiveProjects() {
  const [projects, areas, products] = await Promise.all([
    localDb.projects.list(),
    localDb.areas.list(),
    localDb.products.list(),
  ]);
  const liveAreaIds = new Set(excludeSoftDeleted(areas).map((a) => a.id));
  const liveProductIds = new Set(excludeSoftDeleted(products).map((p) => p.id));
  const active = excludeSoftDeleted(projects).filter((p) => !p.is_archived);
  // See entityUtils.js's requireLiveParent/allowOptionalLiveParent — a
  // project whose area (required) or product (optional, "standalone"
  // projects have none) was deleted out from under it no longer silently
  // renders as if it still belongs somewhere real.
  const withLiveArea = requireLiveParent(active, "parent_area_id", liveAreaIds);
  return allowOptionalLiveParent(withLiveArea, "parent_product_id", liveProductIds);
}

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: fetchActiveProjects,
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

// Same parent-existence guard the AI chat path already had (chatActions.js's
// MOVE_PROJECT/CREATE_PROJECT/UPDATE_PROJECT cases) — the plain UI mutation
// functions below used to go straight to localDb with none, so a stale/
// deleted parent id could silently orphan a project (and, transitively, its
// tasks). Only checked when the relevant field is actually present/changing;
// most edits don't touch a parent at all.
export async function moveProject({ id, parent_product_id }) {
  if (parent_product_id) await assertLiveParent(localDb.products, parent_product_id, "Product");
  return localDb.projects.update(id, { parent_product_id });
}

export async function updateProject({ id, data }) {
  if (data.parent_area_id) await assertLiveParent(localDb.areas, data.parent_area_id, "Area");
  if (data.parent_product_id) await assertLiveParent(localDb.products, data.parent_product_id, "Product");
  return localDb.projects.update(id, data);
}

export async function createProject(data) {
  await assertLiveParent(localDb.areas, data.parent_area_id, "Area");
  if (data.parent_product_id) await assertLiveParent(localDb.products, data.parent_product_id, "Product");
  return localDb.projects.create(data);
}

// Cascading archive: tags the project is_archived, and cascades archived_at
// to every child task. Exported as a plain function so the chat assistant's
// action executor shares this exact cascade logic with the UI.
//
// Tasks cascade FIRST, the project itself LAST — see useAreas.js's
// deleteArea for why: there's no real cross-collection transaction here, so
// if a write is interrupted partway through, this order means the project
// only disappears from the active list once its tasks are already
// consistent, instead of the project vanishing while its tasks still read
// as active with no visible parent.
export async function archiveProject(id) {
  const now = new Date().toISOString();
  const tasks = await localDb.tasks.filter({ project_id: id });
  await localDb.tasks.updateMany(tasks.map((t) => t.id), { archived_at: now });
  const project = await localDb.projects.update(id, { is_archived: true, archived_at: now });
  return project;
}

// Soft delete: tags the project deleted_at, and cascades deleted_at to every
// child task. Same deepest-first ordering as archiveProject above.
export async function deleteProject(id) {
  const now = new Date().toISOString();
  const tasks = await localDb.tasks.filter({ project_id: id });
  await localDb.tasks.updateMany(tasks.filter((t) => !t.deleted_at).map((t) => t.id), { deleted_at: now });
  const project = await localDb.projects.update(id, { deleted_at: now });
  return project;
}

// Restores a project and un-cascades archived_at from its tasks. Same
// deepest-first ordering: tasks un-archive first, so the project never
// reappears in the active list before its own tasks are already visible too.
export async function restoreProject(id) {
  const tasks = await localDb.tasks.filter({ project_id: id });
  await localDb.tasks.updateMany(tasks.filter((t) => t.archived_at).map((t) => t.id), { archived_at: null });
  const project = await localDb.projects.update(id, { is_archived: false, archived_at: null });
  return project;
}

export function useMoveProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: moveProject,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateProject,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createProject,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useArchiveProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: archiveProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["archivedProjects"] });
      queryClient.invalidateQueries({ queryKey: ["allTasks"] });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["archivedProjects"] });
      queryClient.invalidateQueries({ queryKey: ["allTasks"] });
    },
  });
}

export function useRestoreProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: restoreProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["archivedProjects"] });
      queryClient.invalidateQueries({ queryKey: ["allTasks"] });
    },
  });
}

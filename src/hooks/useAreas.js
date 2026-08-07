import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { localDb } from "@/lib/localDb";
import { excludeSoftDeleted } from "@/lib/entityUtils";

export function useAreas() {
  return useQuery({
    queryKey: ["areas"],
    queryFn: async () => {
      const areas = await localDb.areas.list();
      return excludeSoftDeleted(areas);
    },
    // Local-only data: the only writers are this app's own mutation hooks
    // and the chat assistant (both call the same plain functions below and
    // invalidateQueries(["areas"]) on success). Nothing else can change this
    // data out from under us, so there's nothing to gain from React Query
    // re-running the query on every mount/refocus — that would just be a
    // wasted extra localDb read.
    staleTime: Infinity,
  });
}

export const createArea = (data) => localDb.areas.create(data);

export const updateArea = ({ id, data }) => localDb.areas.update(id, data);

// Soft delete: tags the area deleted_at, and cascades deleted_at to every
// child Product, every Project under this area, and every Task under those
// projects. Exported as a plain function (not just wrapped in the hook
// below) so the chat assistant's action executor can call the exact same
// cascade logic the UI does — one implementation, not a second copy that
// could drift.
//
// Order matters here: there's no real cross-collection transaction in this
// storage layer (each `updateMany` below is its own separately-awaited
// write), so if anything interrupts the cascade partway through (a device
// storage write error, permission revoked mid-session, the tab closing),
// whatever hasn't been written yet is simply never written. Deepest-first
// (tasks, then projects, then products, then the area itself LAST) means an
// interruption leaves the area still visible with some already-cleaned-up
// children — an honest "this didn't finish" the user can retry — instead of
// the area vanishing while its tasks silently stay "active" forever with no
// visible parent (the exact bug this ordering fixes: a real user's task
// stats kept counting tasks under an area that had already disappeared from
// the dashboard). See taskUtils.js/useProjects.js/useProducts.js for the
// matching defense-in-depth fix: even an orphan created some other way (a
// stale-parent write, a future bug) no longer counts as "active" anywhere.
export async function deleteArea(id) {
  const now = new Date().toISOString();

  const products = await localDb.products.filter({ parent_area_id: id });
  const projects = await localDb.projects.filter({ parent_area_id: id });
  const tasksByProject = await Promise.all(projects.map((p) => localDb.tasks.filter({ project_id: p.id })));

  await localDb.tasks.updateMany(
    tasksByProject.flat().filter((t) => !t.deleted_at).map((t) => t.id),
    { deleted_at: now }
  );
  await localDb.projects.updateMany(
    projects.filter((p) => !p.deleted_at).map((p) => p.id),
    { deleted_at: now }
  );
  await localDb.products.updateMany(
    products.filter((p) => !p.deleted_at).map((p) => p.id),
    { deleted_at: now }
  );
  const area = await localDb.areas.update(id, { deleted_at: now });

  return area;
}

export function useUpdateArea() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateArea,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["areas"] }),
  });
}

export function useCreateArea() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createArea,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["areas"] }),
  });
}

export function useDeleteArea() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteArea,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["areas"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["allTasks"] });
    },
  });
}

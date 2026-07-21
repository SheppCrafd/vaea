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
    // Local-only data: the only writer is this app's own mutation hooks,
    // which always invalidateQueries(["areas"]) on success. Nothing else can
    // change this data out from under us, so there's nothing to gain from
    // React Query re-running the query on every mount/refocus — that would
    // just be a wasted extra localDb read.
    staleTime: Infinity,
  });
}

export function useUpdateArea() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => localDb.areas.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["areas"] }),
  });
}

export function useCreateArea() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => localDb.areas.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["areas"] }),
  });
}

// Soft delete: tags the area deleted_at, and cascades deleted_at to every
// child Product, every Project under this area, and every Task under those
// projects.
export function useDeleteArea() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const now = new Date().toISOString();
      const area = await localDb.areas.update(id, { deleted_at: now });

      const products = await localDb.products.filter({ parent_area_id: id });
      await localDb.products.updateMany(
        products.filter((p) => !p.deleted_at).map((p) => p.id),
        { deleted_at: now }
      );

      const projects = await localDb.projects.filter({ parent_area_id: id });
      await localDb.projects.updateMany(
        projects.filter((p) => !p.deleted_at).map((p) => p.id),
        { deleted_at: now }
      );

      const tasksByProject = await Promise.all(projects.map((p) => localDb.tasks.filter({ project_id: p.id })));
      await localDb.tasks.updateMany(
        tasksByProject.flat().filter((t) => !t.deleted_at).map((t) => t.id),
        { deleted_at: now }
      );

      return area;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["areas"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["allTasks"] });
    },
  });
}

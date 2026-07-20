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
      await Promise.all(
        products.filter((p) => !p.deleted_at).map((p) => localDb.products.update(p.id, { deleted_at: now }))
      );

      const projects = await localDb.projects.filter({ parent_area_id: id });
      await Promise.all(
        projects.filter((p) => !p.deleted_at).map((p) => localDb.projects.update(p.id, { deleted_at: now }))
      );

      const tasksByProject = await Promise.all(projects.map((p) => localDb.tasks.filter({ project_id: p.id })));
      await Promise.all(
        tasksByProject.flat().filter((t) => !t.deleted_at).map((t) => localDb.tasks.update(t.id, { deleted_at: now }))
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

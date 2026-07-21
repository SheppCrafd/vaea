import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { localDb } from "@/lib/localDb";
import { excludeSoftDeleted } from "@/lib/entityUtils";

export function useProducts() {
  return useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const products = await localDb.products.list();
      return excludeSoftDeleted(products);
    },
    // Local-only data — see the matching comment in useAreas.js.
    staleTime: Infinity,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => localDb.products.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => localDb.products.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
  });
}

// Soft delete: tags the product deleted_at, and cascades deleted_at to every
// child Project (and every Task under those projects).
export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const now = new Date().toISOString();
      const product = await localDb.products.update(id, { deleted_at: now });

      const projects = await localDb.projects.filter({ parent_product_id: id });
      await localDb.projects.updateMany(
        projects.filter((p) => !p.deleted_at).map((p) => p.id),
        { deleted_at: now }
      );

      const tasksByProject = await Promise.all(projects.map((p) => localDb.tasks.filter({ project_id: p.id })));
      await localDb.tasks.updateMany(
        tasksByProject.flat().filter((t) => !t.deleted_at).map((t) => t.id),
        { deleted_at: now }
      );

      return product;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["allTasks"] });
    },
  });
}

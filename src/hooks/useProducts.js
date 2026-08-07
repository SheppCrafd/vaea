import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { localDb } from "@/lib/localDb";
import { excludeSoftDeleted, requireLiveParent, assertLiveParent } from "@/lib/entityUtils";

// A plain exported function, not just inlined in useProducts's queryFn below
// — same reason createProduct/deleteProduct/etc. already are: directly
// testable without needing to render the hook.
export async function fetchActiveProducts() {
  const [products, areas] = await Promise.all([localDb.products.list(), localDb.areas.list()]);
  const liveAreaIds = new Set(excludeSoftDeleted(areas).map((a) => a.id));
  // requireLiveParent: see entityUtils.js — a product whose area was
  // deleted out from under it (a cascade interrupted mid-write, a stale
  // write elsewhere) no longer silently renders as if it still belongs
  // somewhere real.
  return requireLiveParent(excludeSoftDeleted(products), "parent_area_id", liveAreaIds);
}

export function useProducts() {
  return useQuery({
    queryKey: ["products"],
    queryFn: fetchActiveProducts,
    // Local-only data — see the matching comment in useAreas.js.
    staleTime: Infinity,
  });
}

// Validates parent_area_id before creating — the AI chat path already had
// this guard (chatActions.js's own CREATE_PRODUCT case); the regular
// "Create New" form went straight to localDb with no check at all, so a
// stale/deleted area id (a form left open while the area gets deleted
// elsewhere) used to silently create a permanently orphaned product.
export async function createProduct(data) {
  await assertLiveParent(localDb.areas, data.parent_area_id, "Area");
  return localDb.products.create(data);
}

// Same guard, only when the update actually touches parent_area_id — most
// updates (title/description edits) don't, and shouldn't pay for an extra
// lookup they don't need.
export async function updateProduct({ id, data }) {
  if (data.parent_area_id) await assertLiveParent(localDb.areas, data.parent_area_id, "Area");
  return localDb.products.update(id, data);
}

// Soft delete: tags the product deleted_at, and cascades deleted_at to every
// child Project (and every Task under those projects). Exported as a plain
// function so the chat assistant's action executor shares this exact cascade
// logic with the UI's own mutation hook below.
//
// Deepest-first order (tasks, then projects, then the product itself LAST)
// — see useAreas.js's deleteArea for why: an interruption partway through
// leaves the product still visible with some already-cleaned-up children,
// rather than the product vanishing while its tasks stay "active" with no
// visible parent.
export async function deleteProduct(id) {
  const now = new Date().toISOString();

  const projects = await localDb.projects.filter({ parent_product_id: id });
  const tasksByProject = await Promise.all(projects.map((p) => localDb.tasks.filter({ project_id: p.id })));

  await localDb.tasks.updateMany(
    tasksByProject.flat().filter((t) => !t.deleted_at).map((t) => t.id),
    { deleted_at: now }
  );
  await localDb.projects.updateMany(
    projects.filter((p) => !p.deleted_at).map((p) => p.id),
    { deleted_at: now }
  );
  const product = await localDb.products.update(id, { deleted_at: now });

  return product;
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createProduct,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateProduct,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["allTasks"] });
    },
  });
}

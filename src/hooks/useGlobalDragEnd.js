import { useQueryClient } from "@tanstack/react-query";
import { localDb } from "@/lib/localDb";
import { useAreas } from "@/hooks/useAreas";
import { useProjects, useUpdateProject } from "@/hooks/useProjects";
import { useProducts, useUpdateProduct } from "@/hooks/useProducts";
import { useAllTasks, useUpdateTask } from "@/hooks/useTasks";
import { useUpdateStakeholder } from "@/hooks/useStakeholders";
import { sortByPosition, reorderPositions } from "@/lib/entityUtils";

function withStakeholder(currentIds, stakeholderId) {
  const ids = currentIds || [];
  return ids.includes(stakeholderId) ? ids : [...ids, stakeholderId];
}

// Single onDragEnd for the whole app (lives in one DndContext at the
// AppShell root, since the stakeholder drag source in the left sidebar and
// its drop targets in the main dashboard need a shared ancestor). Dispatches
// on active/over `data.type` rather than raw ids, so draggable/droppable
// elements just need to tag themselves with { type, id, ... } and never
// have to know about each other.
export function useGlobalDragEnd() {
  const queryClient = useQueryClient();
  const { data: areas = [] } = useAreas();
  const { data: projects = [] } = useProjects();
  const { data: products = [] } = useProducts();
  const { data: tasks = [] } = useAllTasks();
  const updateProject = useUpdateProject();
  const updateProduct = useUpdateProduct();
  const updateTask = useUpdateTask();
  const updateStakeholder = useUpdateStakeholder();

  return (event) => {
    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current || {};
    const overData = over.data.current || {};

    if (activeData.type === "stakeholder") {
      const stakeholderId = activeData.stakeholderId;

      if (overData.type === "project") {
        const project = projects.find((p) => p.id === overData.id);
        if (!project) return;
        updateProject.mutate({ id: project.id, data: { stakeholder_ids: withStakeholder(project.stakeholder_ids, stakeholderId) } });
      } else if (overData.type === "product") {
        const product = products.find((p) => p.id === overData.id);
        if (!product) return;
        updateProduct.mutate({ id: product.id, data: { stakeholder_ids: withStakeholder(product.stakeholder_ids, stakeholderId) } });
      } else if (overData.type === "task") {
        const task = tasks.find((t) => t.id === overData.id);
        if (!task) return;
        updateTask.mutate({
          id: task.id,
          data: { stakeholder_ids: withStakeholder(task.stakeholder_ids, stakeholderId), project_id: task.project_id },
        });
      } else if (overData.type === "department") {
        updateStakeholder.mutate({ id: stakeholderId, data: { department: overData.name || "" } });
      }
      return;
    }

    if (activeData.type === "project") {
      const project = projects.find((p) => p.id === activeData.id);
      if (!project) return;

      // Dropped on a sibling project: reorder within that project's parent
      // (product, or area-direct), taking the target's spot — the same
      // "drop onto X to take X's place" mechanic Products already have one
      // level up. Coming from a different parent, the same computation
      // moves it there landing at that spot instead of tacked on the end.
      if (overData.type === "project" && overData.id !== project.id) {
        const target = projects.find((p) => p.id === overData.id);
        if (!target) return;
        const targetProductId = target.parent_product_id ?? null;
        const targetAreaId = target.parent_area_id ?? null;
        const siblingIds = sortByPosition(
          projects.filter(
            (p) =>
              (p.parent_product_id ?? null) === targetProductId &&
              (p.parent_area_id ?? null) === targetAreaId &&
              p.id !== project.id
          )
        ).map((p) => p.id);
        const positions = reorderPositions([...siblingIds, project.id], project.id, target.id);
        localDb.projects
          .updateMany(Object.keys(positions), (item) => (
            item.id === project.id
              ? { position: positions[item.id], parent_product_id: targetProductId, parent_area_id: targetAreaId }
              : { position: positions[item.id] }
          ))
          .then(() => queryClient.invalidateQueries({ queryKey: ["projects"] }));
        return;
      }

      if (overData.type === "product") {
        const targetProduct = products.find((p) => p.id === overData.id);
        if (!targetProduct) return;
        if (project.parent_product_id !== targetProduct.id) {
          updateProject.mutate({
            id: project.id,
            data: { parent_product_id: targetProduct.id, parent_area_id: targetProduct.parent_area_id },
          });
        }
      } else if (overData.type === "area") {
        if (project.parent_product_id !== null || project.parent_area_id !== overData.id) {
          updateProject.mutate({
            id: project.id,
            data: { parent_product_id: null, parent_area_id: overData.id },
          });
        }
      }
      return;
    }

    // Areas have no parent to move between — the only thing "drag to
    // rearrange" can mean for one is reordering the whole list. Reuses
    // AreaCard's existing "area" droppable (already there for a Project
    // dropped in to become a direct child) rather than adding a second one;
    // useGlobalDragEnd only ever branches on the ACTIVE drag's type, so the
    // same drop target already works for both.
    if (activeData.type === "area") {
      if (overData.type !== "area" || overData.id === activeData.id) return;
      const orderedIds = sortByPosition(areas).map((a) => a.id);
      const positions = reorderPositions(orderedIds, activeData.id, overData.id);
      const changedIds = Object.keys(positions).filter((id) => {
        const area = areas.find((a) => a.id === id);
        return area && (area.position ?? null) !== positions[id];
      });
      if (changedIds.length) {
        localDb.areas
          .updateMany(changedIds, (item) => ({ position: positions[item.id] }))
          .then(() => queryClient.invalidateQueries({ queryKey: ["areas"] }));
      }
      return;
    }

    // A Product dropped on another Product reorders within that product's
    // own area (or moves there first, if it came from a different one,
    // landing right where it was dropped rather than just tacked onto the
    // end) — one computation covers both, since "already in that area" is
    // just the case where parent_area_id doesn't actually change. Dropped
    // directly on an Area instead (not on one of its Products), it moves
    // there appended at the end, same as a Project dropped on an Area does.
    if (activeData.type === "product") {
      const product = products.find((p) => p.id === activeData.id);
      if (!product) return;

      if (overData.type === "product" && overData.id !== product.id) {
        const targetProduct = products.find((p) => p.id === overData.id);
        if (!targetProduct) return;
        const targetAreaId = targetProduct.parent_area_id;
        const siblingIds = sortByPosition(products.filter((p) => p.parent_area_id === targetAreaId && p.id !== product.id)).map((p) => p.id);
        const positions = reorderPositions([...siblingIds, product.id], product.id, targetProduct.id);
        localDb.products
          .updateMany(Object.keys(positions), (item) => (
            item.id === product.id
              ? { position: positions[item.id], parent_area_id: targetAreaId }
              : { position: positions[item.id] }
          ))
          .then(() => queryClient.invalidateQueries({ queryKey: ["products"] }));
      } else if (overData.type === "area" && overData.id !== product.parent_area_id) {
        const siblings = sortByPosition(products.filter((p) => p.parent_area_id === overData.id));
        const nextPosition = siblings.length ? Math.max(...siblings.map((p, i) => p.position ?? i)) + 1 : 0;
        updateProduct.mutate({ id: product.id, data: { parent_area_id: overData.id, position: nextPosition } });
      }
    }
  };
}

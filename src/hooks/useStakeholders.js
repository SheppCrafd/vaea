import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { localDb } from "@/lib/localDb";
import { excludeSoftDeleted } from "@/lib/entityUtils";

export function useStakeholders() {
  return useQuery({
    queryKey: ["stakeholders"],
    queryFn: async () => {
      const stakeholders = await localDb.stakeholders.list();
      return excludeSoftDeleted(stakeholders);
    },
    // Local-only data — see the matching comment in useAreas.js.
    staleTime: Infinity,
  });
}

export const createStakeholder = (data) => localDb.stakeholders.create(data);

export const updateStakeholder = ({ id, data }) => localDb.stakeholders.update(id, data);

// Cascades to every Product/Project/Task/Note that had this stakeholder
// assigned, scrubbing the id out of their stakeholder_ids array — mirrors
// deleteDepartment's own cascade (useDepartments.js), which clears a
// deleted department off every Stakeholder that had it. Without this, a
// deleted stakeholder's id lingered forever in stakeholder_ids arrays
// elsewhere: dead references any UI resolving ids to a real stakeholder
// (assignment pickers, highlight filters) would either silently drop or
// choke on.
export async function deleteStakeholder(id) {
  const now = new Date().toISOString();
  const stakeholder = await localDb.stakeholders.update(id, { deleted_at: now });

  const removeStakeholder = (item) => ({ stakeholder_ids: (item.stakeholder_ids || []).filter((sid) => sid !== id) });
  const scrubCollection = async (collection) => {
    const items = await collection.list();
    const affected = items.filter((item) => (item.stakeholder_ids || []).includes(id));
    if (affected.length) await collection.updateMany(affected.map((item) => item.id), removeStakeholder);
  };
  await Promise.all([
    scrubCollection(localDb.products),
    scrubCollection(localDb.projects),
    scrubCollection(localDb.tasks),
    scrubCollection(localDb.projectNotes),
  ]);

  return stakeholder;
}

export function useCreateStakeholder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createStakeholder,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["stakeholders"] }),
  });
}

export function useUpdateStakeholder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateStakeholder,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["stakeholders"] }),
  });
}

export function useDeleteStakeholder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteStakeholder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stakeholders"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["allTasks"] });
    },
  });
}

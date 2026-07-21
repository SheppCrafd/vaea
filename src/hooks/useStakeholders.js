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

export function useCreateStakeholder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => localDb.stakeholders.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["stakeholders"] }),
  });
}

export function useUpdateStakeholder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => localDb.stakeholders.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["stakeholders"] }),
  });
}

export function useDeleteStakeholder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => localDb.stakeholders.update(id, { deleted_at: new Date().toISOString() }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["stakeholders"] }),
  });
}

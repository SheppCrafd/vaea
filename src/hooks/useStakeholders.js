import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export function useStakeholders() {
  return useQuery({
    queryKey: ["stakeholders"],
    queryFn: async () => {
      const stakeholders = await base44.entities.Stakeholder.list();
      return stakeholders.filter((s) => !s.deleted_at);
    },
  });
}

export function useCreateStakeholder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => base44.entities.Stakeholder.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["stakeholders"] }),
  });
}

export function useDeleteStakeholder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => base44.entities.Stakeholder.update(id, { deleted_at: new Date().toISOString() }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["stakeholders"] }),
  });
}
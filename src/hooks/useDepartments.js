import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { excludeSoftDeleted } from "@/lib/entityUtils";

export function useDepartments() {
  return useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const departments = await base44.entities.Department.list();
      return excludeSoftDeleted(departments).sort((a, b) => a.name.localeCompare(b.name));
    },
  });
}

export function useCreateDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => base44.entities.Department.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["departments"] }),
  });
}

// Cascades the rename to every Stakeholder currently assigned to this department.
export function useRenameDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }) => base44.functions.invoke("renameDepartment", { departmentId: id, newName: name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      queryClient.invalidateQueries({ queryKey: ["stakeholders"] });
    },
  });
}

// Cascades to every Stakeholder currently assigned to this department,
// clearing their department field (they become "Unassigned").
export function useDeleteDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => base44.functions.invoke("deleteDepartment", { departmentId: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      queryClient.invalidateQueries({ queryKey: ["stakeholders"] });
    },
  });
}

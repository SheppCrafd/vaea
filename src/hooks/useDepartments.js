import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { localDb } from "@/lib/localDb";
import { excludeSoftDeleted } from "@/lib/entityUtils";

export function useDepartments() {
  return useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const departments = await localDb.departments.list();
      return excludeSoftDeleted(departments).sort((a, b) => a.name.localeCompare(b.name));
    },
    // Local-only data — see the matching comment in useAreas.js.
    staleTime: Infinity,
  });
}

export function useCreateDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => localDb.departments.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["departments"] }),
  });
}

// Cascades the rename to every Stakeholder currently assigned to this
// department. Stakeholder.department is a plain string, not a foreign key,
// so the cascade is a string-match update across matching records.
export function useRenameDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }) => {
      const department = await localDb.departments.get(id);
      if (!department) throw new Error("Department not found");
      const oldName = department.name;
      const updated = await localDb.departments.update(id, { name });
      if (oldName !== name) {
        const stakeholders = await localDb.stakeholders.filter({ department: oldName });
        await localDb.stakeholders.updateMany(
          stakeholders.filter((s) => !s.deleted_at).map((s) => s.id),
          { department: name }
        );
      }
      return updated;
    },
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
    mutationFn: async (id) => {
      const department = await localDb.departments.get(id);
      if (!department) throw new Error("Department not found");
      const now = new Date().toISOString();
      const updated = await localDb.departments.update(id, { deleted_at: now });
      const stakeholders = await localDb.stakeholders.filter({ department: department.name });
      await localDb.stakeholders.updateMany(
        stakeholders.filter((s) => !s.deleted_at).map((s) => s.id),
        { department: "" }
      );
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      queryClient.invalidateQueries({ queryKey: ["stakeholders"] });
    },
  });
}

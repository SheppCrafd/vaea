import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { localDb } from "@/lib/localDb";

export function useProjectNotes(projectId) {
  return useQuery({
    queryKey: ["projectNotes", projectId],
    queryFn: () => localDb.projectNotes.filter({ project_id: projectId }),
    enabled: !!projectId,
    // Local-only data — see the matching comment in useAreas.js.
    staleTime: Infinity,
  });
}

export function useAllProjectNotes() {
  return useQuery({
    queryKey: ["allProjectNotes"],
    queryFn: () => localDb.projectNotes.list(),
    // Local-only data — see the matching comment in useAreas.js.
    staleTime: Infinity,
  });
}

export function useCreateProjectNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => localDb.projectNotes.create(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["projectNotes", variables.project_id] });
      queryClient.invalidateQueries({ queryKey: ["allProjectNotes"] });
    },
  });
}

export function useUpdateProjectNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => localDb.projectNotes.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projectNotes"] });
      queryClient.invalidateQueries({ queryKey: ["allProjectNotes"] });
    },
  });
}

export function useDeleteProjectNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => localDb.projectNotes.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projectNotes"] });
      queryClient.invalidateQueries({ queryKey: ["allProjectNotes"] });
    },
  });
}

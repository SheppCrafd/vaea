import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { filterActiveTasks, isTaskArchived, isTaskDeleted } from "@/lib/taskUtils";

// 1. FETCH TASKS FOR A SPECIFIC PROJECT (WITH LIVE SUBSCRIPTION POLLING)
export function useTasks(projectId) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["tasks", projectId],
    queryFn: async () => {
      const tasks = await base44.entities.Task.filter({ project_id: projectId });
      return filterActiveTasks(tasks);
    },
    enabled: !!projectId,
  });

  // Live "matrix polling": any Task change refreshes this project's quadrant counts instantly.
  useEffect(() => {
    if (!projectId) return;
    const unsubscribe = base44.entities.Task.subscribe((event) => {
      if (event.data?.project_id === projectId) {
        queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
      }
    });
    return unsubscribe;
  }, [projectId, queryClient]);

  return query;
}

// FETCH A PROJECT'S ARCHIVED (NOT DELETED) TASKS — for viewing archived tasks
// from the project detail view.
export function useArchivedTasks(projectId) {
  return useQuery({
    queryKey: ["archivedTasks", projectId],
    queryFn: async () => {
      const tasks = await base44.entities.Task.filter({ project_id: projectId });
      return tasks.filter((t) => isTaskArchived(t) && !isTaskDeleted(t));
    },
    enabled: !!projectId,
  });
}

// 2. FETCH ALL ACTIVE TASKS GLOBALLY (USED BY AGENT CONTEXT & METRICS)
export function useAllTasks() {
  return useQuery({
    queryKey: ["allTasks"],
    queryFn: async () => {
      const tasks = await base44.entities.Task.list();
      return filterActiveTasks(tasks);
    },
  });
}

// 3. CREATE TASK (SUPPORTS ANY CUSTOM PAYLOADS LIKE STAKEHOLDER_ID)
export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => base44.entities.Task.create(data),
    onSuccess: (_, variables) => {
      // Invalidate both general task lists and the active project's tasks
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      if (variables?.project_id) {
        queryClient.invalidateQueries({ queryKey: ["tasks", variables.project_id] });
      }
      queryClient.invalidateQueries({ queryKey: ["allTasks"] });
    },
  });
}

// 4. UPDATE TASK (GENERIC DATA MUTATION - PERFECT FOR ASSIGNING STAKEHOLDERS)
export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => base44.entities.Task.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["archivedTasks"] });
      if (variables?.data?.project_id) {
        queryClient.invalidateQueries({ queryKey: ["tasks", variables.data.project_id] });
      }
      queryClient.invalidateQueries({ queryKey: ["allTasks"] });
    },
  });
}

// 6. DELETE TASK (SOFT DELETE VIA DELETED_AT TIMESTAMP)
export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => base44.entities.Task.update(id, { deleted_at: new Date().toISOString() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["allTasks"] });
    },
  });
}

// 7. TOGGLE TASK PRIORITY IN TOP THREE FOCUS LIST
export function useToggleTopThree() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }) => base44.functions.invoke("toggleTopThree", { taskId: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["allTasks"] });
    },
  });
}
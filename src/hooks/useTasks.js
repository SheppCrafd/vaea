import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { localDb } from "@/lib/localDb";
import { filterActiveTasks, isTaskArchived, isTaskDeleted } from "@/lib/taskUtils";

// 1. FETCH TASKS FOR A SPECIFIC PROJECT (WITH LIVE SUBSCRIPTION POLLING)
export function useTasks(projectId) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["tasks", projectId],
    queryFn: async () => {
      const tasks = await localDb.tasks.filter({ project_id: projectId });
      return filterActiveTasks(tasks);
    },
    enabled: !!projectId,
    // Local-only data — see the matching comment in useAreas.js. The
    // subscribe()-driven invalidation right below still forces a refetch the
    // instant any task changes, regardless of staleTime.
    staleTime: Infinity,
  });

  // Live "matrix polling": any Task change refreshes this project's quadrant counts instantly.
  useEffect(() => {
    if (!projectId) return;
    const unsubscribe = localDb.tasks.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
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
      const tasks = await localDb.tasks.filter({ project_id: projectId });
      return tasks.filter((t) => isTaskArchived(t) && !isTaskDeleted(t));
    },
    enabled: !!projectId,
    // Local-only data — see the matching comment in useAreas.js.
    staleTime: Infinity,
  });
}

// 2. FETCH ALL ACTIVE TASKS GLOBALLY (USED BY AGENT CONTEXT & METRICS)
export function useAllTasks() {
  return useQuery({
    queryKey: ["allTasks"],
    queryFn: async () => {
      const tasks = await localDb.tasks.list();
      return filterActiveTasks(tasks);
    },
    // Local-only data — see the matching comment in useAreas.js.
    staleTime: Infinity,
  });
}

// 3. CREATE TASK (SUPPORTS ANY CUSTOM PAYLOADS LIKE STAKEHOLDER_ID)
export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => localDb.tasks.create(data),
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
    mutationFn: ({ id, data }) => localDb.tasks.update(id, data),
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
    mutationFn: (id) => localDb.tasks.update(id, { deleted_at: new Date().toISOString() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["allTasks"] });
    },
  });
}

// 7. TOGGLE TASK PRIORITY IN TOP THREE FOCUS LIST — max 3 per project.
export function useToggleTopThree() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }) => {
      const task = await localDb.tasks.get(id);
      if (!task) throw new Error("Task not found");
      const nextValue = !task.is_today_top_three;
      if (nextValue) {
        const projectTasks = await localDb.tasks.filter({ project_id: task.project_id, is_today_top_three: true });
        const otherTopThree = projectTasks.filter((t) => t.id !== id);
        if (otherTopThree.length >= 3) {
          throw new Error('Only 3 "Top 3" tasks are allowed per project');
        }
      }
      return localDb.tasks.update(id, { is_today_top_three: nextValue });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["allTasks"] });
    },
  });
}

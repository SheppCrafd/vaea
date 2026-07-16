import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

// Chat sessions are never soft-deleted in this MVP — every session a user
// starts stays in their history, browsable via the "<" caret.
export function useChatSessions() {
  return useQuery({
    queryKey: ["chatSessions"],
    queryFn: async () => {
      const sessions = await base44.entities.ChatSession.list();
      return [...sessions].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    },
  });
}

export function useCreateChatSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => base44.entities.ChatSession.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["chatSessions"] }),
  });
}

export function useUpdateChatSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => base44.entities.ChatSession.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["chatSessions"] }),
  });
}

export function useDeleteChatSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const messages = await base44.entities.ChatMessage.filter({ session_id: id });
      await Promise.all(messages.map((m) => base44.entities.ChatMessage.delete(m.id)));
      return base44.entities.ChatSession.delete(id);
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["chatSessions"] });
      queryClient.invalidateQueries({ queryKey: ["chatMessages", id] });
    },
  });
}

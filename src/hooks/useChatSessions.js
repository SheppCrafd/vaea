import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { localDb } from "@/lib/localDb";
import { loadAiProviderConfig, isLocalBridgeConfigured } from "@/lib/aiProviderConfig";

// Local Mode's whole pitch is "nothing leaves this device" — hosting its
// own chat history on Base44's hosted ChatSession/ChatMessage (which need a
// real signed-in account, RLS-gated) would both contradict that and force a
// sign-in Local Mode otherwise has no reason to need. Every other
// provider keeps using the Base44-hosted entities as before. Re-checked on
// every call rather than cached — a mid-session provider switch is rare
// enough that trading a little inconsistency for simplicity is fine, but the
// alternative (silently stale) would be worse.
async function chatBackend() {
  const config = await loadAiProviderConfig();
  return isLocalBridgeConfigured(config) ? localDb.chatSessions : base44.entities.ChatSession;
}

// Chat sessions are never soft-deleted in this MVP — every session a user
// starts stays in their history, browsable via the "<" caret.
export function useChatSessions() {
  return useQuery({
    queryKey: ["chatSessions"],
    queryFn: async () => {
      const backend = await chatBackend();
      const sessions = await backend.list();
      return [...sessions].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    },
  });
}

export function useCreateChatSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data) => (await chatBackend()).create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["chatSessions"] }),
  });
}

export function useUpdateChatSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }) => (await chatBackend()).update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["chatSessions"] }),
  });
}

export function useDeleteChatSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const config = await loadAiProviderConfig();
      const isLocal = isLocalBridgeConfigured(config);
      const messages = isLocal
        ? await localDb.chatMessages.filter({ session_id: id })
        : await base44.entities.ChatMessage.filter({ session_id: id });
      await Promise.all(messages.map((m) => (isLocal ? localDb.chatMessages.delete(m.id) : base44.entities.ChatMessage.delete(m.id))));
      return isLocal ? localDb.chatSessions.delete(id) : base44.entities.ChatSession.delete(id);
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["chatSessions"] });
      queryClient.invalidateQueries({ queryKey: ["chatMessages", id] });
    },
  });
}

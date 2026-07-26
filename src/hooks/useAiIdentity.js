import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { loadAiIdentity, saveAiIdentity } from "@/lib/aiPreferences";

// Same react-query-backed shape as every other entity hook (useAreas.js,
// etc.) — added because AiPreferencesSection (Settings) and
// useChatController (the chat header) both read/write this identity but
// previously had no way to hear about each other: Settings called
// saveAiIdentity() directly, and the chat header read it once via its own
// local useState + a mount-only useEffect. Saving a new name in Settings
// never reached an already-mounted ChatBox/ChatPage header until a full
// reload. Routing both through one cached query fixes that — a save here
// invalidates every consumer's copy immediately.
export function useAiIdentity() {
  return useQuery({
    queryKey: ["aiIdentity"],
    queryFn: loadAiIdentity,
    staleTime: Infinity,
  });
}

export function useSaveAiIdentity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveAiIdentity,
    onSuccess: (_, identity) => {
      queryClient.setQueryData(["aiIdentity"], identity);
    },
  });
}

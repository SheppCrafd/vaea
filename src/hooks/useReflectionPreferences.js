import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { loadReflectionPreferences, saveReflectionPreferences } from "@/lib/reflectionPreferences";

// Same react-query-backed shape as useAiIdentity.js — the consent overlay
// (ChatReflectionConsent.jsx), the Settings toggle (AiPreferencesSection.jsx),
// and reflectionTrigger.js's eligibility check all need to agree on the
// current value the instant any one of them changes it, not just after a
// reload.
export function useReflectionPreferences() {
  return useQuery({
    queryKey: ["reflectionPreferences"],
    queryFn: loadReflectionPreferences,
    staleTime: Infinity,
  });
}

export function useSaveReflectionPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveReflectionPreferences,
    onSuccess: (_, prefs) => {
      queryClient.setQueryData(["reflectionPreferences"], prefs);
    },
  });
}

import { useQuery } from "@tanstack/react-query";
import { loadVaultConnection, isVaultConnected } from "@/lib/vaultConnection";

// A plain boolean read of vault connection status, cached the same way
// useAiIdentity.js/useReflectionPreferences.js already cache their own
// deviceStorage-backed values — added because the reflection feature's
// vault-aware copy (ChatReflectionConsent.jsx, AiPreferencesSection.jsx)
// needs this in two places; ExternalVaultSection.jsx's own local
// useState+useEffect pair (it also tracks a live "testing"/"saved" flow
// this doesn't need) isn't reusable as-is.
export function useVaultConnected() {
  return useQuery({
    queryKey: ["vaultConnected"],
    queryFn: async () => isVaultConnected(await loadVaultConnection()),
    staleTime: Infinity,
  });
}

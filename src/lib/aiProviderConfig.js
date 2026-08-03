// Which model answers Vaea Chat — Vaea's own hosted default, or a provider
// the user brings their own API key for (Settings -> AI Model). Local-only,
// same pattern as aiPreferences.js/vaultConnection.js: backed by
// deviceStorage (real files in FSA mode, in-memory + manual export
// otherwise), never localStorage, never sent to Vaea's own backend — a BYOK
// key is only ever read client-side, to call that provider's API directly
// (see src/lib/llm/byokChat.js).
import { readKey, writeKey, removeKey } from "@/lib/deviceStorage";

export const AI_PROVIDER_CONFIG_KEY = "vaea_llm_provider_config";

export const DEFAULTS = {
  provider: "base44",
  model: "",
  apiKey: "",
  // Backdoor Mode only — baked into the watcher launcher scripts
  // (localBridgeStorage.js's writeWatcherKit) so the folder itself carries a
  // ready-to-run pointer at whatever local/on-prem model the user has,
  // rather than the user hand-editing a command every time.
  backdoorEndpoint: "",
};

export async function loadAiProviderConfig() {
  try {
    const stored = await readKey(AI_PROVIDER_CONFIG_KEY);
    return { ...DEFAULTS, ...(stored || {}) };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function saveAiProviderConfig(config) {
  try {
    await writeKey(AI_PROVIDER_CONFIG_KEY, { ...DEFAULTS, ...config });
  } catch {
    // best-effort — the choice just won't survive a reload
  }
}

export async function clearAiProviderConfig() {
  try {
    await removeKey(AI_PROVIDER_CONFIG_KEY);
  } catch {
    // best-effort
  }
}

export function isByokConfigured(config) {
  return !!(config?.provider && config.provider !== "base44" && config.apiKey && config.model);
}

// "Backdoor Mode" (src/lib/llm/localBridgeAdapter.js) has no key or model to
// pick — selecting the provider is enough here, since whether the folder
// itself is actually connected is checked live (async, FSA permission
// state) inside runByokChat, the same way an expired key would only surface
// as a real request failure rather than being validated up front.
export function isLocalBridgeConfigured(config) {
  return config?.provider === "local-bridge";
}

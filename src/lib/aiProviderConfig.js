// Which model answers Vaea Chat — Vaea's own hosted default, or a provider
// the user brings their own API key for (Settings -> AI Model). Local-only,
// same pattern as aiPreferences.js/vaultConnection.js: backed by
// deviceStorage (real files in FSA mode, in-memory + manual export
// otherwise), never localStorage, never sent to Vaea's own backend — a BYOK
// key is only ever read client-side, to call that provider's API directly
// (see src/lib/llm/byokChat.js).
import { readKey, writeKey, removeKey } from "@/lib/deviceStorage";
import { PROVIDERS } from "@/lib/llm/providers";

export const AI_PROVIDER_CONFIG_KEY = "vaea_llm_provider_config";

export const DEFAULTS = {
  provider: "base44",
  model: "",
  apiKey: "",
  // Local Mode only — baked into the watcher launcher scripts
  // (localBridgeStorage.js's writeWatcherKit, bridgeWatcherKit.js) so the
  // folder itself carries a ready-to-run pointer at whatever local model the
  // user picked, rather than them hand-editing a command every time.
  // `localConnector`: "echo" | "ollama" | "lmstudio" | "gpt4all" |
  // "textgen" | "anthropic" | "custom" — the first six are built-in presets
  // bridge_watcher.py already knows how to talk to; "custom" falls back to
  // `localUrl`, a raw endpoint already speaking Vaea's own request shape.
  localConnector: "echo",
  localModel: "",
  localUrl: "",
  // "local-http" provider only — the local server's own base URL (e.g.
  // http://localhost:11434/v1), typed by the user since (unlike the fixed
  // vendor providers above) there's no single right answer here.
  baseUrl: "",
};

// Local Mode was called "Backdoor Mode" before this rename — a stored config
// from before it carries the old key names (backdoorConnector/backdoorModel/
// backdoorUrl) instead. Copied over once on read so an existing connection
// doesn't silently reset to the "echo" test connector; never written back
// under the old names again.
function migrateLegacyKeys(stored) {
  if (!stored) return stored;
  const hasLegacy = "backdoorConnector" in stored || "backdoorModel" in stored || "backdoorUrl" in stored;
  if (!hasLegacy) return stored;
  const { backdoorConnector, backdoorModel, backdoorUrl, ...rest } = stored;
  return {
    ...rest,
    localConnector: stored.localConnector ?? backdoorConnector,
    localModel: stored.localModel ?? backdoorModel,
    localUrl: stored.localUrl ?? backdoorUrl,
  };
}

export async function loadAiProviderConfig() {
  try {
    const stored = await readKey(AI_PROVIDER_CONFIG_KEY);
    return { ...DEFAULTS, ...migrateLegacyKeys(stored || {}) };
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
  if (!config?.provider || config.provider === "base44" || !config.model) return false;
  const provider = PROVIDERS[config.provider];
  if (!provider) return false;
  if (provider.keyRequired !== false && !config.apiKey) return false;
  if (provider.needsBaseUrl && !config.baseUrl) return false;
  return true;
}

// "Local Mode" (src/lib/llm/localBridgeAdapter.js) has no key or model to
// pick — selecting the provider is enough here, since whether the folder
// itself is actually connected is checked live (async, FSA permission
// state) inside runByokChat, the same way an expired key would only surface
// as a real request failure rather than being validated up front.
export function isLocalBridgeConfigured(config) {
  return config?.provider === "local-bridge";
}

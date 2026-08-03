// Best-effort auto-detection of an already-running local model server, so
// "choose a folder" in Settings can configure itself instead of making the
// user open a dropdown and type a model name — probes the same four
// default local ports bridgeWatcherKit.js already has built-in presets for.
//
// Real limitation, not a bug: this only works if the local server's own
// CORS policy allows requests from Vaea's origin. Ollama's default
// (OLLAMA_ORIGINS) allows any http://localhost:* origin, which covers local
// dev and a locally-run Vaea build, but NOT a real hosted https:// domain —
// someone running a deployed Vaea against their own local Ollama would need
// to add Vaea's real origin to OLLAMA_ORIGINS themselves for this to find
// it. When detection finds nothing (blocked by CORS, nothing running, or a
// tool that doesn't expose a models list), this fails silently and Settings
// falls back to the manual dropdown exactly as before — never a dead end.
const CANDIDATES = [
  {
    connector: "ollama",
    url: "http://localhost:11434/api/tags",
    parseModels: (data) => (data.models || []).map((m) => m.name),
  },
  {
    connector: "lmstudio",
    url: "http://localhost:1234/v1/models",
    parseModels: (data) => (data.data || []).map((m) => m.id),
  },
  {
    connector: "gpt4all",
    url: "http://localhost:4891/v1/models",
    parseModels: (data) => (data.data || []).map((m) => m.id),
  },
  {
    connector: "textgen",
    url: "http://localhost:5000/v1/models",
    parseModels: (data) => (data.data || []).map((m) => m.id),
  },
];

const PROBE_TIMEOUT_MS = 1000;

async function probe({ connector, url, parseModels }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const models = parseModels(await res.json());
    return models.length ? { connector, model: models[0] } : null;
  } catch {
    return null; // not running, or CORS-blocked — either way, nothing found
  } finally {
    clearTimeout(timer);
  }
}

// Races every candidate in parallel and returns the first real hit — order
// doesn't otherwise matter since at most one local server is likely running
// on any given machine.
export async function detectLocalModel() {
  const results = await Promise.all(CANDIDATES.map(probe));
  return results.find(Boolean) || null;
}

// The catalog of bring-your-own-key providers Settings -> AI Model offers,
// plus which HTTP shape each one speaks. Two shapes cover all four
// companies: Anthropic's own Messages API, and the OpenAI-compatible
// chat-completions shape that OpenAI itself, Google's Gemini (via its
// v1beta/openai compatibility endpoint), and xAI's Grok (a native
// OpenAI-compatible API) all understand — so byokChat.js only ever needs
// two adapters (anthropicAdapter.js, openaiCompatibleAdapter.js), not four.
//
// Model ids drift as providers ship new ones — this list is a reasonable
// snapshot, not a promise; update the arrays below when a provider retires
// or renames a model, nothing else needs to change.
export const PROVIDERS = {
  base44: {
    id: "base44",
    label: "Vaea's built-in (default)",
    description: "No setup needed — Vaea picks the model for you.",
  },
  anthropic: {
    id: "anthropic",
    label: "Anthropic",
    adapter: "anthropic",
    description: "Claude",
    keyPlaceholder: "sk-ant-...",
    keyHelpUrl: "https://console.anthropic.com/settings/keys",
    baseUrl: "https://api.anthropic.com",
    models: [
      { id: "claude-opus-4-8", label: "Claude Opus 4.8" },
      { id: "claude-sonnet-5", label: "Claude Sonnet 5" },
      { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
    ],
  },
  openai: {
    id: "openai",
    label: "OpenAI",
    adapter: "openai-compatible",
    description: "ChatGPT",
    keyPlaceholder: "sk-...",
    keyHelpUrl: "https://platform.openai.com/api-keys",
    baseUrl: "https://api.openai.com/v1",
    models: [
      { id: "gpt-5", label: "GPT-5" },
      { id: "gpt-5-mini", label: "GPT-5 Mini" },
      { id: "gpt-4o", label: "GPT-4o" },
    ],
  },
  google: {
    id: "google",
    label: "Google",
    adapter: "openai-compatible",
    description: "Gemini",
    keyPlaceholder: "AIza...",
    keyHelpUrl: "https://aistudio.google.com/app/apikey",
    // Gemini's own OpenAI-compatibility layer — same chat-completions
    // request/response shape as OpenAI/xAI below, just a different base URL
    // and model catalog, so no Gemini-specific adapter is needed.
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    models: [
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    ],
  },
  xai: {
    id: "xai",
    label: "xAI",
    adapter: "openai-compatible",
    description: "Grok",
    keyPlaceholder: "xai-...",
    keyHelpUrl: "https://console.x.ai",
    baseUrl: "https://api.x.ai/v1",
    models: [
      { id: "grok-4", label: "Grok 4" },
      { id: "grok-4-fast", label: "Grok 4 Fast" },
    ],
  },
  // A real HTTP call, same as anthropic/openai/google/xai above — the
  // difference is baseUrl isn't fixed here, it's typed by the user in
  // AiModelSection.jsx and carried on providerConfig.baseUrl, because it
  // points at a server running on THIS device (Ollama, LM Studio, etc.),
  // not a fixed vendor endpoint. That's also why keyRequired is false:
  // local servers usually don't check one. Exists specifically for
  // enterprise-managed machines where Group Policy/AppLocker/WDAC blocks
  // launching Backdoor Mode's watcher script — a plain fetch() from this
  // tab to localhost never launches a new process, so that policy never
  // engages. See byokChat.js's use of `needsBaseUrl`/`keyRequired`.
  "local-http": {
    id: "local-http",
    label: "Local HTTP (Ollama, LM Studio, etc.)",
    adapter: "openai-compatible",
    description: "Your own local server, called directly — no script to launch",
    keyPlaceholder: "optional — only if your server requires one",
    keyHelpUrl: "",
    keyRequired: false,
    needsBaseUrl: true,
    baseUrl: "",
    models: [],
  },
  // No API key, no HTTP call at all — the request/reply round-trip happens
  // through two folders on disk instead (see localBridgeStorage.js /
  // localBridgeAdapter.js), for an enterprise's own on-prem or air-gapped
  // model. AiModelSection.jsx shows a folder-connect UI for this provider
  // instead of the key/model fields the other BYOK providers get.
  "local-bridge": {
    id: "local-bridge",
    label: "Backdoor Mode",
    adapter: "local-bridge",
    description: "Your own local/on-prem model, via file polling",
  },
};

export const PROVIDER_LIST = Object.values(PROVIDERS);

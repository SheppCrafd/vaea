import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Eye, EyeOff, FolderCog, Loader2, RefreshCw, TriangleAlert, Unlink, ChevronRight } from "lucide-react";
import { loadAiProviderConfig, saveAiProviderConfig, DEFAULTS as PROVIDER_DEFAULTS } from "@/lib/aiProviderConfig";
import { PROVIDERS, PROVIDER_LIST } from "@/lib/llm/providers";
import {
  supportsFileSystemAccess as bridgeSupported,
  getBridgeStatus,
  getRememberedFolderName as getRememberedBridgeFolderName,
  connectBridgeFolder,
  reconnectBridgeFolder,
  disconnectBridgeFolder,
  inspectBridgeFolder,
  writeWatcherKit,
} from "@/lib/llm/localBridgeStorage";
import { detectLocalModel } from "@/lib/llm/localModelDetect";

// Which model actually answers Vaea Chat — Vaea's own hosted default, or a
// provider the user brings their own API key for. A BYOK key is used
// straight from this browser to call that provider's own API directly
// (src/lib/llm/byokChat.js) — it's stored on this device only (same
// deviceStorage backend as everything else, see aiProviderConfig.js) and
// never touches Vaea's own backend.
export default function AiModelSection() {
  const [config, setConfig] = useState(PROVIDER_DEFAULTS);
  const [showKey, setShowKey] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    loadAiProviderConfig().then(setConfig);
  }, []);

  const provider = PROVIDERS[config.provider] || PROVIDERS.base44;
  const isByok = provider.id !== "base44";
  const isLocalBridge = provider.id === "local-bridge";
  const isKeyBased = isByok && !isLocalBridge;
  const keyOptional = provider.keyRequired === false;
  const needsBaseUrl = !!provider.needsBaseUrl;

  const persist = async (next) => {
    setConfig(next);
    await saveAiProviderConfig(next);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1500);
  };

  const handleProviderChange = (providerId) => {
    const nextProvider = PROVIDERS[providerId];
    // Switching providers invalidates whatever model was picked for the
    // previous one — default to that provider's first model, not a
    // leftover id it doesn't recognize.
    persist({ ...config, provider: providerId, model: nextProvider.models?.[0]?.id || "", apiKey: "", baseUrl: "" });
  };

  const handleModelChange = (model) => persist({ ...config, model });
  const handleKeyChange = (apiKey) => persist({ ...config, apiKey });
  const handleBaseUrlChange = (baseUrl) => persist({ ...config, baseUrl });

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">AI Model</p>
        {justSaved && (
          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Check className="w-3.5 h-3.5" /> Saved
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Vaea Chat answers using its own built-in model by default. Bring your own API key instead to use Claude,
        ChatGPT, Gemini, or Grok directly — your key is sent from this browser straight to that provider, never
        through Vaea's own servers. Pick Local HTTP to call a model server already running on this device (Ollama,
        LM Studio, etc.) directly — no folder, no script, nothing for IT policy to block. Or pick Backdoor Mode to
        route every prompt through a folder on this device instead — no network call at all, for fully air-gapped
        setups.
      </p>

      <div className="flex flex-col gap-3">
        <div>
          <label htmlFor="ai-model-provider" className="text-sm font-medium mb-1.5 block">Provider</label>
          <select
            id="ai-model-provider"
            value={provider.id}
            onChange={(e) => handleProviderChange(e.target.value)}
            className="w-full text-sm px-3 py-2 bg-background border border-input rounded-md outline-none focus:ring-1 focus:ring-primary/50 transition-all"
          >
            {PROVIDER_LIST.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}{p.description ? ` — ${p.description}` : ""}
              </option>
            ))}
          </select>
        </div>

        {isKeyBased && (
          <>
            {needsBaseUrl && (
              <div>
                <label htmlFor="ai-model-base-url" className="text-sm font-medium mb-1.5 block">Server URL</label>
                <input
                  id="ai-model-base-url"
                  type="text"
                  value={config.baseUrl}
                  onChange={(e) => handleBaseUrlChange(e.target.value)}
                  placeholder="http://localhost:11434/v1"
                  autoComplete="off"
                  className="w-full text-sm px-3 py-2 bg-background border border-input rounded-md outline-none focus:ring-1 focus:ring-primary/50 transition-all font-terminal"
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  Ollama's OpenAI-compatible endpoint is <span className="font-terminal">http://localhost:11434/v1</span> by
                  default; LM Studio's is usually <span className="font-terminal">http://localhost:1234/v1</span>.
                </p>
              </div>
            )}

            <div>
              <label htmlFor="ai-model-model" className="text-sm font-medium mb-1.5 block">Model</label>
              {provider.models.length > 0 ? (
                <select
                  id="ai-model-model"
                  value={config.model}
                  onChange={(e) => handleModelChange(e.target.value)}
                  className="w-full text-sm px-3 py-2 bg-background border border-input rounded-md outline-none focus:ring-1 focus:ring-primary/50 transition-all"
                >
                  {provider.models.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  id="ai-model-model"
                  type="text"
                  value={config.model}
                  onChange={(e) => handleModelChange(e.target.value)}
                  placeholder="the model name your server is serving, e.g. llama3.2"
                  autoComplete="off"
                  className="w-full text-sm px-3 py-2 bg-background border border-input rounded-md outline-none focus:ring-1 focus:ring-primary/50 transition-all font-terminal"
                />
              )}
            </div>

            <div>
              <label htmlFor="ai-model-api-key" className="text-sm font-medium mb-1.5 block">
                {provider.label} API key{keyOptional ? " (optional)" : ""}
              </label>
              <div className="relative">
                <input
                  id="ai-model-api-key"
                  type={showKey ? "text" : "password"}
                  value={config.apiKey}
                  onChange={(e) => handleKeyChange(e.target.value)}
                  placeholder={provider.keyPlaceholder}
                  autoComplete="off"
                  className="w-full text-sm pl-3 pr-9 py-2 bg-background border border-input rounded-md outline-none focus:ring-1 focus:ring-primary/50 transition-all font-terminal"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  aria-label={showKey ? "Hide API key" : "Show API key"}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                {keyOptional
                  ? "Most local servers don't check this — leave it blank unless yours does."
                  : <>Stored on this device only — used to call {provider.label} directly, one request at a time.{" "}
                      <a href={provider.keyHelpUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">
                        Get a key
                      </a>
                    </>}
              </p>
            </div>
          </>
        )}

        {isLocalBridge && (
          <BackdoorModeConnect
            backdoorConnector={config.backdoorConnector}
            backdoorModel={config.backdoorModel}
            backdoorUrl={config.backdoorUrl}
            onBackdoorChange={(patch) => persist({ ...config, ...patch })}
          />
        )}

        {isByok && provider.id !== "anthropic" && provider.id !== "xai" && (
          <p className="text-xs text-muted-foreground">
            {isLocalBridge
              ? "Web search isn't available with your own model — there's no hosted search to inherit."
              : "Web search isn't available with this provider — Anthropic and xAI have their own built in, but this one doesn't."}{" "}
            Attachment reading and Vaea Vault work the same as with Vaea's built-in model.
          </p>
        )}
      </div>
    </div>
  );
}

// Every connector bridge_watcher.py knows how to talk to directly — found
// (by actually running Backdoor Mode against a real local Ollama model, not
// just guessing) to be the single biggest gap for anyone without Python/API
// experience: Ollama's own API doesn't speak Vaea's request shape natively,
// so getting a real reply used to require hand-writing a translation
// script. These six presets mean picking one from a dropdown and typing a
// model name is the whole job now — see bridgeWatcherKit.js's own header
// for why one generic translator covers four of them.
const BACKDOOR_CONNECTORS = [
  { id: "echo", label: "Test only — no real model", needsModel: false },
  { id: "ollama", label: "Ollama", needsModel: true, modelPlaceholder: "llama3.2" },
  { id: "lmstudio", label: "LM Studio", needsModel: true, modelPlaceholder: "the model name shown in LM Studio" },
  { id: "gpt4all", label: "GPT4All", needsModel: true, modelPlaceholder: "the model name shown in GPT4All" },
  { id: "textgen", label: "text-generation-webui / llama.cpp server", needsModel: true, modelPlaceholder: "the model name it's serving" },
  { id: "anthropic", label: "Real Claude API", needsModel: true, modelPlaceholder: "claude-sonnet-5" },
  { id: "claude-code", label: "Claude Code CLI (already open on this device)", needsModel: false },
  { id: "custom", label: "Custom endpoint (advanced)", needsModel: false },
];

// Folder-connect UI for "Backdoor Mode" — the user grants access to a
// folder Vaea writes prompts/ and responses/ into (localBridgeStorage.js),
// picks which local model answers, and their own local watcher script (see
// the setup guide) answers by polling it. Deliberately mirrors
// ExternalVaultSection.jsx's connect/disconnect button pattern.
function BackdoorModeConnect({ backdoorConnector, backdoorModel, backdoorUrl, onBackdoorChange }) {
  const [status, setStatus] = useState("checking");
  const [folderName, setFolderName] = useState(null);
  const [error, setError] = useState("");
  const [stats, setStats] = useState(null); // { pending: [names], processed: n }
  const [kitJustWritten, setKitJustWritten] = useState(false);
  const [autoDetected, setAutoDetected] = useState(null); // { connector, model } — just-detected, for the confirmation line
  const activeConnector = BACKDOOR_CONNECTORS.find((c) => c.id === backdoorConnector) || BACKDOOR_CONNECTORS[0];

  const refresh = async () => {
    const s = await getBridgeStatus();
    setStatus(s);
    if (s === "needs-permission") setFolderName(await getRememberedBridgeFolderName());
    // Surface the folder's live state: what's still waiting for the watcher
    // vs how many rounds are already filed in processed/.
    setStats(s === "connected" ? await inspectBridgeFolder().catch(() => null) : null);
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleConnect = async () => {
    setError("");
    setAutoDetected(null);
    try {
      // connectBridgeFolder already drops a runnable watcher kit (script +
      // launchers + README) into the folder on its own, in --echo test
      // mode. Right after, try to find an already-running local model on
      // this device (Ollama, LM Studio, GPT4All, text-generation-webui) —
      // best-effort (see localModelDetect.js's own header on why this can't
      // always succeed) — and if one's found, configure and rewrite the
      // kit for it immediately, so picking a folder is genuinely the whole
      // job for anyone who already has one of these running.
      await connectBridgeFolder();
      await refresh();
      const detected = await detectLocalModel();
      if (detected) {
        onBackdoorChange({ backdoorConnector: detected.connector, backdoorModel: detected.model });
        await writeWatcherKit({ connector: detected.connector, model: detected.model });
        setAutoDetected(detected);
      }
    } catch (err) {
      if (err.name !== "AbortError") setError("Couldn't get access to that folder. Try again.");
    }
  };

  const handleReconnect = async () => {
    setError("");
    try {
      await reconnectBridgeFolder();
      await refresh();
    } catch {
      setError("Permission wasn't granted. Try again, or choose a different folder.");
    }
  };

  const handleDisconnect = async () => {
    await disconnectBridgeFolder();
    setFolderName(null);
    await refresh();
  };

  const handleRewriteKit = async () => {
    setError("");
    const ok = await writeWatcherKit({ connector: backdoorConnector, model: backdoorModel.trim(), url: backdoorUrl.trim() });
    if (ok) {
      setKitJustWritten(true);
      setTimeout(() => setKitJustWritten(false), 2000);
    } else {
      setError("Couldn't write the watcher files to that folder. Try reconnecting it.");
    }
  };

  if (!bridgeSupported) {
    return (
      <p className="flex items-start gap-1.5 text-xs text-destructive">
        <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        Backdoor Mode needs direct folder access, which this browser doesn't support — use Chrome or Edge on desktop instead.
      </p>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-sm font-medium">Bridge folder</p>
        {status === "connected" && (
          <span className="flex items-center gap-1 text-[11px] text-primary font-medium">
            <Check className="w-3.5 h-3.5" /> Connected
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Choose a folder and Vaea does the rest: it creates <span className="font-terminal">prompts/</span> and{" "}
        <span className="font-terminal">responses/</span> folders and writes a ready-to-run watcher script straight
        into it — no copying, pasting, or hand-typing a command. Nothing is sent over the network.
      </p>

      {status === "connected" && (
        <>
          {autoDetected && (
            <p className="flex items-start gap-1.5 text-xs text-primary mb-3">
              <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              Found {BACKDOOR_CONNECTORS.find((c) => c.id === autoDetected.connector)?.label} already running —
              configured it with model "{autoDetected.model}" automatically. Double-click the launcher
              (<span className="font-terminal">run_watcher.bat</span>) in the folder to start answering.
            </p>
          )}
          {stats && (
            <p className="text-xs text-muted-foreground mb-3">
              <span className="font-terminal text-foreground">{stats.pending.length}</span> prompt{stats.pending.length === 1 ? "" : "s"} waiting ·{" "}
              <span className="font-terminal text-foreground">{stats.processed}</span> processed
              <button
                type="button"
                onClick={refresh}
                aria-label="Refresh folder status"
                title="Refresh"
                className="ml-2 align-middle text-muted-foreground hover:text-foreground transition-colors"
              >
                <RefreshCw className="w-3 h-3 inline" />
              </button>
            </p>
          )}

          <div className="mb-3">
            <label htmlFor="backdoor-connector" className="text-xs font-medium mb-1 block">Local model</label>
            <select
              id="backdoor-connector"
              value={backdoorConnector}
              onChange={(e) => onBackdoorChange({ backdoorConnector: e.target.value })}
              className="w-full text-xs px-3 py-2 bg-background border border-input rounded-md outline-none focus:ring-1 focus:ring-primary/50 transition-all mb-2"
            >
              {BACKDOOR_CONNECTORS.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>

            {activeConnector.needsModel && (
              <input
                type="text"
                value={backdoorModel}
                onChange={(e) => onBackdoorChange({ backdoorModel: e.target.value })}
                placeholder={activeConnector.modelPlaceholder}
                autoComplete="off"
                className="w-full text-xs px-3 py-2 bg-background border border-input rounded-md outline-none focus:ring-1 focus:ring-primary/50 transition-all font-terminal mb-1.5"
              />
            )}

            {backdoorConnector === "anthropic" && (
              <p className="text-xs text-muted-foreground mb-1.5">
                Set <span className="font-terminal">ANTHROPIC_API_KEY</span> in your own terminal before running the
                watcher — Vaea never asks for, stores, or sees this key. If you just want Claude answering Vaea Chat
                with no folder or script involved, pick "Anthropic — Claude" as the Provider above instead.
              </p>
            )}

            {backdoorConnector === "claude-code" && (
              <p className="text-xs text-muted-foreground mb-1.5">
                Runs <span className="font-terminal">claude -p</span> on this device for each message — needs the{" "}
                <a href="https://claude.com/claude-code" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">
                  Claude Code CLI
                </a>{" "}
                installed and already signed in (no separate API key). It can read files or search the web to help
                answer, but every actual change to your workspace still goes through the same tool-call + confirm
                flow as any other model.
              </p>
            )}

            {backdoorConnector === "custom" && (
              <input
                type="text"
                value={backdoorUrl}
                onChange={(e) => onBackdoorChange({ backdoorUrl: e.target.value })}
                placeholder="http://localhost:PORT/endpoint — already speaking Vaea's own request shape"
                autoComplete="off"
                className="w-full text-xs px-3 py-2 bg-background border border-input rounded-md outline-none focus:ring-1 focus:ring-primary/50 transition-all font-terminal mb-1.5"
              />
            )}

            <div className="flex items-center gap-2 mt-1">
              <button
                type="button"
                onClick={handleRewriteKit}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
              >
                Update watcher files with this configuration
              </button>
              {kitJustWritten && (
                <span className="flex items-center gap-1 text-[11px] text-primary font-medium">
                  <Check className="w-3.5 h-3.5" /> Written
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleDisconnect}
            className="flex items-center gap-1.5 text-xs px-3 py-2 border border-input rounded-md hover:bg-accent transition-colors text-muted-foreground"
          >
            <Unlink className="w-3.5 h-3.5" /> Disconnect
          </button>
        </>
      )}

      {status === "needs-permission" && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReconnect}
            className="flex items-center gap-1.5 text-sm px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md transition-colors shadow-sm"
          >
            <FolderCog className="w-3.5 h-3.5" /> Resume access to "{folderName}"
          </button>
          <button type="button" onClick={handleConnect} className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">
            Use a different folder
          </button>
        </div>
      )}

      {status === "disconnected" && (
        <button
          type="button"
          onClick={handleConnect}
          className="flex items-center gap-1.5 text-sm px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md transition-colors shadow-sm"
        >
          <FolderCog className="w-3.5 h-3.5" /> Choose a folder
        </button>
      )}

      {status === "checking" && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}

      {error && (
        <p className="flex items-start gap-1.5 text-xs text-destructive mt-3">
          <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {error}
        </p>
      )}

      <Link
        to="/app/settings/backdoor-setup"
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 mt-3 w-fit"
      >
        Set up your local watcher script <ChevronRight className="w-3 h-3" />
      </Link>
    </div>
  );
}

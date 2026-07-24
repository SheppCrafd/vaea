import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Eye, EyeOff, FolderCog, Loader2, TriangleAlert, Unlink, ChevronRight } from "lucide-react";
import { loadAiProviderConfig, saveAiProviderConfig, DEFAULTS as PROVIDER_DEFAULTS } from "@/lib/aiProviderConfig";
import { PROVIDERS, PROVIDER_LIST } from "@/lib/llm/providers";
import {
  supportsFileSystemAccess as bridgeSupported,
  getBridgeStatus,
  getRememberedFolderName as getRememberedBridgeFolderName,
  connectBridgeFolder,
  reconnectBridgeFolder,
  disconnectBridgeFolder,
} from "@/lib/llm/localBridgeStorage";

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
    persist({ ...config, provider: providerId, model: nextProvider.models?.[0]?.id || "", apiKey: "" });
  };

  const handleModelChange = (model) => persist({ ...config, model });
  const handleKeyChange = (apiKey) => persist({ ...config, apiKey });

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
        through Vaea's own servers. Or pick Backdoor Mode to route every prompt to your own local/on-prem model
        through a folder on this device — no network call at all.
      </p>

      <div className="flex flex-col gap-3">
        <div>
          <p className="text-sm font-medium mb-1.5">Provider</p>
          <select
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
            <div>
              <p className="text-sm font-medium mb-1.5">Model</p>
              <select
                value={config.model}
                onChange={(e) => handleModelChange(e.target.value)}
                className="w-full text-sm px-3 py-2 bg-background border border-input rounded-md outline-none focus:ring-1 focus:ring-primary/50 transition-all"
              >
                {provider.models.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>

            <div>
              <p className="text-sm font-medium mb-1.5">{provider.label} API key</p>
              <div className="relative">
                <input
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
                Stored on this device only — used to call {provider.label} directly, one request at a time.{" "}
                <a href={provider.keyHelpUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">
                  Get a key
                </a>
              </p>
            </div>
          </>
        )}

        {isLocalBridge && <BackdoorModeConnect />}

        {isByok && (
          <p className="text-xs text-muted-foreground">
            Web search, attachment reading, and Vaea Vault only work with Vaea's built-in model —
            not yet available with {isLocalBridge ? "Backdoor Mode" : "a bring-your-own-key provider"}.
          </p>
        )}
      </div>
    </div>
  );
}

// Folder-connect UI for "Backdoor Mode" — no key or model to enter here;
// instead the user grants access to a folder Vaea writes prompts/ and
// responses/ into (localBridgeStorage.js), and their own local watcher
// script (see the setup guide) answers by polling it. Deliberately mirrors
// ExternalVaultSection.jsx's connect/disconnect button pattern.
function BackdoorModeConnect() {
  const [status, setStatus] = useState("checking");
  const [folderName, setFolderName] = useState(null);
  const [error, setError] = useState("");

  const refresh = async () => {
    const s = await getBridgeStatus();
    setStatus(s);
    if (s === "needs-permission") setFolderName(await getRememberedBridgeFolderName());
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleConnect = async () => {
    setError("");
    try {
      await connectBridgeFolder();
      await refresh();
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
        Every prompt is written to a <span className="font-terminal">prompts/</span> folder on this device and read
        back from a <span className="font-terminal">responses/</span> folder next to it — nothing is sent over the
        network. Your own local script watches that folder and answers using your company's model.
      </p>

      {status === "connected" && (
        <button
          type="button"
          onClick={handleDisconnect}
          className="flex items-center gap-1.5 text-xs px-3 py-2 border border-input rounded-md hover:bg-accent transition-colors text-muted-foreground"
        >
          <Unlink className="w-3.5 h-3.5" /> Disconnect
        </button>
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
        to="/settings/backdoor-setup"
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 mt-3 w-fit"
      >
        Set up your local watcher script <ChevronRight className="w-3 h-3" />
      </Link>
    </div>
  );
}

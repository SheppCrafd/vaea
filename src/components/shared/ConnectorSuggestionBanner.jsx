import { useEffect, useState } from "react";
import { X, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { suggestionForEmail, isSuggestionDismissed, dismissSuggestion } from "@/lib/connectorSuggestion";
import { loadGmailConnection, isGmailConnected } from "@/lib/gmailConnection";
import { loadOutlookConnection, isOutlookConnected } from "@/lib/outlookConnection";
import { loadGoogleWorkspaceConnection, isGoogleWorkspaceConnected } from "@/lib/googleWorkspaceConnection";
import { loadMicrosoftConnection, isMicrosoftConnected } from "@/lib/microsoftConnection";
import { buildAuthorizationUrl as buildGmailUrl } from "@/lib/gmailOAuthPkce";
import { buildAuthorizationUrl as buildOutlookUrl } from "@/lib/outlookOAuthPkce";
import { buildAuthorizationUrl as buildGoogleWorkspaceUrl } from "@/lib/googleWorkspaceOAuthPkce";
import { buildAuthorizationUrl as buildMicrosoftUrl } from "@/lib/microsoftOAuthPkce";

// One real OAuth trigger per connector key — the exact same
// buildAuthorizationUrl() + window.location.assign() pair each Settings
// section's own "Connect" button already calls, not a second
// implementation of the handshake.
const CONNECTOR_URL_BUILDERS = {
  gmail: buildGmailUrl,
  outlook: buildOutlookUrl,
  googleWorkspace: buildGoogleWorkspaceUrl,
  microsoft: buildMicrosoftUrl,
};

const CONNECTOR_CHECKS = {
  gmail: async () => isGmailConnected(await loadGmailConnection()),
  outlook: async () => isOutlookConnected(await loadOutlookConnection()),
  googleWorkspace: async () => isGoogleWorkspaceConnected(await loadGoogleWorkspaceConnection()),
  microsoft: async () => isMicrosoftConnected(await loadMicrosoftConnection()),
};

// A one-time, dismissible suggestion — never a silent auto-connect (see
// connectorSuggestion.js for why that isn't actually possible). Mounted
// once, above every /app/* route, so it shows regardless of which page a
// user lands on right after signing in.
export default function ConnectorSuggestionBanner() {
  const { user, isAuthenticated } = useAuth();
  const [suggestion, setSuggestion] = useState(null);
  const [connecting, setConnecting] = useState(null);

  useEffect(() => {
    if (!isAuthenticated || !user?.email) { setSuggestion(null); return; }
    const match = suggestionForEmail(user.email);
    if (!match || isSuggestionDismissed(user.email)) { setSuggestion(null); return; }
    let cancelled = false;
    (async () => {
      const alreadyConnected = await Promise.all(match.connectors.map((key) => CONNECTOR_CHECKS[key]()));
      // Already connected to everything this domain implies — nothing to
      // suggest, and don't re-ask next time either.
      if (alreadyConnected.every(Boolean)) {
        dismissSuggestion(user.email);
        return;
      }
      if (!cancelled) setSuggestion(match);
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, user?.email]);

  if (!suggestion) return null;

  const handleConnect = async () => {
    setConnecting(true);
    try {
      // First not-yet-connected one in the pair — the OAuth redirect
      // leaves this page, so only one connect happens per click; the
      // banner (still not dismissed) offers the other on return.
      for (const key of suggestion.connectors) {
        if (!(await CONNECTOR_CHECKS[key]())) {
          window.location.assign(await CONNECTOR_URL_BUILDERS[key]());
          return;
        }
      }
    } finally {
      setConnecting(false);
    }
  };

  const handleDismiss = () => {
    dismissSuggestion(user.email);
    setSuggestion(null);
  };

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-primary/[0.06] border-b border-primary/10 text-sm">
      <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
      <p className="flex-1 min-w-0 truncate text-foreground/80">
        You signed in with <span className="font-medium">{user.email}</span> — connect {suggestion.label} too?
      </p>
      <button
        type="button"
        onClick={handleConnect}
        disabled={connecting}
        className="shrink-0 text-xs px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md transition-colors disabled:opacity-50"
      >
        {connecting ? "Connecting…" : "Connect"}
      </button>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="shrink-0 p-1 text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

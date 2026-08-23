import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { X, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { suggestionForEmail, suggestionForProvider, isSuggestionDismissed, dismissSuggestion } from "@/lib/connectorSuggestion";
import { loadGmailConnection, isGmailConnected } from "@/lib/gmailConnection";
import { loadOutlookConnection, isOutlookConnected } from "@/lib/outlookConnection";
import { loadGoogleWorkspaceConnection, isGoogleWorkspaceConnected } from "@/lib/googleWorkspaceConnection";
import { loadMicrosoftConnection, isMicrosoftConnected } from "@/lib/microsoftConnection";
import { loadAppleMailConnection, isAppleMailConnected } from "@/lib/appleMailConnection";
import { buildAuthorizationUrl as buildGmailUrl } from "@/lib/gmailOAuthPkce";
import { buildAuthorizationUrl as buildOutlookUrl } from "@/lib/outlookOAuthPkce";
import { buildAuthorizationUrl as buildGoogleWorkspaceUrl } from "@/lib/googleWorkspaceOAuthPkce";
import { buildAuthorizationUrl as buildMicrosoftUrl } from "@/lib/microsoftOAuthPkce";
import { useAppStore } from "@/lib/store";

// One real OAuth trigger per connector key — the exact same
// buildAuthorizationUrl() + window.location.assign() pair each Settings
// section's own "Connect" button already calls, not a second
// implementation of the handshake. Apple Mail has no entry here on purpose:
// iCloud has no public OAuth API (see appleMailConnection.js), so its own
// Settings section is an app-specific-password form instead — "Connect"
// for that one just navigates there rather than starting a redirect.
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
  appleMail: async () => isAppleMailConnected(await loadAppleMailConnection()),
};

// A one-time, dismissible suggestion — never a silent auto-connect (see
// connectorSuggestion.js for why that isn't actually possible). Mounted
// once, above every /app/* route, so it shows regardless of which page a
// user lands on right after signing in.
export default function ConnectorSuggestionBanner() {
  const { user, isAuthenticated } = useAuth();
  const [suggestion, setSuggestion] = useState(null);
  const [connecting, setConnecting] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const openAppSection = useAppStore((s) => s.openAppSection);

  useEffect(() => {
    if (!isAuthenticated || !user?.email) { setSuggestion(null); return; }
    // Which "Continue with ___" button was actually clicked (see
    // LoginScreen.jsx/SignUpScreen.jsx) beats guessing from the email's
    // domain — it's the only signal Apple has at all, and it's just a
    // better signal for Google/Microsoft too (an org's Google Workspace
    // account rarely has a @gmail.com address, so the domain heuristic
    // alone would miss it). Consumed once: stripped from the URL right
    // after reading so a refresh doesn't keep re-triggering it.
    const signinProvider = searchParams.get("signin_provider");
    const match = signinProvider ? suggestionForProvider(signinProvider) : suggestionForEmail(user.email);
    if (signinProvider) {
      const next = new URLSearchParams(searchParams);
      next.delete("signin_provider");
      setSearchParams(next, { replace: true });
    }
    if (!match || isSuggestionDismissed(user.email)) { setSuggestion(null); return; }
    let cancelled = false;
    (async () => {
      const alreadyConnected = await Promise.all(match.connectors.map((key) => CONNECTOR_CHECKS[key]()));
      // Already connected to everything this implies — nothing to suggest,
      // and don't re-ask next time either.
      if (alreadyConnected.every(Boolean)) {
        dismissSuggestion(user.email);
        return;
      }
      if (!cancelled) setSuggestion(match);
    })();
    return () => { cancelled = true; };
    // searchParams/setSearchParams intentionally excluded from deps below:
    // reading signin_provider once and stripping it must not re-trigger
    // this same effect on the very URL change that stripping causes.
  }, [isAuthenticated, user?.email]);

  if (!suggestion) return null;

  const handleConnect = async () => {
    setConnecting(true);
    try {
      // First not-yet-connected one in the pair — the OAuth redirect
      // leaves this page, so only one connect happens per click; the
      // banner (still not dismissed) offers the other on return. Apple
      // Mail has no OAuth URL to redirect to at all (see
      // CONNECTOR_URL_BUILDERS's own comment) — send the user to its
      // Settings section instead, same as clicking "Connect" there would.
      for (const key of suggestion.connectors) {
        if (await CONNECTOR_CHECKS[key]()) continue;
        if (key === "appleMail") {
          openAppSection("/app/settings", "settings:apple-mail");
          return;
        }
        window.location.assign(await CONNECTOR_URL_BUILDERS[key]());
        return;
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

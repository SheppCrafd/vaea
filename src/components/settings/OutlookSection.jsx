import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Mail, Check, Loader2, TriangleAlert, Unlink } from "lucide-react";
import { loadOutlookConnection, saveOutlookConnection, clearOutlookConnection, isOutlookConnected, DEFAULTS } from "@/lib/outlookConnection";
import { buildAuthorizationUrl } from "@/lib/outlookOAuthPkce";
import { listMessages } from "@/lib/microsoftGraphApi";
import { SettingsCard } from "@/components/ui/settings-card";
import ConnectorPreview from "@/components/settings/ConnectorPreview";

function RecentMessages({ connection, onTokenRefreshed }) {
  const load = async () => {
    const { messages, connection: refreshed } = await listMessages(connection, { maxResults: 5 });
    if (refreshed.accessToken !== connection.accessToken) onTokenRefreshed(refreshed);
    return messages;
  };

  return (
    <ConnectorPreview
      title="Recent inbox"
      loadingLabel="Loading your inbox…"
      emptyLabel="Nothing in the inbox."
      load={load}
    >
      {(messages) => (
        <ul className="flex flex-col gap-2">
          {messages.map((message) => (
            <li key={message.id} className="flex items-baseline gap-2.5 text-sm">
              {message.unread && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
              <span className={`truncate text-xs text-muted-foreground font-terminal shrink-0 w-32 ${message.unread ? "text-foreground font-medium" : ""}`}>
                {message.from}
              </span>
              <span className={`truncate ${message.unread ? "font-medium" : ""}`}>{message.subject || "(no subject)"}</span>
            </li>
          ))}
        </ul>
      )}
    </ConnectorPreview>
  );
}

// Outlook/Exchange mail — split out from MicrosoftSection.jsx (which now
// covers Calendar + Teams only) so a user can grant mail access without
// also granting calendar access. Same shared Azure app, a narrower
// Mail.Read/Mail.Send-only consent — see outlookOAuthPkce.js. Feeds the
// Vmail tab alongside Gmail.
export default function OutlookSection() {
  const [connection, setConnection] = useState(DEFAULTS);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const queryClient = useQueryClient();

  useEffect(() => {
    loadOutlookConnection().then(setConnection);
  }, []);

  const connected = isOutlookConnected(connection);

  const handleConnect = async () => {
    setConnecting(true);
    setError("");
    try {
      window.location.assign(await buildAuthorizationUrl());
    } catch (err) {
      setError(err.message);
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    await clearOutlookConnection();
    setConnection(DEFAULTS);
    queryClient.invalidateQueries({ queryKey: ["outlookConnected"] });
  };

  const handleTokenRefreshed = async (refreshed) => {
    setConnection(refreshed);
    await saveOutlookConnection(refreshed);
  };

  return (
    <SettingsCard>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Outlook Mail</p>
        {connected && (
          <span className="flex items-center gap-1 text-[11px] text-primary font-medium">
            <Check className="w-3.5 h-3.5" /> {connection.emailAddress || "Connected"}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Connect Outlook mail from a Microsoft 365 or Outlook.com account and it appears in Vmail with your other inboxes. Vaea Chat can check it or send a message when you ask; sending always waits for your yes. The connection is stored on this device, not on Vaea's servers.
      </p>

      {!connected ? (
        <>
          <button
            type="button"
            onClick={handleConnect}
            disabled={connecting}
            className="flex items-center gap-1.5 text-sm px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md transition-colors shadow-sm disabled:opacity-50"
          >
            {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
            {connecting ? "Redirecting to Microsoft…" : "Connect Outlook"}
          </button>
          {error && (
            <p className="flex items-start gap-1.5 text-xs text-destructive mt-3">
              <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {error}
            </p>
          )}
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={handleDisconnect}
            className="flex items-center gap-1.5 text-xs px-3 py-2 border border-input rounded-md hover:bg-accent transition-colors text-muted-foreground"
          >
            <Unlink className="w-3.5 h-3.5" /> Disconnect
          </button>
          <RecentMessages connection={connection} onTokenRefreshed={handleTokenRefreshed} />
        </>
      )}
    </SettingsCard>
  );
}

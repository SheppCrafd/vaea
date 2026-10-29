import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, Check, Loader2, TriangleAlert, Unlink } from "lucide-react";
import { loadMicrosoftConnection, saveMicrosoftConnection, clearMicrosoftConnection, isMicrosoftConnected, DEFAULTS } from "@/lib/microsoftConnection";
import { buildAuthorizationUrl } from "@/lib/microsoftOAuthPkce";
import { listEvents } from "@/lib/microsoftGraphApi";
import { SettingsCard } from "@/components/ui/settings-card";
import ConnectorPreview from "@/components/settings/ConnectorPreview";

function UpcomingEvents({ connection, onTokenRefreshed }) {
  const load = async () => {
    const { events, connection: refreshed } = await listEvents(connection, { maxResults: 4 });
    if (refreshed.accessToken !== connection.accessToken) onTokenRefreshed(refreshed);
    return events;
  };

  return (
    <ConnectorPreview
      title="What's next"
      loadingLabel="Loading your calendar…"
      emptyLabel="Nothing coming up."
      load={load}
    >
      {(events) => (
        <ul className="flex flex-col gap-2">
          {events.map((event) => (
            <li key={event.id} className="flex items-baseline gap-2.5 text-sm">
              <span className="text-xs text-muted-foreground font-terminal shrink-0 w-32 truncate">{event.start}</span>
              <span className="truncate">{event.subject || "(no title)"}</span>
              {event.isOnlineMeeting && <span className="text-[10px] text-primary shrink-0">Teams</span>}
            </li>
          ))}
        </ul>
      )}
    </ConnectorPreview>
  );
}

// Microsoft 365 / Outlook Calendar — Calendar + Teams meeting links only
// (the assistant can add a real Teams join link to any event it creates).
// Outlook/Exchange mail is a separate connector (OutlookSection.jsx, feeds
// the Vmail tab) so a user can grant one without the other. Same
// PKCE-against-a-shared-public-client flow as Calendar/Gmail — see
// microsoftOAuthPkce.js.
export default function MicrosoftSection() {
  const [connection, setConnection] = useState(DEFAULTS);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const queryClient = useQueryClient();

  useEffect(() => {
    loadMicrosoftConnection().then(setConnection);
  }, []);

  const connected = isMicrosoftConnected(connection);

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
    await clearMicrosoftConnection();
    setConnection(DEFAULTS);
    queryClient.invalidateQueries({ queryKey: ["microsoftConnected"] });
  };

  const handleTokenRefreshed = async (refreshed) => {
    setConnection(refreshed);
    await saveMicrosoftConnection(refreshed);
  };

  return (
    <SettingsCard>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Microsoft 365 Calendar</p>
        {connected && (
          <span className="flex items-center gap-1 text-[11px] text-primary font-medium">
            <Check className="w-3.5 h-3.5" /> {connection.emailAddress || "Connected"}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Connect a Microsoft 365 or Outlook.com calendar and Vaea Chat can check what's on it, add events (with a Teams link if you want one), or cancel them. Cancelling waits for your yes. This covers the calendar only; connect Outlook Mail below to see your email in Vmail. The connection is stored on this device, not on Vaea's servers.
      </p>

      {!connected ? (
        <>
          <button
            type="button"
            onClick={handleConnect}
            disabled={connecting}
            className="flex items-center gap-1.5 text-sm px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md transition-colors shadow-sm disabled:opacity-50"
          >
            {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Building2 className="w-3.5 h-3.5" />}
            {connecting ? "Redirecting to Microsoft…" : "Connect Microsoft"}
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
          <UpcomingEvents connection={connection} onTokenRefreshed={handleTokenRefreshed} />
        </>
      )}
    </SettingsCard>
  );
}

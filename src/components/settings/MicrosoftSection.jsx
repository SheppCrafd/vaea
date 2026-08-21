import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Check, LayoutGrid, Loader2, Mail, TriangleAlert, Unlink, Video } from "lucide-react";
import { loadMicrosoftConnection, saveMicrosoftConnection, clearMicrosoftConnection, isMicrosoftConnected, DEFAULTS } from "@/lib/microsoftConnection";
import { buildAuthorizationUrl } from "@/lib/microsoftOAuthPkce";
import { listEvents } from "@/lib/microsoftGraphApi";

// Real upcoming-events preview, same on-demand-not-polled discipline as
// GoogleWorkspaceSection/GmailSection — Graph is also a shared per-app quota
// across every Vaea user.
function UpcomingEvents({ connection, onTokenRefreshed }) {
  const [events, setEvents] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const { events: fetched, connection: refreshed } = await listEvents(connection, { maxResults: 4 });
      setEvents(fetched);
      if (refreshed.accessToken !== connection.accessToken) onTokenRefreshed(refreshed);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mt-6 pt-6 border-t border-border">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium">What's next</p>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      {loading && !events ? (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading your calendar…
        </div>
      ) : error ? (
        <p className="flex items-start gap-1.5 text-xs text-destructive">
          <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {error}
        </p>
      ) : events.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nothing coming up.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {events.map((event) => (
            <li key={event.id} className="flex items-baseline gap-2.5 text-sm">
              <span className="text-xs text-muted-foreground font-terminal shrink-0 w-32 truncate">{event.start}</span>
              <span className="truncate">{event.subject || "(no title)"}</span>
              {event.isOnlineMeeting && (
                <span className="flex items-center gap-1 text-[10px] text-primary border border-primary/30 rounded px-1 py-0.5 shrink-0">
                  <Video className="w-2.5 h-2.5" /> Teams
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Microsoft 365 / Outlook.com — one connection, one consent screen, covers
// Outlook Calendar, Outlook/Exchange mail, and Teams meeting links (the
// assistant can add a real Teams join link to any event it creates). Same
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
    <div className="card-enter bg-card border border-foreground/[0.04] rounded-2xl shadow-md p-6">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Microsoft 365 / Outlook</p>
        {connected && (
          <span className="flex items-center gap-1 text-[11px] text-primary font-medium">
            <Check className="w-3.5 h-3.5" /> {connection.emailAddress || "Connected"}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        One Microsoft sign-in covers three surfaces at once: Outlook Calendar, Outlook/Exchange mail, and Teams
        meeting links (the assistant can attach a real join link to any event it creates). Works with a Microsoft
        365 work account or a personal Outlook.com account either way. Cancelling an event or sending mail always
        goes through the same confirm step any other destructive change does, and nothing about the account sits on
        Vaea's servers — the connection lives on this device, sent along transiently only for the moment a request
        actually needs it.
      </p>
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground mb-4">
        <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" /> Calendar</span>
        <span className="text-border">·</span>
        <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> Mail</span>
        <span className="text-border">·</span>
        <span className="flex items-center gap-1"><Video className="w-3 h-3" /> Teams</span>
      </div>

      {!connected ? (
        <>
          <button
            type="button"
            onClick={handleConnect}
            disabled={connecting}
            className="flex items-center gap-1.5 text-sm px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md transition-colors shadow-sm disabled:opacity-50"
          >
            {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LayoutGrid className="w-3.5 h-3.5" />}
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
    </div>
  );
}

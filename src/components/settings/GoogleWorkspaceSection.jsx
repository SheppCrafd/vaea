import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutGrid, Check, Loader2, TriangleAlert, Unlink } from "lucide-react";
import {
  loadGoogleWorkspaceConnection,
  saveGoogleWorkspaceConnection,
  clearGoogleWorkspaceConnection,
  isGoogleWorkspaceConnected,
} from "@/lib/googleWorkspaceConnection";
import { buildAuthorizationUrl } from "@/lib/googleWorkspaceOAuthPkce";
import { listEvents } from "@/lib/googleCalendarApi";
import { SettingsCard } from "@/components/ui/settings-card";

// A compact, real preview of what's actually connected — a handful of
// upcoming events, not a static "Connected" badge. Fetched once on mount
// and again after a manual refresh click, never polled — Google's free-tier
// quotas are per-project, shared across every Vaea user, so this stays
// on-demand rather than firing on every render/navigation.
function UpcomingEvents({ connection, onTokenRefreshed }) {
  const [events, setEvents] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const { events: fetched, connection: refreshed } = await listEvents(connection, { maxResults: 4, timeMin: new Date().toISOString() });
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
  }, []);

  return (
    <div className="mt-6 pt-6 border-t border-border">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium">What's next on your calendar</p>
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
          {events.map((event) => {
            const start = event.start?.dateTime || event.start?.date;
            const label = event.start?.dateTime
              ? new Date(start).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
              : new Date(start).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
            return (
              <li key={event.id} className="flex items-baseline gap-2.5 text-sm">
                <span className="text-xs text-muted-foreground font-terminal shrink-0 w-32">{label}</span>
                <span className="truncate">{event.summary || "(no title)"}</span>
                {event.hangoutLink && <span className="text-[10px] text-primary shrink-0">Meet</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const INCLUDED_PRODUCTS = ["Calendar", "Drive", "Docs", "Sheets", "Slides", "Tasks", "Forms"];

// Google Workspace — a single one-click OAuth connection (PKCE against a
// public "Desktop app" client Vaea itself owns, so no per-user setup is
// needed — see googleWorkspaceOAuthPkce.js) covering Calendar, Drive, Docs,
// Sheets, Slides, Tasks, and Forms all at once. Gmail is deliberately kept
// out of this connector and its own separate consent screen (GmailSection.jsx)
// — inbox read/send is a bigger ask than the rest of Workspace and users
// should be able to grant one without the other.
export default function GoogleWorkspaceSection() {
  const [connection, setConnection] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const queryClient = useQueryClient();

  useEffect(() => {
    loadGoogleWorkspaceConnection().then(setConnection);
  }, []);

  const connected = isGoogleWorkspaceConnected(connection);

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
    await clearGoogleWorkspaceConnection();
    setConnection({ accessToken: "", refreshToken: "", expiresAt: 0, calendarId: "primary", email: "" });
    queryClient.invalidateQueries({ queryKey: ["googleWorkspaceConnected"] });
  };

  const handleTokenRefreshed = async (refreshed) => {
    setConnection(refreshed);
    await saveGoogleWorkspaceConnection(refreshed);
  };

  if (!connection) return null;

  return (
    <SettingsCard>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Google Workspace</p>
        {connected && (
          <span className="flex items-center gap-1 text-[11px] text-primary font-medium">
            <Check className="w-3.5 h-3.5" /> {connection.email || "Connected"}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-1">
        One connection covers {INCLUDED_PRODUCTS.join(", ")} — the assistant can look things up or make changes
        across all of them when you ask, with the same confirm step any other destructive or outgoing action goes
        through. Gmail is separate (see below), so you can grant inbox access independently.
      </p>
      <p className="text-xs text-muted-foreground mb-4">
        Nothing about this account sits on Vaea's servers: the connection lives on this device, and is only ever
        sent along transiently, for the moment a request actually needs it.
      </p>

      {!connected ? (
        <>
          <button
            type="button"
            onClick={handleConnect}
            disabled={connecting}
            className="flex items-center gap-1.5 text-sm px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md transition-colors shadow-sm disabled:opacity-50"
          >
            {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LayoutGrid className="w-3.5 h-3.5" />}
            {connecting ? "Redirecting to Google…" : "Connect Google Workspace"}
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

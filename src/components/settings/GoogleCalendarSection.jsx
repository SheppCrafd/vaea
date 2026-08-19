import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Check, Loader2, TriangleAlert, Unlink } from "lucide-react";
import { loadCalendarConnection, saveCalendarConnection, clearCalendarConnection, isCalendarConnected, DEFAULTS as CONNECTION_DEFAULTS } from "@/lib/calendarConnection";
import { buildAuthorizationUrl } from "@/lib/googleOAuthPkce";
import { listEvents } from "@/lib/googleCalendarApi";

// A compact, real preview of what's actually connected — a handful of
// upcoming events, not a static "Connected" badge. Fetched once on mount
// and again after a manual refresh click, never polled — Google Calendar's
// free-tier quota is per-project, shared across every Vaea user, so this
// stays on-demand rather than firing on every render/navigation.
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
        // A day-agenda rail, not a plain list — the left border reads as a
        // timeline the events sit against, and only the soonest one (index
        // 0, since the API call above already sorts by startTime) is picked
        // out in full color: exactly one thing on this list is "next."
        <ul className="flex flex-col gap-2.5 border-l-2 border-border pl-3">
          {events.map((event, index) => {
            const start = event.start?.dateTime || event.start?.date;
            const label = event.start?.dateTime
              ? new Date(start).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
              : new Date(start).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
            const isNext = index === 0;
            return (
              <li key={event.id} className="flex items-baseline gap-2.5 text-sm">
                <span className={`text-xs font-terminal shrink-0 w-32 ${isNext ? "text-primary font-medium" : "text-muted-foreground"}`}>
                  {label}
                </span>
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

// Google Calendar — a one-click OAuth connection (PKCE against a public
// "Desktop app" client Vaea itself owns, so no per-user setup is needed —
// see googleOAuthPkce.js). Unlike Vaea Vault's PAT form, there's nothing
// for the user to type here at all: the whole flow is a redirect to
// Google's own consent screen and back.
export default function GoogleCalendarSection() {
  // Initialized to real defaults, not null — ExternalVaultSection.jsx and
  // every other connection-style section render their card immediately and
  // fill in once the async storage read resolves. This one used to return
  // null until then, which meant its card was simply absent from the page
  // for a moment: on /settings, where all nine sections mount at once, that
  // showed up as a layout jump once it popped in, and this section reading
  // like an afterthought next to Vaea Vault's identical pattern.
  const [connection, setConnection] = useState(CONNECTION_DEFAULTS);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const queryClient = useQueryClient();

  useEffect(() => {
    loadCalendarConnection().then(setConnection);
  }, []);

  const connected = isCalendarConnected(connection);

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
    await clearCalendarConnection();
    setConnection({ accessToken: "", refreshToken: "", expiresAt: 0, calendarId: "primary" });
    queryClient.invalidateQueries({ queryKey: ["calendarConnected"] });
  };

  const handleTokenRefreshed = async (refreshed) => {
    setConnection(refreshed);
    await saveCalendarConnection(refreshed);
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-1">
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          <CalendarDays className="w-3.5 h-3.5" /> Google Calendar
        </p>
        {connected && (
          <span className="flex items-center gap-1 text-[11px] text-primary font-medium">
            <Check className="w-3.5 h-3.5" /> Connected
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Once connected, the assistant can see what's actually on your schedule — this week, next week, whenever you
        ask — and add, reschedule, or clear time when you tell it to. Anything it removes from the calendar goes
        through the same confirm step as any other destructive change. The connection itself never touches Vaea's
        servers: it stays on this device and is only handed over for the instant a calendar request needs it.
      </p>

      {!connected ? (
        <>
          <button
            type="button"
            onClick={handleConnect}
            disabled={connecting}
            className="flex items-center gap-1.5 text-sm px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md transition-colors shadow-sm disabled:opacity-50"
          >
            {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CalendarDays className="w-3.5 h-3.5" />}
            {connecting ? "Redirecting to Google…" : "Connect Google Calendar"}
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

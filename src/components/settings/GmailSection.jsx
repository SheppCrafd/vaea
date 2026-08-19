import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Mail, Check, Loader2, TriangleAlert, Unlink } from "lucide-react";
import { loadGmailConnection, saveGmailConnection, clearGmailConnection, isGmailConnected, DEFAULTS } from "@/lib/gmailConnection";
import { buildAuthorizationUrl } from "@/lib/gmailOAuthPkce";
import { listMessages } from "@/lib/gmailApi";

// Real recent-inbox preview, same on-demand-not-polled discipline as
// GoogleCalendarSection's UpcomingEvents — Gmail's API is also a shared
// per-project daily quota across every Vaea user.
function RecentMessages({ connection, onTokenRefreshed }) {
  const [messages, setMessages] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const { messages: fetched, connection: refreshed } = await listMessages(connection, { query: "in:inbox", maxResults: 5 });
      setMessages(fetched);
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
        <p className="text-sm font-medium">Recent inbox</p>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      {loading && !messages ? (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading your inbox…
        </div>
      ) : error ? (
        <p className="flex items-start gap-1.5 text-xs text-destructive">
          <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {error}
        </p>
      ) : messages.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nothing in the inbox.</p>
      ) : (
        // Two lines per row, not one — sender/subject on top the way an
        // inbox list always reads, and the real snippet underneath, because
        // a mail preview that can't show you a fragment of what was
        // actually said isn't really a preview. Calendar's list is a rail
        // of single-line rows against time; this is a stack of messages,
        // because that's the thing each one actually is.
        <ul className="flex flex-col gap-3">
          {messages.map((message) => (
            <li key={message.id} className="flex flex-col gap-0.5 text-sm">
              <div className="flex items-baseline gap-2.5">
                {message.unread && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                <span className={`truncate text-xs text-muted-foreground font-terminal shrink-0 w-32 ${message.unread ? "text-foreground font-medium" : ""}`}>
                  {message.from.replace(/<.*>/, "").trim() || message.from}
                </span>
                <span className={`truncate ${message.unread ? "font-medium" : ""}`}>{message.subject || "(no subject)"}</span>
              </div>
              {message.snippet && <p className="pl-4 text-xs text-muted-foreground/70 truncate">{message.snippet}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Gmail — same PKCE-against-a-shared-public-client flow as Calendar (see
// gmailOAuthPkce.js), kept as its own independent connection so a user can
// grant calendar access without also granting inbox read/send access.
export default function GmailSection() {
  const [connection, setConnection] = useState(DEFAULTS);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const queryClient = useQueryClient();

  useEffect(() => {
    loadGmailConnection().then(setConnection);
  }, []);

  const connected = isGmailConnected(connection);

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
    await clearGmailConnection();
    setConnection(DEFAULTS);
    queryClient.invalidateQueries({ queryKey: ["gmailConnected"] });
  };

  const handleTokenRefreshed = async (refreshed) => {
    setConnection(refreshed);
    await saveGmailConnection(refreshed);
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-1">
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          <Mail className="w-3.5 h-3.5" /> Gmail
        </p>
        {connected && (
          <span className="flex items-center gap-1 text-[11px] text-primary font-medium">
            <Check className="w-3.5 h-3.5" /> {connection.emailAddress || "Connected"}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Connect Gmail and the assistant can read what's landed in your inbox, or draft and send a reply on your
        behalf when you ask — nothing goes out without the same confirm step every outgoing action gets. Like the
        calendar connection, this one lives only on this device and is passed along just long enough for a single
        request to use it, never stored on Vaea's servers.
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
            {connecting ? "Redirecting to Google…" : "Connect Gmail"}
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
    </div>
  );
}

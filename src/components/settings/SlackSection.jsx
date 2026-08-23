import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Hash, Check, Loader2, TriangleAlert, Unlink } from "lucide-react";
import { loadSlackConnection, clearSlackConnection, isSlackConnected, DEFAULTS } from "@/lib/slackConnection";
import { buildAuthorizationUrl } from "@/lib/slackOAuth";
import { listChannels } from "@/lib/slackApi";

// Slack's mental model is channel-first — you navigate TO a channel, then
// see messages. So the connected preview shows channels (not messages),
// because "post to #general" is how you'd actually tell Vaea to use Slack.
// Structurally different from Gmail's inbox-first or Calendar's event-first
// preview, which is the point.
const ACCENT = "#9333ea";

function ChannelPip({ unread }) {
  if (!unread) return null;
  return <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: ACCENT }} />;
}

function ChannelList({ connection }) {
  const [channels, setChannels] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const fetched = await listChannels(connection);
      setChannels(fetched.slice(0, 6));
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
        <p className="text-sm font-medium">Channels</p>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {loading && !channels ? (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading channels…
        </div>
      ) : error ? (
        <p className="flex items-start gap-1.5 text-xs text-destructive">
          <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {error}
        </p>
      ) : channels?.length === 0 ? (
        <p className="text-xs text-muted-foreground">No public channels found.</p>
      ) : (
        // Channel-sidebar layout: # prefix, name, optional unread pip.
        // This is Slack's own navigation paradigm rather than a message feed.
        <ul className="flex flex-col gap-0.5">
          {channels?.map((ch) => (
            <li key={ch.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors">
              <Hash className="w-3.5 h-3.5 shrink-0 text-muted-foreground/60" />
              <span className="text-sm font-terminal truncate flex-1">{ch.name}</span>
              {ch.topic && (
                <span className="text-xs text-muted-foreground/50 truncate max-w-[120px] hidden sm:block">{ch.topic}</span>
              )}
              <ChannelPip unread={false} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function SlackSection() {
  const [connection, setConnection] = useState(DEFAULTS);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const queryClient = useQueryClient();

  useEffect(() => {
    loadSlackConnection().then(setConnection);
  }, []);

  const connected = isSlackConnected(connection);

  const handleConnect = () => {
    setConnecting(true);
    setError("");
    try {
      window.location.assign(buildAuthorizationUrl());
    } catch (err) {
      setError(err.message);
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    await clearSlackConnection();
    setConnection(DEFAULTS);
    queryClient.invalidateQueries({ queryKey: ["slackConnected"] });
  };

  return (
    <div className="card-enter bg-card border border-foreground/[0.04] rounded-2xl shadow-md p-6">
      <div className="flex items-center justify-between mb-1">
        <p
          className="flex items-center gap-1.5 text-xs font-terminal font-medium uppercase tracking-[0.18em]"
          style={{ color: connected ? ACCENT : undefined }}
        >
          <Hash className="w-3.5 h-3.5" />
          {connected ? `# ${connection.workspaceName}` : "Slack"}
        </p>
        {connected && (
          <span className="flex items-center gap-1 text-[11px] font-medium" style={{ color: ACCENT }}>
            <Check className="w-3.5 h-3.5" />
            {connection.username ? `@${connection.username}` : "Connected"}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Connect Slack and the assistant can read channel messages or post to a channel when you ask —
        messages are sent as you, not as a bot. Posting always goes through the same confirm step any
        other outgoing action does. The token lives on this device only, sent transiently per request.
      </p>

      {!connected ? (
        <>
          <button
            type="button"
            onClick={handleConnect}
            disabled={connecting}
            className="flex items-center gap-1.5 text-sm px-4 py-2 font-medium rounded-md transition-colors shadow-sm disabled:opacity-50 text-white"
            style={{ background: connecting ? `${ACCENT}99` : ACCENT }}
          >
            {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Hash className="w-3.5 h-3.5" />}
            {connecting ? "Redirecting to Slack…" : "Connect Slack"}
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
          <ChannelList connection={connection} />
        </>
      )}
    </div>
  );
}

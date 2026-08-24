import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Mail, Check, Loader2, TriangleAlert, Unlink } from "lucide-react";
import { loadGmailConnection, saveGmailConnection, clearGmailConnection, isGmailConnected, DEFAULTS } from "@/lib/gmailConnection";
import { buildAuthorizationUrl } from "@/lib/gmailOAuthPkce";
import { listMessages } from "@/lib/gmailApi";
import { SettingsCard } from "@/components/ui/settings-card";
import ConnectorPreview from "@/components/settings/ConnectorPreview";

function RecentMessages({ connection, onTokenRefreshed }) {
  const load = async () => {
    const { messages, connection: refreshed } = await listMessages(connection, { query: "in:inbox", maxResults: 5 });
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
                {message.from.replace(/<.*>/, "").trim() || message.from}
              </span>
              <span className={`truncate ${message.unread ? "font-medium" : ""}`}>{message.subject || "(no subject)"}</span>
            </li>
          ))}
        </ul>
      )}
    </ConnectorPreview>
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
    <SettingsCard>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Gmail</p>
        {connected && (
          <span className="flex items-center gap-1 text-[11px] text-primary font-medium">
            <Check className="w-3.5 h-3.5" /> {connection.emailAddress || "Connected"}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Connect Gmail and the assistant can check what's in your inbox or send a message when you ask — sending
        always goes through the same confirm step any other outgoing action does. Nothing about this account sits
        on Vaea's servers: the connection lives on this device, sent along transiently only for the moment a
        request actually needs it.
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
    </SettingsCard>
  );
}

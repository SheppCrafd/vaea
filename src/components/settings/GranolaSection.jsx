import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { NotebookPen, Check, Loader2, TriangleAlert, Unlink } from "lucide-react";
import { loadGranolaConnection, clearGranolaConnection, isGranolaConnected, isFreeGranolaPlan, DEFAULTS } from "@/lib/granolaConnection";
import { buildAuthorizationUrl } from "@/lib/granolaOAuth";
import { SettingsCard } from "@/components/ui/settings-card";

// Granola meeting notes. Sign-in goes through Granola's own OAuth (its MCP
// server), so there's nothing to set up beyond clicking Connect.
export default function GranolaSection() {
  const [connection, setConnection] = useState(DEFAULTS);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const queryClient = useQueryClient();

  useEffect(() => {
    loadGranolaConnection().then(setConnection);
  }, []);

  const connected = isGranolaConnected(connection);

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
    await clearGranolaConnection();
    setConnection(DEFAULTS);
    queryClient.invalidateQueries({ queryKey: ["granola"] });
  };

  return (
    <SettingsCard>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Granola</p>
        {connected && (
          <span className="flex items-center gap-1 text-[11px] text-primary font-medium">
            <Check className="w-3.5 h-3.5" /> {connection.emailAddress || "Connected"}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Connect Granola and your meeting notes appear in Meetings. Open one to turn it into tasks, link it to a project, or hand it to Vaea Chat. Sign in with the account you use in the Granola app: a Google account, or a Microsoft 365 work or school account.
      </p>
      {connected && (
        <p className="text-xs text-muted-foreground -mt-2 mb-4">
          {!connection.plan
            ? "What Vaea can read follows your Granola plan."
            : isFreeGranolaPlan(connection.plan)
              ? "Your Granola plan shares the last 30 days of notes. Transcripts need a paid Granola plan."
              : "Your Granola plan shares all your notes, including transcripts."}
        </p>
      )}

      {!connected ? (
        <>
          <button
            type="button"
            onClick={handleConnect}
            disabled={connecting}
            className="flex items-center gap-1.5 text-sm px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md transition-colors shadow-sm disabled:opacity-50"
          >
            {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <NotebookPen className="w-3.5 h-3.5" />}
            {connecting ? "Redirecting to Granola…" : "Connect Granola"}
          </button>
          {error && (
            <p className="flex items-start gap-1.5 text-xs text-destructive mt-3">
              <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {error}
            </p>
          )}
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/app/meetings"
            className="flex items-center gap-1.5 text-sm px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md transition-colors shadow-sm"
          >
            <NotebookPen className="w-3.5 h-3.5" /> Open Meetings
          </Link>
          <button
            type="button"
            onClick={handleDisconnect}
            className="flex items-center gap-1.5 text-xs px-3 py-2 border border-input rounded-md hover:bg-accent transition-colors text-muted-foreground"
          >
            <Unlink className="w-3.5 h-3.5" /> Disconnect
          </button>
        </div>
      )}
    </SettingsCard>
  );
}

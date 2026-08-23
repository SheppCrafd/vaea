import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { loadGoogleWorkspaceConnection, isGoogleWorkspaceConnected } from "@/lib/googleWorkspaceConnection";
import { loadGmailConnection, isGmailConnected } from "@/lib/gmailConnection";
import { loadMicrosoftConnection, isMicrosoftConnected } from "@/lib/microsoftConnection";
import { loadOutlookConnection, isOutlookConnected } from "@/lib/outlookConnection";
import { loadAppleMailConnection, isAppleMailConnected } from "@/lib/appleMailConnection";
import { loadClickUpConnection, isClickUpConnected } from "@/lib/clickupConnection";
import { loadSlackConnection, isSlackConnected } from "@/lib/slackConnection";
import { loadVaultConnection, isVaultConnected } from "@/lib/vaultConnection";
import { SettingsCard } from "@/components/ui/settings-card";

const CONNECTORS = [
  { label: "Google Workspace", load: loadGoogleWorkspaceConnection, isConnected: isGoogleWorkspaceConnected, section: "google-workspace" },
  { label: "Gmail", load: loadGmailConnection, isConnected: isGmailConnected, section: "gmail" },
  { label: "Microsoft 365 Calendar", load: loadMicrosoftConnection, isConnected: isMicrosoftConnected, section: "microsoft" },
  { label: "Outlook Mail", load: loadOutlookConnection, isConnected: isOutlookConnected, section: "outlook" },
  { label: "Apple Mail", load: loadAppleMailConnection, isConnected: isAppleMailConnected, section: "apple-mail" },
  { label: "ClickUp", load: loadClickUpConnection, isConnected: isClickUpConnected, section: "clickup" },
  { label: "Slack", load: loadSlackConnection, isConnected: isSlackConnected, section: "slack" },
  { label: "Vaea Brain", load: loadVaultConnection, isConnected: isVaultConnected, section: "brain" },
];

// One glance at every connector's real status — token freshness isn't
// surfaced here (each connector refreshes its own access token on demand,
// transparently, the moment a tool actually needs it; there's nothing
// meaningful to show ahead of that), just whether a connection exists at
// all right now.
export default function ConnectorHealthSection() {
  const [statuses, setStatuses] = useState(null);

  useEffect(() => {
    (async () => {
      const results = await Promise.all(
        CONNECTORS.map(async (c) => ({ ...c, connected: c.isConnected(await c.load()) }))
      );
      setStatuses(results);
    })();
  }, []);

  return (
    <SettingsCard>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Connector Health</p>
      <p className="text-xs text-muted-foreground mb-4">Every connector's real status, at a glance.</p>
      {!statuses ? (
        <p className="text-xs text-muted-foreground">Checking…</p>
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {statuses.map((c) => (
            <div key={c.label} className="flex items-center justify-between py-2.5">
              <span className="text-sm">{c.label}</span>
              {c.connected ? (
                <span className="flex items-center gap-1 text-[11px] text-primary font-medium">
                  <Check className="w-3.5 h-3.5" /> Connected
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <X className="w-3.5 h-3.5" /> Not connected
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </SettingsCard>
  );
}

import { useEffect, useState } from "react";
import { Apple, Check, TriangleAlert, Unlink } from "lucide-react";
import { loadAppleMailConnection, saveAppleMailConnection, clearAppleMailConnection, isAppleMailConnected, DEFAULTS } from "@/lib/appleMailConnection";

// Apple/iCloud Mail — no OAuth here (Apple doesn't offer one for iCloud
// Mail); the user generates an app-specific password at
// appleid.apple.com > Sign-In and Security > App-Specific Passwords and
// enters it below, same credential shape Apple Mail's own iOS/macOS
// settings app asks for when adding the account elsewhere. Saved,
// real, and shows up as a connected account. Being upfront about the one
// real gap: reading/sending mail over IMAP needs a small server-side
// bridge (browsers can't open raw IMAP sockets) that isn't built yet — the
// Vmail tab says so plainly rather than pretending messages are syncing
// when they aren't.
export default function AppleMailSection() {
  const [connection, setConnection] = useState(DEFAULTS);
  const [emailAddress, setEmailAddress] = useState("");
  const [appSpecificPassword, setAppSpecificPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadAppleMailConnection().then(setConnection);
  }, []);

  const connected = isAppleMailConnected(connection);

  const handleConnect = async (e) => {
    e.preventDefault();
    setError("");
    if (!emailAddress.trim() || !appSpecificPassword.trim()) {
      setError("Both fields are required.");
      return;
    }
    setSaving(true);
    try {
      const next = { emailAddress: emailAddress.trim(), appSpecificPassword: appSpecificPassword.trim() };
      await saveAppleMailConnection(next);
      setConnection(next);
      setEmailAddress("");
      setAppSpecificPassword("");
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    await clearAppleMailConnection();
    setConnection(DEFAULTS);
  };

  return (
    <div className="card-enter bg-card border border-foreground/[0.04] rounded-2xl shadow-md p-6">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Apple Mail</p>
        {connected && (
          <span className="flex items-center gap-1 text-[11px] text-primary font-medium">
            <Check className="w-3.5 h-3.5" /> {connection.emailAddress}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Connect an iCloud Mail address using an app-specific password (generate one at appleid.apple.com under
        Sign-In and Security). It'll show up in the Vmail tab alongside Gmail and Outlook. Nothing about this
        account sits on Vaea's servers: it's stored on this device only. Note: message sync is still being built —
        connecting saves the credential now, and Vmail will start showing real Apple Mail messages once that lands.
      </p>

      {!connected ? (
        <form onSubmit={handleConnect} className="flex flex-col gap-2.5">
          <input
            type="email"
            value={emailAddress}
            onChange={(e) => setEmailAddress(e.target.value)}
            placeholder="you@icloud.com"
            className="text-sm px-3 py-2 rounded-md border border-input bg-background outline-none focus:ring-2 focus:ring-primary/40"
          />
          <input
            type="password"
            value={appSpecificPassword}
            onChange={(e) => setAppSpecificPassword(e.target.value)}
            placeholder="App-specific password"
            className="text-sm px-3 py-2 rounded-md border border-input bg-background outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button
            type="submit"
            disabled={saving}
            className="flex items-center justify-center gap-1.5 text-sm px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md transition-colors shadow-sm disabled:opacity-50 self-start"
          >
            <Apple className="w-3.5 h-3.5" />
            {saving ? "Saving…" : "Connect Apple Mail"}
          </button>
          {error && (
            <p className="flex items-start gap-1.5 text-xs text-destructive">
              <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {error}
            </p>
          )}
        </form>
      ) : (
        <button
          type="button"
          onClick={handleDisconnect}
          className="flex items-center gap-1.5 text-xs px-3 py-2 border border-input rounded-md hover:bg-accent transition-colors text-muted-foreground"
        >
          <Unlink className="w-3.5 h-3.5" /> Disconnect
        </button>
      )}
    </div>
  );
}

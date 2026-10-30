import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckSquare, Check, Loader2, TriangleAlert, Unlink } from "lucide-react";
import { loadClickUpConnection, saveClickUpConnection, clearClickUpConnection, isClickUpConnected, DEFAULTS as CLICKUP_DEFAULTS } from "@/lib/clickupConnection";
import { buildAuthorizationUrl } from "@/lib/clickupOAuth";
import { listSpaces, listLists, testClickUpConnection } from "@/lib/clickupApi";
import { CONNECTOR_AVAILABLE } from "@/lib/connectorAvailability";
import { SettingsCard } from "@/components/ui/settings-card";
import { Input } from "@/components/ui/input";
import ComingSoon from "@/components/shared/ComingSoon";
import { Select } from "@/components/ui/select";

// Picking a default list — unlike Google Calendar's obvious "primary"
// calendar, ClickUp has a real Space -> Folder -> List hierarchy with no
// single default. Two dropdowns (space, then list within it), same
// scannable pattern as any other Settings form field, not a wizard.
function DefaultListPicker({ connection, onSaved }) {
  const [spaces, setSpaces] = useState(null);
  const [spaceId, setSpaceId] = useState("");
  const [lists, setLists] = useState(null);
  const [listId, setListId] = useState(connection.defaultListId || "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    listSpaces(connection)
      .then((s) => {
        setSpaces(s);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const handleSpaceChange = async (id) => {
    setSpaceId(id);
    setLists(null);
    if (!id) return;
    try {
      setLists(await listLists(connection, id));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleListChange = async (id) => {
    setListId(id);
    const list = lists?.find((l) => l.id === id);
    const updated = { ...connection, defaultListId: id, defaultListName: list?.name || "" };
    await saveClickUpConnection(updated);
    onSaved(updated);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading your workspace…
      </div>
    );
  }

  if (error) {
    return (
      <p className="flex items-start gap-1.5 text-xs text-destructive">
        <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {error}
      </p>
    );
  }

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <div>
        <p className="text-xs font-medium mb-1.5">Space</p>
        <Select
          value={spaceId}
          onChange={(e) => handleSpaceChange(e.target.value)}
          className="outline-none focus:ring-1 focus:ring-primary/50 transition-all"
          placeholder="Choose a space…"
          options={spaces.map((s) => ({ value: s.id, label: s.name }))}
        />
      </div>
      <div>
        <p className="text-xs font-medium mb-1.5">Default list</p>
        <Select
          value={listId}
          onChange={(e) => handleListChange(e.target.value)}
          disabled={!lists}
          className="outline-none focus:ring-1 focus:ring-primary/50 transition-all"
          placeholder={lists ? "Choose a list…" : "Pick a space first"}
          options={lists?.map((l) => ({ value: l.id, label: l.folder ? `${l.folder} / ${l.name}` : l.name })) || []}
        />
      </div>
    </div>
  );
}

// The free way in: a personal API token works with exactly the same API
// calls as an OAuth token (both go in the Authorization header), and needs
// no app registered with ClickUp. It's checked against ClickUp before it's
// saved, and it only ever goes to ClickUp and to Vaea Chat's request.
function PersonalTokenForm({ onConnected }) {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const queryClient = useQueryClient();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const accessToken = token.trim();
    if (!accessToken) return;
    setBusy(true);
    setError("");
    try {
      const { workspaceId, workspaceName } = await testClickUpConnection(accessToken);
      const connection = { ...CLICKUP_DEFAULTS, accessToken, workspaceId, workspaceName };
      await saveClickUpConnection(connection);
      setToken("");
      onConnected(connection);
      queryClient.invalidateQueries({ queryKey: ["clickupConnected"] });
    } catch (err) {
      setError(
        /rejected that token/.test(err.message)
          ? "ClickUp didn't accept that token. Copy it again from ClickUp's Apps settings; it starts with pk_."
          : err.message
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-5 pt-5 border-t border-border">
      <label htmlFor="clickup-token" className="text-sm font-medium">Connect with a personal API token</label>
      <p className="text-xs text-muted-foreground mt-1 mb-3">
        In ClickUp, open your avatar menu, then Settings, then Apps, and copy the API token (it starts with pk_). The token can do anything your ClickUp account can; regenerating it in ClickUp disconnects Vaea.
      </p>
      <div className="flex gap-2">
        <Input
          id="clickup-token"
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="pk_…"
          className="font-terminal"
        />
        <button
          type="submit"
          disabled={busy || !token.trim()}
          className="shrink-0 flex items-center gap-1.5 text-sm px-4 py-2 border border-input rounded-md hover:bg-accent transition-colors disabled:opacity-50"
        >
          {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {busy ? "Checking…" : "Connect"}
        </button>
      </div>
      {error && (
        <p className="flex items-start gap-1.5 text-xs text-destructive mt-3">
          <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {error}
        </p>
      )}
    </form>
  );
}

// ClickUp — connects tasks/projects and ClickUp's own team Chat. Same
// one-click OAuth shape as Google Calendar (see clickupOAuth.js for why the
// code exchange itself needs one server round-trip, unlike Calendar's fully
// client-side PKCE flow) — the difference a user actually sees is the
// "which list do new tasks go to" picker after connecting, since ClickUp's
// hierarchy has no obvious single default the way a calendar does.
export default function ClickUpSection() {
  const [connection, setConnection] = useState(CLICKUP_DEFAULTS);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const queryClient = useQueryClient();

  useEffect(() => {
    loadClickUpConnection().then(setConnection);
  }, []);

  const connected = isClickUpConnected(connection);

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
    await clearClickUpConnection();
    setConnection(CLICKUP_DEFAULTS);
    queryClient.invalidateQueries({ queryKey: ["clickupConnected"] });
  };

  return (
    <SettingsCard>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">ClickUp</p>
        {connected && (
          <span className="flex items-center gap-1 text-[11px] text-primary font-medium">
            <Check className="w-3.5 h-3.5" /> Connected to {connection.workspaceName}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Connect ClickUp and Vaea Chat can find or add tasks in a list you pick, and read or post in your ClickUp Chat channels. Deleting a task or posting a message waits for your yes. The connection is stored on this device; nothing about your workspace is kept on Vaea's servers.
      </p>

      {!connected ? (
        <>
          {CONNECTOR_AVAILABLE["clickup-oauth"] ? (
            <button
              type="button"
              onClick={handleConnect}
              disabled={connecting}
              className="flex items-center gap-1.5 text-sm px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md transition-colors shadow-sm disabled:opacity-50"
            >
              {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckSquare className="w-3.5 h-3.5" />}
              {connecting ? "Redirecting to ClickUp…" : "Connect ClickUp"}
            </button>
          ) : (
            <ComingSoon>
              <button
                type="button"
                disabled
                className="flex items-center gap-1.5 text-sm px-4 py-2 bg-primary text-primary-foreground font-medium rounded-md shadow-sm"
              >
                <CheckSquare className="w-3.5 h-3.5" /> Connect ClickUp
              </button>
            </ComingSoon>
          )}
          <PersonalTokenForm onConnected={setConnection} />
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
          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-sm font-medium mb-3">Where new tasks go</p>
            <DefaultListPicker connection={connection} onSaved={setConnection} />
            {connection.defaultListName && (
              <p className="text-xs text-muted-foreground mt-2">Currently: {connection.defaultListName}</p>
            )}
          </div>
        </>
      )}
    </SettingsCard>
  );
}

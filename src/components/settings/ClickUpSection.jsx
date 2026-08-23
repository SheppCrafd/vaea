import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckSquare, Check, ChevronRight, FolderTree, Loader2, MessagesSquare, TriangleAlert, Unlink } from "lucide-react";
import { loadClickUpConnection, saveClickUpConnection, clearClickUpConnection, isClickUpConnected, DEFAULTS as CLICKUP_DEFAULTS } from "@/lib/clickupConnection";
import { buildAuthorizationUrl } from "@/lib/clickupOAuth";
import { listSpaces, listLists } from "@/lib/clickupApi";

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
    <div className="flex flex-col sm:flex-row sm:items-end gap-2">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium mb-1.5">Space</p>
        <select
          value={spaceId}
          onChange={(e) => handleSpaceChange(e.target.value)}
          className="w-full text-sm px-3 py-2 bg-background border border-input rounded-md outline-none focus:ring-1 focus:ring-primary/50 transition-all"
        >
          <option value="">Choose a space…</option>
          {spaces.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>
      <ChevronRight className="hidden sm:block w-3.5 h-3.5 text-muted-foreground shrink-0 mb-2.5" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium mb-1.5">Default list</p>
        <select
          value={listId}
          onChange={(e) => handleListChange(e.target.value)}
          disabled={!lists}
          className="w-full text-sm px-3 py-2 bg-background border border-input rounded-md outline-none focus:ring-1 focus:ring-primary/50 transition-all disabled:opacity-50"
        >
          <option value="">{lists ? "Choose a list…" : "Pick a space first"}</option>
          {lists?.map((l) => (
            <option key={l.id} value={l.id}>{l.folder ? `${l.folder} / ${l.name}` : l.name}</option>
          ))}
        </select>
      </div>
    </div>
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
    <div className="card-enter bg-card border border-foreground/[0.04] rounded-2xl shadow-md p-6">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">ClickUp</p>
        {connected && (
          <span className="flex items-center gap-1 text-[11px] text-primary font-medium">
            <Check className="w-3.5 h-3.5" /> Connected to {connection.workspaceName}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        ClickUp isn't a calendar or an inbox — it's where the actual work lives, so once connected the assistant can
        look up or add tasks in a list you choose below, plus{" "}
        <span className="inline-flex items-center gap-1"><MessagesSquare className="w-3 h-3" />read or post</span>{" "}
        to your ClickUp Chat channels. Moving or deleting anything always goes through the same confirm step any
        other destructive change does. The connection itself lives on this device; the one exception is ClickUp's
        token exchange, which has to pass through Vaea's backend since ClickUp requires a real client secret to
        complete it (unlike Google Calendar's fully local flow) — nothing about your workspace is stored there
        afterward.
      </p>

      {!connected ? (
        <>
          <button
            type="button"
            onClick={handleConnect}
            disabled={connecting}
            className="flex items-center gap-1.5 text-sm px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md transition-colors shadow-sm disabled:opacity-50"
          >
            {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckSquare className="w-3.5 h-3.5" />}
            {connecting ? "Redirecting to ClickUp…" : "Connect ClickUp"}
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
          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-sm font-medium mb-1">Where new tasks go</p>
            <p className="text-xs text-muted-foreground mb-3">
              ClickUp has no single obvious default the way a calendar has "primary" — pick a space, then a list
              within it.
            </p>
            <DefaultListPicker connection={connection} onSaved={setConnection} />
            {connection.defaultListName && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2.5">
                <FolderTree className="w-3.5 h-3.5 shrink-0" />
                <span className="font-terminal">{connection.defaultListName}</span>
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

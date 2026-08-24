import { useEffect, useState } from "react";
import { Loader2, TriangleAlert } from "lucide-react";

// The "here's what's actually connected" panel under every connected
// connector card — a handful of real rows, not a static "Connected" badge.
// Fetched once on mount and again on a manual Refresh click, never polled:
// these are all shared per-project/per-app quotas across every Vaea user, so
// this stays on-demand rather than firing on every render/navigation.
//
// `load` returns the rows to show (and is where a caller does any
// token-refresh bookkeeping); `children` is called with them to render the
// list, since each connector's row layout is deliberately its own — Slack's
// channel sidebar, Gmail's inbox lines, and Calendar's agenda are different
// shapes on purpose.
export default function ConnectorPreview({ title, loadingLabel, emptyLabel, refreshingLabel = "Refreshing…", load, children }) {
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      setItems(await load());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // Mount-only: refreshing again is the Refresh button's job, not a
    // re-render's.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mt-6 pt-6 border-t border-border">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium">{title}</p>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          {loading ? refreshingLabel : "Refresh"}
        </button>
      </div>
      {loading && !items ? (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> {loadingLabel}
        </div>
      ) : error ? (
        <p className="flex items-start gap-1.5 text-xs text-destructive">
          <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {error}
        </p>
      ) : items?.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyLabel}</p>
      ) : (
        children(items || [])
      )}
    </div>
  );
}

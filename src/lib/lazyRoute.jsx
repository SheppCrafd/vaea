import { lazy } from "react";
import { WifiOff } from "lucide-react";

// lazy() for a section of the app loaded on first use. If its code can't be
// downloaded (usually because the device is offline and the section hasn't
// been opened yet), it shows a short message in place of the section
// instead of throwing to the page-wide error screen. React caches the
// result, so the message stays until a reload, which its button offers.
export function OfflineSection({ compact = false }) {
  return (
    <div role="status" className={compact ? "p-4 text-center" : "h-full flex items-center justify-center px-6"}>
      <div className="max-w-sm text-center">
        <WifiOff className="w-5 h-5 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm font-medium text-foreground">This part of Vaea needs a connection the first time you open it</p>
        <p className="text-sm text-muted-foreground mt-1">Your board still works offline. Reconnect, then reload to open this.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 text-sm px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md transition-colors"
        >
          Reload
        </button>
      </div>
    </div>
  );
}

export function lazyRoute(load, { compact = false } = {}) {
  return lazy(() =>
    load().catch((err) => {
      if (!/dynamically imported module|Importing a module script failed|Failed to fetch|error loading dynamically/i.test(err?.message || "")) throw err;
      return { default: () => <OfflineSection compact={compact} /> };
    }),
  );
}

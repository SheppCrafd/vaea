import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, TriangleAlert } from "lucide-react";

// The shared shell behind every connector's OAuth redirect target. None of
// these are dead-end confirmation screens: each runs its provider's own
// `connect` (exchange the code, resolve whatever identity the Settings card
// wants to show, save the connection) and bounces straight back to Settings
// the moment it's done, so a one-click "Connect" actually feels like one
// click. Only the icon, the in-progress wording, and `connect` itself differ
// per provider — everything else here is identical across all of them.
export default function OAuthCallbackPage({ Icon, message, connect }) {
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        await connect(new URLSearchParams(window.location.search));
        navigate("/app/settings", { replace: true });
      } catch (err) {
        setError(err.message || "Something went wrong.");
      }
    })();
    // `connect` is a per-page constant; re-running on identity changes would
    // repeat the one-shot code exchange.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  return (
    <div className="h-full flex items-center justify-center px-6">
      <div className="max-w-sm text-center">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          {error ? (
            <Icon className="w-5 h-5 text-primary" />
          ) : (
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          )}
        </div>
        {error ? (
          <>
            <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-destructive mb-1">
              <TriangleAlert className="w-4 h-4" /> Couldn't connect
            </p>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <button
              type="button"
              onClick={() => navigate("/app/settings", { replace: true })}
              className="text-sm px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md transition-colors shadow-sm"
            >
              Back to Settings
            </button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{message}</p>
        )}
      </div>
    </div>
  );
}

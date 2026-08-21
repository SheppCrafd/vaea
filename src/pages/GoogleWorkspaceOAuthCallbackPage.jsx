import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LayoutGrid, Loader2, TriangleAlert } from "lucide-react";
import { exchangeCodeForTokens } from "@/lib/googleWorkspaceOAuthPkce";
import { saveGoogleWorkspaceConnection } from "@/lib/googleWorkspaceConnection";

// Where Google redirects back to after the user allows (or denies) Workspace
// access. Not a dead-end confirmation screen — it exchanges the code, looks
// up the connected address (userinfo.email is part of the connector's
// scope), saves the connection, and bounces straight back to Settings the
// moment it's done, so the one-click "Connect" flow actually feels like one
// click.
export default function GoogleWorkspaceOAuthCallbackPage() {
  const [state, setState] = useState("working"); // working | error
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const tokens = await exchangeCodeForTokens(new URLSearchParams(window.location.search));
        let email = "";
        try {
          const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: { Authorization: `Bearer ${tokens.accessToken}` },
          });
          if (res.ok) email = (await res.json()).email || "";
        } catch {
          // best-effort — a missing email just means the Settings card shows "Connected" instead
        }
        await saveGoogleWorkspaceConnection({ ...tokens, calendarId: "primary", email });
        navigate("/app/settings", { replace: true });
      } catch (err) {
        setState("error");
        setError(err.message);
      }
    })();
  }, [navigate]);

  return (
    <div className="h-full flex items-center justify-center px-6">
      <div className="max-w-sm text-center">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          {state === "working" ? (
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          ) : (
            <LayoutGrid className="w-5 h-5 text-primary" />
          )}
        </div>
        {state === "working" ? (
          <p className="text-sm text-muted-foreground">Connecting Google Workspace…</p>
        ) : (
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
        )}
      </div>
    </div>
  );
}

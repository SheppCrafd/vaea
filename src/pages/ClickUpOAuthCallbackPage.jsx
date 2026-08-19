import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckSquare, Loader2, TriangleAlert } from "lucide-react";
import { exchangeCode } from "@/lib/clickupOAuth";
import { saveClickUpConnection } from "@/lib/clickupConnection";

// Where ClickUp redirects back to after the user allows (or denies) access.
// Exchanges the code via exchangeClickUpToken (the one server-side step
// this flow needs, since ClickUp's exchange requires a client secret — see
// that function's own comment), saves the connection, and bounces straight
// back to Settings.
export default function ClickUpOAuthCallbackPage() {
  const [state, setState] = useState("working"); // working | error
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const { accessToken, workspaceId, workspaceName } = await exchangeCode(new URLSearchParams(window.location.search));
        await saveClickUpConnection({ accessToken, workspaceId, workspaceName });
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
            <CheckSquare className="w-5 h-5 text-primary" />
          )}
        </div>
        {state === "working" ? (
          <p className="text-sm text-muted-foreground">Connecting your ClickUp workspace…</p>
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

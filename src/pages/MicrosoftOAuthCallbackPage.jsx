import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Loader2, TriangleAlert } from "lucide-react";
import { exchangeCodeForTokens } from "@/lib/microsoftOAuthPkce";
import { saveMicrosoftConnection } from "@/lib/microsoftConnection";
import { testMicrosoftConnection } from "@/lib/microsoftGraphApi";

// Mirrors CalendarOAuthCallbackPage.jsx / GmailOAuthCallbackPage.jsx —
// exchange the code, resolve the real signed-in address, save, bounce back.
export default function MicrosoftOAuthCallbackPage() {
  const [state, setState] = useState("working"); // working | error
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const tokens = await exchangeCodeForTokens(new URLSearchParams(window.location.search));
        const { emailAddress } = await testMicrosoftConnection(tokens);
        await saveMicrosoftConnection({ ...tokens, emailAddress });
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
            <Building2 className="w-5 h-5 text-primary" />
          )}
        </div>
        {state === "working" ? (
          <p className="text-sm text-muted-foreground">Connecting your Microsoft account…</p>
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

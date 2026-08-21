import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Loader2, TriangleAlert } from "lucide-react";
import { exchangeCodeForTokens } from "@/lib/gmailOAuthPkce";
import { saveGmailConnection } from "@/lib/gmailConnection";
import { testGmailConnection } from "@/lib/gmailApi";

// Mirrors GoogleWorkspaceOAuthCallbackPage.jsx — exchange the code, resolve the
// real connected address via testGmailConnection so the Settings card can
// show it right away, save, bounce back.
export default function GmailOAuthCallbackPage() {
  const [state, setState] = useState("working"); // working | error
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const tokens = await exchangeCodeForTokens(new URLSearchParams(window.location.search));
        const { emailAddress } = await testGmailConnection(tokens);
        await saveGmailConnection({ ...tokens, emailAddress });
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
            <Mail className="w-5 h-5 text-primary" />
          )}
        </div>
        {state === "working" ? (
          <p className="text-sm text-muted-foreground">Connecting Gmail…</p>
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

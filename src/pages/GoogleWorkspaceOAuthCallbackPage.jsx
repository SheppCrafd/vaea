import { LayoutGrid } from "lucide-react";
import OAuthCallbackPage from "@/pages/OAuthCallbackPage";
import { exchangeCodeForTokens } from "@/lib/googleWorkspaceOAuthPkce";
import { saveGoogleWorkspaceConnection } from "@/lib/googleWorkspaceConnection";

async function connect(params) {
  const tokens = await exchangeCodeForTokens(params);
  let email = "";
  try {
    // userinfo.email is part of the connector's scope.
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });
    if (res.ok) email = (await res.json()).email || "";
  } catch {
    // best-effort — a missing email just means the Settings card shows "Connected"
  }
  await saveGoogleWorkspaceConnection({ ...tokens, calendarId: "primary", email });
}

export default function GoogleWorkspaceOAuthCallbackPage() {
  return <OAuthCallbackPage Icon={LayoutGrid} message="Connecting Google Workspace…" connect={connect} />;
}

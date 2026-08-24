import { CheckSquare } from "lucide-react";
import OAuthCallbackPage from "@/pages/OAuthCallbackPage";
import { exchangeCode } from "@/lib/clickupOAuth";
import { saveClickUpConnection } from "@/lib/clickupConnection";

// Exchanges the code via exchangeClickUpToken — the one server-side step this
// flow needs, since ClickUp's exchange requires a client secret (see that
// function's own comment).
async function connect(params) {
  const { accessToken, workspaceId, workspaceName } = await exchangeCode(params);
  await saveClickUpConnection({ accessToken, workspaceId, workspaceName });
}

export default function ClickUpOAuthCallbackPage() {
  return <OAuthCallbackPage Icon={CheckSquare} message="Connecting your ClickUp workspace…" connect={connect} />;
}

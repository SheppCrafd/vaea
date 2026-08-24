import { Mail } from "lucide-react";
import OAuthCallbackPage from "@/pages/OAuthCallbackPage";
import { exchangeCodeForTokens } from "@/lib/outlookOAuthPkce";
import { saveOutlookConnection } from "@/lib/outlookConnection";
import { testMicrosoftConnection } from "@/lib/microsoftGraphApi";

// The same generic Graph "/me" call MicrosoftOAuthCallbackPage uses resolves
// the signed-in address regardless of which scope grant (Calendar vs Mail)
// was just exchanged.
async function connect(params) {
  const tokens = await exchangeCodeForTokens(params);
  const { emailAddress } = await testMicrosoftConnection(tokens);
  await saveOutlookConnection({ ...tokens, emailAddress });
}

export default function OutlookOAuthCallbackPage() {
  return <OAuthCallbackPage Icon={Mail} message="Connecting your Outlook mail…" connect={connect} />;
}

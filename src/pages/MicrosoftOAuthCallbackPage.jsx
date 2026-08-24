import { Building2 } from "lucide-react";
import OAuthCallbackPage from "@/pages/OAuthCallbackPage";
import { exchangeCodeForTokens } from "@/lib/microsoftOAuthPkce";
import { saveMicrosoftConnection } from "@/lib/microsoftConnection";
import { testMicrosoftConnection } from "@/lib/microsoftGraphApi";

async function connect(params) {
  const tokens = await exchangeCodeForTokens(params);
  const { emailAddress } = await testMicrosoftConnection(tokens);
  await saveMicrosoftConnection({ ...tokens, emailAddress });
}

export default function MicrosoftOAuthCallbackPage() {
  return <OAuthCallbackPage Icon={Building2} message="Connecting your Microsoft account…" connect={connect} />;
}

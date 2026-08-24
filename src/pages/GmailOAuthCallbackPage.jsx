import { Mail } from "lucide-react";
import OAuthCallbackPage from "@/pages/OAuthCallbackPage";
import { exchangeCodeForTokens } from "@/lib/gmailOAuthPkce";
import { saveGmailConnection } from "@/lib/gmailConnection";
import { testGmailConnection } from "@/lib/gmailApi";

// Resolves the real connected address via testGmailConnection so the Settings
// card can show it right away.
async function connect(params) {
  const tokens = await exchangeCodeForTokens(params);
  const { emailAddress } = await testGmailConnection(tokens);
  await saveGmailConnection({ ...tokens, emailAddress });
}

export default function GmailOAuthCallbackPage() {
  return <OAuthCallbackPage Icon={Mail} message="Connecting Gmail…" connect={connect} />;
}

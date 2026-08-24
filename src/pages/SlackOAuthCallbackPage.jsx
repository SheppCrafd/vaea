import { Hash } from "lucide-react";
import OAuthCallbackPage from "@/pages/OAuthCallbackPage";
import { exchangeCode } from "@/lib/slackOAuth";
import { saveSlackConnection } from "@/lib/slackConnection";

async function connect(params) {
  await saveSlackConnection(await exchangeCode(params));
}

export default function SlackOAuthCallbackPage() {
  return <OAuthCallbackPage Icon={Hash} message="Connecting Slack…" connect={connect} />;
}

// Slack OAuth — Slack's token endpoint requires client_id + client_secret
// (confirmed: no PKCE public-client option), so this uses the shared
// server-side-exchange flow in serverExchangeOAuth.js, same as ClickUp.
import { createServerExchangeOAuthClient } from "@/lib/serverExchangeOAuth";

// User scopes for reading channels and posting as the user. Bot scopes
// (scope=) would let Vaea post as a bot, which is a different UX — user scopes
// means messages show up as coming from the actual person.
const USER_SCOPE = "channels:read,channels:history,chat:write";

const client = createServerExchangeOAuthClient({
  authorizeUrl: "https://slack.com/oauth/v2/authorize",
  clientId: import.meta.env.VITE_SLACK_CLIENT_ID,
  stateKey: "vaea_slack_oauth_state",
  callbackPath: "/app/settings/slack-callback",
  exchangePath: "/exchangeSlackToken",
  providerName: "Slack",
  authParams: { user_scope: USER_SCOPE },
});

export const buildAuthorizationUrl = client.buildAuthorizationUrl;
// Resolves to { accessToken, workspaceId, workspaceName, userId, username }.
export const exchangeCode = client.exchangeCode;

// ClickUp's OAuth flow — its token exchange requires a real client secret
// (confirmed against ClickUp's own docs: "Use the Get Access Token endpoint
// with client_id, client_secret, and code"), so this uses the shared
// server-side-exchange flow in serverExchangeOAuth.js, same as Slack.
import { createServerExchangeOAuthClient } from "@/lib/serverExchangeOAuth";

const client = createServerExchangeOAuthClient({
  authorizeUrl: "https://app.clickup.com/api",
  clientId: import.meta.env.VITE_CLICKUP_CLIENT_ID,
  stateKey: "vaea_clickup_oauth_state",
  callbackPath: "/app/settings/clickup-callback",
  exchangePath: "/exchangeClickUpToken",
  providerName: "ClickUp",
});

export const buildAuthorizationUrl = client.buildAuthorizationUrl;
// Resolves to { accessToken, workspaceId, workspaceName }.
export const exchangeCode = client.exchangeCode;

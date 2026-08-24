// PKCE OAuth against Microsoft's identity platform, requesting ONLY mail
// scopes — the Outlook-mail half of what used to be one combined
// Calendar+Mail+Teams grant (see microsoftOAuthPkce.js for that history). Same
// shared, Vaea-owned Azure AD app/client id as microsoftOAuthPkce.js — this is
// a second, independently-consented redirect off the SAME app registration, not
// a new app. The one setup step this needs that Calendar didn't: this callback
// path (below) has to be added as a second redirect URI on that existing Azure
// app registration (Azure Portal -> App registrations -> Authentication -> Add
// URI) — a one-line addition, not a new registration.
import { createPkceOAuthClient } from "@/lib/pkceOAuth";

const SCOPE = "offline_access openid Mail.Read Mail.Send";

const client = createPkceOAuthClient({
  authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
  tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
  clientId: import.meta.env.VITE_MICROSOFT_CLIENT_ID,
  scope: SCOPE,
  storagePrefix: "vaea_outlook",
  callbackPath: "/app/settings/outlook-callback",
  providerName: "Microsoft",
  deniedMessage: "Outlook access wasn't granted.",
  tokenParams: { scope: SCOPE },
});

export const buildAuthorizationUrl = client.buildAuthorizationUrl;
export const exchangeCodeForTokens = client.exchangeCodeForTokens;
export const refreshAccessToken = client.refreshAccessToken;

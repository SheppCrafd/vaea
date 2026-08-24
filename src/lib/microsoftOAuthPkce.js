// PKCE OAuth against Microsoft's identity platform, using ONE shared,
// Vaea-owned Azure AD app registration — same "no per-user setup" principle as
// the Google connectors' shared client. See pkceOAuth.js for the shared flow.
//
// The one thing that's NOT a copy-paste of the Google version: which Azure
// platform type the redirect URI is registered under matters a lot here.
// Registering it as a "Single-page application" redirect gets you PKCE with no
// client secret too, but Microsoft caps THAT flow's refresh token at 24 hours,
// forcing a re-auth (often invisible, via an iframe — but not always, e.g.
// Safari's third-party-cookie blocking) once a day. Registering the SAME
// redirect URI under "Mobile and desktop applications" instead is still a
// genuine public client (no secret, "Allow public client flows" = Yes) but gets
// the normal long-lived refresh token, same as Google's "Desktop app"
// credential type. That's the one to use here — worth calling out clearly in
// the setup guide so it isn't picked wrong later.
//
// Tenant is "common" (work/school AND personal Microsoft/Outlook.com accounts).
// Scope is Calendar + Teams-meeting-link only — Outlook/Exchange mail is a
// separate, independently-consented grant off this same Azure app, requested by
// outlookOAuthPkce.js instead, so a user can connect one without the other.
import { createPkceOAuthClient } from "@/lib/pkceOAuth";

const SCOPE = "offline_access openid Calendars.ReadWrite";

const client = createPkceOAuthClient({
  authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
  tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
  clientId: import.meta.env.VITE_MICROSOFT_CLIENT_ID,
  scope: SCOPE,
  storagePrefix: "vaea_microsoft",
  callbackPath: "/app/settings/microsoft-callback",
  providerName: "Microsoft",
  deniedMessage: "Microsoft access wasn't granted.",
  // Microsoft wants the scope repeated on the token/refresh request too.
  tokenParams: { scope: SCOPE },
});

export const buildAuthorizationUrl = client.buildAuthorizationUrl;
export const exchangeCodeForTokens = client.exchangeCodeForTokens;
export const refreshAccessToken = client.refreshAccessToken;

// PKCE OAuth for the Google Workspace connector — one consent screen covering
// Calendar, Drive, Docs, Sheets, Slides, Tasks, and Forms, against a public
// "Desktop app" OAuth client: no client secret exists, so PKCE is what proves
// this specific browser tab requested the code being exchanged. See
// pkceOAuth.js for the shared flow.
//
// Gmail is intentionally excluded from this scope list — see gmailOAuthPkce.js,
// which runs its own independent flow.
import { createPkceOAuthClient } from "@/lib/pkceOAuth";

const client = createPkceOAuthClient({
  authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  clientId: import.meta.env.VITE_GOOGLE_CALENDAR_CLIENT_ID,
  scope: [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/documents",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/presentations",
    "https://www.googleapis.com/auth/tasks",
    "https://www.googleapis.com/auth/forms.body",
    "https://www.googleapis.com/auth/forms.responses.readonly",
    "https://www.googleapis.com/auth/userinfo.email",
  ].join(" "),
  storagePrefix: "vaea_workspace",
  callbackPath: "/app/settings/google-callback",
  providerName: "Google",
  deniedMessage: "Google Workspace access wasn't granted.",
  // Google only issues a refresh token when asked for offline access.
  authParams: { access_type: "offline" },
});

export const buildAuthorizationUrl = client.buildAuthorizationUrl;
export const exchangeCodeForTokens = client.exchangeCodeForTokens;

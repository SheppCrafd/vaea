// PKCE OAuth for Gmail — reuses the exact same Google Cloud OAuth client as
// Workspace (VITE_GOOGLE_CALENDAR_CLIENT_ID; one Google Cloud project's
// "Desktop app" credential covers any scope, not just Calendar's — the name is
// a holdover from building Calendar first, not a real limit) but runs its own
// independent consent flow with only Gmail's scope, its own sessionStorage
// keys, and its own callback route — so connecting one never silently grants
// the other. See pkceOAuth.js for the shared flow.
import { createPkceOAuthClient } from "@/lib/pkceOAuth";

const client = createPkceOAuthClient({
  authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  clientId: import.meta.env.VITE_GOOGLE_CALENDAR_CLIENT_ID,
  scope: "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send",
  storagePrefix: "vaea_gmail",
  callbackPath: "/app/settings/gmail-callback",
  providerName: "Google",
  deniedMessage: "Gmail access wasn't granted.",
  authParams: { access_type: "offline" },
});

export const buildAuthorizationUrl = client.buildAuthorizationUrl;
export const exchangeCodeForTokens = client.exchangeCodeForTokens;

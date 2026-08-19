// PKCE (Proof Key for Code Exchange) helpers for the Google Calendar
// connector's Authorization Code flow — see the plan's rationale for using
// a public "Desktop app" OAuth client: no client secret exists, so PKCE is
// what proves this specific browser tab requested the code being exchanged.
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/calendar";
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CALENDAR_CLIENT_ID;

const VERIFIER_KEY = "vaea_calendar_pkce_verifier";
const STATE_KEY = "vaea_calendar_pkce_state";

function base64UrlEncode(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function randomString(byteLength) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function sha256Base64Url(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return base64UrlEncode(new Uint8Array(digest));
}

function callbackUrl() {
  return `${window.location.origin}/app/settings/calendar-callback`;
}

// Builds the consent-screen URL and stashes the verifier + state in
// sessionStorage (this tab, this visit only — never written to
// deviceStorage, since it's worthless the moment the redirect completes).
// Callers should navigate to the returned URL directly.
export async function buildAuthorizationUrl() {
  const verifier = randomString(32);
  const state = randomString(16);
  const challenge = await sha256Base64Url(verifier);

  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(STATE_KEY, state);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: callbackUrl(),
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
  });
  return `${AUTH_URL}?${params}`;
}

// Called from CalendarOAuthCallbackPage.jsx once Google redirects back with
// ?code=...&state=.... Validates state (CSRF/mixed-tab protection), then
// exchanges the code for tokens — public client, no secret.
export async function exchangeCodeForTokens(searchParams) {
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const expectedState = sessionStorage.getItem(STATE_KEY);
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  sessionStorage.removeItem(STATE_KEY);
  sessionStorage.removeItem(VERIFIER_KEY);

  if (error) throw new Error(error === "access_denied" ? "Calendar access wasn't granted." : `Google returned an error: ${error}`);
  if (!code) throw new Error("Google didn't send back an authorization code.");
  if (!state || state !== expectedState) throw new Error("This connection attempt doesn't match the one that started — try connecting again.");
  if (!verifier) throw new Error("This connection attempt expired — try connecting again.");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      code,
      code_verifier: verifier,
      grant_type: "authorization_code",
      redirect_uri: callbackUrl(),
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error_description || `Google rejected the connection (${res.status}).`);
  }
  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

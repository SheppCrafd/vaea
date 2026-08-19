// PKCE OAuth against Microsoft's identity platform, using ONE shared,
// Vaea-owned Azure AD app registration — same "no per-user setup" principle
// as Google Calendar/Gmail's shared client (see googleOAuthPkce.js).
//
// The one thing that's NOT a copy-paste of the Google version: which Azure
// platform type the redirect URI is registered under matters a lot here.
// Registering it as a "Single-page application" redirect gets you PKCE with
// no client secret too, but Microsoft caps THAT flow's refresh token at 24
// hours, forcing a re-auth (often invisible, via an iframe — but not always,
// e.g. Safari's third-party-cookie blocking) once a day. Registering the
// SAME redirect URI under "Mobile and desktop applications" instead is
// still a genuine public client (no secret, "Allow public client flows" =
// Yes) but gets the normal long-lived refresh token, same as Google's
// "Desktop app" credential type. That's the one to use here — worth calling
// out clearly in the setup guide so it isn't picked wrong later.
//
// Tenant is "common" (work/school AND personal Microsoft/Outlook.com
// accounts) since Outlook/Exchange email was explicitly in scope, not just
// Microsoft 365 work accounts.
const AUTH_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const SCOPE = "offline_access openid Calendars.ReadWrite Mail.Read Mail.Send";
const CLIENT_ID = import.meta.env.VITE_MICROSOFT_CLIENT_ID;

const VERIFIER_KEY = "vaea_microsoft_pkce_verifier";
const STATE_KEY = "vaea_microsoft_pkce_state";

function base64UrlEncode(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
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
  return `${window.location.origin}/app/settings/microsoft-callback`;
}

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
    prompt: "consent",
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
  });
  return `${AUTH_URL}?${params}`;
}

export async function exchangeCodeForTokens(searchParams) {
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const expectedState = sessionStorage.getItem(STATE_KEY);
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  sessionStorage.removeItem(STATE_KEY);
  sessionStorage.removeItem(VERIFIER_KEY);

  if (error) throw new Error(error === "access_denied" ? "Microsoft access wasn't granted." : errorDescription || `Microsoft returned an error: ${error}`);
  if (!code) throw new Error("Microsoft didn't send back an authorization code.");
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
      scope: SCOPE,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error_description || `Microsoft rejected the connection (${res.status}).`);
  }
  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

export async function refreshAccessToken(refreshToken) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CLIENT_ID, refresh_token: refreshToken, grant_type: "refresh_token", scope: SCOPE }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error_description || `Microsoft rejected the refresh (${res.status}).`);
  }
  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

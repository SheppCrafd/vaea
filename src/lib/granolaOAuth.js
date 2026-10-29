// Sign-in for Granola, through the OAuth server in front of its MCP server
// (mcp.granola.ai). Unlike Google or Microsoft there's no Vaea-owned client
// ID to provision: Granola supports Dynamic Client Registration, so each
// browser origin registers itself once and keeps the client ID it gets back.
// Works on every Granola plan; what the user can read (how far back, whether
// transcripts are included) follows their own Granola plan.
//
// Granola's OAuth server answers registration and token requests without
// CORS headers, so those two calls go through the granolaAuth base44
// function. PKCE, state and the redirect stay in the browser, and the MCP
// server itself allows browser calls (see granolaMcp.js).
import { base44 } from "@/api/base44Client";
import { randomString, sha256Base64Url } from "@/lib/pkceOAuth";
import { loadGranolaRegistration, saveGranolaRegistration } from "@/lib/granolaConnection";

export const MCP_URL = "https://mcp.granola.ai/mcp";
const AUTHORIZE_URL = "https://mcp-auth.granola.ai/oauth2/authorize";
const CALLBACK_PATH = "/app/settings/granola-callback";
// "mcp" is the scope the MCP server's resource metadata advertises;
// offline_access asks for a refresh token so the user signs in once.
const SCOPE = "mcp offline_access";
const VERIFIER_KEY = "vaea_granola_pkce_verifier";
const STATE_KEY = "vaea_granola_pkce_state";

const callbackUrl = () => `${window.location.origin}${CALLBACK_PATH}`;

async function relay(action, params) {
  const res = await base44.functions.fetch("/granolaAuth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, params }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && data.error) throw new Error(data.error);
  if (!res.ok) {
    if (data.error === "invalid_grant") throw new Error("Your Granola sign-in expired. Reconnect Granola in Settings.");
    throw new Error(data.error_description || data.error || `Granola sign-in failed (${res.status}).`);
  }
  return data;
}

// Registers this origin with Granola the first time, then reuses the ID.
// A different origin (preview vs production) needs its own registration,
// because Granola only redirects back to the URI it was registered with.
export async function ensureClientId() {
  const saved = await loadGranolaRegistration();
  if (saved.clientId && saved.redirectUri === callbackUrl()) return saved.clientId;
  const { client_id: clientId } = await relay("register", {
    client_name: "Vaea",
    redirect_uris: [callbackUrl()],
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    scope: SCOPE,
  });
  if (!clientId) throw new Error("Granola didn't return a client ID. Try connecting again.");
  await saveGranolaRegistration({ clientId, redirectUri: callbackUrl() });
  return clientId;
}

// Some token responses omit expires_in; assume an hour so the token is
// refreshed rather than trusted forever.
export function readTokens(data, previous = {}) {
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || previous.refreshToken || "",
    expiresAt: Date.now() + (Number(data.expires_in) > 0 ? Number(data.expires_in) : 3600) * 1000,
  };
}

export async function buildAuthorizationUrl() {
  const clientId = await ensureClientId();
  const verifier = randomString(32);
  const state = randomString(16);
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(STATE_KEY, state);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl(),
    response_type: "code",
    scope: SCOPE,
    code_challenge: await sha256Base64Url(verifier),
    code_challenge_method: "S256",
    state,
    // RFC 8707: name the MCP server the token is for.
    resource: MCP_URL,
  });
  return `${AUTHORIZE_URL}?${params}`;
}

export async function exchangeCodeForTokens(searchParams) {
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const expectedState = sessionStorage.getItem(STATE_KEY);
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  sessionStorage.removeItem(STATE_KEY);
  sessionStorage.removeItem(VERIFIER_KEY);

  if (error) throw new Error(error === "access_denied" ? "Granola access wasn't granted." : searchParams.get("error_description") || `Granola returned an error: ${error}`);
  if (!code) throw new Error("Granola didn't send back an authorization code.");
  if (!state || state !== expectedState) throw new Error("This connection attempt doesn't match the one that started. Try connecting again.");
  if (!verifier) throw new Error("This connection attempt expired. Try connecting again.");

  const { clientId } = await loadGranolaRegistration();
  if (!clientId) throw new Error("This connection attempt expired. Go back to Settings and connect Granola again.");
  const data = await relay("token", {
    grant_type: "authorization_code",
    code,
    code_verifier: verifier,
    client_id: clientId,
    redirect_uri: callbackUrl(),
  });
  return { clientId, ...readTokens(data) };
}

export async function refreshGranolaTokens(connection) {
  if (!connection.refreshToken) throw new Error("Your Granola sign-in expired. Reconnect Granola in Settings.");
  const data = await relay("token", {
    grant_type: "refresh_token",
    refresh_token: connection.refreshToken,
    client_id: connection.clientId,
  });
  return { ...connection, ...readTokens(data, connection) };
}

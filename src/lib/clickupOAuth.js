// ClickUp's OAuth flow — unlike Google Calendar's PKCE-only public client,
// ClickUp's token exchange requires a real client secret (confirmed against
// ClickUp's own docs: "Use the Get Access Token endpoint with client_id,
// client_secret, and code"). So the redirect/consent half stays entirely
// client-side (nothing secret in it — just a public client_id and a state
// value for CSRF protection, same idea as calendar's PKCE state, minus the
// PKCE part since it isn't needed/supported here), but the actual code->token
// exchange has to go through base44/functions/exchangeClickUpToken, where the
// secret actually lives (via `base44 secrets set`, read with Deno.env.get).
import { base44 } from "@/api/base44Client";

const AUTHORIZE_URL = "https://app.clickup.com/api";
const CLIENT_ID = import.meta.env.VITE_CLICKUP_CLIENT_ID;

const STATE_KEY = "vaea_clickup_oauth_state";

function randomState() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function callbackUrl() {
  return `${window.location.origin}/app/settings/clickup-callback`;
}

export function buildAuthorizationUrl() {
  const state = randomState();
  sessionStorage.setItem(STATE_KEY, state);
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: callbackUrl(),
    state,
  });
  return `${AUTHORIZE_URL}?${params}`;
}

// Called from ClickUpOAuthCallbackPage.jsx. Validates state, then hands the
// code to exchangeClickUpToken (an authenticated base44 function — needs
// the user's own Base44 session, same as any other base44.functions call)
// rather than talking to ClickUp's token endpoint directly, since that step
// needs the client secret this browser never has.
export async function exchangeCode(searchParams) {
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const expectedState = sessionStorage.getItem(STATE_KEY);
  sessionStorage.removeItem(STATE_KEY);

  if (error) throw new Error("ClickUp access wasn't granted.");
  if (!code) throw new Error("ClickUp didn't send back an authorization code.");
  if (!state || state !== expectedState) throw new Error("This connection attempt doesn't match the one that started — try connecting again.");

  const response = await base44.functions.fetch("/exchangeClickUpToken", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, redirect_uri: callbackUrl() }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `ClickUp connection failed (${response.status}).`);
  return data; // { accessToken, workspaceId, workspaceName }
}

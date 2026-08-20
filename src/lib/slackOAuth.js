// Slack OAuth — mirrors clickupOAuth.js's server-side-token-exchange
// pattern exactly. Slack's token endpoint requires client_id + client_secret
// (confirmed: no PKCE public-client option), so the code→token step goes
// through base44/functions/exchangeSlackToken rather than directly from the
// browser. The authorize redirect itself is purely client-side (state for
// CSRF, public client_id, no secret needed before the token exchange).
import { base44 } from "@/api/base44Client";

const AUTHORIZE_URL = "https://slack.com/oauth/v2/authorize";
const CLIENT_ID = import.meta.env.VITE_SLACK_CLIENT_ID;
const STATE_KEY = "vaea_slack_oauth_state";

// User scopes for reading channels and posting as the user.
// Bot scopes (scope=) would let Vaea post as a bot, which is a different
// UX — user scopes means messages show up as coming from the actual person.
const USER_SCOPE = "channels:read,channels:history,chat:write";

function randomState() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function callbackUrl() {
  return `${window.location.origin}/app/settings/slack-callback`;
}

export function buildAuthorizationUrl() {
  const state = randomState();
  sessionStorage.setItem(STATE_KEY, state);
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    user_scope: USER_SCOPE,
    redirect_uri: callbackUrl(),
    state,
  });
  return `${AUTHORIZE_URL}?${params}`;
}

export async function exchangeCode(searchParams) {
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const expectedState = sessionStorage.getItem(STATE_KEY);
  sessionStorage.removeItem(STATE_KEY);

  if (error) throw new Error("Slack access wasn't granted.");
  if (!code) throw new Error("Slack didn't send back an authorization code.");
  if (!state || state !== expectedState) throw new Error("This connection attempt doesn't match the one that started — try connecting again.");

  const response = await base44.functions.fetch("/exchangeSlackToken", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, redirect_uri: callbackUrl() }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Slack connection failed (${response.status}).`);
  return data; // { accessToken, workspaceId, workspaceName, userId, username }
}

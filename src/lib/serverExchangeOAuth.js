// OAuth for the providers whose token exchange requires a real client secret
// (Slack and ClickUp — neither offers a PKCE public-client option, unlike the
// Google/Microsoft connectors in pkceOAuth.js). The redirect/consent half
// stays entirely client-side, since nothing in it is secret: just a public
// client id plus a `state` value for CSRF protection. The code->token step is
// the ONE part that has to go through a base44 function, where the secret
// actually lives (via `base44 secrets set`, read with Deno.env.get).
import { base44 } from "@/api/base44Client";

function randomState() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * @param authorizeUrl  provider's consent-screen endpoint
 * @param clientId      public client id (the secret never reaches the browser)
 * @param stateKey      sessionStorage key holding this attempt's state value
 * @param callbackPath  app-relative redirect path, resolved against the origin
 * @param exchangePath  base44 function that performs the secret-bearing exchange
 * @param providerName  human name used in error copy ("Slack")
 * @param authParams    extra params for the authorize URL
 */
export function createServerExchangeOAuthClient({
  authorizeUrl,
  clientId,
  stateKey,
  callbackPath,
  exchangePath,
  providerName,
  authParams = {},
}) {
  const callbackUrl = () => `${window.location.origin}${callbackPath}`;

  function buildAuthorizationUrl() {
    const state = randomState();
    sessionStorage.setItem(stateKey, state);
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl(),
      state,
      ...authParams,
    });
    return `${authorizeUrl}?${params}`;
  }

  // Called from the connector's callback page. Validates state, then hands the
  // code to the exchange function (an authenticated base44 function — needs the
  // user's own Base44 session, same as any other base44.functions call) rather
  // than talking to the provider's token endpoint directly.
  async function exchangeCode(searchParams) {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    const expectedState = sessionStorage.getItem(stateKey);
    sessionStorage.removeItem(stateKey);

    if (error) throw new Error(`${providerName} access wasn't granted.`);
    if (!code) throw new Error(`${providerName} didn't send back an authorization code.`);
    if (!state || state !== expectedState) throw new Error("This connection attempt doesn't match the one that started — try connecting again.");

    const response = await base44.functions.fetch(exchangePath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, redirect_uri: callbackUrl() }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `${providerName} connection failed (${response.status}).`);
    return data;
  }

  return { buildAuthorizationUrl, exchangeCode };
}

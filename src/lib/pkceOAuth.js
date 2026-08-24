// PKCE (Proof Key for Code Exchange) Authorization Code flow, shared by every
// connector that talks to a public OAuth client — Google Workspace, Gmail,
// Microsoft (Calendar/Teams), and Outlook mail. All four are public clients
// with no client secret, so PKCE is what proves that this specific browser tab
// requested the code being exchanged.
//
// Only the endpoints, scope, client id, callback path, and a couple of
// provider-specific request params differ between them; everything else — the
// verifier/state generation, the sessionStorage handoff across the redirect,
// state validation, and the token-response shape — is identical, and lives
// here once.
//
// The verifier and state go in sessionStorage (this tab, this visit only —
// never deviceStorage, since both are worthless the moment the redirect
// completes).

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

async function readTokens(res, providerName, action) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error_description || `${providerName} rejected the ${action} (${res.status}).`);
  }
  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

/**
 * @param authUrl        provider's authorize endpoint
 * @param tokenUrl       provider's token endpoint
 * @param clientId       public client id (no secret exists for these)
 * @param scope          space-separated scope string
 * @param storagePrefix  namespaces this connector's sessionStorage keys, so
 *                       connecting one provider never clobbers another's
 *                       in-flight attempt
 * @param callbackPath   app-relative redirect path, resolved against the
 *                       current origin
 * @param providerName   human name used in generic error copy ("Google")
 * @param deniedMessage  shown when the user declines at the consent screen
 * @param authParams     extra params for the authorize URL
 * @param tokenParams    extra params for the token request body
 */
export function createPkceOAuthClient({
  authUrl,
  tokenUrl,
  clientId,
  scope,
  storagePrefix,
  callbackPath,
  providerName,
  deniedMessage,
  authParams = {},
  tokenParams = {},
}) {
  const VERIFIER_KEY = `${storagePrefix}_pkce_verifier`;
  const STATE_KEY = `${storagePrefix}_pkce_state`;
  const callbackUrl = () => `${window.location.origin}${callbackPath}`;

  async function buildAuthorizationUrl() {
    const verifier = randomString(32);
    const state = randomString(16);
    const challenge = await sha256Base64Url(verifier);

    sessionStorage.setItem(VERIFIER_KEY, verifier);
    sessionStorage.setItem(STATE_KEY, state);

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl(),
      response_type: "code",
      scope,
      prompt: "consent",
      code_challenge: challenge,
      code_challenge_method: "S256",
      state,
      ...authParams,
    });
    return `${authUrl}?${params}`;
  }

  // Called from the connector's callback page once the provider redirects back
  // with ?code=...&state=.... Validates state (CSRF/mixed-tab protection),
  // then exchanges the code for tokens — public client, no secret.
  async function exchangeCodeForTokens(searchParams) {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    const expectedState = sessionStorage.getItem(STATE_KEY);
    const verifier = sessionStorage.getItem(VERIFIER_KEY);
    sessionStorage.removeItem(STATE_KEY);
    sessionStorage.removeItem(VERIFIER_KEY);

    if (error) {
      if (error === "access_denied") throw new Error(deniedMessage);
      throw new Error(errorDescription || `${providerName} returned an error: ${error}`);
    }
    if (!code) throw new Error(`${providerName} didn't send back an authorization code.`);
    if (!state || state !== expectedState) throw new Error("This connection attempt doesn't match the one that started — try connecting again.");
    if (!verifier) throw new Error("This connection attempt expired — try connecting again.");

    const res = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        code,
        code_verifier: verifier,
        grant_type: "authorization_code",
        redirect_uri: callbackUrl(),
        ...tokenParams,
      }),
    });
    return readTokens(res, providerName, "connection");
  }

  async function refreshAccessToken(refreshToken) {
    const res = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
        ...tokenParams,
      }),
    });
    return readTokens(res, providerName, "refresh");
  }

  return { buildAuthorizationUrl, exchangeCodeForTokens, refreshAccessToken };
}

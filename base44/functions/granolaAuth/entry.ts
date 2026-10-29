import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Granola sign-in, relayed. Granola's OAuth server (mcp-auth.granola.ai)
// answers registration and token requests without CORS headers, so a
// browser can't read the replies. This function makes those two calls on
// the browser's behalf and returns Granola's reply unchanged.
//
// Nothing secret lives here: Granola clients are public (PKCE, no client
// secret). The function forwards only an allow-listed set of fields to two
// fixed Granola endpoints, so it can't be used to reach anything else.
// Tokens pass through and are never stored.
const AUTH = 'https://mcp-auth.granola.ai';
const MCP_RESOURCE = 'https://mcp.granola.ai/mcp';
const REGISTER_FIELDS = ['client_name', 'redirect_uris', 'grant_types', 'response_types', 'token_endpoint_auth_method', 'scope'];
const TOKEN_FIELDS = ['grant_type', 'code', 'code_verifier', 'redirect_uri', 'client_id', 'refresh_token', 'resource'];
const GRANT_TYPES = new Set(['authorization_code', 'refresh_token']);

function pick(source: Record<string, unknown>, fields: string[]) {
  const out: Record<string, unknown> = {};
  for (const f of fields) if (source[f] !== undefined) out[f] = source[f];
  return out;
}

async function relay(res: Response) {
  const text = await res.text();
  let body: unknown;
  try { body = JSON.parse(text); } catch { body = { error: `Granola returned an unexpected reply (${res.status}).` }; }
  return Response.json(body, { status: res.status });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Sign in to Vaea to connect Granola.' }, { status: 401 });

    const { action, params } = await req.json();
    if (!params || typeof params !== 'object') return Response.json({ error: 'params is required' }, { status: 400 });

    if (action === 'register') {
      const body = pick(params, REGISTER_FIELDS);
      if (!Array.isArray(body.redirect_uris) || body.redirect_uris.length !== 1) {
        return Response.json({ error: 'Exactly one redirect URI is required.' }, { status: 400 });
      }
      body.token_endpoint_auth_method = 'none';
      return relay(await fetch(`${AUTH}/oauth2/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }));
    }

    if (action === 'token') {
      const body = pick(params, TOKEN_FIELDS) as Record<string, string>;
      if (!GRANT_TYPES.has(body.grant_type)) return Response.json({ error: 'Unsupported grant type.' }, { status: 400 });
      body.resource = MCP_RESOURCE;
      return relay(await fetch(`${AUTH}/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(body),
      }));
    }

    return Response.json({ error: 'Unknown action.' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

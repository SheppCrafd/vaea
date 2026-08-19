import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// The one server-side step ClickUp's OAuth flow actually needs. Unlike
// Google Calendar's public "Desktop app" client (no secret at all, see
// googleOAuthPkce.js), ClickUp's token exchange requires a real client
// secret — confirmed against ClickUp's own docs: "Use the Get Access Token
// endpoint with client_id, client_secret, and code." That secret lives
// here only, set via `base44 secrets set CLICKUP_CLIENT_SECRET=...` and
// read through Deno.env — never shipped to the browser, never logged,
// never written to any entity. Everything downstream of this one exchange
// (the resulting access token) is exactly as sensitive as the vault's own
// GitHub PAT — ClickUp tokens don't expire and there's no refresh token to
// protect — so it goes back to the client once and is stored/used the same
// local-only way every other connector's token already is
// (clickupConnection.js).
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { code, redirect_uri } = await req.json();
    if (!code || !redirect_uri) return Response.json({ error: 'code and redirect_uri are required' }, { status: 400 });

    // Deno.env here only ever sees `base44 secrets set` values — it has no
    // access to the Vite build's .env.production at all (that file only
    // ever reaches the CLIENT bundle via import.meta.env, a completely
    // separate mechanism). So CLICKUP_CLIENT_ID has to be set here too,
    // even though it's the exact same public value as the frontend's
    // VITE_CLICKUP_CLIENT_ID — not a second secret, just a second place the
    // one non-secret id needs to live.
    const clientId = Deno.env.get('CLICKUP_CLIENT_ID');
    const clientSecret = Deno.env.get('CLICKUP_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      return Response.json({ error: 'ClickUp isn\'t configured on this deployment yet — run `base44 secrets set CLICKUP_CLIENT_ID=... CLICKUP_CLIENT_SECRET=...`.' }, { status: 500 });
    }

    const tokenRes = await fetch('https://api.clickup.com/api/v2/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri }),
    });
    if (!tokenRes.ok) {
      const body = await tokenRes.json().catch(() => ({}));
      return Response.json({ error: body.err || `ClickUp rejected the connection (${tokenRes.status}).` }, { status: 400 });
    }
    const { access_token } = await tokenRes.json();

    // Also resolve the workspace right here — one fewer round-trip for the
    // client, and confirms the token actually works before handing it back.
    const teamRes = await fetch('https://api.clickup.com/api/v2/team', { headers: { Authorization: access_token } });
    if (!teamRes.ok) return Response.json({ error: 'Connected, but could not read the ClickUp workspace.' }, { status: 502 });
    const { teams } = await teamRes.json();
    const team = teams?.[0];
    if (!team) return Response.json({ error: 'No ClickUp workspace found on this account.' }, { status: 404 });

    return Response.json({ accessToken: access_token, workspaceId: team.id, workspaceName: team.name });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

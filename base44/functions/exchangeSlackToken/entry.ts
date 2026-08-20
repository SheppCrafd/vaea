import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Server-side Slack token exchange — same pattern as exchangeClickUpToken.
// Slack's oauth.v2.access endpoint requires client_id + client_secret
// (confirmed: no PKCE/public-client path). The secret is set once via
// `base44 secrets set SLACK_CLIENT_ID=... SLACK_CLIENT_SECRET=...` and
// read here through Deno.env — never shipped to the browser.
//
// Slack user tokens (authed_user.access_token, from user_scope OAuth) don't
// expire and no refresh token is issued, same simplicity as ClickUp.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { code, redirect_uri } = await req.json();
    if (!code || !redirect_uri) return Response.json({ error: 'code and redirect_uri are required' }, { status: 400 });

    const clientId = Deno.env.get('SLACK_CLIENT_ID');
    const clientSecret = Deno.env.get('SLACK_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      return Response.json(
        { error: 'Slack isn\'t configured on this deployment yet — run `base44 secrets set SLACK_CLIENT_ID=... SLACK_CLIENT_SECRET=...`.' },
        { status: 500 }
      );
    }

    // Slack uses form-encoded POST to oauth.v2.access, not JSON.
    const tokenRes = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, redirect_uri }),
    });
    if (!tokenRes.ok) {
      return Response.json({ error: `Slack API error (${tokenRes.status}).` }, { status: 400 });
    }
    const tokenData = await tokenRes.json();
    if (!tokenData.ok) {
      return Response.json({ error: tokenData.error || 'Slack connection failed.' }, { status: 400 });
    }

    // With user_scope OAuth, the actual user token is in authed_user.access_token.
    const accessToken = tokenData.authed_user?.access_token;
    if (!accessToken) {
      return Response.json({ error: 'Slack returned a bot token but not a user token — reconnect using user scopes.' }, { status: 400 });
    }

    const workspaceId = tokenData.team?.id;
    const workspaceName = tokenData.team?.name;
    const userId = tokenData.authed_user?.id;

    // Resolve the display name via auth.test — confirms the token works.
    const authRes = await fetch('https://slack.com/api/auth.test', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const authData = await authRes.json();
    const username = authData.ok ? authData.user : '';

    return Response.json({ accessToken, workspaceId, workspaceName, userId, username });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

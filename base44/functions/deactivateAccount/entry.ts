import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Best-effort account deletion, callable only by the authenticated user on
// their own account. There's no SDK endpoint — not even under service-role,
// which bypasses entity access rules but doesn't expose an admin "delete
// user" operation — to remove the underlying login credential itself, so
// this disables the user's profile and clears personally-identifying fields
// instead; the client logs them out immediately after. Uses service-role
// specifically because the client-side `auth.updateMe()`'s writable-field
// set isn't documented reliably enough to trust for this.
//
// Deliberately does not touch Area/Product/Project/Task/etc. — those are
// shared team data (this app is a manager + their PMs sharing one
// dashboard), not personal data, so deleting one account must not cascade
// into deleting or altering anyone's shared work.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const updated = await base44.asServiceRole.entities.User.update(user.id, {
      disabled: true,
      full_name: 'Deleted User',
      avatar_url: null,
    });

    return Response.json({ user: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

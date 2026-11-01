import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Deletes everything Vaea holds for this person on the hosted side, then
// disables the account. The Privacy Policy promises that deleting your
// account removes your chats and any board kept in cloud storage, so those
// rows go first: chat messages, chat sessions, and AppData (cloud storage).
// Each delete runs through the person's own client, so the entity rules
// (created_by_id = this user) limit it to their own rows. Base44 has no API
// to remove the login itself, so the account is disabled and its profile
// cleared.
const OWNED_ENTITIES = ['ChatMessage', 'ChatSession', 'AppData'];
const PAGE = 100;
const MAX_ROUNDS = 200; // up to 20,000 rows per entity, then report

async function deleteAllOwned(entity: { list: Function; delete: Function }) {
  let deleted = 0;
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const rows = await entity.list('-created_date', PAGE);
    if (!rows?.length) return { deleted, complete: true };
    for (const row of rows) {
      await entity.delete(row.id);
      deleted++;
    }
  }
  return { deleted, complete: false };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const removed: Record<string, number> = {};
    for (const name of OWNED_ENTITIES) {
      const result = await deleteAllOwned(base44.entities[name]);
      removed[name] = result.deleted;
      if (!result.complete) {
        return Response.json(
          { error: 'There was too much data to delete in one go. Try again to finish deleting your account.' },
          { status: 500 },
        );
      }
    }

    await base44.asServiceRole.entities.User.update(user.id, {
      disabled: true,
      full_name: 'Deleted User',
      avatar_url: null,
    });

    return Response.json({ ok: true, removed });
  } catch (error) {
    console.error('deactivateAccount failed:', error?.message);
    return Response.json({ error: "Your account couldn't be deleted. Nothing more was changed. Try again in a moment." }, { status: 500 });
  }
});

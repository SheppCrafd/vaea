import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Restores a project and un-cascades archived_at from its tasks.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { projectId } = await req.json();
    if (!projectId) return Response.json({ error: 'projectId is required' }, { status: 400 });

    const project = await base44.entities.Project.update(projectId, { is_archived: false, archived_at: null });

    const tasks = await base44.entities.Task.filter({ project_id: projectId });
    await Promise.all(
      tasks.filter((t) => t.archived_at).map((t) => base44.entities.Task.update(t.id, { archived_at: null }))
    );

    return Response.json({ project });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
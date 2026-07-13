import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Soft delete: tags the area deleted_at, and cascades deleted_at to every child
// Product, every Project under this area (standalone or via a product), and every Task under those projects.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { areaId } = await req.json();
    if (!areaId) return Response.json({ error: 'areaId is required' }, { status: 400 });

    const now = new Date().toISOString();
    const area = await base44.entities.Area.update(areaId, { deleted_at: now });

    const products = await base44.entities.Product.filter({ parent_area_id: areaId });
    await Promise.all(products.filter((p) => !p.deleted_at).map((p) => base44.entities.Product.update(p.id, { deleted_at: now })));

    const projects = await base44.entities.Project.filter({ parent_area_id: areaId });
    await Promise.all(projects.filter((p) => !p.deleted_at).map((p) => base44.entities.Project.update(p.id, { deleted_at: now })));

    const projectIds = projects.map((p) => p.id);
    const tasksByProject = await Promise.all(projectIds.map((id) => base44.entities.Task.filter({ project_id: id })));
    const tasks = tasksByProject.flat();
    await Promise.all(tasks.filter((t) => !t.deleted_at).map((t) => base44.entities.Task.update(t.id, { deleted_at: now })));

    return Response.json({ area });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
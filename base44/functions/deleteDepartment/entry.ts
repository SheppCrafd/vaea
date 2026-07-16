import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Soft-deletes a department, cascading to every Stakeholder currently
// assigned to it by clearing their department field to "" (they become
// "Unassigned" rather than being deleted themselves).
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { departmentId } = await req.json();
    if (!departmentId) return Response.json({ error: 'departmentId is required' }, { status: 400 });

    const department = await base44.entities.Department.get(departmentId);
    if (!department) return Response.json({ error: 'Department not found' }, { status: 404 });

    const now = new Date().toISOString();
    const updated = await base44.entities.Department.update(departmentId, { deleted_at: now });

    const stakeholders = await base44.entities.Stakeholder.filter({ department: department.name });
    await Promise.all(
      stakeholders.filter((s) => !s.deleted_at).map((s) => base44.entities.Stakeholder.update(s.id, { department: '' }))
    );

    return Response.json({ department: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Renames a department, cascading the rename to every Stakeholder currently
// assigned to it. Stakeholder.department is a plain string, not a foreign
// key, so the cascade is a string-match update across matching records.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { departmentId, newName } = await req.json();
    if (!departmentId || !newName) {
      return Response.json({ error: 'departmentId and newName are required' }, { status: 400 });
    }

    const department = await base44.entities.Department.get(departmentId);
    if (!department) return Response.json({ error: 'Department not found' }, { status: 404 });

    const oldName = department.name;
    const updated = await base44.entities.Department.update(departmentId, { name: newName });

    if (oldName !== newName) {
      const stakeholders = await base44.entities.Stakeholder.filter({ department: oldName });
      await Promise.all(
        stakeholders.filter((s) => !s.deleted_at).map((s) => base44.entities.Stakeholder.update(s.id, { department: newName }))
      );
    }

    return Response.json({ department: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

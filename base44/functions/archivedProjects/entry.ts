import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { start, end } = await req.json().catch(() => ({}));

    // "Reveal all projects that were or are active in that date range... even
    // those archived" — this is a project-lifetime overlap check, not a
    // simple is_archived filter. A project's active window is
    // [created_date, archived_at ?? now]; it belongs in the result if that
    // window overlaps [start, end]. This deliberately includes currently
    // active (non-archived) projects too, since the spec's "even those
    // archived" phrasing implies archived projects are an addition to the
    // otherwise-expected active set, not the whole result.
    const allProjects = await base44.entities.Project.list();
    const rangeStart = start ? new Date(start) : null;
    const rangeEnd = end ? new Date(end) : null;
    const filtered = allProjects.filter((p) => {
      if (p.deleted_at) return false;
      // No range picked yet: default to the archive's original purpose
      // (browse archived projects) rather than dumping the whole live
      // dashboard into this view.
      if (!rangeStart && !rangeEnd) return !!p.is_archived;
      const activeFrom = p.created_date ? new Date(p.created_date) : null;
      const activeUntil = p.is_archived && p.archived_at ? new Date(p.archived_at) : null; // null = still active (open-ended)
      if (rangeEnd && activeFrom && activeFrom > rangeEnd) return false; // didn't exist yet by end of range
      if (rangeStart && activeUntil && activeUntil < rangeStart) return false; // was archived before range started
      return true;
    });

    // Selective fetching: quadrant counts computed server-side, no nested task arrays returned.
    const withQuadrants = await Promise.all(
      filtered.map(async (p) => {
        const tasks = await base44.entities.Task.filter({ project_id: p.id });
        const activeTasks = tasks.filter((t) => !t.deleted_at);
        const quadrantCounts = [1, 2, 3, 4].map((q) => activeTasks.filter((t) => (t.quadrant || 4) === q).length);
        return {
          id: p.id,
          title: p.title,
          objective: p.objective,
          due_date: p.due_date,
          parent_product_id: p.parent_product_id,
          parent_area_id: p.parent_area_id,
          updated_date: p.updated_date,
          is_archived: !!p.is_archived,
          archived_at: p.archived_at || null,
          quadrant_counts: quadrantCounts,
        };
      })
    );

    return Response.json({ projects: withQuadrants });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
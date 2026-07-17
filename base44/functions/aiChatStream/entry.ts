import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Full-capability chat assistant backend. The client sends the user's
// message (plus recent conversation text); this function gathers complete
// app context (including archived data), asks the LLM to pick one action
// from the full catalog below (using the REAL entity field names, not the
// legacy client-side prompt's guessed ones), and executes it server-side
// under the authenticated request context.
//
// Destructive actions (DELETE_*) are never executed on the first pass: they
// come back as `pending_action` for the client to confirm, then get
// re-submitted with `confirmedAction` set to actually run — mirroring the
// confirm dialog a human gets from the equivalent UI button.

const DESTRUCTIVE_ACTIONS = new Set([
  'DELETE_AREA',
  'DELETE_PRODUCT',
  'DELETE_PROJECT',
  'DELETE_TASK',
  'DELETE_STAKEHOLDER',
  'DELETE_NOTE',
  'DELETE_DEPARTMENT',
  // Not a delete, but a bulk mutation across potentially many tasks at
  // once — confirmed first for the same reason the UI's "Clear Done"
  // button is, even though a single ARCHIVE_TASK isn't.
  'ARCHIVE_DONE_TASKS',
]);

const ACTION_CATALOG = `
[AVAILABLE ACTIONS — use the exact field names shown, they match the real database schema]

- "UNDO_LAST_ACTION" (no args)

- "CREATE_AREA" (args: title, description)
- "UPDATE_AREA" (args: area_id, title, description)
- "DELETE_AREA" (args: area_id) — cascades: also deletes every Product, Project, and Task under this area

- "CREATE_PRODUCT" (args: parent_area_id, title, description, stakeholder_ids [optional array])
- "UPDATE_PRODUCT" (args: product_id, title, description, stakeholder_ids) — omit a field to leave it unchanged; pass stakeholder_ids as the FULL new array (not just additions)
- "DELETE_PRODUCT" (args: product_id)

- "CREATE_PROJECT" (args: parent_area_id, parent_product_id [optional, null for standalone], title, objective, problem_statement, owner_name, due_date [ISO date], due_date_status ["ESTIMATED" or "COMMITTED"], stakeholder_ids [optional array], related_product_ids [optional array])
- "UPDATE_PROJECT" (args: project_id, title, objective, problem_statement, owner_name, due_date, due_date_status, stakeholder_ids [full replacement array], related_product_ids [full replacement array, products this project also serves beyond its primary parent], attachments [full replacement array of {name,url}], links [full replacement array of {label,url}], metrics [object with any of impact_forecast/impact_measured/outcome_forecast/outcome_measured]) — omit a field to leave it unchanged
- "MOVE_PROJECT" (args: project_id, parent_product_id [null to detach], parent_area_id)
- "ARCHIVE_PROJECT" (args: project_id) — cascades: also archives every task under it
- "RESTORE_PROJECT" (args: project_id)
- "DELETE_PROJECT" (args: project_id) — cascades: also deletes every task under it

- "CREATE_NOTE" (args: project_id, type ["RISK", "QUESTION", or "NOTE"], content, reporter [optional name], stakeholder_ids [optional array])
- "UPDATE_NOTE" (args: note_id, content)
- "DELETE_NOTE" (args: note_id)

- "CREATE_TASK" (args: project_id, description, quadrant [1-4 or null], type ["COMMUNICATION","OPEN_QUESTIONS","SCRUM_NEEDS","EMPLOYEE_NEEDS","OTHER"], is_highly_important [bool], is_quick_task [bool], stakeholder_ids [array], status [optional, one of the UPDATE_TASK_STATUS values, defaults to "NOT_STARTED"], notes [optional], is_weekly_focus [optional bool]) — every field but description may be omitted, matching the task table's "fill in what you have" new-row
- "UPDATE_TASK" (args: task_id, description, quadrant, type, is_highly_important, is_quick_task, stakeholder_ids [full replacement array], notes, attachments [full replacement array of {name,url}])
- "UPDATE_TASK_STATUS" (args: task_id, status ["NOT_STARTED","IN_PROGRESS","DELEGATED","PENDING_FEEDBACK","ON_HOLD","BLOCKED","DONE","DELEGATED_DONE"])
- "TOGGLE_WEEKLY_FOCUS" (args: task_id)
- "TOGGLE_TOP_THREE" (args: task_id) — max 3 per project, will error if exceeded
- "ARCHIVE_TASK" (args: task_id)
- "ARCHIVE_DONE_TASKS" (args: project_id) — bulk-archives every active (not already archived) task in the project whose status is "DONE" or "DELEGATED_DONE"; mirrors the task table's "Clear Done" button
- "RESTORE_TASK" (args: task_id) — un-archives a task
- "DELETE_TASK" (args: task_id)

- "CREATE_STAKEHOLDER" (args: name, department, avatar_url [optional, from an attached image]) — department should match an existing Department's name from [GLOBAL DATABASE STATE]; if the user names a department that doesn't exist yet, call CREATE_DEPARTMENT first (or ask them)
- "UPDATE_STAKEHOLDER" (args: stakeholder_id, name, department, avatar_url)
- "DELETE_STAKEHOLDER" (args: stakeholder_id)

- "CREATE_DEPARTMENT" (args: name)
- "RENAME_DEPARTMENT" (args: department_id, name) — cascades: every stakeholder currently in this department is updated to the new name too
- "DELETE_DEPARTMENT" (args: department_id) — cascades: every stakeholder currently in this department becomes Unassigned (they are NOT deleted themselves)

- "SET_CUSTOM_FIELD" (args: entity_type ["project","product","area"], entity_id, label, value, show_on_card [bool], area_wide [bool, optional]) — adds or updates a custom field's value on that entity. If entity_type is "project" or "product" and area_wide is true, the field is also registered on that entity's parent Area, making it available (empty, fillable) on every other project/product in that same area — matching what the "All projects/products in this area" option does in the UI. Areas have no broader scope to register against, so area_wide is ignored when entity_type is "area".

- "CHAT_ONLY" (args: none — just respond conversationally)
- "UNKNOWN" (args: none — couldn't map the request to an action)
`;

// Mirrors the client's "/" autocomplete list in src/lib/chatCommands.js —
// kept in sync by hand since the two live in different runtimes (this file
// runs as a Deno function, the client list is a bundled frontend module).
const SLASH_COMMAND_GUIDE = `
[SLASH COMMAND SHORTHANDS]
The chat composer offers "/" autocomplete for these one-word commands. If [LATEST USER MESSAGE] starts with one of them, treat the text after the command word as its argument and map it to the action below — resolve ids from [GLOBAL DATABASE STATE] as usual, and only ask a follow-up question if something required genuinely can't be resolved (e.g. no active project, an ambiguous task name).

- "/task <description>" → CREATE_TASK on the Active Project ID
- "/project <title>" → CREATE_PROJECT
- "/product <title>" → CREATE_PRODUCT
- "/area <title>" → CREATE_AREA
- "/note <text>" → CREATE_NOTE, type "NOTE", on the Active Project ID
- "/risk <text>" → CREATE_NOTE, type "RISK", on the Active Project ID
- "/question <text>" → CREATE_NOTE, type "QUESTION", on the Active Project ID
- "/stakeholder <name>" → CREATE_STAKEHOLDER
- "/status <task, new status>" → UPDATE_TASK_STATUS
- "/top3 <task>" → TOGGLE_TOP_THREE
- "/focus <task>" → TOGGLE_WEEKLY_FOCUS
- "/help" (no argument) → "CHAT_ONLY" — reply with exactly these 12 commands as a markdown list, each with its one-line description

If [LATEST USER MESSAGE] starts with a "/" word that is NOT one of the commands above, ignore the slash — do not invent or guess an action for it. Respond with "CHAT_ONLY" (or "UNKNOWN" if there's truly nothing to say).
`;

function buildPrompt({ activeProjectId, areas, products, projects, archivedProjects, tasks, archivedTasks, stakeholders, departments, notes, conversationHistory, userText }) {
  return `[SYSTEM INSTRUCTIONS]
You are the admin routing engine for a portfolio-tracking dashboard, acting on behalf of the manager using it. You have full read/write access to every object described below, including archived ones — you can answer questions about archived projects/tasks just as well as active ones.

CRITICAL: Respond ONLY with valid JSON, no text outside the JSON object.

CRITICAL MAPPING RULE: When an action needs an id (area_id, product_id, project_id, task_id, note_id, stakeholder_id), look up the correct id from [GLOBAL DATABASE STATE] using the name/title the user gave. Never invent an id or pass a name where an id is expected.

ATTACHMENTS: if [LATEST USER MESSAGE] contains a line like "[Attached: filename](https://...)", the user has already uploaded that file. If they're asking to attach it to a project or task, use UPDATE_PROJECT or UPDATE_TASK with an \`attachments\` array containing \`{"name": "filename", "url": "https://..."}\` merged with that entity's existing attachments. If they're asking to set it as a stakeholder's photo/avatar, use CREATE_STAKEHOLDER or UPDATE_STAKEHOLDER with \`avatar_url\` set to that URL instead. If unsure whether to replace vs. add to an existing array, ask the user.

FIELDS MARKED "full replacement array": when an action arg is documented as a full replacement array (stakeholder_ids, related_product_ids, attachments, links), you must include the COMPLETE desired array, not just the item being added or removed — look up the entity's current value in [GLOBAL DATABASE STATE] first and merge/modify it yourself before sending the action.
${ACTION_CATALOG}
${SLASH_COMMAND_GUIDE}
[GLOBAL DATABASE STATE]
Active Project ID (if the user is chatting from within a specific project): ${activeProjectId || 'None'}
Areas: ${JSON.stringify(areas.map((a) => ({ id: a.id, title: a.title, description: a.description })))}
Products: ${JSON.stringify(products.map((p) => ({ id: p.id, title: p.title, parent_area_id: p.parent_area_id, description: p.description, stakeholder_ids: p.stakeholder_ids || [] })))}
Active Projects: ${JSON.stringify(projects.map((p) => ({ id: p.id, title: p.title, parent_area_id: p.parent_area_id, parent_product_id: p.parent_product_id, objective: p.objective, owner_name: p.owner_name, due_date: p.due_date, due_date_status: p.due_date_status, stakeholder_ids: p.stakeholder_ids || [], related_product_ids: p.related_product_ids || [], attachments: p.attachments || [], links: p.links || [] })))}
Archived Projects: ${JSON.stringify(archivedProjects.map((p) => ({ id: p.id, title: p.title })))}
Active Tasks: ${JSON.stringify(tasks.map((t) => ({ id: t.id, project_id: t.project_id, description: t.description, status: t.status, quadrant: t.quadrant, type: t.type, stakeholder_ids: t.stakeholder_ids })))}
Archived Tasks: ${JSON.stringify(archivedTasks.map((t) => ({ id: t.id, project_id: t.project_id, description: t.description, status: t.status })))}
Stakeholders: ${JSON.stringify(stakeholders.map((s) => ({ id: s.id, name: s.name, department: s.department })))}
Departments: ${JSON.stringify(departments.map((d) => ({ id: d.id, name: d.name })))}
Project Notes: ${JSON.stringify(notes.map((n) => ({ id: n.id, project_id: n.project_id, type: n.type, content: n.content })))}

[CONVERSATION HISTORY]
${conversationHistory || '(none yet)'}

[LATEST USER MESSAGE]
${userText}

[EXPECTED JSON OUTPUT]
"args_json" must be a JSON-encoded STRING (not a nested object) containing that action's args, e.g. "{\\"title\\":\\"Foo\\",\\"description\\":\\"Bar\\"}". Use "{}" (the string) when an action takes no args.
{ "action": "ACTION_NAME", "args_json": "{...}", "message": "your reply to the user, matching their tone, in markdown" }`;
}

async function executeAction(base44, action, args) {
  switch (action) {
    case 'CREATE_AREA': {
      const area = await base44.entities.Area.create({ title: args.title, description: args.description });
      return { toolResult: { area } };
    }
    case 'UPDATE_AREA': {
      const area = await base44.entities.Area.update(args.area_id, { title: args.title, description: args.description });
      return { toolResult: { area } };
    }
    case 'DELETE_AREA': {
      const now = new Date().toISOString();
      const area = await base44.entities.Area.update(args.area_id, { deleted_at: now });
      const products = await base44.entities.Product.filter({ parent_area_id: args.area_id });
      await Promise.all(products.filter((p) => !p.deleted_at).map((p) => base44.entities.Product.update(p.id, { deleted_at: now })));
      const projects = await base44.entities.Project.filter({ parent_area_id: args.area_id });
      await Promise.all(projects.filter((p) => !p.deleted_at).map((p) => base44.entities.Project.update(p.id, { deleted_at: now })));
      const tasksByProject = await Promise.all(projects.map((p) => base44.entities.Task.filter({ project_id: p.id })));
      await Promise.all(tasksByProject.flat().filter((t) => !t.deleted_at).map((t) => base44.entities.Task.update(t.id, { deleted_at: now })));
      return { toolResult: { area } };
    }

    case 'CREATE_PRODUCT': {
      const product = await base44.entities.Product.create({
        parent_area_id: args.parent_area_id,
        title: args.title,
        description: args.description,
        stakeholder_ids: args.stakeholder_ids || [],
      });
      return { toolResult: { product } };
    }
    case 'UPDATE_PRODUCT': {
      const { product_id, ...rest } = args;
      const product = await base44.entities.Product.update(product_id, rest);
      return { toolResult: { product } };
    }
    case 'DELETE_PRODUCT': {
      const product = await base44.entities.Product.update(args.product_id, { deleted_at: new Date().toISOString() });
      return { toolResult: { product } };
    }

    case 'CREATE_PROJECT': {
      const project = await base44.entities.Project.create({
        parent_area_id: args.parent_area_id,
        parent_product_id: args.parent_product_id || null,
        title: args.title,
        objective: args.objective,
        problem_statement: args.problem_statement,
        owner_name: args.owner_name,
        due_date: args.due_date,
        due_date_status: args.due_date_status || 'ESTIMATED',
        stakeholder_ids: args.stakeholder_ids || [],
        related_product_ids: args.related_product_ids || [],
      });
      return { toolResult: { project } };
    }
    case 'UPDATE_PROJECT': {
      const { project_id, ...rest } = args;
      const project = await base44.entities.Project.update(project_id, rest);
      return { toolResult: { project } };
    }
    case 'MOVE_PROJECT': {
      const project = await base44.entities.Project.update(args.project_id, {
        parent_product_id: args.parent_product_id ?? null,
        parent_area_id: args.parent_area_id,
      });
      return { toolResult: { project } };
    }
    case 'ARCHIVE_PROJECT': {
      const project = await base44.entities.Project.update(args.project_id, { is_archived: true });
      const tasks = await base44.entities.Task.filter({ project_id: args.project_id });
      const now = new Date().toISOString();
      await Promise.all(tasks.map((t) => base44.entities.Task.update(t.id, { archived_at: now })));
      return { toolResult: { project } };
    }
    case 'RESTORE_PROJECT': {
      const project = await base44.entities.Project.update(args.project_id, { is_archived: false });
      const tasks = await base44.entities.Task.filter({ project_id: args.project_id });
      await Promise.all(tasks.filter((t) => t.archived_at).map((t) => base44.entities.Task.update(t.id, { archived_at: null })));
      return { toolResult: { project } };
    }
    case 'DELETE_PROJECT': {
      const now = new Date().toISOString();
      const project = await base44.entities.Project.update(args.project_id, { deleted_at: now });
      const tasks = await base44.entities.Task.filter({ project_id: args.project_id });
      await Promise.all(tasks.filter((t) => !t.deleted_at).map((t) => base44.entities.Task.update(t.id, { deleted_at: now })));
      return { toolResult: { project } };
    }

    case 'CREATE_NOTE': {
      const note = await base44.entities.ProjectNote.create({
        project_id: args.project_id,
        type: args.type || 'NOTE',
        content: args.content,
        reporter: args.reporter,
        stakeholder_ids: args.stakeholder_ids || [],
      });
      return { toolResult: { note } };
    }
    case 'UPDATE_NOTE': {
      const note = await base44.entities.ProjectNote.update(args.note_id, { content: args.content });
      return { toolResult: { note } };
    }
    case 'DELETE_NOTE': {
      await base44.entities.ProjectNote.delete(args.note_id);
      return { toolResult: {} };
    }

    case 'CREATE_TASK': {
      const task = await base44.entities.Task.create({
        project_id: args.project_id,
        description: args.description,
        quadrant: args.quadrant ?? null,
        type: args.type || 'OTHER',
        is_highly_important: !!args.is_highly_important,
        is_quick_task: !!args.is_quick_task,
        stakeholder_ids: args.stakeholder_ids || [],
        status: args.status || 'NOT_STARTED',
        notes: args.notes || '',
        is_weekly_focus: !!args.is_weekly_focus,
      });
      return { toolResult: { task } };
    }
    case 'UPDATE_TASK': {
      const { task_id, ...rest } = args;
      const task = await base44.entities.Task.update(task_id, rest);
      return { toolResult: { task } };
    }
    case 'UPDATE_TASK_STATUS': {
      const previous = await base44.entities.Task.get(args.task_id);
      const task = await base44.entities.Task.update(args.task_id, { status: args.status });
      return { toolResult: { task, previousStatus: previous?.status, undo: { type: 'UPDATE_TASK_STATUS', task_id: args.task_id, status: previous?.status } } };
    }
    case 'TOGGLE_WEEKLY_FOCUS': {
      const previous = await base44.entities.Task.get(args.task_id);
      const task = await base44.entities.Task.update(args.task_id, { is_weekly_focus: !previous?.is_weekly_focus });
      return { toolResult: { task, undo: { type: 'TOGGLE_WEEKLY_FOCUS', task_id: args.task_id } } };
    }
    case 'TOGGLE_TOP_THREE': {
      const previous = await base44.entities.Task.get(args.task_id);
      if (!previous) throw new Error('Task not found');
      const nextValue = !previous.is_today_top_three;
      if (nextValue) {
        const projectTasks = await base44.entities.Task.filter({ project_id: previous.project_id, is_today_top_three: true });
        if (projectTasks.filter((t) => t.id !== args.task_id).length >= 3) {
          throw new Error('Only 3 "Top 3" tasks are allowed per project');
        }
      }
      const task = await base44.entities.Task.update(args.task_id, { is_today_top_three: nextValue });
      return { toolResult: { task, undo: { type: 'TOGGLE_TOP_THREE', task_id: args.task_id } } };
    }
    case 'ARCHIVE_TASK': {
      const task = await base44.entities.Task.update(args.task_id, { archived_at: new Date().toISOString() });
      return { toolResult: { task } };
    }
    case 'ARCHIVE_DONE_TASKS': {
      const tasks = await base44.entities.Task.filter({ project_id: args.project_id });
      const now = new Date().toISOString();
      const doneTasks = tasks.filter((t) => !t.archived_at && (t.status === 'DONE' || t.status === 'DELEGATED_DONE'));
      const archived = await Promise.all(doneTasks.map((t) => base44.entities.Task.update(t.id, { archived_at: now })));
      return { toolResult: { tasks: archived, count: archived.length } };
    }
    case 'RESTORE_TASK': {
      const task = await base44.entities.Task.update(args.task_id, { archived_at: null });
      return { toolResult: { task } };
    }
    case 'DELETE_TASK': {
      const task = await base44.entities.Task.update(args.task_id, { deleted_at: new Date().toISOString() });
      return { toolResult: { task } };
    }

    case 'CREATE_STAKEHOLDER': {
      const stakeholder = await base44.entities.Stakeholder.create({ name: args.name, department: args.department, avatar_url: args.avatar_url });
      return { toolResult: { stakeholder } };
    }
    case 'UPDATE_STAKEHOLDER': {
      const { stakeholder_id, ...rest } = args;
      const stakeholder = await base44.entities.Stakeholder.update(stakeholder_id, rest);
      return { toolResult: { stakeholder } };
    }
    case 'DELETE_STAKEHOLDER': {
      const stakeholder = await base44.entities.Stakeholder.update(args.stakeholder_id, { deleted_at: new Date().toISOString() });
      return { toolResult: { stakeholder } };
    }

    case 'CREATE_DEPARTMENT': {
      const department = await base44.entities.Department.create({ name: args.name });
      return { toolResult: { department } };
    }
    case 'RENAME_DEPARTMENT': {
      const department = await base44.entities.Department.get(args.department_id);
      if (!department) throw new Error('Department not found');
      const oldName = department.name;
      const updated = await base44.entities.Department.update(args.department_id, { name: args.name });
      if (oldName !== args.name) {
        const members = await base44.entities.Stakeholder.filter({ department: oldName });
        await Promise.all(members.filter((s) => !s.deleted_at).map((s) => base44.entities.Stakeholder.update(s.id, { department: args.name })));
      }
      return { toolResult: { department: updated } };
    }
    case 'DELETE_DEPARTMENT': {
      const department = await base44.entities.Department.get(args.department_id);
      if (!department) throw new Error('Department not found');
      const now = new Date().toISOString();
      const updated = await base44.entities.Department.update(args.department_id, { deleted_at: now });
      const members = await base44.entities.Stakeholder.filter({ department: department.name });
      await Promise.all(members.filter((s) => !s.deleted_at).map((s) => base44.entities.Stakeholder.update(s.id, { department: '' })));
      return { toolResult: { department: updated } };
    }

    case 'SET_CUSTOM_FIELD': {
      const entityMap = { project: base44.entities.Project, product: base44.entities.Product, area: base44.entities.Area };
      const entityApi = entityMap[args.entity_type];
      if (!entityApi) throw new Error(`Unknown entity_type "${args.entity_type}"`);
      const entity = await entityApi.get(args.entity_id);
      if (!entity) throw new Error('Entity not found');
      const key = String(args.label).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'field';
      const custom_data = { ...entity.custom_data, [key]: { label: args.label, value: args.value } };
      const display_on_card_fields = args.show_on_card
        ? [...new Set([...(entity.display_on_card_fields || []), key])]
        : entity.display_on_card_fields || [];
      const updated = await entityApi.update(args.entity_id, { custom_data, display_on_card_fields });

      if (args.area_wide && args.entity_type !== 'area' && entity.parent_area_id) {
        const area = await base44.entities.Area.get(entity.parent_area_id);
        if (area) {
          const fieldListKey = `${args.entity_type}_fields`;
          const existingFields = area.custom_schema?.[fieldListKey] || [];
          if (!existingFields.some((f) => f.key === key)) {
            await base44.entities.Area.update(area.id, {
              custom_schema: { ...area.custom_schema, [fieldListKey]: [...existingFields, { key, label: args.label }] },
            });
          }
        }
      }

      return { toolResult: { entity: updated } };
    }

    default:
      throw new Error(`Unknown action "${action}"`);
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { confirmedAction } = body;

    // Second round-trip: the client already showed a confirm prompt and the
    // user accepted, so just run the action — no LLM call needed.
    if (confirmedAction) {
      const { action, args } = confirmedAction;
      const result = await executeAction(base44, action, args);
      return Response.json({ reply: confirmedAction.confirmMessage || 'Done.', toolResult: result.toolResult, action });
    }

    const { message, conversationHistory, activeProjectId } = body;
    if (!message) return Response.json({ error: 'message is required' }, { status: 400 });

    const [areas, products, allProjects, allTasksRaw, stakeholders, notes, departments] = await Promise.all([
      base44.entities.Area.list(),
      base44.entities.Product.list(),
      base44.entities.Project.list(),
      base44.entities.Task.list(),
      base44.entities.Stakeholder.list(),
      base44.entities.ProjectNote.list(),
      base44.entities.Department.list(),
    ]);

    const projects = allProjects.filter((p) => !p.is_archived && !p.deleted_at);
    const archivedProjects = allProjects.filter((p) => p.is_archived && !p.deleted_at);
    const tasks = allTasksRaw.filter((t) => !t.archived_at && !t.deleted_at);
    const archivedTasks = allTasksRaw.filter((t) => t.archived_at && !t.deleted_at);

    const prompt = buildPrompt({
      activeProjectId,
      areas: areas.filter((a) => !a.deleted_at),
      products: products.filter((p) => !p.deleted_at),
      projects,
      archivedProjects,
      tasks,
      archivedTasks,
      stakeholders: stakeholders.filter((s) => !s.deleted_at),
      departments: departments.filter((d) => !d.deleted_at),
      notes,
      conversationHistory,
      userText: message,
    });

    const response = await base44.integrations.Core.InvokeLLM({
      prompt,
      // Every property here is a flat scalar on purpose — an open-ended
      // nested "object" type for args (no fixed properties) is rejected by
      // strict structured-output schema validation, so args travels as a
      // JSON-encoded string instead and gets parsed below.
      response_json_schema: {
        type: 'object',
        properties: {
          action: { type: 'string' },
          args_json: { type: 'string' },
          message: { type: 'string' },
        },
        required: ['action', 'message'],
      },
    });

    const rawText = typeof response === 'string' ? response : response?.text || JSON.stringify(response);
    let decision;
    try {
      const clean = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      decision = JSON.parse(clean);
    } catch {
      return Response.json({ reply: "Hit a bump parsing that request. Try again?" });
    }

    const { action, args_json, message: reply } = decision;
    let args = {};
    try {
      args = args_json ? JSON.parse(args_json) : {};
    } catch {
      args = {};
    }

    if (!action || action === 'CHAT_ONLY' || action === 'UNKNOWN') {
      return Response.json({ reply: reply || "I couldn't map that to an action — could you rephrase?" });
    }

    if (action === 'UNDO_LAST_ACTION') {
      // The undo target lives in the client's local history (last mutation
      // it applied), so just tell the client to handle it.
      return Response.json({ reply, action: 'UNDO_LAST_ACTION' });
    }

    if (DESTRUCTIVE_ACTIONS.has(action)) {
      return Response.json({
        reply,
        pending_action: { action, args, confirmMessage: reply },
      });
    }

    const result = await executeAction(base44, action, args);
    return Response.json({ reply, toolResult: result.toolResult, action });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

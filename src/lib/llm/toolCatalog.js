// The action catalog a BYOK model can call — a JSON Schema port of
// base44/functions/aiChatStream/entry.ts's Zod tool definitions, kept in
// sync by hand (different runtime, can't share a module, same reasoning as
// that file's own SLASH COMMANDS/vault-tools split). `staged: true` tools
// never run here — calling one just queues {action, args, temp_id} into the
// plan the client executes afterward (chatActions.js), identical contract
// to the base44-hosted path. `staged: false` tools run for real, client-side
// (src/lib/llm/localTools.js), and their results feed back into the model's
// next turn.
//
// web_search is deliberately NOT a catalog entry here at all — unlike
// every tool below, it's never client-executed/staged through this
// codebase's own runTool dispatch. Anthropic and xAI each have their own
// native hosted web search, wired directly into anthropicAdapter.js/
// openaiCompatibleAdapter.js instead (see those files' own comments);
// OpenAI/Google BYOK and Local Mode have no web search at all — see
// systemPrompt.js's own NOT AVAILABLE note. Everything below DOES work
// across every BYOK provider and Local Mode: read_project_link via a
// plain client-side fetch (see localTools.js; CORS can block some sites, a
// real limitation, not a bug), analyze_attachment the same way but limited
// to images + plain-text files (no client-side PDF/Office parser), and
// WRITE_VAULT_NOTE/list_vault_notes/read_vault_note/search_vault/
// audit_vault via githubApi.js's own client-side GitHub layer.
import { THEME_MODES, ACCENT_KEYS } from "@/lib/appearanceConstants";

const idDesc = (desc) => `${desc} — look this id up from [DATABASE STATE] by name/title; never invent one.`;
// Same as idDesc, but for a parent-record field on a CREATE_* tool — see the
// matching parentId() comment in base44/functions/aiChatStream/entry.ts for
// why idDesc's plain "never invent one" was steering the model away from the
// $temp_id mechanism for a parent this same turn is creating, producing
// Products/Projects with a parent id matching no real record (created, but
// never rendered anywhere).
const parentIdDesc = (desc) => `${desc} — look this id up from [DATABASE STATE] by name/title. If THIS TURN's own plan already created the parent (via an earlier CREATE_AREA/CREATE_PRODUCT call), use its "$temp_id" reference instead — never invent a real-looking id either way.`;
const stakeholderIdsDesc = (desc) => `${desc} Pass the FULL desired array (not just additions/removals) — look up the entity's current value in [DATABASE STATE] and merge yourself.`;

const STATUS_ENUM = ["NOT_STARTED", "IN_PROGRESS", "DELEGATED", "PENDING_FEEDBACK", "ON_HOLD", "BLOCKED", "DONE", "DELEGATED_DONE"];
const TASK_TYPE_ENUM = ["COMMUNICATION", "OPEN_QUESTIONS", "SCRUM_NEEDS", "EMPLOYEE_NEEDS", "OTHER"];
const BULK_ENTITY_ENUM = ["area", "product", "project", "task", "note", "stakeholder", "department"];

// Kept in sync with chatActions.js's own MAX_BULK_ITEMS_PER_CALL (that copy
// enforces this for real once a plan executes, as defense-in-depth) and
// re-exported for toolRunner.js, which enforces it a second time at staging
// time — the moment the model calls BULK_CREATE/BULK_DELETE, not after the
// whole plan comes back — so an oversized call gets rejected back to the
// model in the same tool round-trip instead of surfacing later as a runtime
// error on the user's own device.
export const MAX_BULK_ITEMS_PER_CALL = 5;

const tempIdProp = {
  type: "string",
  description: 'Tag this not-yet-real record with a short label (e.g. "area1") ONLY if a later tool call in this same turn needs to reference its id before it has ever been created. Omit otherwise.',
};

export const TOOL_CATALOG = [
  {
    name: "UNDO_LAST_ACTION",
    staged: true,
    description: "Undo the single most recently executed action (only one level of undo exists). Must be the ONLY tool you call this turn if used — never combine it with anything else.",
    parameters: { type: "object", properties: {}, required: [] },
  },

  {
    name: "CREATE_AREA",
    staged: true,
    description: "Create a new top-level Area.",
    parameters: {
      type: "object",
      properties: { title: { type: "string" }, description: { type: "string" }, temp_id: tempIdProp },
      required: ["title"],
    },
  },
  {
    name: "UPDATE_AREA",
    staged: true,
    description: "Update an existing Area. Omit a field to leave it unchanged.",
    parameters: {
      type: "object",
      properties: { area_id: { type: "string", description: idDesc("Area") }, title: { type: "string" }, description: { type: "string" } },
      required: ["area_id"],
    },
  },
  {
    name: "DELETE_AREA",
    staged: true,
    description: "Delete an Area. CASCADES: also deletes every Product, Project, and Task under it.",
    parameters: { type: "object", properties: { area_id: { type: "string", description: idDesc("Area") } }, required: ["area_id"] },
  },

  {
    name: "CREATE_PRODUCT",
    staged: true,
    description: "Create a new Product under an Area.",
    parameters: {
      type: "object",
      properties: {
        parent_area_id: { type: "string", description: parentIdDesc("Parent Area") },
        title: { type: "string" },
        description: { type: "string" },
        stakeholder_ids: { type: "array", items: { type: "string" }, description: stakeholderIdsDesc("Stakeholders on this product.") },
        temp_id: tempIdProp,
      },
      required: ["parent_area_id", "title"],
    },
  },
  {
    name: "UPDATE_PRODUCT",
    staged: true,
    description: "Update an existing Product. Omit a field to leave it unchanged.",
    parameters: {
      type: "object",
      properties: {
        product_id: { type: "string", description: idDesc("Product") },
        title: { type: "string" },
        description: { type: "string" },
        stakeholder_ids: { type: "array", items: { type: "string" }, description: stakeholderIdsDesc("Full replacement stakeholder list.") },
      },
      required: ["product_id"],
    },
  },
  {
    name: "DELETE_PRODUCT",
    staged: true,
    description: "Delete a Product.",
    parameters: { type: "object", properties: { product_id: { type: "string", description: idDesc("Product") } }, required: ["product_id"] },
  },
  {
    name: "MOVE_PRODUCT",
    staged: true,
    description: "Move a Product to a different Area.",
    parameters: {
      type: "object",
      properties: {
        product_id: { type: "string", description: idDesc("Product") },
        parent_area_id: { type: "string", description: idDesc("New parent Area") },
      },
      required: ["product_id", "parent_area_id"],
    },
  },

  {
    name: "CREATE_PROJECT",
    staged: true,
    description: "Create a new Project under an Area, optionally attached to a Product.",
    parameters: {
      type: "object",
      properties: {
        parent_area_id: { type: "string", description: parentIdDesc("Parent Area") },
        parent_product_id: { type: "string", description: parentIdDesc("Parent Product") + " Omit for a standalone project not under any product." },
        title: { type: "string" },
        objective: { type: "string" },
        problem_statement: { type: "string" },
        owner_name: { type: "string" },
        due_date: { type: "string", description: "ISO date" },
        due_date_status: { type: "string", enum: ["ESTIMATED", "COMMITTED"] },
        stakeholder_ids: { type: "array", items: { type: "string" }, description: stakeholderIdsDesc("Stakeholders on this project.") },
        related_product_ids: { type: "array", items: { type: "string" }, description: "Other products this project also serves, beyond its primary parent." },
        temp_id: tempIdProp,
      },
      required: ["parent_area_id", "title"],
    },
  },
  {
    name: "UPDATE_PROJECT",
    staged: true,
    description: "Update an existing Project. Omit a field to leave it unchanged.",
    parameters: {
      type: "object",
      properties: {
        project_id: { type: "string", description: idDesc("Project") },
        title: { type: "string" },
        objective: { type: "string" },
        problem_statement: { type: "string" },
        owner_name: { type: "string" },
        due_date: { type: "string" },
        due_date_status: { type: "string", enum: ["ESTIMATED", "COMMITTED"] },
        stakeholder_ids: { type: "array", items: { type: "string" }, description: stakeholderIdsDesc("Full replacement stakeholder list.") },
        related_product_ids: { type: "array", items: { type: "string" }, description: "Full replacement array." },
        attachments: {
          type: "array",
          items: { type: "object", properties: { name: { type: "string" }, url: { type: "string" } }, required: ["name", "url"] },
          description: "Full replacement array — merge with existing first if adding one (see ATTACHMENTS rule).",
        },
        links: {
          type: "array",
          items: { type: "object", properties: { label: { type: "string" }, url: { type: "string" } }, required: ["label", "url"] },
          description: "Full replacement array.",
        },
        metrics: {
          type: "object",
          properties: {
            impact_forecast: { type: "string" },
            impact_measured: { type: "string" },
            outcome_forecast: { type: "string" },
            outcome_measured: { type: "string" },
          },
        },
      },
      required: ["project_id"],
    },
  },
  {
    name: "MOVE_PROJECT",
    staged: true,
    description: "Move a Project to a different Area and/or Product.",
    parameters: {
      type: "object",
      properties: {
        project_id: { type: "string", description: idDesc("Project") },
        parent_product_id: { type: "string", description: idDesc("Parent Product") + " Omit to detach from any product." },
        parent_area_id: { type: "string", description: idDesc("New parent Area") },
      },
      required: ["project_id", "parent_area_id"],
    },
  },
  {
    name: "ARCHIVE_PROJECT",
    staged: true,
    description: "Archive a Project. CASCADES: also archives every task under it.",
    parameters: { type: "object", properties: { project_id: { type: "string", description: idDesc("Project") } }, required: ["project_id"] },
  },
  {
    name: "RESTORE_PROJECT",
    staged: true,
    description: "Restore a previously archived Project.",
    parameters: { type: "object", properties: { project_id: { type: "string", description: idDesc("Archived project") } }, required: ["project_id"] },
  },
  {
    name: "DELETE_PROJECT",
    staged: true,
    description: "Delete a Project. CASCADES: also deletes every task under it.",
    parameters: { type: "object", properties: { project_id: { type: "string", description: idDesc("Project") } }, required: ["project_id"] },
  },

  {
    name: "CREATE_NOTE",
    staged: true,
    description: "Add a Note/Risk/Question to a Project.",
    parameters: {
      type: "object",
      properties: {
        project_id: { type: "string", description: idDesc("Project") },
        type: { type: "string", enum: ["RISK", "QUESTION", "NOTE"] },
        content: { type: "string" },
        reporter: { type: "string" },
        stakeholder_ids: { type: "array", items: { type: "string" }, description: stakeholderIdsDesc("Stakeholders tagged on this note.") },
        temp_id: tempIdProp,
      },
      required: ["project_id", "content"],
    },
  },
  {
    name: "UPDATE_NOTE",
    staged: true,
    description: "Edit an existing note's content.",
    parameters: { type: "object", properties: { note_id: { type: "string", description: idDesc("Note") }, content: { type: "string" } }, required: ["note_id", "content"] },
  },
  {
    name: "DELETE_NOTE",
    staged: true,
    description: "Delete a note.",
    parameters: { type: "object", properties: { note_id: { type: "string", description: idDesc("Note") } }, required: ["note_id"] },
  },

  {
    name: "CREATE_TASK",
    staged: true,
    description: "Add a Task to a Project. Every field but description may be omitted.",
    parameters: {
      type: "object",
      properties: {
        project_id: { type: "string", description: idDesc("Project") },
        description: { type: "string" },
        quadrant: { type: "integer", minimum: 1, maximum: 4 },
        type: { type: "string", enum: TASK_TYPE_ENUM },
        is_highly_important: { type: "boolean" },
        is_quick_task: { type: "boolean" },
        stakeholder_ids: { type: "array", items: { type: "string" }, description: stakeholderIdsDesc("Stakeholders on this task.") },
        status: { type: "string", enum: STATUS_ENUM },
        notes: { type: "string" },
        is_weekly_focus: { type: "boolean" },
        temp_id: tempIdProp,
      },
      required: ["project_id", "description"],
    },
  },
  {
    name: "UPDATE_TASK",
    staged: true,
    description: "Update an existing Task. Omit a field to leave it unchanged.",
    parameters: {
      type: "object",
      properties: {
        task_id: { type: "string", description: idDesc("Task") },
        description: { type: "string" },
        quadrant: { type: "integer", minimum: 1, maximum: 4 },
        type: { type: "string", enum: TASK_TYPE_ENUM },
        is_highly_important: { type: "boolean" },
        is_quick_task: { type: "boolean" },
        stakeholder_ids: { type: "array", items: { type: "string" }, description: stakeholderIdsDesc("Full replacement stakeholder list.") },
        notes: { type: "string" },
        attachments: {
          type: "array",
          items: { type: "object", properties: { name: { type: "string" }, url: { type: "string" } }, required: ["name", "url"] },
          description: "Full replacement array.",
        },
      },
      required: ["task_id"],
    },
  },
  {
    name: "UPDATE_TASK_STATUS",
    staged: true,
    description: "Change a single task's status.",
    parameters: {
      type: "object",
      properties: { task_id: { type: "string", description: idDesc("Task") }, status: { type: "string", enum: STATUS_ENUM } },
      required: ["task_id", "status"],
    },
  },
  {
    name: "BULK_UPDATE_TASK_STATUS",
    staged: true,
    description: 'Change status on several tasks at once (e.g. "mark these 5 tasks done").',
    parameters: {
      type: "object",
      properties: {
        task_ids: { type: "array", items: { type: "string" }, description: "Existing task ids." },
        status: { type: "string", enum: STATUS_ENUM },
      },
      required: ["task_ids", "status"],
    },
  },
  {
    name: "TOGGLE_WEEKLY_FOCUS",
    staged: true,
    description: "Toggle whether a task is this week's focus.",
    parameters: { type: "object", properties: { task_id: { type: "string", description: idDesc("Task") } }, required: ["task_id"] },
  },
  {
    name: "TOGGLE_TOP_THREE",
    staged: true,
    description: "Toggle whether a task is one of today's top 3 (max 3 per project — errors if exceeded).",
    parameters: { type: "object", properties: { task_id: { type: "string", description: idDesc("Task") } }, required: ["task_id"] },
  },
  {
    name: "ARCHIVE_TASK",
    staged: true,
    description: "Archive a single task.",
    parameters: { type: "object", properties: { task_id: { type: "string", description: idDesc("Task") } }, required: ["task_id"] },
  },
  {
    name: "ARCHIVE_DONE_TASKS",
    staged: true,
    description: 'Bulk-archive every active DONE/DELEGATED_DONE task in a project (mirrors the "Clear Done" button).',
    parameters: { type: "object", properties: { project_id: { type: "string", description: idDesc("Project") } }, required: ["project_id"] },
  },
  {
    name: "RESTORE_TASK",
    staged: true,
    description: "Un-archive a task.",
    parameters: { type: "object", properties: { task_id: { type: "string", description: idDesc("Archived task") } }, required: ["task_id"] },
  },
  {
    name: "DELETE_TASK",
    staged: true,
    description: "Delete a task.",
    parameters: { type: "object", properties: { task_id: { type: "string", description: idDesc("Task") } }, required: ["task_id"] },
  },

  {
    name: "CREATE_STAKEHOLDER",
    staged: true,
    description: "Create a new Stakeholder. If the named department doesn't exist yet in [DATABASE STATE], call CREATE_DEPARTMENT first (or ask).",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        department: { type: "string" },
        avatar_url: { type: "string", description: "From an attached image — see ATTACHMENTS rule." },
        temp_id: tempIdProp,
      },
      required: ["name"],
    },
  },
  {
    name: "UPDATE_STAKEHOLDER",
    staged: true,
    description: "Update an existing Stakeholder.",
    parameters: {
      type: "object",
      properties: { stakeholder_id: { type: "string", description: idDesc("Stakeholder") }, name: { type: "string" }, department: { type: "string" }, avatar_url: { type: "string" } },
      required: ["stakeholder_id"],
    },
  },
  {
    name: "DELETE_STAKEHOLDER",
    staged: true,
    description: "Delete a Stakeholder.",
    parameters: { type: "object", properties: { stakeholder_id: { type: "string", description: idDesc("Stakeholder") } }, required: ["stakeholder_id"] },
  },

  {
    name: "CREATE_DEPARTMENT",
    staged: true,
    description: "Create a new Department.",
    parameters: { type: "object", properties: { name: { type: "string" }, temp_id: tempIdProp }, required: ["name"] },
  },
  {
    name: "RENAME_DEPARTMENT",
    staged: true,
    description: "Rename a Department. CASCADES: every stakeholder in it is updated to the new name too.",
    parameters: {
      type: "object",
      properties: { department_id: { type: "string", description: idDesc("Department") }, name: { type: "string" } },
      required: ["department_id", "name"],
    },
  },
  {
    name: "DELETE_DEPARTMENT",
    staged: true,
    description: "Delete a Department. CASCADES: every stakeholder in it becomes Unassigned (they are NOT deleted).",
    parameters: { type: "object", properties: { department_id: { type: "string", description: idDesc("Department") } }, required: ["department_id"] },
  },

  {
    name: "SET_CUSTOM_FIELD",
    staged: true,
    description: "Add or update a custom field's value on a Project/Product/Area.",
    parameters: {
      type: "object",
      properties: {
        entity_type: { type: "string", enum: ["project", "product", "area"] },
        entity_id: { type: "string" },
        label: { type: "string" },
        value: { type: "string" },
        show_on_card: { type: "boolean" },
        area_wide: { type: "boolean", description: "If true (and entity_type isn't \"area\"), also register this field on the entity's parent Area so it's available on every other project/product in that area." },
      },
      required: ["entity_type", "entity_id", "label", "value"],
    },
  },
  {
    name: "DELETE_CUSTOM_FIELD",
    staged: true,
    description: "Remove a custom field from a Project/Product/Area.",
    parameters: {
      type: "object",
      properties: {
        entity_type: { type: "string", enum: ["project", "product", "area"] },
        entity_id: { type: "string" },
        label: { type: "string", description: "The exact label of the custom field to remove, as shown in [DATABASE STATE]." },
      },
      required: ["entity_type", "entity_id", "label"],
    },
  },
  {
    name: "REORDER_ENTITY",
    staged: true,
    description: 'Move an Area, Product, or Project to a new position among its siblings — the same list it already appears in (e.g. Products within the same Area, Projects within the same Area+Product) — mirroring drag-to-reorder in the UI. "Move X above/before Y" -> before_id: Y\'s id. "Move X to the end/last" -> omit before_id.',
    parameters: {
      type: "object",
      properties: {
        entity_type: { type: "string", enum: ["area", "product", "project"] },
        entity_id: { type: "string", description: idDesc("The record to reorder") },
        before_id: { type: "string", description: "The sibling id to place it immediately before. Omit to move it to the end of its list." },
      },
      required: ["entity_type", "entity_id"],
    },
  },

  {
    name: "BULK_CREATE",
    staged: true,
    description: `Create up to ${MAX_BULK_ITEMS_PER_CALL} records of the SAME type in one shot (e.g. 5 tasks under one project). A bigger request needs several BULK_CREATE calls, each with at most ${MAX_BULK_ITEMS_PER_CALL} items — never one call with more than that. Items here can't be individually referenced later via temp_id — for that, call the single CREATE_* tool repeatedly instead.`,
    parameters: {
      type: "object",
      properties: {
        entity_type: { type: "string", enum: BULK_ENTITY_ENUM },
        items: {
          type: "array",
          items: { type: "object" },
          maxItems: MAX_BULK_ITEMS_PER_CALL,
          description: `Each item shaped exactly like that entity's single CREATE_* tool's args. Max ${MAX_BULK_ITEMS_PER_CALL} — split a bigger batch across multiple BULK_CREATE calls instead.`,
        },
      },
      required: ["entity_type", "items"],
    },
  },
  {
    name: "BULK_DELETE",
    staged: true,
    description: `Delete up to ${MAX_BULK_ITEMS_PER_CALL} records of the same type in one shot (same cascades as the single DELETE_* action, per id). A bigger request needs several BULK_DELETE calls, each with at most ${MAX_BULK_ITEMS_PER_CALL} ids.`,
    parameters: {
      type: "object",
      properties: {
        entity_type: { type: "string", enum: BULK_ENTITY_ENUM },
        ids: { type: "array", items: { type: "string" }, maxItems: MAX_BULK_ITEMS_PER_CALL },
      },
      required: ["entity_type", "ids"],
    },
  },

  {
    name: "EXPORT_CSV",
    staged: true,
    description: "Export all records of one entity type as a downloadable CSV file on the user's device.",
    parameters: { type: "object", properties: { entity_type: { type: "string", enum: [...BULK_ENTITY_ENUM, "note"] } }, required: ["entity_type"] },
  },
  {
    name: "SET_CARD_VIEW",
    staged: true,
    description: 'Switch the dashboard\'s card display between "mini" (compact) and "full" (always-editable) mode.',
    parameters: { type: "object", properties: { view: { type: "string", enum: ["mini", "full"] } }, required: ["view"] },
  },
  {
    name: "SET_APPEARANCE",
    staged: true,
    description: "Change the app's theme mode and/or accent color (Settings -> Appearance). Pass whichever one the user actually asked to change; omit the other.",
    parameters: {
      type: "object",
      properties: {
        theme: { type: "string", enum: THEME_MODES, description: '"system" follows the OS/browser setting.' },
        accent: { type: "string", enum: ACCENT_KEYS },
      },
      required: [],
    },
  },
  {
    name: "SET_AI_IDENTITY",
    staged: true,
    description: 'Set your own name/identity/soul/user-profile fields (Settings -> AI Assistant). Used by the "/setup" flow after interviewing the user, or any time they explicitly ask to change how you communicate or what you\'re called. Omit a field to leave it unchanged.',
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "What to call yourself — shown in the chat header." },
        identity: { type: "string", description: "Who you are / your role here." },
        soul: { type: "string", description: "Tone and any standing behavioral protocol the user wants (e.g. always compare two approaches before answering a bug/architecture question)." },
        userProfile: { type: "string", description: "How the user works, what they value, how they like to communicate." },
      },
      required: [],
    },
  },
  {
    name: "WRITE_VAULT_NOTE",
    staged: true,
    description: "Create or update one file in the connected Vaea Brain (a personal Obsidian/GitHub notes repo — see [VAEA BRAIN] below). Staged like every tool above, not run here — the user's own device commits it via the GitHub API using their locally-stored token. Use for \"/vault-log\" (write today's [Daily/YYYY-MM-DD].md, and a [Decisions/...] file too if a real decision was made) and for \"/vault-tidy\" fixes (adding a missing [[wikilink]], creating a stub file). Always pass the FULL desired file content, not a diff — look up the current content via read_vault_note first if you're editing an existing note, and preserve everything in it you're not deliberately changing.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: 'Repo-relative path, e.g. "Daily/2026-07-22.md" or "Decisions/Some Decision.md".' },
        content: { type: "string", description: "The full file content, in Markdown, using [[wikilink]] syntax for any reference to another note." },
        commit_message: { type: "string", description: "Short commit message. Defaults to a generic one if omitted." },
      },
      required: ["path", "content"],
    },
  },

  {
    name: "CREATE_CALENDAR_EVENT",
    staged: true,
    description: "Add an event to the connected Google Calendar (see [GOOGLE CALENDAR] below). Staged like every tool above, not run here — the user's own device creates it via the Google Calendar API using their locally-stored connection. Times are RFC3339 (e.g. \"2026-08-20T14:00:00-04:00\") — use the current date/time context to resolve relative dates like \"tomorrow\" or \"next Tuesday\" before calling this.",
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string", description: "Event title." },
        start: { type: "string", description: "RFC3339 start time, e.g. \"2026-08-20T14:00:00-04:00\". For an all-day event, use a plain date \"2026-08-20\" instead." },
        end: { type: "string", description: "RFC3339 end time (or plain date for an all-day event). Defaults to 1 hour after start if omitted for a timed event." },
        description: { type: "string", description: "Optional event notes/description." },
        location: { type: "string", description: "Optional location." },
        meet_link: { type: "boolean", description: "Set true to attach a real Google Meet video link to this event." },
      },
      required: ["summary", "start"],
    },
  },
  {
    name: "UPDATE_CALENDAR_EVENT",
    staged: true,
    description: "Change an existing Google Calendar event — move it, rename it, edit its notes. Get the event_id from list_calendar_events first; never guess one. Only pass the fields actually changing.",
    parameters: {
      type: "object",
      properties: {
        event_id: { type: "string", description: "The event's id, from list_calendar_events." },
        summary: { type: "string" },
        start: { type: "string", description: "RFC3339 start time or plain date, if moving the event." },
        end: { type: "string", description: "RFC3339 end time or plain date, if moving the event." },
        description: { type: "string" },
        location: { type: "string" },
      },
      required: ["event_id"],
    },
  },
  {
    name: "DELETE_CALENDAR_EVENT",
    staged: true,
    description: "Cancel/remove an event from the connected Google Calendar. Get the event_id from list_calendar_events first; never guess one. Destructive — goes through the normal confirm-before-destructive step like any other delete.",
    parameters: {
      type: "object",
      properties: { event_id: { type: "string", description: "The event's id, from list_calendar_events." } },
      required: ["event_id"],
    },
  },
  {
    name: "list_calendar_events",
    staged: false,
    description: "List upcoming events on the connected Google Calendar (see [GOOGLE CALENDAR] below). Runs immediately and returns real data. Defaults to the next 20 events from right now if no range is given.",
    parameters: {
      type: "object",
      properties: {
        time_min: { type: "string", description: "RFC3339 lower bound, e.g. start of today. Defaults to right now." },
        time_max: { type: "string", description: "RFC3339 upper bound, e.g. end of this week, if the user asked about a specific range." },
      },
      required: [],
    },
  },

  {
    name: "SCHEDULE_CALENDAR_TIME",
    staged: true,
    description: "Vaea Calendar — find a genuinely free slot on the connected calendar(s) and book it, for a one-off task, a recurring protected focus block, or a recurring habit. Only works if the user has turned on \"Let Vaea Calendar auto-schedule tasks\" in Settings -> Agent Behavior — if they haven't, tell them that's where to enable it rather than guessing why nothing happened. Every block this creates is tagged in its description so RESCHEDULE_CALENDAR_CONFLICTS can find it later.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        duration_minutes: { type: "number" },
        block_type: { type: "string", enum: ["task", "focus", "habit"], description: "task: one-off. focus: a recurring protected deep-work block. habit: a recurring personal routine." },
        occurrences: { type: "number", description: "For focus/habit only — how many times to book it. Defaults to 4." },
        days_of_week: { type: "array", items: { type: "number" }, description: "For focus/habit only — which days (0=Sunday) it's allowed to land on. Omit for any day." },
        earliest: { type: "string", description: "RFC3339 — don't search before this. Defaults to now." },
        latest: { type: "string", description: "RFC3339 — don't search past this. Defaults to 14 days out." },
      },
      required: ["title", "duration_minutes", "block_type"],
    },
  },
  {
    name: "RESCHEDULE_CALENDAR_CONFLICTS",
    staged: true,
    description: "Vaea Calendar — find every Vaea-auto-scheduled block (from SCHEDULE_CALENDAR_TIME) that now overlaps a real, non-Vaea event, and move each conflicting block to the next free slot. This is reactive, not a background watcher — call it when the user asks to check, not proactively on every turn.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "search_drive_files",
    staged: false,
    description: "Search the connected Google Drive by filename (see [GOOGLE WORKSPACE] below). Runs immediately and returns real data. Omit query to list the most recently modified files.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Optional filename substring to search for." },
        max_results: { type: "number", description: "Defaults to 20." },
      },
      required: [],
    },
  },
  {
    name: "CREATE_DRIVE_FILE",
    staged: true,
    description: "Create a plain-text file in the connected Google Drive. For a structured document/spreadsheet/presentation, use CREATE_GOOGLE_DOC/CREATE_GOOGLE_SHEET/CREATE_GOOGLE_SLIDES instead.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        content: { type: "string" },
        mime_type: { type: "string", description: "Defaults to text/plain." },
      },
      required: ["name", "content"],
    },
  },
  {
    name: "DELETE_DRIVE_FILE",
    staged: true,
    description: "Delete a file from the connected Google Drive. Get file_id from search_drive_files first; never guess one. Destructive — goes through the normal confirm-before-destructive step.",
    parameters: {
      type: "object",
      properties: { file_id: { type: "string" } },
      required: ["file_id"],
    },
  },
  {
    name: "CREATE_GOOGLE_DOC",
    staged: true,
    description: "Create a new Google Doc in the connected Google Drive.",
    parameters: {
      type: "object",
      properties: { title: { type: "string" } },
      required: ["title"],
    },
  },
  {
    name: "read_google_doc",
    staged: false,
    description: "Read the full plain text of a Google Doc. Get document_id from search_drive_files first; never guess one. Runs immediately and returns real data.",
    parameters: {
      type: "object",
      properties: { document_id: { type: "string" } },
      required: ["document_id"],
    },
  },
  {
    name: "APPEND_GOOGLE_DOC_TEXT",
    staged: true,
    description: "Append text to the end of an existing Google Doc. Get document_id from search_drive_files or read_google_doc first; never guess one.",
    parameters: {
      type: "object",
      properties: { document_id: { type: "string" }, text: { type: "string" } },
      required: ["document_id", "text"],
    },
  },
  {
    name: "REPLACE_GOOGLE_DOC_TEXT",
    staged: true,
    description: "Find and replace every exact-match occurrence of text within a Google Doc.",
    parameters: {
      type: "object",
      properties: { document_id: { type: "string" }, find: { type: "string" }, replace: { type: "string" } },
      required: ["document_id", "find", "replace"],
    },
  },
  {
    name: "CREATE_GOOGLE_SHEET",
    staged: true,
    description: "Create a new Google Sheets spreadsheet in the connected Google Drive.",
    parameters: {
      type: "object",
      properties: { title: { type: "string" } },
      required: ["title"],
    },
  },
  {
    name: "read_google_sheet",
    staged: false,
    description: "Read cell values from a Google Sheets spreadsheet. Get spreadsheet_id from search_drive_files first; never guess one. Runs immediately and returns real data.",
    parameters: {
      type: "object",
      properties: {
        spreadsheet_id: { type: "string" },
        range: { type: "string", description: "A1 notation, e.g. \"Sheet1!A1:C10\". Defaults to a broad range on the first sheet." },
      },
      required: ["spreadsheet_id"],
    },
  },
  {
    name: "UPDATE_GOOGLE_SHEET_VALUES",
    staged: true,
    description: "Overwrite cell values in a Google Sheets range. Pass the FULL rectangle of values for the range, not just the cells changing.",
    parameters: {
      type: "object",
      properties: {
        spreadsheet_id: { type: "string" },
        range: { type: "string", description: "A1 notation, e.g. \"Sheet1!A1:C3\"." },
        values: { type: "array", items: { type: "array", items: {} }, description: "2D array of rows, each an array of cell values." },
      },
      required: ["spreadsheet_id", "range", "values"],
    },
  },
  {
    name: "APPEND_GOOGLE_SHEET_VALUES",
    staged: true,
    description: "Append rows to the end of the data in a Google Sheets range/sheet.",
    parameters: {
      type: "object",
      properties: {
        spreadsheet_id: { type: "string" },
        range: { type: "string", description: "A1 notation naming the sheet/table to append after, e.g. \"Sheet1\"." },
        values: { type: "array", items: { type: "array", items: {} }, description: "2D array of rows to append." },
      },
      required: ["spreadsheet_id", "range", "values"],
    },
  },
  {
    name: "CREATE_GOOGLE_SLIDES",
    staged: true,
    description: "Create a new Google Slides presentation in the connected Google Drive.",
    parameters: {
      type: "object",
      properties: { title: { type: "string" } },
      required: ["title"],
    },
  },
  {
    name: "read_google_slides",
    staged: false,
    description: "Read the text content of every slide in a Google Slides presentation. Get presentation_id from search_drive_files first; never guess one. Runs immediately and returns real data.",
    parameters: {
      type: "object",
      properties: { presentation_id: { type: "string" } },
      required: ["presentation_id"],
    },
  },
  {
    name: "ADD_GOOGLE_SLIDE",
    staged: true,
    description: "Append a new title+body slide to an existing Google Slides presentation.",
    parameters: {
      type: "object",
      properties: {
        presentation_id: { type: "string" },
        title: { type: "string" },
        body: { type: "string" },
      },
      required: ["presentation_id"],
    },
  },
  {
    name: "list_google_task_lists",
    staged: false,
    description: "List the connected account's Google Tasks lists (see [GOOGLE WORKSPACE] below). Runs immediately and returns real data.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "list_google_tasks",
    staged: false,
    description: "List tasks in a Google Tasks list. Defaults to the default list if task_list_id is omitted. Runs immediately and returns real data.",
    parameters: {
      type: "object",
      properties: {
        task_list_id: { type: "string", description: "From list_google_task_lists; omit for the default list." },
        show_completed: { type: "boolean", description: "Defaults to false." },
      },
      required: [],
    },
  },
  {
    name: "CREATE_GOOGLE_TASK",
    staged: true,
    description: "Create a task in a Google Tasks list — the user's actual Google Tasks, not Vaea's own tasks.",
    parameters: {
      type: "object",
      properties: {
        task_list_id: { type: "string", description: "From list_google_task_lists; omit for the default list." },
        title: { type: "string" },
        notes: { type: "string" },
        due: { type: "string", description: "RFC3339 date, e.g. \"2026-08-20T00:00:00.000Z\"." },
      },
      required: ["title"],
    },
  },
  {
    name: "UPDATE_GOOGLE_TASK",
    staged: true,
    description: "Change or complete an existing Google Task. Get task_id from list_google_tasks first; never guess one. Only pass the fields actually changing.",
    parameters: {
      type: "object",
      properties: {
        task_list_id: { type: "string" },
        task_id: { type: "string" },
        title: { type: "string" },
        notes: { type: "string" },
        due: { type: "string" },
        completed: { type: "boolean" },
      },
      required: ["task_id"],
    },
  },
  {
    name: "DELETE_GOOGLE_TASK",
    staged: true,
    description: "Delete a Google Task. Get task_id from list_google_tasks first; never guess one. Destructive — goes through the normal confirm-before-destructive step.",
    parameters: {
      type: "object",
      properties: { task_list_id: { type: "string" }, task_id: { type: "string" } },
      required: ["task_id"],
    },
  },
  {
    name: "CREATE_GOOGLE_FORM",
    staged: true,
    description: "Create a new Google Form in the connected Google Drive.",
    parameters: {
      type: "object",
      properties: { title: { type: "string" } },
      required: ["title"],
    },
  },
  {
    name: "read_google_form",
    staged: false,
    description: "Read a Google Form's questions. Get form_id from search_drive_files first; never guess one. Runs immediately and returns real data.",
    parameters: {
      type: "object",
      properties: { form_id: { type: "string" } },
      required: ["form_id"],
    },
  },
  {
    name: "ADD_GOOGLE_FORM_QUESTION",
    staged: true,
    description: "Add a short-answer text question to an existing Google Form.",
    parameters: {
      type: "object",
      properties: {
        form_id: { type: "string" },
        title: { type: "string", description: "The question text." },
        required: { type: "boolean", description: "Defaults to false." },
      },
      required: ["form_id", "title"],
    },
  },
  {
    name: "list_google_form_responses",
    staged: false,
    description: "List responses submitted to a Google Form. Get form_id from search_drive_files first; never guess one. Runs immediately and returns real data.",
    parameters: {
      type: "object",
      properties: { form_id: { type: "string" } },
      required: ["form_id"],
    },
  },

  {
    name: "SEND_GMAIL_MESSAGE",
    staged: true,
    description: "Send an email from the connected Gmail account (see [GMAIL] below) — shows up in the Vmail tab. Staged like every tool above, not run here — the user's own device sends it via the Gmail API using their locally-stored connection.",
    parameters: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient email address." },
        subject: { type: "string" },
        body: { type: "string", description: "Plain-text message body." },
      },
      required: ["to", "subject", "body"],
    },
  },
  {
    name: "list_gmail_messages",
    staged: false,
    description: "List recent messages in the connected Gmail inbox (see [GMAIL] below, also visible in the Vmail tab). Runs immediately and returns real data. Optional query uses Gmail's own search syntax (e.g. \"is:unread\", \"from:someone@example.com\").",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Optional Gmail search query." },
        max_results: { type: "number", description: "Defaults to 10." },
      },
      required: [],
    },
  },
  {
    name: "read_gmail_message",
    staged: false,
    description: "Read the full body of one Gmail message. Get message_id from list_gmail_messages first; never guess one. Runs immediately and returns real data.",
    parameters: {
      type: "object",
      properties: { message_id: { type: "string", description: "The message's id, from list_gmail_messages." } },
      required: ["message_id"],
    },
  },

  {
    name: "CREATE_OUTLOOK_EVENT",
    staged: true,
    description: "Add an event to the connected Microsoft 365 / Outlook calendar (see [MICROSOFT 365] below). Staged like every tool above, not run here — the user's own device creates it via Microsoft Graph using their locally-stored connection. start/end are {dateTime, timeZone} — resolve relative dates against [CURRENT DATE & TIME] first. Pass teams_meeting: true if the user wants a real Teams join link attached.",
    parameters: {
      type: "object",
      properties: {
        subject: { type: "string", description: "Event title." },
        start: { type: "string", description: "Start date/time, e.g. \"2026-08-20T14:00:00\". For an all-day event, use a plain date \"2026-08-20\"." },
        start_timezone: { type: "string", description: "IANA timezone for start, e.g. \"America/New_York\". Defaults to UTC if omitted." },
        end: { type: "string", description: "End date/time or plain date. Defaults to 1 hour after start if omitted for a timed event." },
        end_timezone: { type: "string", description: "IANA timezone for end. Defaults to start_timezone." },
        description: { type: "string" },
        location: { type: "string" },
        teams_meeting: { type: "boolean", description: "Set true to attach a real Microsoft Teams join link to this event." },
      },
      required: ["subject", "start"],
    },
  },
  {
    name: "UPDATE_OUTLOOK_EVENT",
    staged: true,
    description: "Change an existing Outlook calendar event. Get the event_id from list_outlook_events first; never guess one. Only pass the fields actually changing.",
    parameters: {
      type: "object",
      properties: {
        event_id: { type: "string", description: "The event's id, from list_outlook_events." },
        subject: { type: "string" },
        start: { type: "string" },
        start_timezone: { type: "string" },
        end: { type: "string" },
        end_timezone: { type: "string" },
        description: { type: "string" },
        location: { type: "string" },
      },
      required: ["event_id"],
    },
  },
  {
    name: "DELETE_OUTLOOK_EVENT",
    staged: true,
    description: "Cancel/remove an event from the connected Outlook calendar. Get the event_id from list_outlook_events first; never guess one. Destructive — goes through the normal confirm-before-destructive step like any other delete.",
    parameters: {
      type: "object",
      properties: { event_id: { type: "string", description: "The event's id, from list_outlook_events." } },
      required: ["event_id"],
    },
  },
  {
    name: "list_outlook_events",
    staged: false,
    description: "List upcoming events on the connected Outlook calendar (see [MICROSOFT 365] below). Runs immediately and returns real data. Defaults to the next 30 days from right now if no range is given.",
    parameters: {
      type: "object",
      properties: {
        time_min: { type: "string", description: "ISO lower bound. Defaults to right now." },
        time_max: { type: "string", description: "ISO upper bound, if the user asked about a specific range." },
      },
      required: [],
    },
  },
  {
    name: "SEND_OUTLOOK_MESSAGE",
    staged: true,
    description: "Send an email from the connected Outlook/Exchange account (see [OUTLOOK] below) — shows up in the Vmail tab. Staged like every tool above, not run here — the user's own device sends it via Microsoft Graph using their locally-stored Outlook mail connection.",
    parameters: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient email address." },
        subject: { type: "string" },
        body: { type: "string", description: "Plain-text message body." },
      },
      required: ["to", "subject", "body"],
    },
  },
  {
    name: "list_outlook_messages",
    staged: false,
    description: "List recent messages in the connected Outlook inbox (see [OUTLOOK] below, also visible in the Vmail tab). Runs immediately and returns real data.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Optional search text (subject/body/sender)." },
        max_results: { type: "number", description: "Defaults to 10." },
      },
      required: [],
    },
  },
  {
    name: "read_outlook_message",
    staged: false,
    description: "Read the full body of one Outlook message. Get message_id from list_outlook_messages first; never guess one. Runs immediately and returns real data.",
    parameters: {
      type: "object",
      properties: { message_id: { type: "string", description: "The message's id, from list_outlook_messages." } },
      required: ["message_id"],
    },
  },

  {
    name: "ARCHIVE_GMAIL_MESSAGE",
    staged: true,
    description: "Archive a Gmail message (removes it from the inbox, keeps it — not a delete). Get message_id from list_gmail_messages first; never guess one. Non-destructive — runs immediately, no confirmation needed.",
    parameters: { type: "object", properties: { message_id: { type: "string" } }, required: ["message_id"] },
  },
  {
    name: "DELETE_GMAIL_MESSAGE",
    staged: true,
    description: "Move a Gmail message to Trash. Get message_id from list_gmail_messages first; never guess one. Destructive — goes through the normal confirm-before-destructive step like any other delete.",
    parameters: { type: "object", properties: { message_id: { type: "string" } }, required: ["message_id"] },
  },
  {
    name: "REPORT_GMAIL_SPAM",
    staged: true,
    description: "Mark a Gmail message as spam (moves it out of the inbox into Spam). Use this whenever a message looks like a scam/phishing attempt and the user asks you to deal with it, or you're managing the inbox and flag one yourself. Get message_id from list_gmail_messages first; never guess one. Non-destructive — runs immediately, no confirmation needed.",
    parameters: { type: "object", properties: { message_id: { type: "string" } }, required: ["message_id"] },
  },
  {
    name: "DRAFT_GMAIL_REPLY",
    staged: true,
    description: "Create a real Gmail draft replying to a message — threaded onto the original, correct \"Re:\" subject — WITHOUT sending it. The user reviews and sends it themselves (from their real Gmail, or ask them if they'd rather you send it outright via SEND_GMAIL_MESSAGE instead). Get message_id from list_gmail_messages first; never guess one. Non-destructive — runs immediately, no confirmation needed.",
    parameters: {
      type: "object",
      properties: {
        message_id: { type: "string", description: "The message being replied to, from list_gmail_messages." },
        to: { type: "string", description: "Recipient — normally the original sender's address." },
        subject: { type: "string", description: "Reply subject — \"Re: \" is added automatically if missing." },
        body: { type: "string", description: "Plain-text reply body." },
      },
      required: ["message_id", "to", "subject", "body"],
    },
  },
  {
    name: "ARCHIVE_OUTLOOK_MESSAGE",
    staged: true,
    description: "Archive an Outlook message (moves it to the Archive folder, keeps it — not a delete). Get message_id from list_outlook_messages first; never guess one. Non-destructive — runs immediately, no confirmation needed.",
    parameters: { type: "object", properties: { message_id: { type: "string" } }, required: ["message_id"] },
  },
  {
    name: "DELETE_OUTLOOK_MESSAGE",
    staged: true,
    description: "Move an Outlook message to Deleted Items. Get message_id from list_outlook_messages first; never guess one. Destructive — goes through the normal confirm-before-destructive step like any other delete.",
    parameters: { type: "object", properties: { message_id: { type: "string" } }, required: ["message_id"] },
  },
  {
    name: "REPORT_OUTLOOK_SPAM",
    staged: true,
    description: "Mark an Outlook message as junk (moves it to the Junk Email folder). Use this whenever a message looks like a scam/phishing attempt and the user asks you to deal with it, or you're managing the inbox and flag one yourself. Get message_id from list_outlook_messages first; never guess one. Non-destructive — runs immediately, no confirmation needed.",
    parameters: { type: "object", properties: { message_id: { type: "string" } }, required: ["message_id"] },
  },
  {
    name: "DRAFT_OUTLOOK_REPLY",
    staged: true,
    description: "Create a real Outlook draft replying to a message — threaded onto the original via Graph's own reply endpoint — WITHOUT sending it. The user reviews and sends it themselves (from their real Outlook, or ask them if they'd rather you send it outright via SEND_OUTLOOK_MESSAGE instead). Get message_id from list_outlook_messages first; never guess one. Non-destructive — runs immediately, no confirmation needed.",
    parameters: {
      type: "object",
      properties: {
        message_id: { type: "string", description: "The message being replied to, from list_outlook_messages." },
        body: { type: "string", description: "Plain-text reply body." },
      },
      required: ["message_id", "body"],
    },
  },

  {
    name: "CREATE_CLICKUP_TASK",
    staged: true,
    description: "Add a task to the connected ClickUp workspace (see [CLICKUP] below). Staged like every tool above, not run here — the user's own device creates it via the ClickUp API using their locally-stored connection. Uses the default list configured in Settings unless list_id is given (from list_clickup_lists).",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Task name." },
        description: { type: "string", description: "Optional task description." },
        due_date: { type: "string", description: "Optional ISO date/datetime." },
        status: { type: "string", description: "Optional status (must be a real status in that list — check list_clickup_tasks for valid values if unsure)." },
        list_id: { type: "string", description: "Which ClickUp list to create it in. Omit to use the default list configured in Settings." },
      },
      required: ["name"],
    },
  },
  {
    name: "UPDATE_CLICKUP_TASK",
    staged: true,
    description: "Change an existing ClickUp task. Get the task_id from list_clickup_tasks first; never guess one. Only pass the fields actually changing.",
    parameters: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "The task's id, from list_clickup_tasks." },
        name: { type: "string" },
        description: { type: "string" },
        status: { type: "string" },
        due_date: { type: "string" },
      },
      required: ["task_id"],
    },
  },
  {
    name: "DELETE_CLICKUP_TASK",
    staged: true,
    description: "Delete a task from the connected ClickUp workspace. Get the task_id from list_clickup_tasks first; never guess one. Destructive — goes through the normal confirm-before-destructive step like any other delete.",
    parameters: {
      type: "object",
      properties: { task_id: { type: "string", description: "The task's id, from list_clickup_tasks." } },
      required: ["task_id"],
    },
  },
  {
    name: "SEND_CLICKUP_MESSAGE",
    staged: true,
    description: "Post a message to a ClickUp Chat channel. Get the channel_id from list_clickup_channels first; never guess one.",
    parameters: {
      type: "object",
      properties: {
        channel_id: { type: "string", description: "The channel's id, from list_clickup_channels." },
        content: { type: "string", description: "The message text (Markdown)." },
      },
      required: ["channel_id", "content"],
    },
  },
  {
    name: "list_clickup_spaces",
    staged: false,
    description: "List every Space in the connected ClickUp workspace. Runs immediately. Use before list_clickup_lists if you need to find a list outside the default one.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "list_clickup_lists",
    staged: false,
    description: "List every List within a ClickUp Space (from list_clickup_spaces). Runs immediately. Use to find a list_id for CREATE_CLICKUP_TASK when the default list configured in Settings isn't the right one.",
    parameters: { type: "object", properties: { space_id: { type: "string" } }, required: ["space_id"] },
  },
  {
    name: "list_clickup_tasks",
    staged: false,
    description: "List tasks in a ClickUp list (see [CLICKUP] below for the default list_id if the user didn't specify one). Runs immediately and returns real data.",
    parameters: {
      type: "object",
      properties: {
        list_id: { type: "string", description: "Which list to read. Omit to use the default list configured in Settings." },
        include_closed: { type: "boolean", description: "Include completed tasks. Defaults to false." },
      },
      required: [],
    },
  },
  {
    name: "list_clickup_channels",
    staged: false,
    description: "List ClickUp Chat channels in the connected workspace. Runs immediately.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "list_clickup_messages",
    staged: false,
    description: "Read recent messages in a ClickUp Chat channel (from list_clickup_channels). Runs immediately.",
    parameters: { type: "object", properties: { channel_id: { type: "string" } }, required: ["channel_id"] },
  },

  {
    name: "SEND_SLACK_MESSAGE",
    staged: true,
    description: "Post a message to a Slack channel as the connected user (see [SLACK] below). Staged — not run here. Get the channel_id from list_slack_channels first; never guess one.",
    parameters: {
      type: "object",
      properties: {
        channel_id: { type: "string", description: "The channel's id, from list_slack_channels." },
        text: { type: "string", description: "The message text." },
      },
      required: ["channel_id", "text"],
    },
  },
  {
    name: "list_slack_channels",
    staged: false,
    description: "List public channels in the connected Slack workspace (see [SLACK] below). Runs immediately. Use before list_slack_messages or SEND_SLACK_MESSAGE to find the right channel_id.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "list_slack_messages",
    staged: false,
    description: "Read recent messages from a Slack channel. Get channel_id from list_slack_channels first. Runs immediately.",
    parameters: {
      type: "object",
      properties: {
        channel_id: { type: "string", description: "The channel's id, from list_slack_channels." },
        limit: { type: "number", description: "Max messages to return. Defaults to 20." },
      },
      required: ["channel_id"],
    },
  },

  {
    name: "suggest_task_fields",
    staged: false,
    description: "Analyze a task description and suggest the most appropriate quadrant (1=urgent+important, 2=important not urgent, 3=urgent not important, 4=neither), whether it's highly important (H), and a brief rationale. Runs immediately. Call this when a user asks for help prioritizing a task they just described, or when they ask what quadrant something should go in.",
    parameters: {
      type: "object",
      properties: {
        description: { type: "string", description: "The task description to analyze." },
        context: { type: "string", description: "Optional: any relevant context about the user's current priorities." },
      },
      required: ["description"],
    },
  },
  {
    name: "search_workspace",
    staged: false,
    description: 'Search across all areas, products, projects (including archived), tasks (including archived), stakeholders, and notes for a keyword — use this for "what did we decide about X" / "find every task mentioning Y" style requests instead of scanning [DATABASE STATE] yourself.',
    parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
  {
    name: "audit_workspace",
    staged: false,
    description: "Audit the whole workspace for hygiene issues — overdue/unowned projects, done-but-unarchived tasks, near-duplicate notes/tasks, stakeholders with no department, empty areas/products. Runs immediately and returns findings only; it does not fix anything itself — propose fixes afterward using the normal CREATE_*/UPDATE_*/ARCHIVE_*/DELETE_* tools, as a confirmable plan like any other request.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "list_vault_notes",
    staged: false,
    description: "List every note (path) in the connected Vaea Brain. Runs immediately. Use to get an overview before deciding what to read, or to check whether a note already exists before creating one.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "read_vault_note",
    staged: false,
    description: "Read one note's full content from the connected Vaea Brain by its exact path (from list_vault_notes or search_vault). Runs immediately and returns real content.",
    parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
  },
  {
    name: "search_vault",
    staged: false,
    description: 'Search the connected Vaea Brain by keyword (GitHub code search, scoped to that one repo). Use for "what did we decide about X" / "find notes mentioning Y" style questions about the user\'s personal vault. Runs immediately.',
    parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
  {
    name: "audit_vault",
    staged: false,
    description: "Audit the connected Vaea Brain: [[wikilink]] structural issues (broken links, isolated notes with zero incoming/outgoing links), suggested_links (note pairs with real topical overlap that aren't linked yet — a real candidate for you to propose a [[wikilink]] between, not a certainty), possible_duplicates (note pairs similar enough they may be the same note written twice — propose a merge, never delete either side without asking), and tags (auto-generated per-note keyword tags, a local word-frequency heuristic, not a synonym/topic-modeling system — treat them as a rough hint, not authoritative). Runs immediately and returns findings only — propose fixes afterward with WRITE_VAULT_NOTE, as a normal confirmable plan, same pattern as audit_workspace/\"/tidy\". Reads every note's content once, so mention it may take a moment on a large vault.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "read_project_link",
    staged: false,
    description: "Read the real content at ANY URL — a URL from a project's \"links\" array (see [DATABASE STATE]), OR a URL the user just pasted/shared directly in this conversation (a Google Drive file, a doc, a GitHub repo, a spec) — instead of only seeing a label/URL string or guessing at what's there. Always call this the instant a request needs to know what a link actually contains, whether it came from a project's own links array or straight from the user's own message. Runs immediately as a plain client-side fetch (not an LLM-driven browse), so some sites will block it via CORS, and an auth-gated URL (e.g. a private Google Drive/Docs link needing sign-in) will come back as an unreadable shell rather than real content — if either happens you'll get a clear error/empty-content result back; tell the user plainly rather than guessing, and ask them to paste the actual text/list instead if the link truly can't be read this way.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "The URL to read — either the exact URL from a project's links array (look it up in [DATABASE STATE] by the link's label, never invent one), or a URL the user directly gave you in this conversation." },
        focus: { type: "string", description: "What to focus on, if the user asked about something specific." },
      },
      required: ["url"],
    },
  },
  {
    name: "analyze_attachment",
    staged: false,
    description: 'Read the actual contents of a file the user attached in this conversation. Runs immediately as a plain client-side fetch: an image (png/jpeg/gif/webp) is handed to you directly so you can genuinely see it (plus a best-effort ocr_text field from a local OCR pass, useful if you have no vision input), a plain-text file\'s content is returned as-is, and a PDF gets real page-by-page text extraction (extracted_text, page_count). A Word doc/other binary format comes back as an honest error instead, since no document parser is available outside Vaea\'s own built-in model.',
    parameters: {
      type: "object",
      properties: {
        file_url: { type: "string", description: 'The URL from a "[Attached: name](url)" line in the latest message.' },
        focus: { type: "string", description: "What to focus the summary on, if the user asked about something specific." },
      },
      required: ["file_url"],
    },
  },

  // --- Full UI parity: every one of these mirrors an action a real user can
  // already take by hand in the app's own UI (Notifications' rule builder,
  // the chat sidebar's Agents/Prompt Templates cards, the Workflow Canvas,
  // Settings -> Agent Behavior, Settings -> Backup & Restore) — so asking
  // the assistant to do it is never a dead end just because that surface
  // happens to be a newer part of the app. ---

  {
    name: "CREATE_NOTIFICATION_RULE",
    staged: true,
    description: "Add a threshold rule to the Notifications page — the same rule builder the user has there themselves. Triggers when the given metric is at or above the threshold.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "A short label for the rule, e.g. \"5+ projects overdue\"." },
        metric: { type: "string", enum: ["overdue_projects", "at_risk_projects", "not_started_tasks"] },
        threshold: { type: "number" },
      },
      required: ["name", "metric", "threshold"],
    },
  },
  {
    name: "DELETE_NOTIFICATION_RULE",
    staged: true,
    description: "Remove a rule from the Notifications page by its exact name.",
    parameters: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
  },
  {
    name: "CREATE_AGENT",
    staged: true,
    description: "Add a named agent definition to the chat sidebar's Agents card — the same thing the user can do there with \"New agent\". This defines an agent (name + what it's for); it does not run anything on its own yet.",
    parameters: {
      type: "object",
      properties: { name: { type: "string" }, purpose: { type: "string", description: "Optional one-line description of what it's for." } },
      required: ["name"],
    },
  },
  {
    name: "DELETE_AGENT",
    staged: true,
    description: "Remove a named agent from the Agents card by its exact name.",
    parameters: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
  },
  {
    name: "CREATE_PROMPT_TEMPLATE",
    staged: true,
    description: "Save a reusable prompt template to the chat sidebar's Prompt Templates card — the same thing the user can do there with \"New template\". Clicking it later drops the text into the composer.",
    parameters: {
      type: "object",
      properties: { name: { type: "string" }, text: { type: "string" } },
      required: ["name", "text"],
    },
  },
  {
    name: "DELETE_PROMPT_TEMPLATE",
    staged: true,
    description: "Remove a saved prompt template by its exact name.",
    parameters: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
  },
  {
    name: "CREATE_WORKFLOW_CARD",
    staged: true,
    description: "Add a sticky-note card to the Workflow Canvas page — the same thing the user can do there with \"Add card\".",
    parameters: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
  },
  {
    name: "UPDATE_WORKFLOW_CARD",
    staged: true,
    description: "Change the text of an existing Workflow Canvas card. Get card_id from list_workflow_cards first; never guess one.",
    parameters: { type: "object", properties: { card_id: { type: "string" }, text: { type: "string" } }, required: ["card_id", "text"] },
  },
  {
    name: "DELETE_WORKFLOW_CARD",
    staged: true,
    description: "Remove a Workflow Canvas card. Get card_id from list_workflow_cards first; never guess one. Destructive — goes through the normal confirm-before-destructive step.",
    parameters: { type: "object", properties: { card_id: { type: "string" } }, required: ["card_id"] },
  },
  {
    name: "list_workflow_cards",
    staged: false,
    description: "List the cards currently on the Workflow Canvas. Runs immediately and returns real data.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "SET_AGENT_BEHAVIOR",
    staged: true,
    description: "Turn one or more of Settings -> Agent Behavior's three toggles on or off — the same switches the user can flip there themselves. Only pass the ones actually changing.",
    parameters: {
      type: "object",
      properties: {
        approval_queue_enabled: { type: "boolean", description: "Approve every action, not just destructive ones." },
        multi_model_comparison_enabled: { type: "boolean", description: "Compare answers across connected BYOK providers." },
        auto_scheduling_enabled: { type: "boolean", description: "Let Vaea Calendar auto-schedule tasks." },
      },
      required: [],
    },
  },
  {
    name: "CREATE_BACKUP",
    staged: true,
    description: "Create a manual backup snapshot of the whole workspace — the same thing the user can do in Settings -> Backup & Restore. A snapshot is also always taken automatically before any risky multi-step plan, so this is for an on-demand extra one.",
    parameters: { type: "object", properties: { label: { type: "string", description: "Optional label, e.g. \"before reorg\"." } }, required: [] },
  },
  {
    name: "list_backups",
    staged: false,
    description: "List available backup snapshots (most recent first). Runs immediately and returns real data.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "RESTORE_BACKUP",
    staged: true,
    description: "Restore the workspace from a backup snapshot — the same \"Restore\" button in Settings -> Backup & Restore. Get snapshot_id from list_backups first; never guess one. Destructive (overwrites current data) — goes through the normal confirm-before-destructive step.",
    parameters: { type: "object", properties: { snapshot_id: { type: "string" } }, required: ["snapshot_id"] },
  },
  {
    name: "OPEN_APP_SECTION",
    staged: true,
    description: "Navigate the user's own screen to a specific tab — and for Settings, a specific section, or for Mind Map, a specific inner tab — so they can actually see it. Use this whenever someone asks where something lives (\"where's the Outlook connector\", \"show me the mind map\", \"open my workflows\", \"open notifications\") instead of just describing it in words. Also pops the floating chat window open so the user keeps seeing the conversation while looking at the destination, scrolls straight to it, and briefly highlights it. Not destructive — runs immediately, no confirmation needed.",
    parameters: {
      type: "object",
      properties: {
        tab: { type: "string", enum: ["dashboard", "chat", "calendar", "vmail", "meetings", "notifications", "mindmap", "settings"], description: "Which tab to open. Workflows lives inside Mind Map now (mindmap_tab: \"workflows\") — there's no separate \"workflows\" tab." },
        settings_section: {
          type: "string",
          enum: ["account", "appearance", "ai", "ai-model", "agent-behavior", "storage", "backup", "connector-health", "brain", "google-workspace", "gmail", "microsoft", "outlook", "apple-mail", "clickup", "slack", "resources"],
          description: "Only used when tab is \"settings\" — which section to scroll to and highlight (e.g. \"outlook\" for the Outlook connector, \"apple-mail\" for Apple Mail).",
        },
        mindmap_tab: {
          type: "string",
          enum: ["vault", "workflows"],
          description: "Only used when tab is \"mindmap\" — which of its two inner tabs to open (\"vault\" for the note graph, \"workflows\" for the sketching canvas). Defaults to whichever was last open if omitted.",
        },
      },
      required: ["tab"],
    },
  },
];

export const STAGED_TOOL_NAMES = new Set(TOOL_CATALOG.filter((t) => t.staged).map((t) => t.name));

const TOOL_CATALOG_BY_NAME = new Map(TOOL_CATALOG.map((t) => [t.name, t]));

// A light, hand-rolled check — required-field presence and a basic
// type match against `parameters` (a plain JSON-Schema-ish object, no need
// for a real validator library like Ajv/Zod given how simple these shapes
// are) — NOT full JSON Schema validation (no nested object/array item
// checking, no enum/format checks). Exists so toolRunner.js can catch an
// obviously bad staged tool call (missing required field, wrong type) at
// staging time and hand the model/relay a `tool_result` error to
// self-correct from, instead of the bad args sailing straight into the plan
// and only surfacing later, at confirm/execute time. Returns a short error
// string, or null if the call looks fine (including when the tool name
// itself isn't in the catalog at all — toolRunner.js's own STAGED_TOOL_NAMES
// check already gates that before this ever runs).
export function validateToolInput(name, input) {
  const tool = TOOL_CATALOG_BY_NAME.get(name);
  if (!tool) return null;
  const { properties = {}, required = [] } = tool.parameters || {};
  const args = input || {};
  for (const field of required) {
    if (args[field] === undefined || args[field] === null || args[field] === "") {
      return `Missing required field "${field}" for ${name}.`;
    }
  }
  for (const [field, value] of Object.entries(args)) {
    const schema = properties[field];
    if (!schema || value === undefined || value === null) continue;
    if (schema.type === "array" && !Array.isArray(value)) {
      return `Field "${field}" for ${name} must be an array, got ${typeof value}.`;
    }
    if (schema.type === "string" && typeof value !== "string") {
      return `Field "${field}" for ${name} must be a string, got ${typeof value}.`;
    }
    if (schema.type === "number" && typeof value !== "number") {
      return `Field "${field}" for ${name} must be a number, got ${typeof value}.`;
    }
    if (schema.type === "boolean" && typeof value !== "boolean") {
      return `Field "${field}" for ${name} must be a boolean, got ${typeof value}.`;
    }
    if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
      return `Field "${field}" for ${name} must be one of: ${schema.enum.join(", ")} — got "${value}".`;
    }
  }
  return null;
}

// Every tool's own connector, by name pattern rather than a per-entry field
// — the catalog is 100+ tools now (mostly Google Workspace/Gmail/Microsoft/
// Slack/ClickUp/Vault, added connector-by-connector across many sessions),
// and every single one is real input-token cost on EVERY request whether or
// not the model ever uses it. Most users have 1-2 connectors actually
// connected, not all of them — sending a not-connected connector's ~15-30
// tool definitions on a plain "hi" is pure waste, and was the single
// biggest contributor to prompt bloat once the catalog grew this large.
// null means "core" — always included regardless of connection state
// (entity CRUD, appearance, AI identity, workspace/attachment reads, and
// every local-only feature added this session that needs no connector at
// all: notification rules, agents, prompt templates, workflow cards, agent
// behavior, backups).
function toolConnectorGroup(name) {
  if (/GMAIL/i.test(name)) return "gmail";
  // Outlook split into two independently-connected scopes: mail tools
  // (message/mail) feed the Vmail tab off outlookConnection.js, event
  // tools stay on the Calendar-only microsoftConnection.js grant.
  if (/OUTLOOK.*(MESSAGE|SPAM|REPLY)|outlook_message/i.test(name)) return "outlook";
  if (/OUTLOOK/i.test(name)) return "microsoft";
  if (/CLICKUP/i.test(name)) return "clickup";
  if (/SLACK/i.test(name)) return "slack";
  if (/VAULT/i.test(name)) return "vault";
  if (/GOOGLE|CALENDAR|DRIVE_FILE/i.test(name)) return "google_workspace";
  return null;
}

// `connections` is optional so every existing call site (tests, anything
// not yet passing it) keeps working unfiltered — pass real connection
// booleans to actually get the savings. Keys match toolConnectorGroup's
// return values.
function filterByConnections(catalog, connections) {
  if (!connections) return catalog;
  return catalog.filter((t) => {
    const group = toolConnectorGroup(t.name);
    return !group || connections[group];
  });
}

// Anthropic's Messages API wants { name, description, input_schema }.
export function toAnthropicTools(connections) {
  return filterByConnections(TOOL_CATALOG, connections).map(({ name, description, parameters }) => ({ name, description, input_schema: parameters }));
}

// OpenAI-compatible chat-completions wants { type: "function", function: { name, description, parameters } }.
export function toOpenAiCompatibleTools(connections) {
  return filterByConnections(TOOL_CATALOG, connections).map(({ name, description, parameters }) => ({ type: "function", function: { name, description, parameters } }));
}

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
    description: "Create or update one file in the connected Vaea Vault (a personal Obsidian/GitHub notes repo — see [VAEA VAULT] below). Staged like every tool above, not run here — the user's own device commits it via the GitHub API using their locally-stored token. Use for \"/vault-log\" (write today's [Daily/YYYY-MM-DD].md, and a [Decisions/...] file too if a real decision was made) and for \"/vault-tidy\" fixes (adding a missing [[wikilink]], creating a stub file). Always pass the FULL desired file content, not a diff — look up the current content via read_vault_note first if you're editing an existing note, and preserve everything in it you're not deliberately changing.",
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
    description: "List every note (path) in the connected Vaea Vault. Runs immediately. Use to get an overview before deciding what to read, or to check whether a note already exists before creating one.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "read_vault_note",
    staged: false,
    description: "Read one note's full content from the connected Vaea Vault by its exact path (from list_vault_notes or search_vault). Runs immediately and returns real content.",
    parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
  },
  {
    name: "search_vault",
    staged: false,
    description: 'Search the connected Vaea Vault by keyword (GitHub code search, scoped to that one repo). Use for "what did we decide about X" / "find notes mentioning Y" style questions about the user\'s personal vault. Runs immediately.',
    parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
  {
    name: "audit_vault",
    staged: false,
    description: "Audit the connected Vaea Vault's [[wikilinks]] for structural issues: links pointing at a note that doesn't exist (broken links) and notes with zero incoming or outgoing links (isolated notes). Runs immediately and returns findings only — propose fixes afterward with WRITE_VAULT_NOTE, as a normal confirmable plan, same pattern as audit_workspace/\"/tidy\". Reads every note's content once, so mention it may take a moment on a large vault.",
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
    description: 'Read the actual contents of a file the user attached in this conversation. Runs immediately as a plain client-side fetch: an image (png/jpeg/gif/webp) is handed to you directly so you can genuinely see it, a plain-text file\'s content is returned as-is — a PDF/Word doc/other binary format comes back as an honest error instead, since no document parser is available outside Vaea\'s own built-in model.',
    parameters: {
      type: "object",
      properties: {
        file_url: { type: "string", description: 'The URL from a "[Attached: name](url)" line in the latest message.' },
        focus: { type: "string", description: "What to focus the summary on, if the user asked about something specific." },
      },
      required: ["file_url"],
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

// Anthropic's Messages API wants { name, description, input_schema }.
export function toAnthropicTools() {
  return TOOL_CATALOG.map(({ name, description, parameters }) => ({ name, description, input_schema: parameters }));
}

// OpenAI-compatible chat-completions wants { type: "function", function: { name, description, parameters } }.
export function toOpenAiCompatibleTools() {
  return TOOL_CATALOG.map(({ name, description, parameters }) => ({ type: "function", function: { name, description, parameters } }));
}

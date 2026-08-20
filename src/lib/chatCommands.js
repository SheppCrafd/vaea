// The chat input's "/" autocomplete list — kept in sync by hand with the
// SLASH_COMMAND_GUIDE block in base44/functions/aiChatStream/entry.ts (the
// two live in different runtimes and can't share a module) and with the
// "In-chat commands" table in README.md.
export const CHAT_COMMANDS = [
  { name: "task", description: "Add a task to the active project" },
  { name: "project", description: "Create a new project" },
  { name: "product", description: "Create a new product" },
  { name: "area", description: "Create a new area of responsibility" },
  { name: "note", description: "Add a note to the active project" },
  { name: "risk", description: "Log a risk on the active project" },
  { name: "question", description: "Log an open question on the active project" },
  { name: "stakeholder", description: "Add a new stakeholder" },
  { name: "status", description: "Change a task's status" },
  { name: "top3", description: "Mark a task as one of today's top 3" },
  { name: "focus", description: "Mark a task as this week's focus" },
  { name: "tidy", description: "Audit the workspace for hygiene issues and propose fixes" },
  { name: "setup", description: "Let the assistant interview you and set its own name/identity/soul" },
  { name: "vault-log", description: "Log this session to your connected Vaea Vault" },
  { name: "vault-tidy", description: "Audit your connected Vaea Vault's wikilinks and propose fixes" },
  { name: "daily-brief", description: "Get a morning briefing across your workspace, calendar, and connected services" },
  { name: "parse-notes", description: "Paste meeting notes — extract tasks, decisions, and follow-ups" },
  { name: "break-down", description: "Break a task or goal into subtasks" },
  { name: "help", description: "List all available slash commands" },
];

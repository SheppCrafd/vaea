# Portfolio Tracker (semi-self-owned)

Repo: https://github.com/SheppCrafd/portfolio-tracker-semiselfowned

A dashboard for managing a portfolio of projects and products across your areas of responsibility — with task tracking, stakeholder visibility, a focus feed, and an AI chat assistant that can act on your data.

This is a fork of the original [Base44](https://base44.com)-backed Portfolio Tracker with everything but the AI assistant moved off Base44: there's no login/account system, and all core app data (areas, products, projects, tasks, stakeholders, departments, notes) lives in the browser's `localStorage` (`src/lib/localDb.js`) instead of a hosted database. Base44 is retained only to run the AI chat assistant's backend function and its own chat history storage — see "Architecture" below for how that split works, including an important caveat about the AI assistant's data.

## Overview

Portfolio Tracker is built for someone managing many projects and products across multiple areas of responsibility (e.g. "Work", "Home"). It organizes work into a three-level hierarchy and gives you a single dashboard to see status, risks, and priorities at a glance:

- **Areas of Responsibility** — the broadest grouping (e.g. Work, Home).
- **Products** — sit inside an area, optionally connected to related products.
- **Projects** — sit inside a product, or directly inside an area if there's no product. Each project owns a set of tasks.

Each level is rendered as a card, nested inside its parent's card, so the dashboard reads as a visual hierarchy rather than a flat list.

### Key features

- **Project cards** show a quadrant breakdown of task counts (Eisenhower-style: important/urgent), owner and due date (color-coded by commitment status), and separate Risks and Open Questions boxes that only tint (red / pending-feedback orange) once populated — plus nearly everything from the expandable detail view is also directly editable on the card face itself (objective, problem statement, metrics, stakeholders, notes, related products, attachments, and populated links in the lower-right corner). The detail view remains for archive/delete, the full task table, and custom-field creation.
- **Task table** per project with status, quadrant + H/Q flags, type, notes, stakeholders, and attachments — every column is independently sortable and filterable, defaulting to a Quadrant sort, plus a "Clear Done" button to bulk-archive completed tasks. Tasks can be flagged as a weekly focus item or one of "today's top 3."
- **Product and Area cards** with their own expandable detail views, stakeholders, and support for user-defined custom fields (global or per-card, optionally surfaced on the card face).
- **Create New / Filter** — a single entry point to create a Task, Project, Product, or Area, plus filtering by area/product/project.
- **Right sidebar** — Today's Top 3, this week's focus items grouped by project, and a horizontal bar chart of task status counts per project.
- **Left sidebar** — stakeholders grouped by department, with per-category (tasks/notes/projects/products) counts that toggle a color-coded highlight (a tint on the matching cards/rows) across the dashboard. Each stakeholder is drag-and-droppable: drop one onto a project/product/task card to assign them, or onto a department to reassign them (department is otherwise not editable from the row).
- **AI chat assistant** — a floating chat widget (and a full `/chat` page) backed by a streaming LLM function that can create/update tasks, projects, products, and areas, add notes, mark focus items, and answer questions about your data, including archived items. The widget is a real draggable/resizable window (drag the header to move it, drag any edge or corner to resize) and remembers its position and size between sessions.
- **Archive view** — a date-range view of everything that was active during that window, including archived projects/tasks, which remain fully editable and can be restored.
- **Product connection lines** — when a project is linked to a product beyond its primary parent (via the "Connect Products" control), a dashed curve is drawn between the two cards, layered so it crosses over Area/Product/Project cards but stays underneath every other UI element (popovers, modals, the chat widget, the archive button).
- **Collapsible sidebars, dark mode, and accent themes** — both side panels collapse via hamburger toggles in the header (state persists across sessions), and a settings shortcut (top right) links to a **Settings** page for switching Light/Dark/System theme and picking one of four curated accent colors (Slate/Indigo/Emerald/Amber). There's no account system, so nothing else lives there.
- **Own branding** — tab title, favicon, and web app manifest (`public/`) are this fork's own, not Base44's default.

### In-chat commands

Typing `/` as the first character of a chat message opens a command menu. Keep typing letters to filter it; the menu closes the moment you type anything that isn't a letter (a space, a comma, etc.), so a command is always a single word — after that, just keep typing your message normally. Select a suggestion with `↑`/`↓` + `Enter`/`Tab`, or click it.

If you send a `/word` that isn't one of the commands below, it's simply treated as plain text — no menu appears for it, and the assistant doesn't try to guess an action for it.

| Command | What it does |
|---|---|
| `/task <description>` | Add a task to the active project |
| `/project <title>` | Create a new project |
| `/product <title>` | Create a new product |
| `/area <title>` | Create a new area of responsibility |
| `/note <text>` | Add a note to the active project |
| `/risk <text>` | Log a risk on the active project |
| `/question <text>` | Log an open question on the active project |
| `/stakeholder <name>` | Add a new stakeholder |
| `/status <task, new status>` | Change a task's status |
| `/top3 <task>` | Mark a task as one of today's top 3 |
| `/focus <task>` | Mark a task as this week's focus |
| `/help` | List all available slash commands |

The client-side list lives in `src/lib/chatCommands.js`; the matching server-side instructions (what each command maps to, and the "ignore anything not on this list" rule) live in `base44/functions/aiChatStream/entry.ts`.

## How it works

### Architecture

- **Frontend**: React 18 + Vite, React Router, TanStack Query for data fetching/caching, Zustand for lightweight client state, Tailwind CSS + Radix UI primitives (via `shadcn`-style components in `src/components/ui`) for the design system. Animation is plain Tailwind (`tailwindcss-animate`'s `animate-in`/`fade-in`/`zoom-in` utilities) plus a handful of custom CSS keyframes in `src/index.css` (the chat "thinking" icon, message fade-in, launch pulse) — no animation library. The status bar chart (`TaskStatistics`) is a hand-rolled stacked-div bar, not a charting library. Dark/light/system theming is wired via `next-themes` (`ThemeProvider` in `App.jsx`); accent color is a separate `data-accent` attribute + CSS-variable override system (`useAccentTheme`), independent of light/dark.
- **Backend, split in two:**
  - **Core app data** (areas, products, projects, tasks, stakeholders, departments, project notes) lives entirely in the browser via `src/lib/localDb.js`, a small localStorage-backed repository (list/get/filter/create/update/delete + a subscribe hook for live task-count polling) that the entity hooks in `src/hooks/` (`useAreas`, `useProducts`, `useProjects`, `useTasks`, `useStakeholders`, `useDepartments`, `useProjectNotes`) sit on top of. There is no server for this data — it's single-browser, and clearing site data clears it.
  - **The AI chat assistant** is still backed by [Base44](https://base44.com): `base44/functions/aiChatStream` (a Base44 serverless function) does the LLM call and, when the assistant chooses an action, executes it — but it does so against **Base44's own hosted entities**, not the localStorage data above. **This means the AI assistant reads and writes a separate, disconnected dataset from the one the rest of the UI shows** — asking it to create a task will not make that task appear on your local dashboard, and vice versa. This was a deliberate scope decision when this fork was cut (see git history), not an oversight; if you want the assistant to act on your real local data, `aiChatStream`'s `executeAction` switch statement is the place to rewire it against `localDb`. Chat session/message history (`ChatSession`/`ChatMessage`) and chat file attachments also still go through Base44, via `src/api/base44Client.js`.
- **Build tooling**: Vite with the `@base44/vite-plugin` (dev-only HMR notifier, visual-edit agent, and analytics hooks — kept because `aiChatStream` still needs the Base44 toolchain), ESLint, TypeScript in `checkJs` mode for type-checking JS via `jsconfig.json`, and Vitest for unit tests.

### Data model

Local data (`src/lib/localDb.js`, no schema enforcement beyond what the hooks/components read and write):

| Collection | Purpose |
|---|---|
| `areas` | Top-level area of responsibility; supports custom fields. |
| `products` | Belongs to an area; tracks stakeholders and related products. |
| `projects` | Belongs to a product and/or area; owns objective, due date, risks, metrics, archive state. |
| `tasks` | Belongs to a project; status, quadrant, type, focus/top-3 flags, archive state. |
| `projectNotes` | Risk, open question, or general note attached to a project. |
| `stakeholders` | Person with a name, department, and avatar; referenced by id across tasks/notes/projects/products. |
| `departments` | Grouping used to organize stakeholders in the left sidebar. |

Soft-delete (`deleted_at`) and archive (`archived_at`/`is_archived`) fields are used throughout instead of hard deletes, so history is preserved for the archive view.

Base44 entities (`base44/entities`), used only by the chat feature: `ChatSession` / `ChatMessage` — AI assistant conversation history, paginated/lazy-loaded.

### Backend functions (`base44/functions`)

Only one remains: `aiChatStream` — streams LLM responses and executes the actions it decides on (against Base44's own entities, see the caveat above). It no longer requires an authenticated Base44 session (the auth gate was removed along with the rest of Base44 auth). Every other function that used to live here (`archiveProject`, `restoreProject`, `archivedProjects`, `deleteArea`, `deleteProduct`, `deleteProject`, `deleteDepartment`, `renameDepartment`, `toggleTopThree`, `deactivateAccount`) has been ported into the local data hooks in `src/hooks/` instead.

### Frontend structure (`src/`)

- `pages/` — top-level routes: `Dashboard`, `ChatPage`, `SettingsPage`. No auth pages — there's no login.
- `components/layout/` — app shell (owns collapsible sidebar state), header (hamburger toggles + `UserMenu`, now just a Settings shortcut), and left/right sidebars.
- `components/areas/`, `components/products/`, `components/projects/` — the card + detail-modal pairs for each entity level, plus `ProductConnectionLines` (the cross-card connector curves, rendered once at the dashboard level).
- `components/sidebar/` — stakeholder list, focus feed, status chart.
- `components/ai/` — the floating chat widget, session history UI, and the `/` command menu (`ChatCommandMenu`).
- `components/modals/` — create/edit forms (`AreaForm`, `ProductForm`, `ProjectForm`, `TaskForm`, `CreateModal`, `FilterModal`).
- `components/archive/` — the archive date-range panel.
- `components/settings/` — the Settings page's sections: `AppearanceSection` (theme + accent picker) is the only one left; the old account section was removed with auth.
- `components/shared/` — cross-cutting UI: avatars, date fields, custom fields, stakeholder/product assignment, per-column table filtering (`ColumnFilterMenu`), the shared floating-menu shell (`PositionedPopover`) every dropdown/popover in the app is built on, and query error states.
- `hooks/` — data hooks per entity (`useProjects`, `useTasks`, `useProducts`, `useAreas`, `useStakeholders`, `useDepartments`, `useProjectNotes`), all backed by `src/lib/localDb.js`, plus chat (`useChatController`, `useChatMessages`, `useChatSessions`, `useSlashCommand`, still Base44-backed), the chat widget's window geometry (`useWindowGeometry`), drag-and-drop (`useGlobalDragEnd`), accent theme persistence (`useAccentTheme`), and other UI utility hooks (inline editing, date selection, file upload, highlight matching). `useFileUpload` stores files as data URLs locally; it's unrelated to the chat widget's own (still Base44) attachment upload.
- `lib/` — cross-cutting logic: `localDb.js` (the local data layer), filter/highlight context, entity and task utilities, the Base44 app-params/query-client setup (kept for the chat client).

## Getting Started

### Prerequisites

1. Clone the repository.
2. Install dependencies: `npm install`.

No login is required and no account setup is needed — the app works immediately against local browser data.

### Run locally (everything except AI chat)

```bash
npm run dev
```

The dashboard, tasks, projects, products, areas, stakeholders, and settings all work fully — they only ever talk to `localStorage`. The AI chat widget will error on send, since there's no `aiChatStream` function running.

### Run locally (with AI chat)

The chat assistant still needs Base44's local dev backend to run its function:

1. Install the Base44 CLI: `npm install -g base44@latest`.
2. `base44 dev` — starts the local Base44 backend (serving `aiChatStream`) and, since `base44/config.jsonc` sets `site.serveCommand` to `npm run dev`, also starts the Vite frontend. Use the URL it prints.

See the [Base44 CLI docs](https://docs.base44.com/developers/references/cli/get-started/overview) for direct CLI usage. Remember: even with chat running, it acts on Base44's own dataset, not your local dashboard data (see the Architecture section above).

### Standalone distributable (hand it to someone with no dev setup)

`standalone/` generates two **single-file** launchers with the entire built app embedded inside them as base64 — there's no companion folder or sibling file to lose track of, so it's safe to email or move around on its own:

- `PortfolioTracker-Windows.bat` — self-extracts and serves via PowerShell (built into Windows). No Node.js needed.
- `PortfolioTracker-Linux.sh` — self-extracts and serves via Python 3 (preinstalled on virtually all modern macOS/Linux). No Node.js needed.

Regenerate them after a source change:

```bash
npm run build          # produces dist/
node standalone/build.cjs   # embeds dist/ into both launchers
```

Whoever receives one of the two files just runs it: double-click the `.bat` on Windows, or `./PortfolioTracker-Linux.sh` (or `bash PortfolioTracker-Linux.sh`) on macOS/Linux. Either one starts a tiny local server with SPA-aware routing and opens the app in their default browser automatically, no install step. See `standalone/README.txt` for the exact instructions each one ships with (also printed to anyone who opens the folder instead of running the file).

This is the same localStorage-only app as `npm run dev` — full functionality except the AI chat widget, which needs Base44's hosting and can't be bundled into an offline file (see the Architecture caveat above). The two generated launchers (and the transient `standalone/_payload.*` build files) are gitignored — they're build artifacts, regenerate them from source rather than committing them. The editable source for each lives in `standalone/templates/*.tpl`.

**Zero-dependency alternative:** `standalone/exe/` builds native executables (`PortfolioTracker-Windows.exe`, `PortfolioTracker-Linux`) with the Node.js runtime itself embedded via [`pkg`](https://github.com/yao-pkg/pkg) — not even PowerShell/Python are required, at the cost of ~45-50MB per file instead of a few hundred KB. Regenerate with:

```bash
npm run build              # from the repo root, if not already built
cd standalone/exe && npm install   # first time only
node build.cjs
```

See `standalone/exe/README.txt` for the size/dependency tradeoff versus the script launchers, and a real gotcha in how `pkg` reads its asset config (documented there so it doesn't get "simplified" back into a broken build).

### Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Vite dev server (frontend only). |
| `npm run build` | Production build. |
| `npm run preview` | Preview the production build locally. |
| `npm run lint` / `npm run lint:fix` | ESLint. |
| `npm run typecheck` | TypeScript check over JS via `jsconfig.json`. |
| `npm test` / `npm run test:watch` | Run the Vitest unit test suite (business logic in `src/lib` and `src/hooks`). |

### Publishing

The frontend and local data layer can be deployed anywhere static sites are hosted (`npm run build` → `dist/`). To keep the AI chat function alive, publish it through the Base44 dashboard as before:

```bash
base44 dashboard open
```

## Docs & Support

- [Using GitHub with Base44](https://docs.base44.com/Integrations/Using-GitHub)
- [Base44 CLI command reference](https://docs.base44.com/developers/references/cli/commands/introduction)
- [Base44 support](https://app.base44.com/support)

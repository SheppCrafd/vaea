# Portfolio Tracker

A dashboard for managing a portfolio of projects and products across your areas of responsibility — with task tracking, stakeholder visibility, a focus feed, and an AI chat assistant that can act on your data. Built as a [Base44](https://base44.com) app (React frontend + Base44-hosted backend/entities).

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
- **Left sidebar** — stakeholders grouped by department, with per-category (tasks/notes/projects/products) counts that toggle a color-coded highlight (a tint on the matching cards/rows) across the dashboard.
- **AI chat assistant** — a floating chat widget (and a full `/chat` page) backed by a streaming LLM function that can create/update tasks, projects, products, and areas, add notes, mark focus items, and answer questions about your data, including archived items. The widget is a real draggable/resizable window (drag the header to move it, drag any edge or corner to resize) and remembers its position and size between sessions.
- **Archive view** — a date-range view of everything that was active during that window, including archived projects/tasks, which remain fully editable and can be restored.

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

- **Frontend**: React 18 + Vite, React Router, TanStack Query for data fetching/caching, Zustand for lightweight client state, Tailwind CSS + Radix UI primitives (via `shadcn`-style components in `src/components/ui`) for the design system, Framer Motion for animation, and Recharts for the status bar chart.
- **Backend**: [Base44](https://base44.com) — a hosted backend providing entity storage/CRUD, auth, and serverless functions. The frontend talks to it through `@base44/sdk`, configured in `src/api/base44Client.js`.
- **Build tooling**: Vite with the `@base44/vite-plugin` (dev-only HMR notifier, visual-edit agent, and analytics hooks), ESLint, TypeScript in `checkJs` mode for type-checking JS via `jsconfig.json`, and Vitest for unit tests.

### Data model (`base44/entities`)

| Entity | Purpose |
|---|---|
| `Area` | Top-level area of responsibility; supports custom fields. |
| `Product` | Belongs to an `Area`; tracks stakeholders and related products. |
| `Project` | Belongs to a `Product` and/or `Area`; owns objective, due date, risks, metrics, archive state. |
| `Task` | Belongs to a `Project`; status, quadrant, type, focus/top-3 flags, archive state. |
| `ProjectNote` | Risk, open question, or general note attached to a project. |
| `Stakeholder` | Person with a name, department, and avatar; referenced by id across tasks/notes/projects/products. |
| `Department` | Grouping used to organize stakeholders in the left sidebar. |
| `ChatSession` / `ChatMessage` | AI assistant conversation history, paginated/lazy-loaded. |
| `User` | App user, with `admin`/`user` role. |

Soft-delete (`deleted_at`) and archive (`archived_at`/`is_archived`) fields are used throughout instead of hard deletes, so history is preserved for the archive view.

### Backend functions (`base44/functions`)

Serverless functions handle operations that go beyond simple entity CRUD: `aiChatStream` (streams LLM responses and executes the actions it decides on), `archiveProject` / `restoreProject` / `archivedProjects`, `deleteArea` / `deleteProduct` / `deleteProject` / `deleteDepartment`, `renameDepartment`, and `toggleTopThree`.

### Frontend structure (`src/`)

- `pages/` — top-level routes: `Dashboard`, `ChatPage`, auth pages (`Login`, `Register`, `ForgotPassword`, `ResetPassword`).
- `components/layout/` — app shell, header, and left/right sidebars.
- `components/areas/`, `components/products/`, `components/projects/` — the card + detail-modal pairs for each entity level.
- `components/sidebar/` — stakeholder list, focus feed, status chart.
- `components/ai/` — the floating chat widget, session history UI, and the `/` command menu (`ChatCommandMenu`).
- `components/modals/` — create/edit forms (`AreaForm`, `ProductForm`, `ProjectForm`, `TaskForm`, `CreateModal`, `FilterModal`).
- `components/archive/` — the archive date-range panel.
- `components/shared/` — cross-cutting UI (avatars, custom fields, stakeholder/product assignment, query error states).
- `hooks/` — data hooks per entity (`useProjects`, `useTasks`, `useProducts`, `useAreas`, `useStakeholders`, `useDepartments`, `useProjectNotes`) plus chat (`useChatController`, `useChatMessages`, `useChatSessions`, `useSlashCommand`), the chat widget's window geometry (`useWindowGeometry`), and other UI utility hooks.
- `lib/` — cross-cutting logic: auth context, filter/highlight context, entity and task utilities, the Base44 app-params/query-client setup.

## Getting Started

### Prerequisites

1. Clone the repository.
2. Install dependencies: `npm install`.
3. Install the Base44 CLI: `npm install -g base44@latest`.

See the [Base44 CLI docs](https://docs.base44.com/developers/references/cli/get-started/overview) for direct CLI usage.

### Run locally (full stack)

```bash
base44 dev
```

This starts the local Base44 backend and, since this project's `base44/config.jsonc` sets `site.serveCommand` to `npm run dev`, also starts the Vite frontend. Use the URL it prints.

### Run frontend-only (against the hosted backend)

```bash
npm run dev
```

Point it at a hosted Base44 app by creating `.env.local`:

```bash
VITE_BASE44_APP_ID=your_app_id
VITE_BASE44_APP_BASE_URL=https://your-app.base44.app
```

`base44 dev` injects these values automatically, so `.env.local` is mainly needed for frontend-only work.

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

Push your changes to git, then publish through the Base44 dashboard:

```bash
base44 dashboard open
```

## Docs & Support

- [Using GitHub with Base44](https://docs.base44.com/Integrations/Using-GitHub)
- [Base44 CLI command reference](https://docs.base44.com/developers/references/cli/commands/introduction)
- [Base44 support](https://app.base44.com/support)

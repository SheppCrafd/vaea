# Portfolio Tracker

Repo: https://github.com/SheppCrafd/portfolio-tracker

A dashboard for managing a portfolio of projects and products across your areas of responsibility — with task tracking, stakeholder visibility, a focus feed, and an AI chat assistant that can act on your data.

This app has core app data (areas, products, projects, tasks, stakeholders, departments, notes) living locally instead of a hosted database — including everything the AI chat assistant reads and writes, since it acts on this exact same data (see "Architecture" below for how that works without a server ever storing it). Running the repo locally via `npm run dev`/`npm run preview`, that data is plain JSON files in a gitignored `data/` folder right in your clone; anywhere else (the hosted preview, a production deploy, the standalone distributables), it's the browser's `localStorage` instead — see "Local data storage" below. [Base44](https://base44.com) is retained for two things: making the LLM call itself (`aiChatStream`) and gating the whole app behind login (Google/Microsoft/Apple/email, via Base44's hosted auth) — there's no custom login form, just Base44's own hosted sign-in page.

## For Enterprises & Organizations

This project is built around data locality, which matters if your organization evaluates tools on data residency and third-party processor exposure:

- **No backend database for your data.** Every Area, Product, Project, Task, Stakeholder, and Note lives locally on the machine running it — as plain files in your own clone if you're running the repo directly, or in the browser's local storage otherwise. There is nothing to breach, subpoena, or leak from a server, because there is no server holding it.
- **The one exception — the AI assistant — is disclosed, not hidden.** Asking it to do something sends a snapshot of your current data to an LLM provider (via a Base44 function) for that single exchange, and nothing is written back to a server afterward. This is stated directly in the product (the info icon in both chat surfaces), not buried in a policy document. If your organization can't accept even transient third-party LLM exposure, the rest of the app works fully with chat simply left unused — see the standalone distributables below for a build with no network dependency at all.
- **Self-hostable, small, and auditable.** The frontend is a static build (`npm run build` → `dist/`) deployable to any static host or internal server — no runtime backend to operate or patch beyond the one optional serverless function powering chat. The codebase is compact and dependency-light enough for a real architecture/security review in an afternoon.
- **Honest about current scope:** this is a single-user, single-browser tool today — there's no multi-user data sharing, roles, or admin console. It's built for one manager's own dashboard, not (yet) a shared team system of record. Evaluate it as a personal productivity tool, not a multi-seat platform, until that changes.

## Overview

Portfolio Tracker is built for someone managing many projects and products across multiple areas of responsibility (e.g. "Work", "Home"). It organizes work into a three-level hierarchy and gives you a single dashboard to see status, risks, and priorities at a glance:

- **Areas of Responsibility** — the broadest grouping (e.g. Work, Home). A single area fills the full dashboard width; add more and they cascade side by side, sharing the row evenly, wrapping to a new row once they no longer fit — so a wide monitor shows more areas at once, not one area stretched thin.
- **Products** — sit inside an area, optionally connected to related products.
- **Projects** — sit inside a product, or directly inside an area if there's no product. Each project owns a set of tasks.

Each level is rendered as a card, nested inside its parent's card, so the dashboard reads as a visual hierarchy rather than a flat list.

### Key features

- **Project cards, two views, toggled at the top of the dashboard:**
  - **Mini Cards** (default) — small squares showing just the title, a quadrant breakdown of task counts (Eisenhower-style: important/urgent), and a compact Not Started/In Prog/Done stats bar. If a project has any risks or open questions, the quadrant shifts left to make room for a warning-triangle / question-mark indicator. Everything else — objective, problem statement, metrics, owner, due date, stakeholders, notes, related products, attachments/links, custom fields, the full task table, archive/delete — lives one click away via the Expand button's detail view; nothing is lost, just not always-visible.
  - **Full Cards** — the original always-editable card: every field above is directly editable right on the card face (inline Risks/Open Questions boxes, owner, due date, stakeholder assigner, links corner), not just via Expand.
  - The choice is remembered across sessions (`localStorage`), and both views share the same underlying data — switching back and forth never loses anything.
- **Task table** per project with status, quadrant + H/Q flags, type, notes, stakeholders, and attachments — every column is independently sortable and filterable, defaulting to a Quadrant sort, plus a "Clear Done" button to bulk-archive completed tasks. Tasks can be flagged as a weekly focus item or one of "today's top 3."
- **Product and Area cards** with their own expandable detail views, stakeholders, and support for user-defined custom fields (global or per-card, optionally surfaced on the card face).
- **Create New / Filter** — a single entry point to create a Task, Project, Product, or Area, plus filtering by area/product/project.
- **Right sidebar** — Today's Top 3, this week's focus items grouped by project, and a horizontal bar chart of task status counts per project.
- **Left sidebar** — stakeholders grouped by department, with per-category (tasks/notes/projects/products) counts that toggle a color-coded highlight (a tint on the matching cards/rows) across the dashboard. Each stakeholder is drag-and-droppable: drop one onto a project/product/task card to assign them, or onto a department to reassign them (department is otherwise not editable from the row).
- **AI chat assistant** — a floating chat widget (and a full `/chat` page) that can create/update tasks, projects, products, and areas, add notes, mark focus items, and answer questions about your data, including archived items — and it acts on the exact same local data you see on the dashboard. Your data is sent to an LLM only for the single exchange it takes to decide what to do; nothing is stored on a server (the `Info` icon in the chat header spells this out). The widget is a real draggable/resizable window (drag the header to move it, drag any edge or corner to resize) and remembers its position and size between sessions.
- **Archive view** — a date-range view of everything that was active during that window, including archived projects/tasks, which remain fully editable and can be restored.
- **Product connection lines** — when a project is linked to a product beyond its primary parent (via the "Connect Products" control), a dashed curve is drawn between the two cards, layered so it crosses over Area/Product/Project cards but stays underneath every other UI element (popovers, modals, the chat widget, the archive button).
- **Collapsible sidebars, dark mode, and accent themes** — both side panels collapse via hamburger toggles in the header (state persists across sessions), and a settings shortcut (top right) links to a **Settings** page for switching Light/Dark/System theme, picking one of four curated accent colors (Slate/Indigo/Emerald/Amber), and basic account management (sign out, delete account).
- **Own branding** — tab title, favicon, and web app manifest (`public/`) are custom, not Base44's default.

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
- **Core app data** (areas, products, projects, tasks, stakeholders, departments, project notes) lives entirely locally via `src/lib/localDb.js`, a small repository (list/get/filter/create/update/delete + a subscribe hook for live task-count polling) that the entity hooks in `src/hooks/` (`useAreas`, `useProducts`, `useProjects`, `useTasks`, `useStakeholders`, `useDepartments`, `useProjectNotes`) sit on top of. There is no server database for this data — see "Local data storage" below for exactly where it's kept and why there are two backing stores.
- **The AI chat assistant acts on this same local data**, split across two places so your data never has to be stored on a server to get there:
  - **`base44/functions/aiChatStream`** (a Base44 serverless function) only decides *what* to do. The client sends it the message plus a snapshot of your current local dataset; it calls the LLM, gets back a plan (a list of actions), and returns that plan **unexecuted**. It never writes anything, anywhere.
  - **`src/lib/chatActions.js`** (client-side) actually runs the plan, against `localDb` — reusing the exact same plain mutation functions (including cascade logic) the UI's own hooks in `src/hooks/` are built on, imported directly rather than duplicated. Destructive actions (deletes, bulk operations) are held for a confirm step client-side before running, same as before.
  - Net effect: your project data touches Base44 only in transit, for one request per message, so the LLM can see it — never persisted there. Chat session/message history (`ChatSession`/`ChatMessage`) and chat file attachments are the one thing that *does* still live on Base44, via `src/api/base44Client.js` — that's conversation history, not your project data.
- **Build tooling**: Vite with the `@base44/vite-plugin` (dev-only HMR notifier, visual-edit agent, and analytics hooks — kept because `aiChatStream` still needs the Base44 toolchain), ESLint, TypeScript in `checkJs` mode for type-checking JS via `jsconfig.json`, and Vitest for unit tests.

### Local data storage

`src/lib/localDb.js` picks one of two backing stores automatically, per session — nothing else in the app needs to know or care which is active:

- **File-backed (running the repo locally via `npm run dev` or `npm run preview`):** data lives as plain JSON files in a gitignored `data/` folder at the repo root (`data/areas.json`, `data/products.json`, etc.) — one file per collection, written by a small Vite dev-server middleware (`vite-localdb-plugin.js`). Open them directly in any editor, back them up, or hand-edit them; the app picks up whatever's on disk on its next read.
- **`localStorage` (everywhere else):** the base44-hosted preview, a production static deploy, and the standalone `.bat`/`.exe` distributables below have no Node process behind them to serve the file-backed API, so the app falls back to the browser's local storage there instead — the same behavior this app has always had.
- The app detects which one is available with a single probe request on first load; there's no manual switch, and no data migrates automatically between the two if you move from one mode to the other (e.g. going from `npm run dev` to the hosted preview starts with a separate, empty dataset).

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

Base44 entities (`base44/entities`) — none of your project data: `User` (login), `ChatSession` / `ChatMessage` (AI assistant conversation history, paginated/lazy-loaded).

### Backend functions (`base44/functions`)

`aiChatStream` — calls the LLM and returns the action plan it decides on; never executes it (see the Architecture section above — `src/lib/chatActions.js` does that, client-side). Requires an authenticated Base44 session (rejects with 401 otherwise) since it's reachable by URL and would otherwise let anyone burn LLM calls or see whatever local data a client sends it. Every entity-cascade function that used to live here (`archiveProject`, `restoreProject`, `archivedProjects`, `deleteArea`, `deleteProduct`, `deleteProject`, `deleteDepartment`, `renameDepartment`, `toggleTopThree`) has been ported into the local data hooks in `src/hooks/` instead. `deactivateAccount` is still here — it's account deletion, tied to the (restored) Base44 login.

### Frontend structure (`src/`)

- `pages/` — top-level routes: `Dashboard`, `ChatPage`, `SettingsPage`. No custom login/register pages — sign-in goes through Base44's own hosted login, wired up in `AuthContext.jsx`/`App.jsx`.
- `components/layout/` — app shell (owns collapsible sidebar state), header (hamburger toggles + `UserMenu`, now just a Settings shortcut), and left/right sidebars.
- `components/areas/`, `components/products/`, `components/projects/` — the card + detail-modal pairs for each entity level (`ProjectCard.jsx` is the Mini Cards default, `ProjectCardFull.jsx` the Full Cards alternative — see `CardViewContext.jsx`), plus `ProductConnectionLines` (the cross-card connector curves, rendered once at the dashboard level).
- `components/sidebar/` — stakeholder list, focus feed, status chart.
- `components/ai/` — the floating chat widget, session history UI, and the `/` command menu (`ChatCommandMenu`).
- `components/modals/` — create/edit forms (`AreaForm`, `ProductForm`, `ProjectForm`, `TaskForm`, `CreateModal`, `FilterModal`).
- `components/archive/` — the archive date-range panel.
- `components/settings/` — the Settings page's sections: `AppearanceSection` (theme + accent picker) and `AccountSection` (sign out, delete account via `DeleteAccountDialog`).
- `components/shared/` — cross-cutting UI: avatars, date fields, custom fields, stakeholder/product assignment, per-column table filtering (`ColumnFilterMenu`), the shared floating-menu shell (`PositionedPopover`) every dropdown/popover in the app is built on, and query error states.
- `hooks/` — data hooks per entity (`useProjects`, `useTasks`, `useProducts`, `useAreas`, `useStakeholders`, `useDepartments`, `useProjectNotes`), all backed by `src/lib/localDb.js` and each also exporting the plain mutation functions `chatActions.js` reuses, plus chat (`useChatController` — gathers the local-data snapshot and runs the assistant's plan via `chatActions.js`; `useChatMessages`, `useChatSessions`, `useSlashCommand`, still Base44-backed for conversation history only), the chat widget's window geometry (`useWindowGeometry`), drag-and-drop (`useGlobalDragEnd`), accent theme persistence (`useAccentTheme`), and other UI utility hooks (inline editing, date selection, file upload, highlight matching). `useFileUpload` stores files as data URLs locally; it's unrelated to the chat widget's own (still Base44) attachment upload.
- `lib/` — cross-cutting logic: `localDb.js` (the local data layer), `chatActions.js` (the chat assistant's client-side action executor), `CardViewContext.jsx` (the Mini/Full card preference, shared by Dashboard/AreaCard/ProductCard), filter/highlight context, entity and task utilities, the Base44 app-params/query-client setup (kept for the chat client).

## Getting Started

### Prerequisites

1. Clone the repository.
2. Install dependencies: `npm install`.

`npm run dev` has no real Base44 app id configured locally, so the login check quietly fails open (a 404 instead of the real backend's `auth_required` 403) and the app renders without asking you to sign in. A properly deployed/published instance will actually require login.

### Run locally (everything except AI chat)

```bash
npm run dev
```

The dashboard, tasks, projects, products, areas, stakeholders, and settings all work fully — they read/write the `data/` folder described in "Local data storage" above (gitignored, created automatically on first write). The AI chat widget will error on send, since there's no `aiChatStream` function running.

### Run locally (with AI chat)

The chat assistant still needs Base44's local dev backend to run its function:

1. Install the Base44 CLI: `npm install -g base44@latest`.
2. `base44 dev` — starts the local Base44 backend (serving `aiChatStream`) and, since `base44/config.jsonc` sets `site.serveCommand` to `npm run dev`, also starts the Vite frontend. Use the URL it prints.

See the [Base44 CLI docs](https://docs.base44.com/developers/references/cli/get-started/overview) for direct CLI usage. With chat running, it acts on your real local dashboard data (see the Architecture section above) — nothing is stored on Base44 beyond conversation history.

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

This is the same app as `npm run dev`, minus the AI chat widget, which needs Base44's hosting for the LLM call itself and can't be bundled into an offline file (the data it acts on, though, is exactly the same local data everything else here uses — see Architecture above). Unlike `npm run dev`, these launchers serve the already-built static `dist/` with no Vite dev server behind them — so there's no `data/` folder here, and data is kept in the browser's `localStorage` instead, same as it always has been (see "Local data storage" above). The two generated launchers (and the transient `standalone/_payload.*` build files) are gitignored — they're build artifacts, regenerate them from source rather than committing them. The editable source for each lives in `standalone/templates/*.tpl`.

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

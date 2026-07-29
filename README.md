# Vaea

Repo: https://github.com/SheppCrafd/vaea

A dashboard for managing a portfolio of projects and products across your areas of responsibility — with task tracking, stakeholder visibility, a focus feed, and an AI chat assistant that can act on your data.

This app has core app data (areas, products, projects, tasks, stakeholders, departments, notes) living locally by default instead of a hosted database — including everything the AI chat assistant reads and writes, since it acts on this exact same data (see "Architecture" below for how that works without a server ever storing it). Running the repo locally via `npm run dev`/`npm run preview`, that data is plain JSON files in a gitignored `data/` folder right in your clone. Anywhere else (the hosted preview, a production deploy, the standalone distributables), you choose on first run: a folder on your own device (or a manually exported/imported file, on browsers without a folder picker), or — opt-in, tied to your account — cloud storage, a real Base44-hosted record instead of your device. See "Local data storage" below. [Base44](https://base44.com) is retained for three things: making the LLM call itself (`aiChatStream`), gating the whole app behind login (Google/Microsoft/Apple/email, via Base44's hosted auth), and, only if you choose it, holding your project data in cloud storage mode — there's no custom login form, just Base44's own hosted sign-in page.

## For Enterprises & Organizations

This project is built around data locality, which matters if your organization evaluates tools on data residency and third-party processor exposure:

- **No backend database for your data, by default.** Every Area, Product, Project, Task, Stakeholder, and Note lives locally on the machine running it — as plain files in your own clone if you're running the repo directly, or in a folder/exported file you control otherwise (see "Local data storage" below). There is nothing to breach, subpoena, or leak from a server, because there is no server holding it — unless a user explicitly opts into cloud storage (Settings → Data Storage, or the first-run choice), which stores their data in a Base44-hosted record scoped to their account instead. That's a deliberate, disclosed exception a user has to choose, not a fallback the app picks for them; if your organization needs device-only storage guaranteed, don't offer that option to your users, or verify they haven't switched to it.
- **Every exception is disclosed, not hidden.** The AI assistant: asking it to do something sends a snapshot of your current data to an LLM provider (via a Base44 function) for that single exchange, and nothing is written back to a server afterward — stated directly in the product (the info icon in both chat surfaces), not buried in a policy document. If your organization can't accept even transient third-party LLM exposure, the rest of the app works fully with chat simply left unused — see the standalone distributables below for a build with no network dependency at all. Cloud storage is the other one, covered above — off by default, opt-in only, and reversible from Settings at any time.
- **Self-hostable, small, and auditable.** The frontend is a static build (`npm run build` → `dist/`) deployable to any static host or internal server — no runtime backend to operate or patch beyond the one optional serverless function powering chat. The codebase is compact and dependency-light enough for a real architecture/security review in an afternoon.
- **Honest about current scope:** this is a single-user, single-browser tool today — there's no multi-user data sharing, roles, or admin console. It's built for one manager's own dashboard, not (yet) a shared team system of record. Evaluate it as a personal productivity tool, not a multi-seat platform, until that changes.

## Overview

Vaea is built for someone managing many projects and products across multiple areas of responsibility (e.g. "Work", "Home"). It organizes work into a three-level hierarchy and gives you a single dashboard to see status, risks, and priorities at a glance:

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
- **Create New / Filter** — a single entry point to create a Task, Project, Product, or Area, plus filtering by area/product/project. A "Via .csv" tab bulk-creates from a single spreadsheet: download one template, then each row spells out the full path down to whatever it's adding — area, optionally a product inside it, optionally a project inside that, optionally a task inside that — leaving deeper columns blank once you've reached the level you're creating. Repeating the same title across rows (or matching something that already exists) attaches to that same record instead of duplicating it, so one file can build out an entire hierarchy — many areas, each with their own products/projects/tasks — in one import. A bad row (e.g. a task with no project) is reported with a specific reason and skipped; it doesn't block the rest of the file.
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
| `/tidy` | Audit the workspace for hygiene issues and propose fixes |
| `/setup` | Interview you and set its own name/identity/soul (see below) |
| `/vault-log` | Log this session to your connected Vaea Vault (see below) |
| `/vault-tidy` | Audit your connected Vaea Vault's wikilinks and propose fixes |
| `/help` | List all available slash commands |

The client-side list lives in `src/lib/chatCommands.js`; the matching server-side instructions (what each command maps to, and the "ignore anything not on this list" rule) live in `base44/functions/aiChatStream/entry.ts`.

### What the assistant can do

Beyond full CRUD on every entity (areas/products/projects/tasks/stakeholders/departments/notes, including bulk create/delete and multi-step plans that chain several records together in one request — "set up an Area with two Products and a Project each"), the assistant can:

- **Search the web** for anything not in your local data (current events, a company's news) — runs for real, mid-conversation, and the result feeds back into its next step.
- **Read an attached file's actual contents** (PDF, image, doc) and summarize or answer questions about it, not just treat it as an opaque filename.
- **Read what a project's links actually point to** — a spec doc, a design file, a GitHub repo — instead of only knowing the label and URL text, so it can answer questions and take actions informed by what's really there.
- **Search your own workspace** by keyword across every area/product/project/task/stakeholder/note (including archived) — a real search step instead of relying on it to read the full data dump itself.
- **Audit the workspace** (`/tidy`) for hygiene issues — overdue/unowned projects, done-but-unarchived tasks, near-duplicate tasks, stakeholders missing a department, empty areas/products — then propose fixes as a normal confirmable plan. This only ever runs when you ask; there's no server-side data store for a true autonomous nightly pass to run against, so this is the deliberate, manually-triggered analog instead.
- **Export any entity type to CSV** and switch the dashboard between Mini/Full card view, on request.
- **Have its own identity, set up however you want.** **Settings → AI Assistant** has four fields — name, identity, soul (tone + any standing response protocol, e.g. "compare two approaches before answering a bug question"), and a note on how you work — sent as context with every message. Write them by hand, or type `/setup` and let the assistant interview you across the conversation and draft them itself via a real tool call, the same staged mechanism as everything else it does. The name you set replaces "PM Copilot" everywhere in the chat UI immediately. There's no server-side storage for this, same as everything else — Export/Import in that same settings section carries it to another device as a small JSON file.

The web search and file-reading calls are covered by the same one-request, nothing-persisted privacy guarantee as the rest of chat — see the Architecture section below.

### Vaea Vault

The assistant can also read and write Vaea Vault — a personal, git-backed Obsidian vault stored on GitHub — the same kind of connection a Claude Code + Obsidian setup gives a coding assistant, brought in-app instead of living in a CLI. **Settings → Vaea Vault**: connect a repo (owner, name, branch, and a personal access token — stored on this device, sent to Vaea's backend only for the moment a read tool actually runs, never persisted server-side). Never set one up before? **Settings → Resources → Vaea Vault setup guide** is a real in-app page (`src/pages/VaultSetupGuidePage.jsx`) walking through Obsidian + git + GitHub from scratch, ending in a real terminal-styled block (`src/components/settings/TerminalBlock.jsx`, prompt color follows your Appearance accent) with every command in order and a copy button.

Once connected:
- **Ask naturally** — `search_vault`, `read_vault_note`, and `list_vault_notes` are live tools (real GitHub Search/Contents API calls, results feed back into the model's next reasoning step) the assistant reaches for on its own, the in-app analog of a vault-crawler subagent.
- **`/vault-log`** — writes a session summary to `Daily/<today>.md` in the connected repo (and a `Decisions/...` file too, if a real decision was made) via a real commit. The in-app analog of a `/log` command, with no separate terminal step.
- **`/vault-tidy`** — `audit_vault` scans every note's `[[wikilinks]]` for broken links and isolated notes (capped at 80 notes per run), then proposes fixes via `WRITE_VAULT_NOTE` as a normal confirmable plan. The in-app analog of a nightly vault-maintenance pass, run on demand instead of on a schedule — there's still no server holding vault content to run an unattended job against.

`WRITE_VAULT_NOTE` always sends the full file content (never a diff) and looks up the current file's sha itself before committing, so it updates instead of conflicting. Not treated as destructive — git's own history is the undo mechanism, the same way `EXPORT_CSV` and everything else here relies on the browser rather than Vaea for anything durable.

### Backups

Since there's no server database, there's also no server-side version history to fall back on if a bulk change goes wrong. A snapshot of every collection is taken automatically (via the same device/cloud storage backend described above, not browser `localStorage`) before any multi-step AI plan, bulk create/delete, or CSV import runs — capped at the 8 most recent. **Settings → Backups** lists them (timestamp + what's in each) and lets you restore one; restoring itself snapshots the current state first, so it's never a one-way door. This is separate from saying "undo" in chat, which only reverts the single most recent action and doesn't survive a page reload.

## How it works

### Architecture

- **Frontend**: React 18 + Vite, React Router, TanStack Query for data fetching/caching, Zustand for lightweight client state, Tailwind CSS + Radix UI primitives (via `shadcn`-style components in `src/components/ui`) for the design system. Animation is plain Tailwind (`tailwindcss-animate`'s `animate-in`/`fade-in`/`zoom-in` utilities) plus a handful of custom CSS keyframes in `src/index.css` (the chat "thinking" icon, message fade-in, launch pulse) — no animation library. The status bar chart (`TaskStatistics`) is a hand-rolled stacked-div bar, not a charting library. Dark/light/system theming is wired via `next-themes` (`ThemeProvider` in `App.jsx`); accent color is a separate `data-accent` attribute + CSS-variable override system (`useAccentTheme`), independent of light/dark.
- **Core app data** (areas, products, projects, tasks, stakeholders, departments, project notes) lives entirely locally via `src/lib/localDb.js`, a small repository (list/get/filter/create/update/delete + a subscribe hook for live task-count polling) that the entity hooks in `src/hooks/` (`useAreas`, `useProducts`, `useProjects`, `useTasks`, `useStakeholders`, `useDepartments`, `useProjectNotes`) sit on top of. There is no server database for this data by default — see "Local data storage" below for exactly where it's kept and what the opt-in cloud alternative is.
- **The AI chat assistant acts on this same local data**, split across two places so your data never has to be stored on a server to get there:
  - **`base44/functions/aiChatStream`** (a Base44 serverless function) only decides *what* to do — it never writes your project data anywhere. It's a real multi-step tool-calling agent (Base44's AI Gateway + the `ai` package's `ToolLoopAgent`, one typed tool per action) rather than a single blind structured-output call: the client sends the message plus a snapshot of your current local dataset, and every CRUD tool call (`CREATE_AREA`, `UPDATE_TASK`, `BULK_DELETE`, ...) just gets queued into a plan, never executed here. Four tools *do* run for real, in-line: `web_search` (Base44's `InvokeLLM` with `add_context_from_internet`) and `analyze_attachment` (`ExtractDataFromUploadedFile`, for reading what the user attached) touch no project data at all; `search_workspace` and `audit_workspace` read the raw dataset already sent with the request (not a new fetch — nothing server-side is queried or stored) to do a real keyword search or hygiene audit instead of relying on the model to eyeball the full JSON dump. All four feed real results back into the model's next reasoning step, which is what makes it a genuine agent rather than one-shot-plan-then-pray. `aiIdentity` (the four-field name/identity/soul/userProfile set from Settings → AI Assistant, or drafted by `/setup`) rides along in the same request, giving the assistant standing instructions on who it is and how to communicate without the client sending anything new server-side. The function returns `{reply, actions}`, same shape as before.
  - **`src/lib/chatActions.js`** (client-side) actually runs the queued plan, against `localDb` — reusing the exact same plain mutation functions (including cascade logic) the UI's own hooks in `src/hooks/` are built on, imported directly rather than duplicated. Destructive actions (deletes, bulk operations) are held for a confirm step client-side before running, same as before.
  - Net effect: your project data touches Base44 only in transit, for one request per message, so the LLM can see it — never persisted there. A web search or attachment read is a live call out for that one exchange too, disclosed in the chat UI's privacy notice, same as everything else here. Chat session/message history (`ChatSession`/`ChatMessage`) and chat file attachments are the one thing that *does* still live on Base44, via `src/api/base44Client.js` — that's conversation history, not your project data.
- **Build tooling**: Vite with the `@base44/vite-plugin` (dev-only HMR notifier, visual-edit agent, and analytics hooks — kept because `aiChatStream` still needs the Base44 toolchain), ESLint, TypeScript in `checkJs` mode for type-checking JS via `jsconfig.json`, and Vitest for unit tests.

### Local data storage

`src/lib/localDb.js` picks a backing store automatically per session — nothing else in the app needs to know or care which is active:

- **File-backed (running the repo locally via `npm run dev` or `npm run preview`):** data lives as plain JSON files in a gitignored `data/` folder at the repo root (`data/areas.json`, `data/products.json`, etc.) — one file per collection, written by a small Vite dev-server middleware (`vite-localdb-plugin.js`). Open them directly in any editor, back them up, or hand-edit them; the app picks up whatever's on disk on its next read.
- **Everywhere else** (the base44-hosted preview, a production static deploy, the standalone `.bat`/`.exe` distributables below): there's no Node process behind the tab to serve the file-backed API, so `localDb.js` reads/writes through `src/lib/deviceStorage.js` instead, which is itself one of three backends — **the app asks you to pick one on first run** (`DeviceStorageGate.jsx`), and you can switch later in Settings → Data Storage (`StorageSection.jsx`):
  - **File System Access** (Chromium desktop only): a folder you grant access to once; each collection is written as `<key>.json` inside it, the same shape as the dev file-backed store's `data/` folder. The folder handle (never any app data) is remembered in IndexedDB, so return visits only need a one-click permission re-grant.
  - **Manual mode** (every other browser — Firefox, Safari, mobile, or anyone who declines the folder picker): nothing persists automatically. Data lives in memory for the session; you load a previously exported JSON file to start, and export an updated one to save.
  - **Cloud** (`src/lib/cloudStorage.js`) — opt-in, requires signing in: data lives in a Base44-hosted `AppData` entity instead of your device, scoped to your account, so it's available from any device you sign into. This is the deliberate exception to "nothing leaves the device" described above — picked explicitly, never silently, and switchable back to device storage anytime (both directions carry your existing data over rather than starting empty).
  - None of this is browser `localStorage` — that was retired 2026-07-23 in favor of the backends above, specifically so entity data never lands in browser storage the app doesn't control.
- The app detects which mode (file-backed vs. device/cloud) is available with a single probe request on first load; there's no manual switch between *that* pair, and no data migrates automatically if you move from one to the other (e.g. going from `npm run dev` to the hosted preview starts with a separate, empty dataset). Switching between File System Access / manual / cloud, once you're in device/cloud mode, does carry your data forward — see `src/lib/storageMigration.js`.

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
- `components/settings/` — the Settings page's sections: `AppearanceSection` (theme + accent picker), `AccountSection` (sign out, delete account via `DeleteAccountDialog`), `StorageSection` (switch between device/cloud storage — see "Local data storage" above), `AiPreferencesSection` (the assistant's name/identity/personality), `AiModelSection` (bring-your-own-key providers and Backdoor Mode's local-bridge connection), `BackupRestoreSection` (local backup snapshots), `ExternalVaultSection` (the Vaea Vault Obsidian/GitHub connection), and `ResourcesSection` (links to the setup guides).
- `components/shared/` — cross-cutting UI: `DeviceStorageGate` (blocks the app from rendering until a storage backend is chosen/connected — see "Local data storage" above), avatars, date fields, custom fields, stakeholder/product assignment, per-column table filtering (`ColumnFilterMenu`), the shared floating-menu shell (`PositionedPopover`) every dropdown/popover in the app is built on, and query error states.
- `hooks/` — data hooks per entity (`useProjects`, `useTasks`, `useProducts`, `useAreas`, `useStakeholders`, `useDepartments`, `useProjectNotes`), all backed by `src/lib/localDb.js` and each also exporting the plain mutation functions `chatActions.js` reuses, plus chat (`useChatController` — gathers the local-data snapshot and runs the assistant's plan via `chatActions.js`; `useChatMessages`, `useChatSessions`, `useSlashCommand`, still Base44-backed for conversation history only), the chat widget's window geometry (`useWindowGeometry`), drag-and-drop (`useGlobalDragEnd`), accent theme persistence (`useAccentTheme`), and other UI utility hooks (inline editing, date selection, file upload, highlight matching). `useFileUpload` stores files as data URLs locally; it's unrelated to the chat widget's own (still Base44) attachment upload.
- `lib/` — cross-cutting logic: `localDb.js` (the local data layer), `deviceStorage.js` (the File System Access/manual backends `localDb.js` reads/writes through outside dev mode), `cloudStorage.js` (the opt-in Base44-hosted backend `deviceStorage.js` dispatches to), `storageMigration.js` (copies data across backends when you switch), `chatActions.js` (the chat assistant's client-side action executor), `CardViewContext.jsx` (the Mini/Full card preference, shared by Dashboard/AreaCard/ProductCard), filter/highlight context, entity and task utilities, the Base44 app-params/query-client setup (kept for the chat client).

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

- `Vaea-Windows.bat` — self-extracts and serves via PowerShell (built into Windows). No Node.js needed.
- `Vaea-Linux.sh` — self-extracts and serves via Python 3 (preinstalled on virtually all modern macOS/Linux). No Node.js needed.

Regenerate them after a source change:

```bash
npm run build          # produces dist/
node standalone/build.cjs   # embeds dist/ into both launchers
```

Whoever receives one of the two files just runs it: double-click the `.bat` on Windows, or `./Vaea-Linux.sh` (or `bash Vaea-Linux.sh`) on macOS/Linux. Either one starts a tiny local server with SPA-aware routing and opens the app in their default browser automatically, no install step. See `standalone/README.txt` for the exact instructions each one ships with (also printed to anyone who opens the folder instead of running the file).

This is the same app as `npm run dev`, minus the AI chat widget, which needs Base44's hosting for the LLM call itself and can't be bundled into an offline file (the data it acts on, though, is exactly the same local data everything else here uses — see Architecture above). Unlike `npm run dev`, these launchers serve the already-built static `dist/` with no Vite dev server behind them — so there's no `data/` folder here, and the app falls back to `deviceStorage.js` instead, same as any other non-dev deployment (see "Local data storage" above): a device folder or manual export/import file by default, or cloud storage if the person running it signs in and opts in. The two generated launchers (and the transient `standalone/_payload.*` build files) are gitignored — they're build artifacts, regenerate them from source rather than committing them. The editable source for each lives in `standalone/templates/*.tpl`.

**Zero-dependency alternative:** `standalone/exe/` builds native executables (`Vaea-Windows.exe`, `Vaea-Linux`) with the Node.js runtime itself embedded via [`pkg`](https://github.com/yao-pkg/pkg) — not even PowerShell/Python are required, at the cost of ~45-50MB per file instead of a few hundred KB. Regenerate with:

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

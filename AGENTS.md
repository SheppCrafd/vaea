# AGENTS.md

## Project Context

This is a fork of a Base44 app with everything except the AI assistant's *brain* moved off Base44. Core app data (areas, products, projects, tasks, stakeholders, departments, notes) lives locally via `src/lib/localDb.js` — no hosted database, and as of the chat rewrite below, the AI assistant reads and writes this exact same data too. `localDb.js` picks its backing store automatically per session: real JSON files in a gitignored `data/` folder when running `npm run dev`/`npm run preview` (served by `vite-localdb-plugin.js`'s dev-server middleware), or `localStorage` everywhere else (hosted preview, production build, standalone distributables — anything with no Node process behind it). Base44 is retained only to run the LLM call itself (`base44/functions/aiChatStream`), store chat history (`ChatSession`/`ChatMessage`), and gate access to the app (login).

Important: `aiChatStream` never touches your project data. It used to execute actions directly against Base44's own hosted entities — a separate, disconnected dataset from what the Dashboard showed, which meant chat could never visibly affect anything you saw. That's been rewired: the client now sends its current local dataset along with each message (so the LLM can see it), the function decides a plan and returns it *unexecuted*, and `src/lib/chatActions.js` runs it client-side against `localDb` — the same cascade logic the UI's own mutation hooks use (imported directly, not duplicated). Your data touches Base44 only in transit, for that one request; nothing is persisted there. A privacy notice (the `Info` icon) in both chat surfaces says exactly this.

Treat this as user-owned application code, keep changes focused on the user's request, and preserve existing project conventions.

Start with `README.md` for local setup and architecture details.

## Key Files

- `src/lib/localDb.js`: the local data layer for all app data, now including what the chat assistant reads/writes. Two backing stores (file-backed via the dev-server API, or `localStorage`), chosen automatically by a probe on first read — every exported function stays `async` regardless of which is active, so nothing calling it needed to change.
- `vite-localdb-plugin.js`: the Vite dev/preview-server middleware backing the file-based store above — reads/writes `data/<collection>.json`. Only active under `npm run dev`/`npm run preview`; has no effect on a production build or any other deployment target.
- `src/hooks/`: entity hooks (`useAreas`, `useProducts`, `useProjects`, `useTasks`, `useStakeholders`, `useDepartments`, `useProjectNotes`) — each exports both a React Query mutation hook (for the UI) and the plain async function it wraps (for `chatActions.js` to reuse directly). Keep it that way — don't let the chat executor drift into its own copy of cascade logic.
- `src/lib/chatActions.js`: the chat assistant's action executor — mirrors `aiChatStream`'s action catalog 1:1, but runs against `localDb` via the hook files' plain functions above. This is what actually creates/updates/deletes things when you chat.
- `src/hooks/useChatController.js`: gathers the local dataset snapshot sent to `aiChatStream`, and calls `chatActions.js` to execute (or hold for confirm, or undo) whatever plan comes back.
- `src/api/base44Client.js`: frontend Base44 SDK client, used only for chat (`useChatController`, `useChatSessions`, `useChatMessages`) and its file attachments.
- `base44/functions/aiChatStream/`: decides the action plan only, never executes it. Requires an authenticated session (rejects with 401 otherwise) since it's reachable by URL and would otherwise let anyone burn LLM calls.
- `base44/functions/deactivateAccount/`: restored account-deletion function, callable only by the authenticated user on their own account.
- `src/lib/AuthContext.jsx` + the `AuthenticatedApp` wrapper in `src/App.jsx`: gates the whole app behind base44's own hosted login (Google/Microsoft/Apple/email) — same pattern as Zmanim Today. Restored from pre-fork history at the user's explicit request; don't remove without being asked, same as you wouldn't have added it without being asked.
- `src/lib/CardViewContext.jsx`: the "mini" vs "full" project-card preference, toggled at the top of the Dashboard and shared by `AreaCard`/`ProductCard` (which switch both which `ProjectCard*` component renders and their container's layout class). `ProjectCard.jsx` (mini, default) and `ProjectCardFull.jsx` (the original always-editable card, restored from pre-mini-cards history) are both real, maintained components — don't treat one as dead code.
- `vite.config.js`: Vite config and Base44 Vite plugin setup — kept because `aiChatStream` still needs the Base44 toolchain.
- `src/lib/csv.js`: generic, entity-agnostic CSV parse/stringify (no external dependency — hand-rolled but RFC4180-correct: quoted fields, embedded commas/newlines, escaped `""` quotes).
- `src/lib/csvImportSchemas.js`: per-entity-type (area/product/project/task) template columns and row -> CREATE_* args resolution for the Create New popover's "Via .csv" tab — including title-based lookup of parent area/product/project, with per-row errors (not a whole-import abort) when a reference doesn't resolve to exactly one match.
- `src/components/modals/CsvImportForm.jsx`: the "Via .csv" tab's UI — download a template, upload a filled-in file, runs every resolved row through `chatActions.js`'s `BULK_CREATE`, same as everything else. Don't add a separate creation path here; reuse the existing one.

## Working Notes

- Most feature work needs nothing but `npm run dev` against local data. Note: `npm run dev` locally has no real base44 app id wired, so the auth check in `AuthContext.jsx` fails with a 404 (not the real backend's 403) and silently falls through to rendering the app — this is a pre-existing quirk in the auth-check code, not a bug introduced by restoring it. The actual auth gate only meaningfully exists on a properly configured/deployed base44 app.
- Only touch `base44 dev` / the Base44 CLI when working on the AI chat function itself.
- Non-chat file uploads (`useFileUpload`, and the stakeholder avatar uploads in `StakeholderList.jsx`/`AddStakeholderModal.jsx`) store files as data URLs locally — don't reach for `base44.integrations.Core.UploadFile` there. The chat widget's own attachment upload in `useChatController.js` is the one exception, left on Base44 intentionally.
- Login is required for the whole app (restored from the pre-fork state) — don't remove it without being asked, mirroring the original instruction not to add it without being asked.
- Run the relevant checks from `package.json` before finishing code changes.

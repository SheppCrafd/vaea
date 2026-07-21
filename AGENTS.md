# AGENTS.md

## Project Context

This is a fork of a Base44 app with everything except the AI assistant moved off Base44. Core app data (areas, products, projects, tasks, stakeholders, departments, notes) lives in browser `localStorage` via `src/lib/localDb.js` — no hosted database. Base44 is retained to run the AI chat assistant's backend function (`base44/functions/aiChatStream`), store chat history (`ChatSession`/`ChatMessage`), and — as of the whole-app login restore below — gate access to the app itself.

Important: `aiChatStream` acts on Base44's own hosted entities, not the local `localDb` data — the AI assistant and the rest of the app currently read/write two disconnected datasets. This was a deliberate scope decision, not a bug; don't "fix" it without being asked to.

Treat this as user-owned application code, keep changes focused on the user's request, and preserve existing project conventions.

Start with `README.md` for local setup and architecture details.

## Key Files

- `src/lib/localDb.js`: the local data layer for all non-chat app data.
- `src/hooks/`: entity hooks (`useAreas`, `useProducts`, `useProjects`, `useTasks`, `useStakeholders`, `useDepartments`, `useProjectNotes`) — all `localDb`-backed, including the cascade/business logic that used to live in Base44 functions.
- `src/api/base44Client.js`: frontend Base44 SDK client, used only for chat (`useChatController`, `useChatSessions`, `useChatMessages`) and its file attachments.
- `base44/functions/aiChatStream/`: base44 itself auto-added an auth check here (rejects unauthenticated requests with 401) after we restored the entity schemas it depends on — see the git history around that date for why.
- `base44/functions/deactivateAccount/`: restored account-deletion function, callable only by the authenticated user on their own account.
- `src/lib/AuthContext.jsx` + the `AuthenticatedApp` wrapper in `src/App.jsx`: gates the whole app behind base44's own hosted login (Google/Microsoft/Apple/email) — same pattern as Zmanim Today. Restored from pre-fork history at the user's explicit request; don't remove without being asked, same as you wouldn't have added it without being asked.
- `vite.config.js`: Vite config and Base44 Vite plugin setup — kept because `aiChatStream` still needs the Base44 toolchain.

## Working Notes

- Most feature work needs nothing but `npm run dev` against local data. Note: `npm run dev` locally has no real base44 app id wired, so the auth check in `AuthContext.jsx` fails with a 404 (not the real backend's 403) and silently falls through to rendering the app — this is a pre-existing quirk in the auth-check code, not a bug introduced by restoring it. The actual auth gate only meaningfully exists on a properly configured/deployed base44 app.
- Only touch `base44 dev` / the Base44 CLI when working on the AI chat function itself.
- Non-chat file uploads (`useFileUpload`, and the stakeholder avatar uploads in `StakeholderList.jsx`/`AddStakeholderModal.jsx`) store files as data URLs locally — don't reach for `base44.integrations.Core.UploadFile` there. The chat widget's own attachment upload in `useChatController.js` is the one exception, left on Base44 intentionally.
- Login is required for the whole app (restored from the pre-fork state) — don't remove it without being asked, mirroring the original instruction not to add it without being asked.
- Run the relevant checks from `package.json` before finishing code changes.

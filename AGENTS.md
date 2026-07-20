# AGENTS.md

## Project Context

This is a fork of a Base44 app with everything except the AI assistant moved off Base44. Core app data (areas, products, projects, tasks, stakeholders, departments, notes) lives in browser `localStorage` via `src/lib/localDb.js` — no hosted database, no login/auth. Base44 is retained only to run the AI chat assistant's backend function (`base44/functions/aiChatStream`) and store chat history (`ChatSession`/`ChatMessage`).

Important: `aiChatStream` acts on Base44's own hosted entities, not the local `localDb` data — the AI assistant and the rest of the app currently read/write two disconnected datasets. This was a deliberate scope decision, not a bug; don't "fix" it without being asked to.

Treat this as user-owned application code, keep changes focused on the user's request, and preserve existing project conventions.

Start with `README.md` for local setup and architecture details.

## Key Files

- `src/lib/localDb.js`: the local data layer for all non-chat app data.
- `src/hooks/`: entity hooks (`useAreas`, `useProducts`, `useProjects`, `useTasks`, `useStakeholders`, `useDepartments`, `useProjectNotes`) — all `localDb`-backed, including the cascade/business logic that used to live in Base44 functions.
- `src/api/base44Client.js`: frontend Base44 SDK client, used only for chat (`useChatController`, `useChatSessions`, `useChatMessages`) and its file attachments.
- `base44/functions/aiChatStream/`: the one remaining Base44 function. Unauthenticated (the auth gate was removed along with the rest of Base44 auth).
- `vite.config.js`: Vite config and Base44 Vite plugin setup — kept because `aiChatStream` still needs the Base44 toolchain.

## Working Notes

- Most feature work needs nothing but `npm run dev` against local data.
- Only touch `base44 dev` / the Base44 CLI when working on the AI chat function itself.
- Non-chat file uploads (`useFileUpload`, and the stakeholder avatar uploads in `StakeholderList.jsx`/`AddStakeholderModal.jsx`) store files as data URLs locally — don't reach for `base44.integrations.Core.UploadFile` there. The chat widget's own attachment upload in `useChatController.js` is the one exception, left on Base44 intentionally.
- There's no user/account/auth concept anymore — don't reintroduce login-gated UI unless asked.
- Run the relevant checks from `package.json` before finishing code changes.

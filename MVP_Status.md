# Portfolio Tracker — MVP Status

_Audited 2026-07-16 against the actual product spec (manager's dashboard for tracking Areas of Responsibility → Products → Projects → Tasks, with stakeholders, an AI copilot, and an archive). Checked every claim against `src/` and `base44/` source, not assumptions._

Legend: `[x]` matches spec & verified working · `[~]` exists but is broken/incomplete/deviates from spec · `[ ]` not built

---

## 0. Top-line summary

_Updated 2026-07-16. Every section (0-12) is now fixed/matching spec. Highlights of the last stretch: the Archive overlay can now open a full, editable project detail view (including its archived tasks) instead of only restoring; and the AI Assistant was rebuilt end-to-end — moved off an unrestricted client-side LLM call onto the authenticated `aiChatStream` backend function, given the full action catalog with correct field names (including archived-data awareness), gated every destructive action behind an inline confirm step, and got the full chat-UX spec (icon customization, attachments, session history via new `ChatSession`/`ChatMessage` entities, lazy-loaded history, scroll-nav, animated icon)._

All 12 spec sections (§1-§12) are now fully matched. Two items remain open, both intentionally out of scope for this pass rather than oversights: **no automated tests** and **no visible error state for failed queries** (§13, Cross-cutting) — neither is a spec-compliance gap, just general engineering hardening not covered by the product spec itself. Also fixed along the way: Product delete now cascades to its projects/tasks like Area/Project delete already did, and got a Delete button in the UI for the first time.

---

## 1. Layout shell

- [x] Header across the top with app title + nav
- [x] Left column: stakeholders by department (`LeftSidebar` → `StakeholderList`)
- [x] Center: main dashboard content
- [x] Right column: Today's Top 3 / Weekly Focus + status bar chart (`Sidebar` → `FocusFeed`, `StatisticsChart`)
- [x] Floating chat widget, bottom-right, above everything (`ChatBox`)
- [x] ~~"View Archive" is a header nav link, not the spec's lower-left button revealing a date-range picker in place.~~ **Fixed** — `AppShell` now has a lower-left "View Archive" button that opens `ArchivePanel` (a floating overlay wrapping the existing `ArchiveView`), matching the spec. The `/archive` route and header nav link were removed since the overlay is reachable from anywhere in the app.

## 2. Dashboard hierarchy (Area → Product → Project)

- [x] Areas render as top-level cards (`AreaCard`)
- [x] Products render as nested cards inside their Area (`ProductCard`)
- [x] Projects render as nested cards inside their Product (`ProjectCard`)
- [x] Projects may skip Product and sit directly in an Area ("Admin Tasks"-style) — modeled via `parent_area_id` + null `parent_product_id`, rendered in an explicit "Direct Projects" drop zone
- [x] Drag-and-drop: projects can be dragged into a Product, or out to an Area's direct-projects zone, live-updating `parent_product_id`/`parent_area_id` (`Dashboard.jsx` `handleDragEnd`)
- [x] ~~"Lines which represent connections to products" was decorative/fake.~~ **Fixed** — `Project.related_product_ids` (new schema field) lets a project link to products beyond its primary parent, set via `ProductAssigner` in the project detail modal. `ProductConnectionLines` (rendered once in `Dashboard.jsx`) draws real curved SVG lines from each project card to its related product cards, found via `data-project-card`/`data-product-card` attributes and recomputed on resize/scroll/data change. Scoped to the main Dashboard view only (not the Area expand modal) for now.

## 3. Project card (spec: title centered top in larger font, objective just under, quadrant squares far left, owner+date far right, risks/questions center, expand icon top-right)

File: `src/components/projects/ProjectCard.jsx`

- [x] Title centered, larger font, top of card, inline-editable
- [x] Objective shown just under title
- [x] Four quadrant-count squares on the far left (Q1 top-left, Q2 top-right, Q3 bottom-left, Q4 bottom-right/unassigned) — layout matches spec exactly
- [x] ~~"Number is dark green if a task in that quadrant is a focus item for the week" is broken.~~ **Fixed** — `getQuadrantCounts()` in `src/lib/taskUtils.js` now reads the real `task.is_weekly_focus`, used by `ProjectCard`.
- [x] ~~"Archived tasks excluded from the count" is broken.~~ **Fixed** — `getQuadrantCounts()` filters through `filterActiveTasks()`, which checks the real `task.archived_at`/`task.deleted_at`.
- [x] ~~Owner name is broken.~~ **Fixed** — card now reads via `getProjectOwner()` (`project.owner_name`) in `src/lib/projectUtils.js`. Shows real owner names instead of always "Unassigned".
- [x] ~~Due date is broken.~~ **Fixed** — card now reads via `formatDueDate()` (`project.due_date`) in `src/lib/projectUtils.js`. Shows real due dates instead of always "No due date".
- [x] ~~Due-date color coding is broken.~~ **Fixed** — `getDueDateColorClass()` now derives on-track/at-risk/missed from the due date itself (no new field needed): COMMITTED + overdue with incomplete tasks = red, COMMITTED + due within 7 days with incomplete tasks = orange, COMMITTED otherwise = green, ESTIMATED (or no due date) = black, all tasks done = blue. Updates automatically as time passes instead of needing manual upkeep.
- [x] ~~Risks & Questions center-of-card field wrote to a nonexistent `project.risks`.~~ **Fixed** — replaced with a real quick-add: typing and pressing Enter creates an actual `ProjectNote` (type RISK) via `useCreateProjectNote`, shown immediately in the real `ProjectNotes` list rendered right below it. One data path now instead of two disconnected ones.
- [x] Expand icon top-right opens the detail modal
- [x] Card also shows extra stats not in the spec (Progress %, Tasks done/total, Notes count) — reasonable additions, not a gap
- [x] ~~`DueDateBadge.jsx` dead code~~ **Fixed** — deleted; its logic now lives, correctly, in `src/lib/projectUtils.js`.

## 4. Project detail / expand view

File: `src/components/projects/ProjectDetailModal.jsx`

- [x] Shows everything from the card plus more, editable
- [x] ~~Owner is wrong here too (`project.owner` instead of `owner_name`).~~ **Fixed** — reads/writes `owner_name` now, matching the card.
- [x] Objective (editable)
- [x] Problem Statement (editable)
- [x] ~~Reporter(s) and stakeholder(s) on individual risks/open questions were not settable.~~ **Fixed** — new `AddNoteForm` (reporter text input + `StakeholderAssigner`) creates real `ProjectNote`s from this view.
- [x] ~~Notes with date-added + stakeholder list didn't work; no dedicated Notes section.~~ **Fixed two bugs**: `ProjectNotes.jsx` was reading `note.created_at`/`note.stakeholders`, which don't exist — the real Base44-injected field is `created_date`, and stakeholder names now resolve from `note.stakeholder_ids` against the stakeholder list. Also added a third `ProjectNote` type, `"NOTE"`, and a dedicated "Notes" section in the detail view separate from "Risks & Open Questions" (both share the same underlying entity/form, filtered by type) — matching the spec's distinction between the two.
- [x] Stakeholders organized by department, with an assigner to add/remove
- [x] Task table embedded at the bottom (`TaskTable`)
- [x] Archive / Restore / Delete actions in the footer, restore-button swap when `is_archived` — matches spec exactly
- [x] ~~Activity, Impact, and Outcome metrics (forecast and measured) had no UI.~~ **Fixed** — Activity is a new editable text field; `project.metrics` is now a small structured object (`impact_forecast`/`impact_measured`/`outcome_forecast`/`outcome_measured`) rendered as an editable 2x2 grid.
- [x] ~~Attachments — no field, no upload UI.~~ **Fixed** — new `Project.attachments` field (array of `{name, url}`), file upload reuses the same `base44.integrations.Core.UploadFile` integration already proven out for stakeholder avatars.
- [x] ~~Links — not modeled, not rendered.~~ **Fixed** — new `Project.links` field (array of `{label, url}`), simple add/remove UI.
- [x] ~~Custom fields were entirely missing.~~ **Fixed** — new `CustomFieldsSection` (in `src/components/shared/`, reusable for Product/Area later) lets a user add a label+value field scoped to either "this project only" (stored in `Project.custom_data`) or "all projects in this area" (registered in `Area.custom_schema.fields` so it shows up, empty, on every other project in that Area too), with a per-field "show on card" checkbox that renders it on `ProjectCard` below the permanent fields. "All projects" is scoped to the Area rather than literally every project app-wide, since that's what the existing schema shape (`custom_schema` living on Area) supports without adding a new global store.
- [x] ~~Archived tasks weren't viewable from the expanded project view.~~ **Fixed** — a collapsible "Archived tasks" section (`ArchivedTaskList`, backed by a new `useArchivedTasks` hook) sits below the task table, with a one-click restore per task.

## 5. Task table popup

Files: `src/components/projects/TaskTable.jsx`, `TaskTableModal.jsx`

- [x] Opens from clicking the quadrant squares on the card
- [x] Status column — all 8 values match spec exactly (dropdown, portal-rendered so it isn't clipped)
- [x] Quadrant column (1–4, editable)
- [x] ~~Quadrant "H"/"Q"/"HQ" suffix notation is not implemented.~~ **Fixed** — the quadrant select now shows plain numbers (1-4, no more confusing "Q1" prefix), paired with two small H/Q toggle buttons that write `is_highly_important`/`is_quick_task`.
- [x] Type column — 5 values match spec exactly
- [x] Description (editable)
- [x] Notes (editable)
- [x] Stakeholders (multi-assign via `StakeholderAssigner`)
- [x] Weekly-focus checkbox
- [x] Top-3 star toggle, including the server-side "max 3 per project" guard
- [x] Archive action per task
- [x] Delete action per task, with confirm
- [x] ~~The new-task row wasn't styled as a blue "New Task" row.~~ **Fixed** — tinted row (`bg-primary/10`) with an explicit "New Task" label next to the plus icon.
- [x] New task can be created with description and/or quadrant only, other fields blank — roughly matches "created with any field but description blank"
- [x] ~~Attachments column — not modeled or rendered.~~ **Fixed** — new `Task.attachments` field, compact paperclip-icon popover (`TaskAttachments`) reusing the same upload integration as everything else.
- [x] ~~No visible way to view/restore an individual archived task from anywhere.~~ **Fixed** — the collapsible "Archived tasks" section built into `ProjectDetailModal` (§4) covers this; matches the spec's own wording ("Archived tasks can be viewed from the expanded view of the project").

## 6. Product card

File: `src/components/products/ProductCard.jsx`

- [x] Title + description top-left, both inline-editable
- [x] Stakeholders shown centered (`AvatarStack`)
- [x] Stats at the bottom (Progress %, Tasks, Projects) — matches "stats on it as well, at the bottom"
- [x] Expand icon → `ProductDetailModal`
- [x] ~~Custom-field capability was missing for Products.~~ **Fixed** — `CustomFieldsSection` wired in with `entityType="product"`, scoped to "all products in this area" (using a separate `product_fields` registry on the Area, independent from Project's `project_fields`) or "this product only".
- [x] ~~`ProductDetailModal` was bare relative to the card.~~ **Fixed** — now also shows the Progress/Tasks/Projects stats row, a stakeholder assigner (not just a read-only list), and the full nested project list (real `ProjectCard`s, not just names) — matches-and-exceeds the collapsed card now.

## 7. Area of Responsibility card

File: `src/components/areas/AreaCard.jsx`

- [x] Title + description top-left, inline-editable
- [x] Expand icon → `AreaModal`
- [x] ~~Custom-field capability was missing for Areas.~~ **Fixed** — `CustomFieldsSection` wired in with `entityType="area"`. Areas have no parent to register a broader scope against, so every Area custom field is inherently area-only (no "all areas" option, matching the spec, which never asks for that).
- [x] ~~`AreaModal` didn't surface the Area's own editable title/description, and there was no additional-fields container.~~ **Fixed** — added an editable title/description header (matching `ProjectDetailModal`/`ProductDetailModal`'s pattern) plus the new Custom Fields section. Also fixed a staleness bug in the process: `AreaModal` now re-resolves its `area` prop against the live `useAreas()` query so edits made inside the modal show up immediately instead of only after closing and reopening it.

## 8. Create New / Filter

File: `src/components/layout/Header.jsx`, `src/components/modals/*`

- [x] "Create New" button opens a modal with Task / Project / Product / Area type picker (`CreateModal`)
- [x] Each type has its own form (`TaskForm`, `ProjectForm`, `ProductForm`, `AreaForm`)
- [x] Filter button opens a modal to exclude any Area / Product / Project from view (`FilterModal`, `FilterContext`)
- [x] `TaskForm` (standalone, opened from the global Create button) — re-checked directly: it does have a required Project picker (`src/components/modals/TaskForm.jsx`), submit is disabled until both a project and description are set. The original note flagging this as unverified was overcautious; no fix needed.

## 9. Right sidebar — Focus feed + stats

File: `src/components/sidebar/FocusFeed.jsx`, `StatisticsChart.jsx`

- [x] Today's Top 3 list, sourced from `is_today_top_three`
- [x] ~~Weekly Focus was only grouped by project, not further by task type.~~ **Fixed** — now grouped by project, then by task type within each project.
- [x] Status can be changed inline from this list (dropdown)
- [x] Horizontal bar chart of task-status counts, correct color mapping per spec: Done/Delegated-Done green, Delegated blue, In Progress yellow, Blocked dark grey, Pending Feedback orange, On Hold red, no-status white-with-border — **matches spec exactly**, nice.
- [x] ~~Bar chart was a single global breakdown, not "by project".~~ **Fixed** — now one compact stacked bar per project (reusing `TaskStatistics`, which already implements the spec's exact color legend, instead of a second parallel color implementation).
- [x] ~~No archive/delete action available on tasks from this feed.~~ **Fixed** — archive and delete icon buttons added to each row, matching `TaskTable`.

## 10. Left sidebar — Stakeholders

File: `src/components/sidebar/StakeholderList.jsx`, `AddStakeholderModal.jsx`

- [x] Grouped by department
- [x] Avatar shows uploaded image or initials fallback (`src/components/shared/Avatar.jsx`, shared with the product stakeholder stack)
- [x] Four count "checkboxes" per stakeholder (Tasks/Notes/Projects/Products), each showing a live count and acting as a highlight toggle — matches spec well
- [x] Clicking a count highlights/dims matching objects across the app — verified wired into `ProjectCard`, `ProductCard`, `AreaCard`, and `TaskTable` (and `FocusFeed` reads it too) via a shared `HighlightContext`
- [x] "Add Stakeholder" button above the list; requires Name + Department, image optional with real upload (`base44.integrations.Core.UploadFile`) — matches spec exactly
- [x] ~~Highlighting didn't reach the individual-quadrant-square level.~~ **Fixed** — `getQuadrantCounts()` now also takes the active `highlightedIds` and flags which quadrants contain a matching task; those squares get a ring highlight on the card, in addition to the existing whole-card dim and table-row dim.

## 11. AI Assistant (chat copilot)

File: `src/components/ai/ChatBox.jsx`, `src/components/ai/ChatMessageList.jsx`, `src/components/ai/ChatSessionList.jsx`, `base44/functions/aiChatStream/`

Rebuilt end-to-end. What's now in place:

- [x] Floating icon bottom-right, opens a chat box
- [x] Text input + submit button
- [x] ~~Two divergent implementations, wrong one live.~~ **Fixed** — all LLM calls and entity mutations now go through the authenticated `aiChatStream` backend function; the client never touches `InvokeLLM` or entities directly anymore.
- [x] ~~Sends to an LLM, parses a structured action, executes it~~ — now covers the **full action catalog** with correct field names: Area/Product/Project/Task/Stakeholder/ProjectNote create/update/delete, move/archive/restore project, weekly-focus/top-3 toggles (with the 3-per-project guard), and `SET_CUSTOM_FIELD`. Field names verified against the real schema (`owner_name`, `due_date`, `stakeholder_ids` as an array, etc.) — the old client-side prompt's field-name mismatches are gone since this is a full rewrite, not a patch.
- [x] ~~No confirmation before destructive actions.~~ **Fixed** — every `DELETE_*` action comes back from the backend as a `pending_action` instead of executing; the client renders inline Yes/Cancel buttons on that message, and only re-invokes the function with `confirmedAction` (skipping the LLM call entirely) once the user confirms. Matches the confirm-dialog behavior a human gets from the equivalent UI button.
- [x] ~~LLM couldn't answer questions about archived objects.~~ **Fixed** — the backend now fetches and includes archived projects and archived tasks in context alongside active ones, explicitly labeled.
- [x] Response rendered as a markdown bubble
- [x] "Chat with the LLM about any other topic" — the `CHAT_ONLY` branch still handles general conversation.
- [x] ~~Chat icon customization was missing.~~ **Fixed** — clicking the header icon opens a picker (5 preset icons or type a custom emoji), persisted to `localStorage`, used both as the trigger icon and the in-box header icon.
- [x] ~~No attachments via a plus icon.~~ **Fixed** — the footer's plus button uploads a file (same `UploadFile` integration used elsewhere) and appends a reference link to the outgoing message.
- [x] ~~No explicit collapse button.~~ **Fixed** — layout now matches the spec's positions: chat icon top-left (opens the icon picker) with the "<" history caret just below it, collapse (`X`) top-right, plus-icon bottom-left, submit bottom-right. Collapsing was already non-destructive to typed input/message state even before this pass (the component was never unmounted), so no separate fix was needed there beyond adding the correctly-positioned icon.
- [x] ~~No animation on the chat icon while responding.~~ **Fixed** — the trigger/header icon gets a bounce animation while `isComputing`, in addition to the inline spinner.
- [x] ~~No scroll-nav bar.~~ **Fixed** — an understated rail with up/down buttons and a position thumb sits to the right of the message list.
- [x] ~~No lazy-loaded history, no saved sessions.~~ **Fixed** — chat is now backed by two new entities, `ChatSession` and `ChatMessage`, persisted server-side. The "<" caret opens a session browser to switch sessions or start a new one; within a session, only the most recent 20 messages render at first, with a "Load earlier messages" trigger revealing more in batches — a client-side windowed reveal rather than true server-side cursor pagination, since the SDK's `.filter()` doesn't expose pagination params; documented here as a scoping call, not oversold as full backend pagination.
- [x] Undo — kept as a lightweight client-side stack of the last few reversible actions (task status, weekly-focus toggle, top-3 toggle), replayed through the same backend `confirmedAction` path rather than a separate mechanism.
- [x] ~~`SET_CUSTOM_FIELD` via chat was scoped down from the UI's version (entity-only, no area-wide registration).~~ **Fixed** — added an `area_wide` flag that registers the field on the parent Area's `custom_schema`, matching the UI's "All projects/products in this area" option exactly.

**2026-07-16 follow-up — found and fixed after the user reported the chat throwing 500s and failing to add risks:**
- **Root cause of every chat failure**: `response_json_schema` declared `args: { type: 'object' }` with no defined shape. Structured-output validation rejects open-ended nested objects like that, so the very first LLM call failed on *every* message, regardless of what the user asked for — not a risks-specific bug. Fixed by encoding `args` as a JSON string (`args_json`) instead, matching the flat-scalar-only shape the original (working, pre-rewrite) version of this function always used.
- A follow-up full-app audit (mutation-by-mutation cross-check against every entity schema, via a dedicated verification pass) found **zero remaining field-name mismatches** anywhere in the app, confirming the args_json bug was the sole cause of the reported failures.
- That same audit surfaced real **capability gaps** between the UI and the chat catalog, since several action handlers silently dropped fields the UI lets you set: `CREATE_PROJECT`/`CREATE_PRODUCT` couldn't set `stakeholder_ids` at all; `UPDATE_PRODUCT` was hard-coded to title/description only (couldn't touch stakeholders); `related_product_ids`, `attachments`, `links`, and `metrics` weren't settable via chat at all despite being real, UI-editable Project fields. All fixed — `UPDATE_PRODUCT` is now a generic passthrough like `UPDATE_PROJECT`/`UPDATE_TASK`, and the context sent to the LLM now includes current `stakeholder_ids`/`related_product_ids`/`attachments`/`links` so it can correctly merge into these "full replacement array" fields instead of guessing.
- Added `RESTORE_TASK` (un-archiving an individual task, previously only possible for whole projects via `RESTORE_PROJECT`) and `avatar_url` support on `CREATE_STAKEHOLDER`/`UPDATE_STAKEHOLDER` (settable from an attached image) — both real UI capabilities the chat couldn't previously touch.
- Added explicit prompt guidance for parsing an attached file's `[Attached: name](url)` reference out of the user's message and using it for `UPDATE_PROJECT`/`UPDATE_TASK` attachments or a stakeholder's `avatar_url`.

**2026-07-16 second follow-up — the reverse gap: things the UI itself couldn't do, that the user (not just chat) needs.** The user reported being unable to remove a risk/question from a project at all — true, `ProjectNotes.jsx` was pure read-only display with no edit or delete affordance anywhere in the UI, even though `useUpdateProjectNote`/`useDeleteProjectNote` already existed and the AI's `UPDATE_NOTE`/`DELETE_NOTE` already worked. Same story for Stakeholders: `useUpdateStakeholder` existed and the AI could call it, but there was no UI to edit a stakeholder's name/department/photo after creation — only create and delete. Fixed both directions so the human and the assistant now have matching CRUD, not just the assistant having more than the human:
  - `ProjectNotes.jsx` — content is now inline-editable, each note has a delete button (with confirm).
  - `StakeholderList.jsx` — name and department are now inline-editable per stakeholder, and clicking the avatar re-uploads a new photo.
  - Chat sessions themselves gained a delete option too (new `useDeleteChatSession`, hover-to-reveal delete button in the "<" history panel, cascades to that session's messages) — deleting the currently-open session starts a new chat. Deliberately *not* exposed to the AI itself (asking the assistant to delete the conversation you're having with it is a strange enough edge case that it's left as a manual-only action, same reasoning as icon customization).

## 12. Archive view

File: `src/components/archive/ArchiveView.jsx`

- [x] Date-range picker (start/end date inputs)
- [x] Shows projects active/archived within that range (server-side filter in `archivedProjects` function)
- [x] Quadrant counts shown and computed server-side without shipping full task arrays — matches the spec's memory-conscious design intent well
- [x] ~~Tasks were never loaded on-demand from this view; no way to open an archived project's detail.~~ **Fixed** — clicking an archived project row now fetches the full record on demand (new `useProject(id)` hook, since the list view intentionally only has the lightweight summary shape) and opens the same `ProjectDetailModal` used on the live dashboard — full editing, notes, custom fields, and its "Archived tasks" section all work identically to an active project. The Restore button on the row itself still works too (stops click propagation so it doesn't also open the modal).
- [x] Restore button present and functional, matches spec's "changes to Restore Project when viewing an archived project" — now works both from the row directly and from inside the opened detail modal.

## 13. Cross-cutting

- [x] React Query cache invalidation wired on every mutation
- [x] Debounced inline-edit pattern used consistently (`EditableText`, `useDebouncedCallback`)
- [ ] No automated tests anywhere in the repo — still true, out of scope for this pass
- [ ] No visible error state for failed queries (only a loading state on the main dashboard) — still true, out of scope for this pass
- [x] ~~No confirmation dialog on most destructive actions except Area/task/stakeholder delete; Product delete and AI chat deletes had none.~~ **Fixed** — Product delete now confirms (`confirmThen`), and every AI-chat `DELETE_*` action is gated behind the inline Yes/Cancel confirm flow described in §11.

---

## Bugs ranked by user-visible impact

1. ~~Project card due-date color, owner name, and due date are all effectively non-functional~~ **Fixed** — owner, due date, and now the on-track/at-risk/missed color (derived from the due date, no schema change needed).
2. ~~The card's "Risks & Questions" inline field writes to a Project field (`risks`) that doesn't exist~~ **Fixed** — now creates a real `ProjectNote`.
3. ~~"Top 3" toggle is broken end-to-end~~ **Fixed** — `useToggleTopThree` now invokes the correct function name `toggleTopThree`. `src/hooks/useTasks.js:101`.
4. ~~Weekly-focus quadrant highlighting and archived-task exclusion on the card are dead code~~ **Fixed** — both now go through `src/lib/taskUtils.js`, which checks the real fields.
5. ~~No custom-field system~~ **Fixed** — `CustomFieldsSection` built and wired into Project, Product, and Area detail views/cards.
6. ~~AI chat is architecturally risky and doesn't match the spec~~ **Fixed** — full rewrite onto the authenticated backend function, confirm-gated destructive actions, and the full chat UX spec (icon customization, attachments, session history, lazy loading, animation).
7. ~~Archive view can't open/edit an archived project~~ **Fixed** — clicking a row opens the full `ProjectDetailModal`.
8. ~~No attachments, links, Activity/Impact/Outcome metrics UI, or per-note reporter/stakeholder/date capture form~~ **Fixed** — all built into `ProjectDetailModal` (§4).
9. ~~Quadrant H/Q/HQ labeling is entirely unbuilt~~ **Fixed** — H/Q toggle buttons in the task table.
10. ~~Product delete doesn't cascade~~ **Fixed** — new `deleteProduct` backend function cascades to child projects/tasks, matching Area/Project. Also added the Delete Product button itself, which didn't exist anywhere in the UI before this.
11. ~~`DueDateBadge.jsx` dead code~~ **Fixed** — deleted.

## Suggested order of attack

1. ~~Fix Project card field names (`owner_name`, `due_date`) and due-date color coding~~ **Done.**
2. ~~Point the card's Risks/Questions block at `ProjectNote` create instead of the nonexistent `project.risks`~~ **Done** (quick-add only; still no way to set reporter/stakeholders/date from the card — that requires opening the full detail modal, see §4).
3. ~~Fix the Top 3 invoke-name bug~~ **Done.**
4. ~~Fix the dead camelCase checks on the card (`isWeeklyFocus`, `isArchived`)~~ **Done.**
5. ~~Build the custom-field system~~ **Done** — Project, Product, and Area.
6. ~~Consolidate the AI assistant onto the backend function, add destructive-action confirmation, fix field-name mapping, layer in the chat-UX spec items~~ **Done.**
7. ~~Wire archived-project detail/task viewing into the Archive page~~ **Done.**
8. ~~Add attachments/links, Activity/Impact/Outcome metrics UI, and H/Q quadrant labeling~~ **Done.**
9. ~~Make Product delete cascade consistently with Area/Project~~ **Done** (also added the missing Delete Product button/UI).

# Portfolio Tracker — Production Status

_Rebuilt 2026-07-16 from a from-scratch, skeptical re-audit of `src/` and `base44/` against the manager's actual product spec — not against the previous MVP_Status.md, whose "all 12 sections fully match spec" claim turned out to be wrong (the stakeholder highlight/dimming feature was fundamentally broken despite being marked `[x]`). Every item below was verified by reading the real code and tracing real logic, not by checking that a similarly-named component exists._

Legend: `[x]` matches spec & verified working · `[~]` exists but was broken/incomplete/deviated — now fixed this pass unless noted · `[ ]` not built / open

---

## 0. Top-line summary

Two categories of real, user-visible bugs were found and fixed this pass:

**1. Stakeholder highlight/dimming was architecturally wrong, not just buggy.** The spec calls for four independent checkboxes per stakeholder (tasks/notes/projects/products), each showing its own count and each highlighting only its own object type. The actual build had one generic checkbox plus four inert, unclickable count badges — checking a stakeholder could never do what the spec describes. Rebuilt `HighlightContext` around `{stakeholderId, category}` pairs, rebuilt the sidebar row with four real toggleable checkboxes, and rewired every consumer (task rows, quadrant rings, Project/Product/Area card dimming, and added it to Project Notes, which had zero highlight treatment before).

**2. Avatar colors didn't match outside the sidebar.** `StakeholderAssigner` (used everywhere you assign stakeholders) and the "Project stakeholders by department" mini-stack in the project detail view each hand-rolled their own flat-color, photo-less initials circle instead of using the shared `Avatar` component. Both now render through the same component the sidebar uses.

Beyond those two, a full section-by-section re-audit (parallelized across 4 independent passes, each re-reading the real source) found and fixed:
- Project card's "Risks & Questions" leaked all note types (including general notes) and rendered at the bottom, not the center — now filtered to RISK/QUESTION and moved into the center column.
- Quadrant H/Q/HQ notation was never rendered as the spec's combined text ("2HQ") — now shown as a computed label alongside the existing edit controls.
- The "blue" New Task row rendered as grayscale (`bg-primary/10` resolves to near-black/near-white, not blue, in this theme) — now an actual blue tint.
- Task creation could bypass the required `description` field via quadrant-only creation, contradicting both the spec and the entity schema — fixed to require description, quadrant/type/stakeholders optional.
- `AreaCard` had no expand icon at all — `AreaModal` was practically unreachable except via a raw `?areaId=` URL param. Added the icon.
- Blocked ("dark grey") and No-status ("white, thin black border") bar-chart colors used theme tokens that flip lightness in dark mode, inverting both colors — now literal, theme-independent colors.
- The archive view's date-range picker was close to decorative: it only ever queried `is_archived: true` projects, filtered by last-edited date, never reconstructing "was this project active during this window." Added a real `archived_at` timestamp to Project and rewrote the query as a lifetime-overlap check across all projects (active + archived), so it now actually answers "what was going on during this range."
- Archived tasks were view-only (description/status text + Restore) — spec requires archived objects be editable like active ones. `ArchivedTaskList` now supports the same inline edits as the live task table (description, status, quadrant, stakeholders, attachments, notes) plus delete.
- Chat message history was fetched in full on every session open (only the *render* was windowed client-side) — defeated the spec's stated "so memory on the page is not overused." Rewrote `useChatMessages` to fetch only the most recent page from the server, with a cursor-based `loadMore()` for older batches.
- Quick-create forms (Task, Project) were too thin relative to "fill in any details they have" — added quadrant/type/stakeholders to Task, and objective/owner/due-date/stakeholders to Project.
- "Create" button relabeled to "Create New" to match the spec's literal wording.

**Known, deliberately open items** (see §13): no automated tests; no visible error state for failed queries; a dead/unused `createTask` backend function (client calls `Task.create` directly — cosmetic cleanup, not a bug); the in-progress bar-chart yellow is a bit more saturated than a true pastel (borderline, left alone); Create New always opens pre-selected to the Task tab rather than a neutral first screen (the tab switcher already gives free choice before any data is entered, so this is a minor default, not a missing capability).

---

## 1. Layout shell

- [x] Header across the top with app title + nav
- [x] Left column: stakeholders by department (`LeftSidebar` → `StakeholderList`)
- [x] Center: main dashboard content
- [x] Right column: Today's Top 3 / Weekly Focus + status bar chart (`Sidebar` → `FocusFeed`, `StatisticsChart`/`TaskStatistics`)
- [x] Floating chat widget, bottom-right, above everything (`ChatBox`)
- [x] "View Archive" — lower-left button opening a floating `ArchivePanel` overlay (`AppShell.jsx`)

## 2. Dashboard hierarchy (Area → Product → Project)

- [x] Areas render as top-level cards (`AreaCard`)
- [x] Products render as nested cards inside their Area (`ProductCard`)
- [x] Projects render as nested cards inside their Product (`ProjectCard`)
- [x] Projects may skip Product and sit directly in an Area ("Admin Tasks"-style) via `parent_area_id` + null `parent_product_id`, rendered in an explicit "Direct Projects" drop zone
- [x] Drag-and-drop: projects can be dragged into a Product, or out to an Area's direct-projects zone
- [x] "Lines which represent connections to products" are real SVG curves (`ProductConnectionLines.jsx`), computed from live DOM rects, sourced from `Project.related_product_ids` (settable via `ProductAssigner`) — genuinely functional, not decorative

## 3. Project card

File: `src/components/projects/ProjectCard.jsx`

- [x] Title centered, larger font, top of card, inline-editable
- [x] Objective shown just under title
- [x] Four quadrant-count squares far left (Q1 top-left, Q2 top-right, Q3 bottom-left, Q4 bottom-right/unassigned)
- [x] Number is dark green when a task in that quadrant is a weekly-focus item
- [x] Archived/deleted tasks excluded from quadrant counts (`filterActiveTasks`)
- [x] Owner name and due date far right, correct on-track/at-risk/missed/done color coding
- [x] ~~Center of card showed ALL note types (including general "NOTE"), and rendered at the bottom of the card, not the center.~~ **Fixed** — `riskNotes` filters to `RISK`/`QUESTION` only, rendered directly under the quick-add input in the center column.
- [x] Expand icon top-right opens the detail modal, editable
- [x] Extra stats not in spec (Progress %, Tasks done/total, Notes count) — reasonable additions

## 4. Project detail / expand view

File: `src/components/projects/ProjectDetailModal.jsx`

- [x] Shows everything from the card plus more, editable
- [x] Objective, Problem Statement (editable)
- [x] Reporter(s)/stakeholder(s) on risks/questions, via `AddNoteForm`
- [x] Notes with date-added + stakeholder name list
- [x] Project stakeholders organized by department — ~~mini-avatar stack used a flat hand-rolled color, ignoring uploaded photos.~~ **Fixed** — now renders through the shared `Avatar` component, matching the sidebar.
- [x] Task table embedded at the bottom
- [x] Archive / Restore / Delete actions, restore-swap on `is_archived`
- [x] Activity, Impact/Outcome metrics (forecast + measured)
- [x] Attachments, Links
- [x] Custom fields: this-project-only vs. all-projects-in-area, with "show on card"
- [x] Archived tasks viewable from this view (`ArchivedTaskList` — see §5 for the editing fix)

## 5. Task table popup

Files: `src/components/projects/TaskTable.jsx`, `TaskTableModal.jsx`

- [x] Opens from clicking the quadrant squares on the card
- [x] Status column — all 8 values
- [x] Quadrant column, editable — ~~H/Q/HQ combined notation was never actually rendered as text ("1H", "2HQ"); only a plain number plus two always-visible toggle buttons.~~ **Fixed** — a computed label (e.g. `2HQ`) now renders next to the existing quadrant select + H/Q toggle buttons, so the literal spec'd notation is visible, not just the underlying flags.
- [x] Type column — 5 values
- [x] Description, Notes, Stakeholders, Attachments — all editable
- [x] Weekly-focus checkbox, Top-3 star toggle (server-side max-3-per-project guard)
- [x] Archive / Delete per task
- [x] ~~"Blue row" for New Task rendered as grayscale — `bg-primary/10` resolves to near-black (light mode) / near-white (dark mode) in this theme, not blue.~~ **Fixed** — literal `bg-blue-500/10` + blue text/icon accents.
- [x] ~~A task could be created with only a quadrant and a blank description, contradicting both the spec ("any field but description blank" reads as: everything else may be blank, description may not) and the entity schema, which already declares `description` required.~~ **Fixed** — creation now requires a non-empty description; quadrant/type/stakeholders remain optional and settable afterward from the row.
- [x] Archived tasks viewable from the expanded project view

## 6. Product card

File: `src/components/products/ProductCard.jsx`

- [x] Title + description top-left, inline-editable
- [x] Stakeholders shown centered (`AvatarStack`, already correctly using the shared `Avatar` component)
- [x] Stats at the bottom (Progress %, Tasks, Projects)
- [x] Expand icon → `ProductDetailModal`, same custom-field capability as Project (entity-only vs. all-products-in-area)
- [x] "Lines which represent connections to products" — see §2

## 7. Area of Responsibility card

File: `src/components/areas/AreaCard.jsx`

- [x] Title + description top-left, inline-editable
- [x] ~~No expand icon anywhere on the card — `AreaModal` was reachable only via a raw `?areaId=` URL query param restored on page load, not through any click affordance.~~ **Fixed** — added the same `Expand` icon pattern used on Product/Project cards, wired to the `onExpand` prop that was already being passed down and silently ignored.
- [x] Custom-field capability (area-only scope, correctly — Areas have no parent to register a broader scope against)

## 8. Create New / Filter

File: `src/components/layout/Header.jsx`, `src/components/modals/*`

- [x] ~~Button labeled "Create" instead of "Create New".~~ **Fixed.**
- [x] Opens a modal with Task/Project/Product/Area type picker (tabs, freely switchable before submitting — defaults to the Task tab rather than a neutral first screen, a minor default not a missing capability)
- [x] ~~Quick-create forms were too thin relative to "fill in any details they have" — Task only took project + description; Project only took area/product/title.~~ **Fixed** — `TaskForm` gained optional quadrant/type/stakeholders; `ProjectForm` gained optional objective/owner/due-date/stakeholders. (`ProductForm`/`AreaForm` were already adequate — title/description/parent-area is the entirety of what those cards show.)
- [x] Filter button independently excludes any Area/Product/Project (`FilterModal`, `FilterContext`)

## 9. Right sidebar — Focus feed + stats

File: `src/components/sidebar/FocusFeed.jsx`, `src/components/shared/TaskStatistics.jsx`

- [x] Today's Top 3, then Weekly Focus grouped by project then task type
- [x] Status changeable inline; archive/delete per row
- [x] Horizontal stacked bar of status counts, one bar per project
- [x] ~~Blocked ("dark grey") used `bg-muted-foreground`, a theme token that's *lighter* in dark mode — inverted the intended color. No-status ("white bar, thin black border") used `bg-muted border-border`, both ~15% lightness in dark mode — rendered as a barely-visible dark-on-dark bar, not white-with-black-border.~~ **Fixed** — both are now literal, theme-independent colors (`#4B5563` dark grey; `bg-white border-black`) so they look the same in both themes, matching the spec's explicit color list.
- [~] In-progress yellow (`#FDE047`) is a fairly saturated yellow rather than a true pastel — borderline call, left as-is since it's still clearly lighter than a primary yellow and the spec's "light" instruction is closer to a vibe than an exact swatch.

## 10. Left sidebar — Stakeholders

File: `src/components/sidebar/StakeholderList.jsx`, `AddStakeholderModal.jsx`

- [x] Grouped by department (real `Department` entity — create/rename/delete, empty departments allowed, deleted departments fall back to "Unassigned")
- [x] Avatar shows uploaded image or initials fallback
- [x] ~~"Check boxes (tasks, notes, projects, products)... inside the check box will be the number... clicking any of those will highlight the relevant object" was NOT what was built.~~ **Fixed — this was the real root cause of "the whole dimming feature is broken."** There was one generic checkbox (highlighting everything about that stakeholder at once) plus four inert, unclickable count badges below it. Rebuilt from the ground up:
  - `HighlightContext` now stores `{stakeholderId, category}` pairs (`category` ∈ tasks/notes/projects/products) instead of a flat stakeholder-id list.
  - Each stakeholder row now has four real, independently-toggleable checkbox-style controls, each showing its own live count, each wired to its own category.
  - Task rows (`TaskTable`, `FocusFeed`) and quadrant-ring highlighting (`taskUtils.getQuadrantCounts`) react only to the `tasks` category.
  - Project Notes (`ProjectNotes.jsx` — previously had **zero** highlight treatment) now dim/highlight per the `notes` category.
  - Project/Product/Area card dimming reacts to `projects` + `products` together (so a container never sits dimmed while a matching child inside it is lit) — this also required fixing the underlying cascade math: `AreaCard`'s effective stakeholder set was only pulling from its direct products, missing nested projects and orphan (product-less) projects entirely; `ProductCard` only looked at its own `stakeholder_ids`, ignoring its child projects. Both now aggregate their full subtree.
- [x] "Add Stakeholder" button; requires Name + Department, image optional
- [x] Drag-and-drop: stakeholders onto a Project/Product/Task card (assign) or a department section (reassign)

## 11. AI Assistant (chat copilot)

File: `src/components/ai/ChatBox.jsx`, `ChatMessageList.jsx`, `ChatSessionList.jsx`, `base44/functions/aiChatStream/`

- [x] Floating icon bottom-right; layout matches spec exactly (chat icon top-left, collapse top-right, plus bottom-left, submit bottom-right)
- [x] Icon customization (presets + custom emoji), synced trigger + header icon
- [x] Plus → attachments; collapse retains typed text (component never unmounts)
- [x] Submit → authenticated `aiChatStream` backend function → full action catalog (Area/Product/Project/Task/Stakeholder/ProjectNote CRUD, move/archive/restore, weekly-focus/top-3, `SET_CUSTOM_FIELD`, generic passthrough)
- [x] Destructive actions gated behind inline confirm
- [x] LLM can answer questions about archived projects/tasks (fetched into context server-side) and chat about any other topic
- [x] Response bubble + understated scroll-nav rail; chat icon animates while responding
- [x] "<" caret opens a floating session-history card positioned left of the chat box
- [x] ~~Message history was fetched **in full** for the session on every open — only the render was windowed client-side via `.slice()`. This defeated the spec's actual stated purpose ("retrieved via lazy loading, so memory on the page is not overused") since the whole dataset was already resident regardless of what was visible.~~ **Fixed** — `useChatMessages` now fetches only the most recent 20 messages from the server on open. `loadMore()` issues one additional request per call, using a `created_date`-cursor filter (`$lt` the oldest currently-loaded message) rather than a skip offset, so pagination can't drift or open a gap if a new message arrives mid-session. New messages are appended directly to the cached page instead of triggering a skip=0 refetch, for the same reason.

## 12. Archive view

File: `src/components/archive/ArchiveView.jsx`, `base44/functions/archivedProjects/`

- [x] Lower-left "View Archive" button, date-range picker
- [x] ~~"Reveal all projects that were or are active in that date range... even those archived" was not actually implemented — the backend function only ever queried `is_archived: true` (never active projects) and filtered by `updated_date` ("last edited"), which has no real relationship to "was this project active during this window." A project archived last month but untouched since would show up regardless of the picked range; a project genuinely active during the target window but archived long after would be excluded or included based on unrelated later edits.~~ **Fixed** — added a real `archived_at` timestamp to `Project` (mirroring `Task`'s existing field, set/cleared by `archiveProject`/`restoreProject`), and rewrote the query as a lifetime-overlap check: a project's active window is `[created_date, archived_at ?? now]`; it's included if that window overlaps the picked range. This now genuinely answers "what was going on during this period" and can surface still-active projects, not just archived ones, matching "even those archived" (an addition to the active set, not the whole result). With no range picked, defaults to archived-only (the view's original browsing purpose). `ArchiveView.jsx` now shows an Active/Archived badge per row and only offers Restore on archived rows.
- [x] Quadrant counts computed server-side, no nested task arrays shipped; tasks fetched on demand only when a task table is actually opened
- [x] ~~`ArchivedTaskList` was read-only (description/status text + a Restore button) — contradicted "archived objects can be edited just like active objects."~~ **Fixed** — same inline-editable fields as the live task table (description, status, quadrant, stakeholders, attachments, notes) plus delete, still with Restore.
- [x] Restore button swaps in correctly whether reached from the archive row or from inside the opened detail modal

## 13. Cross-cutting

- [x] React Query cache invalidation wired on every mutation
- [x] Debounced inline-edit pattern used consistently
- [x] Archive cascade verified correct: `archiveProject` cascades to child tasks; `deleteArea`/`deleteProduct`/`deleteProject` all cascade to their full subtree; confirm-gated delete UI exists for every deletable entity (Area/Product/Project/Task/Stakeholder)
- [ ] No automated tests anywhere in the repo — still true, out of scope for this pass
- [ ] No visible error state for failed queries (only a loading state on the main dashboard) — still true, out of scope for this pass
- [ ] Dead code: `base44/functions/createTask/entry.ts` is never actually invoked — `useCreateTask` calls `base44.entities.Task.create()` directly. Not a functional bug (task creation works), just an unused file worth deleting in a cleanup pass.

---

## Everything fixed this pass, ranked by user-visible impact

1. Stakeholder highlight/dimming was the wrong architecture entirely (one flat checkbox instead of four per-category checkboxes) — root cause of "the whole dimming feature is broken."
2. Avatar colors didn't match outside the sidebar (2 hand-rolled call sites bypassing the shared `Avatar` component).
3. `AreaCard` had no expand icon — `AreaModal` was practically unreachable.
4. Archive view's date-range picker was close to decorative (wrong query entirely, not just a filter nuance).
5. Chat message history defeated its own stated lazy-loading purpose (full fetch, windowed render only).
6. Archived tasks couldn't be edited, only restored.
7. Task creation could bypass the required description field.
8. Project card's Risks/Questions block leaked unrelated note types.
9. Quadrant H/Q/HQ notation, "blue" New Task row, and Blocked/No-status bar colors were all visibly wrong relative to their literal spec description.
10. Quick-create forms for Task/Project were thinner than "fill in any details they have."

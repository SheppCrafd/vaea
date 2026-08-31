# Backlog

Captured 2026-08-30. Checked = done and verified against the code on `dev`.
`code:` lines record what the code actually does, where it diverges from the
request, and what still needs a live check.

**2026-08-31 pass** (on `dev`, `npm run lint` + 447 tests + prod build all green;
new UI Playwright-checked in bundled Chromium): shipped Full-Card layout (problem
statement off the face, quadrant box bottom-aligned, risk/question recolour +
compact hover, header hairline), mini-card risk/question tooltips + a hard
`overflow-hidden` square clamp (the Edge "rectangle/bigger" report — Edge itself
can't run here, so the clamp is defensive), the Create-New (+) buttons with parent
prefill, FocusFeed status dots + "Focus at a glance" bar, Add-links popover
close-on-scroll hardening (needs Edge re-verify), high-contrast empty task bar,
"Show on card" toggles for built-in project fields, full-card **masonry** layout,
the **Notepad** surface (table + tags + create-task + "Have Vaea process") with a
per-product consolidated notes view + "Summarize with Vaea", and the full removal
of Vaea Meetings. Still open: FocusFeed task-editing + pencil (held by you), the
Granola integration (deferred), the marketing-site Meetings copy (separate
pipeline), and a few "revisit later" polish sub-items.

> Some points reference screenshots from the original message ("see the image I
> sent you for a sample", the two "look like this:" mockups, the Edge-vs-Chrome
> mini-card comparison). Those images aren't captured here.

---

## Full Cards

- [x] Editing titles from the card: new text goes in backward — should edit normally
  - code: `useEditableField` keeps the contentEditable as the source of truth while
    focused (no per-keystroke `setState`), which is the documented fix for the
    caret-snaps-to-0 / reversed-text bug. Re-verify live since it's still listed.
- [x] Move Problem Statement to the expanded view
  - code: done — removed from `ProjectCardFull`'s header; still fully editable in
    `ProjectDetailModal`.
- [x] Drop the 4-quadrant box so its bottom lines up with the bottom of Open Questions
  - code: done — `items-stretch` row + Open Questions `flex-1` give the quadrant grid,
    Open Questions, and the meta column one shared bottom edge.
  - [x] Regression: the top of the 4-quadrant box is now also pinned to the top of
    Risks, making it a rectangle whenever there are open questions or risks. Should be
    bottom-aligned only.
    - code: done — the row is `items-end` now (was `items-stretch`) and the quadrant
      `<button>` is `w-16 h-16` (was `w-16 min-h-16`), so it keeps its 64px square
      size and only its bottom edge aligns with Open Questions / the meta column.
  - [x] Remove the "Add a risk and press Enter" / "Add a question and press Enter"
    prompts. Un-populated field looks as it does now; populated field looks like the
    mockup (compact), then full message + date/time on hover.
    - code: done — placeholders are now `"Add a risk…"` / `"Add a question…"`. On the
      card face (`compact` prop on `ProjectNotes`) the note reads as a tight line and
      its timestamp + stakeholder row is hidden until hover; full note text on hover
      already rode on `EditableText`'s native `title`. Mockup wasn't captured — if the
      compact form isn't tight enough, revisit against the image.
  - [x] Recolor: orange for risks, blue for open questions
    - code: done — risks tint `rgba(249,115,22,…)` (orange), open questions
      `rgba(59,130,246,…)` (blue); mini-stats icons follow (risk `#FDBA74`, question
      `#93C5FD`).
- [x] Drop Unassigned, Date, Estimated/Committed, and Stakeholders so the bottom of
  Stakeholders lines up with the bottom of Open Questions
  - code: done — right meta column is `flex flex-col items-end justify-end`; its
    comment confirms it `justify-end`s onto the shared row baseline.
- [x] Make Title and Objective take up almost all the horizontal space at the top of
  the card (leaving room for the corner icons)
  - code: done — header is `pl-7 pr-14`, only the grip / expand-delete footprints
    reserved.
  - [x] Optional: rule under the title + description so it reads as a card header
    - code: done — full-bleed `border-b border-border/60 -mx-3` hairline under the
      title + objective block in `ProjectCardFull`.

## Small cards

- [x] Greyed-out risk icon and open-questions icon when there's none; colored when
  there is
  - code: done — `ProjectMiniStats` always renders both icons; grey
    `text-muted-foreground/35` when empty, `#FCA5A5` (risk) / `#FDBA74` (question)
    when populated.
- [x] Bring the title higher (between expand and move)
  - code: done — `ProjectCardShell` header row is grip · title · expand/delete.
- [x] Small cards changed from squares to rectangles — should be squares
  - code: `ProjectCardShell` now `overflow-hidden` + `shrink-0` header + `min-h-0`
    middle, so the 112px `aspect-square` tile clips any overflow instead of growing
    into a rectangle. Verified 112×112 across the board in bundled Chromium (Playwright).
- [x] Mini cards render bigger in Edge than in Chrome — match the Chrome sizing
  - code: same fix — `aspect-square` alone is only a *preferred* size, so an engine
    whose font metrics run larger than Chromium's could out-measure 112px and grow the
    tile. `overflow-hidden` makes the 112px hard. **Edge can't be launched in this
    environment, so the original Edge repro is unconfirmed — the clamp is defensive.**

## All cards

- [x] On hover, show full text of risks, open questions, title, objective, and the
  link's HTML — on **full** cards
  - code: done on full cards — risks/questions/objective use `EditableText`, which sets
    `title={text}` (plain text, never markup); the title uses `EditableTitle`'s
    `tooltip`; links set `title` to `label — url`.
  - [x] Not happening for risks and open questions on **mini** cards
    - code: done — the joined note text now rides on a wrapping `<span title>` around
      each icon in `ProjectMiniStats`, not an SVG `<title>` child (which doesn't
      reliably surface as a tooltip).
- [x] Remove the "Assign Stakeholders" plus sign on the Product cards
  - code: done — `ProductCard` renders no `StakeholderAssigner`, by explicit design
    comment; assignment stays via drag or the detail modal.
- [x] Move icon repositions the card (shift left/right, up/down), not just move
  between parent objects
  - [ ] Polish how the repositioning interaction looks — revisit later.
- [x] In the title, break lines at word boundaries — after a space, colon, slash,
  hyphen, comma, period, em-dash, or underscore
  - code: done — `titleWithBreakHints` inserts a zero-width space after `: / - , . — _`
    (stripped before save); spaces break natively.
- [x] When there are no tasks, still show a bar at the bottom of the card
  - code: done — `TaskStatistics` and `ProjectMiniStats` both render an empty track
    when the task total is 0.
  - [x] Border treatment: switched to the requested high-contrast look.
    - code: done — empty track is now `bg-background border border-foreground` in
      both `TaskStatistics` and `ProjectMiniStats`: near-white fill / near-black
      outline in light, and the inverse in dark.
- [x] Product cards don't use all available space — e.g. Team Management and
  Measurements/Insight could tuck under the cards above.
  - code: done — full-card layout is CSS multi-column masonry now (see
    `ProjectsGrid` full branch + `AreaCard`'s products container): short Product /
    Project cards let the next card pack straight up underneath in their column
    instead of leaving dead space to the end of the row. `column-width` still
    adds/removes columns responsively. Reading order becomes column-major. Mini mode
    unchanged. Verified in Chromium: 2 product columns, each packing independently.

## Create New

- [x] Add a plus button to the right of the move button on each card that opens the
  Create New modal for the object beneath it, with the relevant parent objects
  pre-populated in the dropdowns (e.g. plus on a Product card → Create New with
  Project selected and the Area/Product filled in).
  - code: done — (+) beside the grip on Area / Product / Project cards (mini + full).
    `store.openCreateModal(type, prefill)` → `CreateModal` passes `prefill` to
    `TaskForm`/`ProjectForm`/`ProductForm`, which seed their parent `<Select>`s from
    it. Area (+) → Product form (area filled); Product (+) → Project form (area +
    product filled); Project (+) → Task form (project filled). Switching the type
    tab by hand clears the prefill.

## Expanded view

- [x] On every field that isn't on the card by default, offer an "add it to the card"
  option.
  - code: done for the built-ins that live off the card face — `ProjectDetailModal`
    now has a "Show on card" checkbox next to Problem Statement, Impact & Outcome
    Metrics, and Related Products. Writes `project.display_on_card_builtins`; the new
    `CardBuiltinFields` component on `ProjectCardFull` renders whichever are on
    (problem statement as an inline editor, metrics as label:value pairs, related
    products as chips). Mirrors the existing custom-field "Show on card" pattern.
    (Owner / dates / stakeholders are already on the full card, so no toggle needed.)

## Tasks

- [x] Remove Type
  - code: no task "Type" field or column exists anywhere — not in `TaskForm`, not in
    `TaskTable` (columns: Description, Status, Quadrant, Stakeholders, Files, Notes,
    Weekly, Top 3, Actions), no `task_type`/`taskType` in the codebase. Appears already
    gone; confirm there's no Type control in the detail modal.
- [x] Adding a task from the 4-quadrant box exposes H/Q, Top 3, and files
  - code: done — clicking the quadrant box opens `TaskTableModal` → `TaskTable`, whose
    new-task row has: description, status, quadrant, **H** and **Q** `FlagToggleButton`s,
    stakeholders, **files** (`TaskAttachments`), notes, weekly `Checkbox`, and **Top 3**
    star (`createNewTask` applies all of them, with the 3-per-project cap enforced).
- [x] Clicking the 4-quadrant box: the modal takes up more horizontal screen space
  - code: done — `TaskTableModal` panel is `max-w-[min(1400px,94vw)]` (was `max-w-4xl`),
    "the task table has nine dense columns and earns the horizontal room."
- Right panel (`FocusFeed`):
  - [x] If a task is in Today's Top 3, it doesn't also appear in Weekly Focus
    - code: done — `weeklyFocus = tasks.filter(t => t.is_weekly_focus && !t.is_today_top_three)`.
  - [ ] Allow editing tasks from this panel — discuss approach
    - code: not done — each row has only a status `<Select>` plus move / archive /
      delete buttons; no description or field editing.
  - [x] Allow moving a task from Weekly Focus to Top 3
    - code: done — up-arrow → `moveToTopThree` via the cap-aware `toggleTopThree`.
  - [x] Bar graph should show all tasks, not broken down by project — graph all Weekly
    Focus + Top 3 together
    - code: done — new "Focus at a glance" `TaskStatistics` bar at the top of
      `FocusFeed`, fed `[...topThree, ...weeklyFocus]` (one pooled set, no per-project
      split). The Weekly Focus list below stays grouped by project as before.
  - [x] Replace the status dropdown with a colored status dot on the left of the task
    card (click the dot to change status). More room for the description.
    - code: done — `<StatusDropdown variant="dot">` on the left of each `FocusFeed`
      row: a `STATUS_COLORS`-tinted dot that opens the existing portal status picker
      (its rows now show swatches too). The `<Select>` is gone.
  - [ ] Replace the three action buttons with one edit (pencil) button that exposes
    the task in a taller table-view-style layout so all notes are readable.
    - code: not done — still three buttons (move / archive / delete), no pencil.

## Add links

- [x] Pasting a URL closes the popover — it shouldn't
  - code: hardened — `usePositionedMenu`'s `closeOnScroll` handler already ignored
    scrolls whose target is inside `[data-popover-panel]`; it now ALSO bails whenever
    `document.activeElement` is inside the panel, covering the case where a single-line
    input scrolling its caret dispatches the scroll with `e.target === document`
    (uncatchable by `.closest()`). **Still needs a live Edge re-verify.**
- [x] Can't navigate within the URL textbox in the popover (try it)
  - code: same root cause / same fix as above — arrow-key caret movement scrolls the
    input the same way a paste does. Neither key handler traps arrows. **Live re-verify
    in Edge.**

## Add via CSV

- [x] When exporting a template, populate all current objects
  - code: done — `buildWorkspaceRows` emits one row per current entity; the "template"
    download is a full workspace export.

## Filter

- [x] Add a Select / Unselect all option (like Excel)
  - code: done — `FilterModal` has a top-level toggle that reads "Select all" /
    "Unselect all" by state.
- [x] Un-checking an object un-checks its child objects; re-checking a child shows a
  grey minus (indeterminate) on the parent
  - code: done — `FilterModal` cascades unchecks through the subtree, shows a tri-state
    `Minus` on partially-included ancestors, and clicking an indeterminate box checks
    the whole subtree (Excel behavior), re-including ancestors.

## Import CSV

- [x] On export, always produce a CSV representing all current active objects
  (not archived or deleted)
  - code: done — same `buildWorkspaceRows` path; the comment states callers pass active
    entities only and the entity hooks already exclude soft-deleted/archived records.

## Backdoor

- [x] Discover new prompt(s); move to "old" once action has been successfully taken
  - code: done in the `local-relay` skill — step 1 lists `prompts/`, treats any file
    with no match in `responses/` as unanswered, picks the oldest; completed pairs are
    filed into `processed/` (by Vaea, after it reads the answer). Confirm this matches
    what you meant by "Backdoor" here (the term was renamed to "Local Mode").
- [x] Ship the "examine the folder contents" action as a prebuilt skill
  - code: done — `local/.claude/skills/local-relay/SKILL.md` (and short alias
    `l/SKILL.md`); steps 1–3 have the agent enumerate `prompts/` and read
    `VAEA_SYSTEM_PROMPT.md` / `VAEA_TOOL_CATALOG.json` / `workspace-data.json`.
    Generated from `bridgeWatcherKit.js` (`buildLocalRelaySkill*`).

## Meetings

- [x] Drop "Vaea Meetings" as a feature of Vaea entirely.
  - code: done — `src/pages/MeetingsPage.jsx` deleted; the nav tab (`tabs.js`), the
    route (now a redirect to `/app` in `AuthenticatedApp.jsx`), and the `"meetings"`
    value in the `OPEN_APP_SECTION` tab enum (`toolCatalog.js` + `entry.ts`) are all
    gone. Calendar + the Microsoft Graph connection are untouched — Teams *join
    links* on calendar events are a calendar feature, not the Meetings surface, and
    stay. `entry.ts` edited but NOT redeployed — needs a base44 deploy eventually.
  - [ ] Marketing site still advertises Meetings ("the surface is here, the
    connector isn't yet" — `src/marketing/pages/Workplace.jsx`, `Product.jsx`,
    `seo.js`, `public/llms.txt`). Separate pipeline; needs a copy pass.
- [ ] Add a Granola integration (replaces the removed Meetings surface).
  - One-click connect + sign in via a real Granola API/OAuth; after that the user
    never touches setup again. They pick a meeting from Granola and can work on it
    in Vaea (notes → tasks/decisions/questions, link to the right project, "Have
    Vaea process").
  - NOT started this session — deferred by explicit request. Needs: whether Granola
    exposes a usable API/OAuth for third-party note access, and where the meeting
    picker lives (its own tab, or inside Calendar).

## Notes

- [x] Add a colorful notepad button above View Archive
  - code: done — accent-gradient "Notepad" FAB at `bottom-[5.25rem] left-6` in
    `AppShell.jsx`, just above View Archive. Opens `NotepadModal`.
  - [x] Notes added in cells in a table, with metadata: Stakeholders, product(s),
    project(s), dates, due dates, "create a task"
    - code: done — new `notes` collection in `localDb` + `useNotes` hook (standalone,
      separate from per-project `ProjectNote`). `NotepadModal` is a table with
      inline-editable cells: content (`EditableText` multiline), Stakeholders /
      Products / Projects (`MultiSelectPopover` cells), Date, Due date (`DateField`).
      Per-row "create a task" opens the Create modal with the note text as the
      description and the first tagged project pre-selected (`TaskForm` prefill
      extended with `description`).
  - [x] "Have Vaea Process" button — wraps the note in a prompt and sends it to the
    model
    - code: done — per-row sparkles button navigates to `/app/chat` with an
      `initialMessage` that wraps the note text in an extract-tasks/decisions/
      questions/follow-ups prompt (same handoff pattern as ProjectDetailModal's
      "Brief me").
- [x] Give each product a consolidated notes view plus an AI summary
  - code: done — `ProductNotesSection` in `ProductDetailModal`: every notepad note
    tagged to the product or one of its projects, plus every `ProjectNote` under it,
    in one list. "Summarize with Vaea" hands the whole set to chat asking for a
    grouped summary + risks / open questions / action items.

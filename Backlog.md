# Backlog

Captured 2026-08-30. Checked = done and verified against the code on `dev`.
`code:` lines record what the code actually does, where it diverges from the
request, and what still needs a live check.

> Some points reference screenshots from the original message ("see the image I
> sent you for a sample", the two "look like this:" mockups, the Edge-vs-Chrome
> mini-card comparison). Those images aren't captured here.

---

## Full Cards

- [x] Editing titles from the card: new text goes in backward — should edit normally
  - code: `useEditableField` keeps the contentEditable as the source of truth while
    focused (no per-keystroke `setState`), which is the documented fix for the
    caret-snaps-to-0 / reversed-text bug. Re-verify live since it's still listed.
- [ ] Move Problem Statement to the expanded view
  - code: not done — still rendered in `ProjectCardFull`'s header (lines ~299–305);
    `ProjectDetailModal` also shows it, so this is a "remove from the card face" job.
- [x] Drop the 4-quadrant box so its bottom lines up with the bottom of Open Questions
  - code: done — `items-stretch` row + Open Questions `flex-1` give the quadrant grid,
    Open Questions, and the meta column one shared bottom edge.
  - [ ] Regression: the top of the 4-quadrant box is now also pinned to the top of
    Risks, making it a rectangle whenever there are open questions or risks. Should be
    bottom-aligned only.
    - code: confirmed — the quadrant `<button>` (`w-16 min-h-16`) stretches to full row
      height inside the `items-stretch` flex row.
  - [ ] Remove the "Add a risk and press Enter" / "Add a question and press Enter"
    prompts. Un-populated field looks as it does now; populated field looks like the
    mockup (compact), then full message + date/time on hover.
    - code: not done — `NoteBox` placeholders are still `"Add a risk and press
      Enter..."` / `"Add a question and press Enter..."`; no date/time-on-hover.
  - [ ] Recolor: orange for risks, blue for open questions
    - code: not done — risks tint red (`rgba(239,68,68,…)`), open questions tint
      `STATUS_COLORS.PENDING_FEEDBACK` (orange).
- [x] Drop Unassigned, Date, Estimated/Committed, and Stakeholders so the bottom of
  Stakeholders lines up with the bottom of Open Questions
  - code: done — right meta column is `flex flex-col items-end justify-end`; its
    comment confirms it `justify-end`s onto the shared row baseline.
- [x] Make Title and Objective take up almost all the horizontal space at the top of
  the card (leaving room for the corner icons)
  - code: done — header is `pl-7 pr-14`, only the grip / expand-delete footprints
    reserved.
  - [ ] Optional: rule under the title + description so it reads as a card header —
    not added; design call left open (how far to push the Payflow nested-cards look).

## Small cards

- [x] Greyed-out risk icon and open-questions icon when there's none; colored when
  there is
  - code: done — `ProjectMiniStats` always renders both icons; grey
    `text-muted-foreground/35` when empty, `#FCA5A5` (risk) / `#FDBA74` (question)
    when populated.
- [x] Bring the title higher (between expand and move)
  - code: done — `ProjectCardShell` header row is grip · title · expand/delete.
- [ ] Small cards changed from squares to rectangles — should be squares
  - code: `ProjectsGrid` mini branch is `repeat(auto-fill, 112px)` fixed tracks and
    `ProjectCardShell` sets `aspect-square` — the code produces 112×112 squares. If it
    renders as a rectangle it's a live layout issue (content overflowing the square,
    or `aspect-square` losing to a flex child). Needs a look in dev.
- [ ] Mini cards render bigger in Edge than in Chrome — match the Chrome sizing
  - code: nothing browser-specific in the mini-card CSS; needs a live Edge-vs-Chrome
    comparison. Likely a default zoom / font-metrics difference, not a code bug.

## All cards

- [x] On hover, show full text of risks, open questions, title, objective, and the
  link's HTML — on **full** cards
  - code: done on full cards — risks/questions/objective use `EditableText`, which sets
    `title={text}` (plain text, never markup); the title uses `EditableTitle`'s
    `tooltip`; links set `title` to `label — url`.
  - [ ] Not happening for risks and open questions on **mini** cards
    - code: `ProjectMiniStats` adds `<AlertTriangle><title>…</title></AlertTriangle>`
      / `<HelpCircle><title>…</title></HelpCircle>` (joined note contents). Reported as
      not firing — verify whether the SVG `<title>` actually surfaces on hover; if not,
      switch to a wrapping element with a real `title`/tooltip.
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
  - [ ] Border treatment differs from the request: code uses a faint hairline
    (`bg-foreground/[0.04]` + `border-foreground/[0.08]`), not white-with-black-border /
    black-with-white-border. Deliberate dev call ("a hard outline reads as a broken
    element") — confirm it's acceptable or switch to the requested look.
- [ ] Product cards don't use all available space — e.g. Team Management and
  Measurements/Insight could tuck under the cards above. Not sure it's wanted; review
  in dev before prod. A space-packing algorithm could maximize use, including when to
  break into more than one column.
  - code: not done — `ProjectsGrid` full branch is a plain
    `grid-template-columns: repeat(auto-fill, minmax(420px, 1fr))`; no masonry / packing.

## Create New

- [ ] Add a plus button to the right of the move button on each card that opens the
  Create New modal for the object beneath it, with the relevant parent objects
  pre-populated in the dropdowns (e.g. plus on a Product card → Create New with
  Project selected and the Area/Product filled in).
  - code: not done — `CreateModal` renders `TaskForm`/`ProjectForm`/… with only
    `onDone`; the forms take no parent-prefill prop, and no card renders an add-child
    button. Only the global "Create new" entry point exists.

## Expanded view

- [ ] On every field that isn't on the card by default, offer an "add it to the card"
  option.
  - code: partial — `CustomFieldsSection` has a per-field "Show on card" checkbox
    (writes `display_on_card_fields`, echoed by `CardCustomFields`) for **custom**
    fields only. Built-in fields (problem statement, owner, dates, stakeholders, …) in
    `ProjectDetailModal` have no such toggle.

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
  - [ ] Bar graph should show all tasks, not broken down by project — graph all Weekly
    Focus + Top 3 together
    - code: not done — `FocusFeed` groups Weekly Focus into per-project sub-lists
      (`groupedWeekly`), and there is no bar graph in this panel at all. (There is a
      separate `StatisticsChart` in the sidebar — not wired to focus/top-3.)
  - [ ] Replace the status dropdown with a colored status dot on the left of the task
    card (click the dot to change status). More room for the description.
    - code: not done — still a `<Select>`.
  - [ ] Replace the three action buttons with one edit (pencil) button that exposes
    the task in a taller table-view-style layout so all notes are readable.
    - code: not done — still three buttons (move / archive / delete), no pencil.

## Add links

- [ ] Pasting a URL closes the popover — it shouldn't
  - code: a fix is present — `usePositionedMenu`'s `closeOnScroll` handler ignores
    scroll events whose target is inside `[data-popover-panel]`, with a comment naming
    this exact symptom ("what made the Add Link popover vanish on paste"). Still on the
    list, so re-verify: a single-line `<input>` scrolling its caret may not emit a
    `scroll` event at all, meaning the real close trigger could be elsewhere (overlay
    click / focus handling).
- [ ] Can't navigate within the URL textbox in the popover (try it)
  - code: same fix / same caveat as above (the comment also names "arrow-key caret
    movement"). `PositionedPopover`'s key handler only traps Tab, so arrows aren't
    intercepted there — re-verify live.

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

- [ ] Add a colorful notepad button above View Archive
  - code: not done — "View Archive" is a lone fixed FAB in `AppShell.jsx` (bottom-left);
    nothing else is docked there.
  - [ ] Notes added in cells in a table, with metadata: Stakeholders, product(s),
    project(s), dates, due dates, "create a task"
  - [ ] "Have Vaea Process" button — wraps the note in a prompt and sends it to the
    model
- [ ] Give each product a consolidated notes view plus an AI summary
  - code: not done — `ProjectNotes` / `AddNoteForm` are per-project only; no
    product-level rollup or AI summary.

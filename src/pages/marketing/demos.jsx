import { useEffect, useMemo, useRef } from "react";
import {
  Search, Package, FolderKanban, Boxes, BookOpen, GitBranch,
  Check, Plus, MessageCircle, Settings,
} from "lucide-react";
import ChatMessageList from "@/components/ai/ChatMessageList";
import ChatIcon from "@/components/ai/ChatIcon";
import { CHAT_ICON_OPTIONS } from "@/lib/chatIcon";
import CommandPaletteResults from "@/components/command/CommandPaletteResults";
import ProjectMiniStats from "@/components/projects/ProjectMiniStats";
import IdentityField, { FIELDS as IDENTITY_FIELDS } from "@/components/settings/IdentityField";
import { Typed, Caret, useTypedText } from "./effects";
import { glassPanel, glassSheen } from "./theme";

// ---------------------------------------------------------------------------
// Animated product films.
//
// Every string these render is the real thing the app produces, not a
// plausible-looking approximation:
//   · "plan · 3 steps across 3 projects" is describePlan()'s actual output
//     shape (chatActions.js) — N steps, then a tally of the entity types the
//     plan touches.
//   · 'archive_project("Q1 Newsletter")' is describeToolCall()'s actual
//     shape — the action name lowercased, the affected entity's real title.
//     Note there is no "→ Growth" arrow in it; the real format is only
//     fn("label"), which an earlier version of these mockups got wrong.
//   · Task dot colors are STATUS_COLORS from taskUtils.js, and the three
//     buckets under them are MINI_STATUS_BUCKETS with their real labels.
//   · The palette's chrome, hint row, and per-type icons are
//     CommandPalette.jsx's.
//   · The identity fields are AiPreferencesSection.jsx's real Name/Identity/
//     Soul labels.
//
// Each film is a pure function of a `step` number handed down from one
// useTimeline clock (see effects.jsx), so nothing can drift out of sync, and
// the final phase of every film is the complete picture — which is what
// reduced-motion users are shown, as a still.
// ---------------------------------------------------------------------------

// A panel whose height is pinned so lines appearing one by one never resize
// the page around it — the difference between a film playing and the layout
// visibly juddering.
function GlassFrame({ children, minHeight, className = "" }) {
  return (
    <div className={`relative w-full rounded-2xl overflow-hidden ${glassPanel} ${className}`}>
      <div className={glassSheen} />
      <div className="relative" style={{ minHeight }}>{children}</div>
    </div>
  );
}

// --- 1. Vaea Chat -----------------------------------------------------------
// The hero film: a whole real session, from the sentence you'd actually type
// to the plain-English summary of what changed.

export const CHAT_PHASES = [2300, 1000, 750, 700, 700, 700, 3000, 2000];

const CHAT_ASK = "Marketing's a mess and I don't have time to sort it, can you clean it up";
const CHAT_REPLY =
  "Archived “Q1 Newsletter” and “Old Brand Deck” — nobody had touched either in over a month. Moved “Landing Page Copy” under Growth. Marketing's down to four active projects.";

// Which caption is lit at each phase — the section's caption list and this
// film share one clock, so the words always describe the frame on screen.
export const CHAT_CAPTIONS = [
  { title: "Say what's wrong, in plain English", body: "No syntax, no forms, no picking the right menu first. Just the sentence you'd say out loud.", from: 0, to: 1 },
  { title: "It works out the actual steps", body: "It reads what you've got, decides what needs to happen, and shows you the plan before touching anything.", from: 2, to: 5 },
  { title: "Then it does them", body: "Real changes to your real workspace — and a plain summary of what moved, so you can see it worked.", from: 6, to: 8 },
];

// Real describeToolCall()/describePlan() output shapes (chatActions.js) —
// see this file's own header comment.
const TOOL_LOG_LINES = [
  "plan · 3 steps across 3 projects",
  'tool call · archive_project("Q1 Newsletter")',
  'tool call · move_project("Landing Page Copy")',
  'tool call · archive_project("Old Brand Deck")',
];
// Exact shape splitToolLogPrefix (ChatMessageList.jsx) expects: a fenced
// ```tool-log block, a blank line, then the reply — the real persisted-
// message format useChatController.js's buildLoggedContent produces.
const CHAT_MESSAGE_CONTENT = "```tool-log\n" + TOOL_LOG_LINES.join("\n") + "\n```\n\n" + CHAT_REPLY;
const DEMO_ICON_CHOICE = { key: CHAT_ICON_OPTIONS[0].key };

export function ChatFilm({ step }) {
  // Steps 0: composer only (nothing to hand ChatMessageList yet — there's
  // no real "message" until it's actually sent, same as the real composer).
  // Steps 1-5: one user message, isComputing true, liveSteps growing —
  // literally ChatMessageList's own live-generation UI, driven by this
  // timeline instead of a real stream.
  // Steps 6-8: the persisted assistant message lands with isNew so
  // ChatMessageList's own real typewriter (useTypewriter) reveals the reply
  // — not a second, fake typing effect standing in for it.
  const sent = step >= 1;
  const computing = step >= 1 && step < 6;
  const messages = sent
    ? [
        { id: "u1", role: "user", content: CHAT_ASK },
        ...(step >= 6 ? [{ id: "a1", role: "assistant", content: CHAT_MESSAGE_CONTENT, tool_log_detail: null }] : []),
      ]
    : [];
  const liveSteps = TOOL_LOG_LINES.slice(0, Math.max(0, step - 1));

  return (
    <GlassFrame minHeight="19rem">
      {/* Matches ChatBox.jsx's real header chrome exactly (bg-primary bar,
          ChatIcon + name) — not the macOS-traffic-light chrome this film
          used to invent, which exists nowhere in the real app. */}
      <div className="flex items-center gap-2 px-4 py-3 bg-primary text-primary-foreground">
        <ChatIcon iconChoice={DEMO_ICON_CHOICE} className="w-5 h-5" />
        <span className="font-terminal font-semibold text-sm">Vaea Chat</span>
      </div>

      <div className="h-64 flex flex-col text-left">
        {!sent ? (
          <div className="p-5 font-terminal text-[13px] leading-relaxed text-foreground/90 flex-1">
            <span className="text-[#46BAD1]">{">"}</span>{" "}
            <Typed text={CHAT_ASK} play={step === 0} complete={step > 0} cps={48} />
            <Caret />
          </div>
        ) : (
          <ChatMessageList
            messages={messages}
            isComputing={computing}
            liveSteps={liveSteps}
            streamingText=""
            iconChoice={DEMO_ICON_CHOICE}
            hasMore={false}
            onLoadMore={() => {}}
            resolvingId={null}
            onConfirm={() => {}}
            onCancel={() => {}}
            newMessageIds={step === 6 ? new Set(["a1"]) : new Set()}
          />
        )}
      </div>
    </GlassFrame>
  );
}

// --- 2. Command palette -----------------------------------------------------
// "Just start typing." Renders CommandPalette.jsx's real chrome: the search
// row with its Esc chip, quick actions when the query is empty, filtered
// results once it isn't, and the ↑↓ / ↵ / ctrl+↵ hint row — with the hint
// that's currently "in use" lighting up as the film drives the selection
// down the list.

export const PALETTE_PHASES = [1100, 1300, 900, 750, 750, 1600];

// Same shape CommandPaletteResults expects: quick-action rows (run: fn, no
// url) before a query, real-entity-shaped rows (type/id/title/subtitle)
// once one's typed — group labels drive CommandPaletteResults' own header
// rows exactly like the real palette's Pages/Dashboard groups do.
const PALETTE_QUICK = [
  { key: "q1", label: "Create Task", Icon: Plus, run: () => {} },
  { key: "q2", label: "Create Project", Icon: Plus, run: () => {} },
  { key: "q3", label: "Open full-page chat", Icon: MessageCircle, run: () => {} },
  { key: "q4", label: "Open Settings", Icon: Settings, run: () => {} },
];

const PALETTE_RESULTS = [
  { type: "product", id: "p1", title: "Growth", subtitle: "Product" },
  { type: "project", id: "p2", title: "Landing Page Copy", subtitle: "in Growth" },
  { type: "task", id: "p3", title: "Write header copy", subtitle: "Landing Page Copy" },
];

function demoGroupLabel(result) {
  if (!result) return null;
  return result.run ? "Quick actions" : "Dashboard";
}

export function PaletteFilm({ step }) {
  const showResults = step >= 2;
  const selected = step <= 2 ? 0 : step === 3 ? 1 : 2;
  const results = showResults ? PALETTE_RESULTS : PALETTE_QUICK;

  return (
    <div className="w-full rounded-xl border border-border bg-card text-foreground shadow-[0_25px_50px_-12px_rgb(0_0_0/0.25)] dark:shadow-[0_0_1px_0_hsl(var(--foreground)/0.15),0_0_50px_-8px_hsl(var(--foreground)/0.14)] overflow-hidden text-left">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border">
        <Search className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="flex-1 text-sm">
          {step === 0 ? (
            <span className="text-muted-foreground">Search areas, products, projects, tasks…</span>
          ) : (
            <Typed text="growth" play={step === 1} complete={step > 1} cps={9} />
          )}
          {step <= 1 && <Caret className="bg-primary/70" />}
        </span>
        <kbd className="shrink-0 text-[10px] font-mono text-muted-foreground border border-border rounded px-1.5 py-0.5">Esc</kbd>
      </div>

      {/* 4 quick-action rows (+ group header) render taller than 3 results
          rows (+ group header) — reserved at the larger of the two so the
          step-2 transition between them never shrinks the card. */}
      <div style={{ minHeight: "11.5rem" }}>
        <CommandPaletteResults
          results={results}
          activeIndex={selected}
          query={step === 1 ? "growth" : ""}
          groupLabel={demoGroupLabel}
          onSelect={() => {}}
          onHover={() => {}}
          activeHasUrl={showResults}
        />
      </div>
    </div>
  );
}

// --- 3. The nesting -------------------------------------------------------
// Area → Product → Project, each level built out in order so the
// containment is something you watch happen rather than have to infer. Area
// and Product shells are hand-matched to AreaCard.jsx/ProductCard.jsx's own
// elevation treatment (those components are wired to @dnd-kit's live drag
// context and real mutation hooks — not safe to force into a static
// marketing page). The Project tile's own stats — quadrant grid, risk/
// question flags, status bar — render through the real ProjectMiniStats.jsx
// component, the exact same one every real Dashboard tile uses; a real
// Dashboard tile never shows individual task names on the tile itself (see
// ProjectCard.jsx's own comment — that's one click away in the detail
// modal), so this film doesn't either, matching the real tile exactly
// instead of a plausible-looking invention.

export const NEST_PHASES = [650, 650, 650, 750, 950, 950, 1800];

// STATUS_COLORS, taskUtils.js.
const DONE = "#86E7B0";
const IN_PROGRESS = "#FEF08A";
const NOT_STARTED = "var(--status-not-started)";

// One fixed quadrant split (this film is telling a status-progression
// story, not an urgency/importance one) — real shape ProjectMiniStats
// expects, same 4 quadrants getQuadrantCounts() always returns.
const NEST_QUADRANTS = [
  { quadrant: "urgent-important", count: 2, hasFocus: false, hasHighlightedStakeholder: false },
  { quadrant: "not-urgent-important", count: 1, hasFocus: false, hasHighlightedStakeholder: false },
  { quadrant: "urgent-not-important", count: 0, hasFocus: false, hasHighlightedStakeholder: false },
  { quadrant: "not-urgent-not-important", count: 0, hasFocus: false, hasHighlightedStakeholder: false },
];

export function NestFilm({ step }) {
  // Task 1 completes at phase 4; task 2 starts moving at phase 5 — same
  // status timeline the old version told, now expressed the way a real
  // Dashboard tile actually shows it (the bottom status bar), not a task
  // checklist no real tile has.
  const statuses = [
    step >= 4 ? "DONE" : "NOT_STARTED",
    step >= 5 ? "IN_PROGRESS" : "NOT_STARTED",
    "NOT_STARTED",
  ];
  const counts = {
    NOT_STARTED: statuses.filter((s) => s === "NOT_STARTED").length,
    IN_PROGRESS: statuses.filter((s) => s === "IN_PROGRESS").length,
    DONE: statuses.filter((s) => s === "DONE").length,
  };
  // MINI_STATUS_BUCKETS, taskUtils.js — real keys/labels/order/colors.
  const miniStats = [
    { key: "NOT_STARTED", label: "Not Started", color: NOT_STARTED, count: counts.NOT_STARTED },
    { key: "IN_PROGRESS", label: "In Prog", color: IN_PROGRESS, count: counts.IN_PROGRESS },
    { key: "DONE", label: "Done", color: DONE, count: counts.DONE },
  ];
  const miniTotal = 3;

  const grow = (show) =>
    `transition-all duration-500 ease-out ${show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`;

  return (
    <div className="w-full rounded-xl bg-card text-foreground border border-border shadow-[0_4px_6px_-1px_rgb(0_0_0/0.1),0_2px_4px_-2px_rgb(0_0_0/0.1)] dark:shadow-[0_0_0_1px_hsl(var(--foreground)/0.06),0_0_16px_-4px_hsl(var(--foreground)/0.10)] p-5 text-left" style={{ minHeight: "18rem" }}>
      <div className={grow(step >= 0)}>
        <p className="text-sm font-semibold flex items-center gap-2">
          <Boxes className="w-4 h-4 text-muted-foreground" />
          Growth
        </p>
      </div>

      <div className={`mt-3 rounded-xl bg-muted/40 border border-border/70 p-4 ${grow(step >= 1)}`}>
        <p className="text-sm font-medium flex items-center gap-2">
          <Package className="w-3.5 h-3.5 text-muted-foreground" />
          Website Relaunch
        </p>

        <div className={`mt-3 rounded-lg bg-card border border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)] dark:shadow-[0_0_0_1px_hsl(var(--foreground)/0.06),0_0_8px_-2px_hsl(var(--foreground)/0.10)] p-3 w-[7.5rem] ${grow(step >= 2)}`}>
          <p className="text-sm font-medium flex items-center gap-2 mb-2">
            <FolderKanban className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="truncate">Landing Page Copy</span>
          </p>
          <div className={`flex flex-col items-center ${grow(step >= 3)}`}>
            <ProjectMiniStats quadrants={NEST_QUADRANTS} miniStats={miniStats} miniTotal={miniTotal} onOpenTable={() => {}} />
          </div>
        </div>
      </div>
    </div>
  );
}

// --- 4. Vaea Brain ----------------------------------------------------------
// A note being written into your own Obsidian vault, then committed. The
// commit strip is the one visual that makes "backed up to your own GitHub,
// not stored by us" land at a glance instead of asking you to trust the copy.

export const VAULT_PHASES = [700, 1800, 2200, 900, 1900];

const VAULT_L1 = "Sorted Marketing, archived two stale projects.";
const VAULT_L2 = "Decided to move launch prep under ";

export function VaultFilm({ step }) {
  return (
    <GlassFrame minHeight="14rem">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-foreground/10">
        <BookOpen className="w-3.5 h-3.5 text-foreground/40" />
        <span className="font-terminal text-[11px] text-foreground/40">Daily/2026-07-24.md</span>
      </div>

      <div className="p-5 font-terminal text-[13px] leading-relaxed text-foreground/90 text-left">
        <p># Today</p>
        <p className="mt-2">
          <Typed text={VAULT_L1} play={step === 1} complete={step > 1} cps={38} />
          {step === 1 && <Caret />}
        </p>
        {step >= 2 && (
          <p className="mt-2">
            <Typed text={VAULT_L2} play={step === 2} complete={step > 2} cps={38} />
            {step > 2 && <span className="text-[#46BAD1]">[[Growth]]</span>}
            {step > 2 && " instead of leaving it standalone."}
            {step === 2 && <Caret />}
          </p>
        )}
      </div>

      <div
        className={`flex items-center gap-1.5 px-5 py-3 border-t border-foreground/10 bg-foreground/[0.02] transition-all duration-500 ${
          step >= 3 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
        }`}
      >
        <GitBranch className="w-3 h-3 text-[#46BAD1] shrink-0" />
        <span className="font-terminal text-[11px] text-foreground/40">Committed to your GitHub — not ours</span>
        {step >= 4 && <Check className="w-3 h-3 text-[#86E7B0] ml-auto shrink-0" />}
      </div>
    </GlassFrame>
  );
}

// --- 5. Checks in on its own ------------------------------------------------
// Vaea Self.md's real "## Notes" section gaining a real self-observation,
// then a real commit — same GlassFrame/commit-strip treatment as VaultFilm
// above, because it's mechanically the exact same WRITE_VAULT_NOTE -> your
// GitHub path, just a different file. The section header and filename are
// the real, exact strings selfNote.js/githubApi.js use (SELF_NOTE_PATH,
// SELF_NOTE_NOTES_HEADER); the observation line itself is illustrative —
// what it actually writes is model-generated prose, same honest standard
// ChatFilm's own reply text already holds itself to.

export const SELFNOTE_PHASES = [1600, 2400, 900, 1900];

const SELFNOTE_LINE = "When asked for a quick fix, skip the explanation and just make the change.";

export function SelfNoteFilm({ step }) {
  return (
    <GlassFrame minHeight="14rem">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-foreground/10">
        <BookOpen className="w-3.5 h-3.5 text-foreground/40" />
        <span className="font-terminal text-[11px] text-foreground/40">Vaea Self.md</span>
      </div>

      <div className="p-5 font-terminal text-[13px] leading-relaxed text-foreground/90 text-left">
        <p className="text-foreground/40">## Notes</p>
        <p className="mt-2">
          <Typed text={SELFNOTE_LINE} play={step === 1} complete={step > 1} cps={42} />
          {step === 1 && <Caret />}
        </p>
      </div>

      <div
        className={`flex items-center gap-1.5 px-5 py-3 border-t border-foreground/10 bg-foreground/[0.02] transition-all duration-500 ${
          step >= 2 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
        }`}
      >
        <GitBranch className="w-3 h-3 text-[#46BAD1] shrink-0" />
        <span className="font-terminal text-[11px] text-foreground/40">Committed to your GitHub — not ours</span>
        {step >= 3 && <Check className="w-3 h-3 text-[#86E7B0] ml-auto shrink-0" />}
      </div>
    </GlassFrame>
  );
}

// --- 6. Give it a personality ----------------------------------------------
// The real Name / Identity / Soul fields from AiPreferencesSection.jsx being
// filled in, and the chat header picking the new name up — which is exactly
// what happens in the app, where saving the identity re-reads it so the
// header updates immediately rather than on next reload.

export const IDENTITY_PHASES = [1200, 2000, 2300, 1200, 1800];

const ID_VALUES = {
  name: "Anvil",
  identity: "My second brain for everything I'm juggling.",
  soul: "Direct, no filler. Ask before anything destructive.",
};

// Real Name/Identity/Soul field config + markup from AiPreferencesSection.jsx
// (via IdentityField.jsx) — "About you" (the 4th real field) is left out of
// this film's 3-beat story, not hidden from the real Settings page.
const IDENTITY_DEMO_FIELDS = IDENTITY_FIELDS.slice(0, 3);

export function IdentityFilm({ step }) {
  const named = step >= 3;
  // Real per-character reveal (useTypedText, the same hook Typed itself
  // wraps) driven straight into the real <input>/<textarea> — one call per
  // field since IDENTITY_DEMO_FIELDS' length is fixed, not looped, so the
  // rules of hooks hold.
  const nameValue = useTypedText(ID_VALUES.name, step === 0, step > 0, 7);
  const identityValue = useTypedText(ID_VALUES.identity, step === 1, step > 1, 30);
  const soulValue = useTypedText(ID_VALUES.soul, step === 2, step > 2, 30);
  const shown = [
    { field: IDENTITY_DEMO_FIELDS[0], value: nameValue },
    { field: IDENTITY_DEMO_FIELDS[1], value: identityValue },
    { field: IDENTITY_DEMO_FIELDS[2], value: soulValue },
  ];

  // A decorative caret absolutely positioned over these fields can't track
  // where the text actually wraps inside the Identity/Soul textareas — it
  // used to sit pinned to the field's bottom-left corner regardless of how
  // many lines the revealed text had actually wrapped onto, floating
  // visibly disconnected from the real cursor position. Focusing the field
  // and moving its own native selection to the end instead gives a real
  // browser caret that always blinks in the true spot, wrap included.
  const nameRef = useRef(null);
  const identityRef = useRef(null);
  const soulRef = useRef(null);
  const fieldRefs = useMemo(() => [nameRef, identityRef, soulRef], []);
  useEffect(() => {
    const el = fieldRefs[step]?.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    el.setSelectionRange(el.value.length, el.value.length);
  }, [step, nameValue, identityValue, soulValue, fieldRefs]);

  // text-foreground is load-bearing, not decorative: this is a light card
  // deliberately placed on a dark band, so without it every label and field
  // inherits the band's near-white text and renders white-on-white.
  return (
    <div className="w-full rounded-xl border border-border bg-card text-foreground shadow-[0_25px_50px_-12px_rgb(0_0_0/0.25)] dark:shadow-[0_0_1px_0_hsl(var(--foreground)/0.15),0_0_50px_-8px_hsl(var(--foreground)/0.14)] overflow-hidden text-left">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Settings className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-medium">Settings · AI Preferences</span>
        {/* Always rendered, opacity toggled — a whole "Saved" chip
            conditionally mounted mid-timeline is the exact layout-shift
            shape already fixed elsewhere in this file. */}
        <span className={`ml-auto flex items-center gap-1 text-[11px] text-muted-foreground transition-opacity duration-300 ${step >= 4 ? "opacity-100" : "opacity-0"}`}>
          <Check className="w-3 h-3 text-[#86E7B0]" /> Saved
        </span>
      </div>

      <div className="p-4 space-y-3" style={{ minHeight: "13rem" }}>
        {shown.map(({ field, value }, i) => (
          <IdentityField key={field.key} ref={fieldRefs[i]} field={field} value={value} readOnly />
        ))}
      </div>

      {/* The payoff: the chat's own header takes the name immediately. */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-border bg-muted/40">
        <MessageCircle className="w-4 h-4 text-muted-foreground shrink-0" />
        <span
          className={`font-terminal text-sm font-semibold transition-all duration-500 ${
            named ? "text-foreground" : "text-muted-foreground"
          }`}
        >
          {named ? ID_VALUES.name : "Vaea Chat"}
        </span>
      </div>
    </div>
  );
}

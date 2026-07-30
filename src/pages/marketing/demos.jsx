import {
  Search, Package, FolderKanban, ListTodo, Boxes, BookOpen, GitBranch,
  Check, Plus, MessageCircle, Settings,
} from "lucide-react";
import { Typed, Caret } from "./effects";
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

function Line({ show, children, className = "" }) {
  return (
    <p
      className={`transition-all duration-300 ${className} ${
        show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
      }`}
    >
      {children}
    </p>
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

export function ChatFilm({ step }) {
  return (
    <GlassFrame minHeight="19rem">
      <div className="flex items-center gap-1.5 px-5 py-3.5 border-b border-foreground/10">
        <span className="w-2.5 h-2.5 rounded-full bg-foreground/15" />
        <span className="w-2.5 h-2.5 rounded-full bg-foreground/15" />
        <span className="w-2.5 h-2.5 rounded-full bg-foreground/15" />
        <span className="ml-2 font-terminal text-[11px] text-foreground/40">Vaea Chat</span>
      </div>

      <div className="p-5 font-terminal text-[13px] leading-relaxed text-left">
        <p className="text-foreground/90">
          <span className="text-[#46BAD1]">{">"}</span>{" "}
          <Typed text={CHAT_ASK} play={step === 0} complete={step > 0} cps={48} />
          {step === 0 && <Caret />}
        </p>

        {step === 1 && (
          <p className="mt-3 flex items-center gap-1.5 text-foreground/40">
            <span className="w-3 h-3 rounded-full border border-[#46BAD1]/60 border-t-transparent animate-spin" />
            <Caret />
          </p>
        )}

        <div className="mt-3 space-y-1 text-foreground/40">
          <Line show={step >= 2}>plan · 3 steps across 3 projects</Line>
          <Line show={step >= 3}>tool call · archive_project(&quot;Q1 Newsletter&quot;)</Line>
          <Line show={step >= 4}>tool call · move_project(&quot;Landing Page Copy&quot;)</Line>
          <Line show={step >= 5}>tool call · archive_project(&quot;Old Brand Deck&quot;)</Line>
        </div>

        {step >= 6 && (
          <p className="mt-3 text-foreground/90">
            <Typed text={CHAT_REPLY} play={step === 6} complete={step > 6} cps={60} />
            {step >= 7 && <Caret />}
          </p>
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

const PALETTE_QUICK = [
  { Icon: Plus, label: "Create Task" },
  { Icon: Plus, label: "Create Project" },
  { Icon: MessageCircle, label: "Open full-page chat" },
  { Icon: Settings, label: "Open Settings" },
];

const PALETTE_RESULTS = [
  { Icon: Package, title: "Growth", subtitle: "Product" },
  { Icon: FolderKanban, title: "Landing Page Copy", subtitle: "in Growth" },
  { Icon: ListTodo, title: "Write header copy", subtitle: "Landing Page Copy" },
];

function Kbd({ children, lit }) {
  return (
    <kbd
      className={`font-mono border rounded px-1 py-0.5 transition-colors duration-200 ${
        lit ? "border-primary/60 bg-primary/10 text-foreground" : "border-border"
      }`}
    >
      {children}
    </kbd>
  );
}

export function PaletteFilm({ step }) {
  const showResults = step >= 2;
  const selected = step <= 2 ? 0 : step === 3 ? 1 : 2;
  const rows = showResults ? PALETTE_RESULTS : PALETTE_QUICK;

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

      <div className="py-1.5" style={{ minHeight: "9rem" }}>
        {rows.map((row, i) => {
          const Icon = row.Icon;
          return (
            <div
              key={row.title || row.label}
              className={`flex items-center gap-3 px-4 py-2 transition-colors duration-200 ${
                i === selected ? "bg-secondary" : ""
              }`}
            >
              <Icon className="w-4 h-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium truncate">{row.title || row.label}</span>
                {row.subtitle && <span className="block text-xs text-muted-foreground truncate">{row.subtitle}</span>}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3 px-4 py-2 border-t border-border text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><Kbd lit={step === 3 || step === 4}>↑↓</Kbd> navigate</span>
        <span className="flex items-center gap-1"><Kbd lit={step >= 5}>↵</Kbd> open</span>
        <span className="flex items-center gap-1"><Kbd>ctrl+↵</Kbd> new tab</span>
      </div>
    </div>
  );
}

// --- 3. The nesting -------------------------------------------------------
// Area → Product → Project → tasks, each level built out in order so the
// containment is something you watch happen rather than have to infer. Each
// level uses its real elevation treatment from the app's own design system
// (Area: bg-card + shadow-md; Product: recessed bg-muted/40 with no shadow;
// Project: pops back to bg-card) — see AreaCard.jsx / ProductCard.jsx and
// the Visual Design Refresh decision note.

export const NEST_PHASES = [650, 650, 650, 750, 950, 950, 1800];

// STATUS_COLORS, taskUtils.js. NOT_STARTED is a theme-adaptive CSS var in the
// real app, so it's referenced the same way here rather than hardcoded.
const DONE = "#86E7B0";
const IN_PROGRESS = "#FEF08A";
const NOT_STARTED = "var(--status-not-started)";

const NEST_TASKS = ["Write header copy", "Draft CTA variants", "Ship to staging"];

export function NestFilm({ step }) {
  // Task 1 completes at phase 4; task 2 starts moving at phase 5.
  const statuses = [
    step >= 4 ? DONE : NOT_STARTED,
    step >= 5 ? IN_PROGRESS : NOT_STARTED,
    NOT_STARTED,
  ];
  const counts = [
    statuses.filter((s) => s === NOT_STARTED).length,
    statuses.filter((s) => s === IN_PROGRESS).length,
    statuses.filter((s) => s === DONE).length,
  ];
  // MINI_STATUS_BUCKETS, taskUtils.js — real labels, real order.
  const buckets = [
    { label: "Not Started", color: NOT_STARTED, count: counts[0] },
    { label: "In Prog", color: IN_PROGRESS, count: counts[1] },
    { label: "Done", color: DONE, count: counts[2] },
  ];

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

        <div className={`mt-3 rounded-lg bg-card border border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)] dark:shadow-[0_0_0_1px_hsl(var(--foreground)/0.06),0_0_8px_-2px_hsl(var(--foreground)/0.10)] p-3 ${grow(step >= 2)}`}>
          <p className="text-sm font-medium flex items-center gap-2">
            <FolderKanban className="w-3.5 h-3.5 text-muted-foreground" />
            Landing Page Copy
          </p>

          <div className={`mt-2.5 space-y-1.5 ${grow(step >= 3)}`}>
            {NEST_TASKS.map((task, i) => (
              <div key={task} className="flex items-center gap-2 text-xs text-muted-foreground">
                {/* 300ms, not 500 — the bucket counts below update instantly
                    as text, so a slower dot visibly lags behind its own count. */}
                <span
                  className="w-2 h-2 rounded-full shrink-0 transition-colors duration-300"
                  style={{ background: statuses[i] }}
                />
                <span className={statuses[i] === DONE ? "line-through opacity-60" : ""}>{task}</span>
              </div>
            ))}
          </div>

          <div className={`mt-3 pt-2.5 border-t border-border flex items-center gap-3 ${grow(step >= 3)}`}>
            {buckets.map(({ label, color, count }) => (
              <span key={label} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                {label}
                <span className="font-medium text-foreground tabular-nums">{count}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- 4. Vaea Vault ----------------------------------------------------------
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

const ID_NAME = "Anvil";
const ID_IDENTITY = "My second brain for everything I'm juggling.";
const ID_SOUL = "Direct, no filler. Ask before anything destructive.";

function Field({ label, children }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-muted-foreground mb-1.5">{label}</p>
      <div className="min-h-[2.25rem] rounded-md border border-input bg-background px-3 py-2 text-[13px]">
        {children}
      </div>
    </div>
  );
}

export function IdentityFilm({ step }) {
  const named = step >= 3;
  // text-foreground is load-bearing, not decorative: this is a light card
  // deliberately placed on a dark band, so without it every label and field
  // inherits the band's near-white text and renders white-on-white.
  return (
    <div className="w-full rounded-xl border border-border bg-card text-foreground shadow-[0_25px_50px_-12px_rgb(0_0_0/0.25)] dark:shadow-[0_0_1px_0_hsl(var(--foreground)/0.15),0_0_50px_-8px_hsl(var(--foreground)/0.14)] overflow-hidden text-left">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Settings className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-medium">Settings · AI Preferences</span>
        {step >= 4 && (
          <span className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground">
            <Check className="w-3 h-3 text-[#86E7B0]" /> Saved
          </span>
        )}
      </div>

      <div className="p-4 space-y-3" style={{ minHeight: "13rem" }}>
        <Field label="Name">
          <Typed text={ID_NAME} play={step === 0} complete={step > 0} cps={7} />
          {step === 0 && <Caret className="bg-primary/70" />}
        </Field>
        <Field label="Identity">
          <Typed text={ID_IDENTITY} play={step === 1} complete={step > 1} cps={30} />
          {step === 1 && <Caret className="bg-primary/70" />}
        </Field>
        <Field label="Soul (tone & protocol)">
          <Typed text={ID_SOUL} play={step === 2} complete={step > 2} cps={30} />
          {step === 2 && <Caret className="bg-primary/70" />}
        </Field>
      </div>

      {/* The payoff: the chat's own header takes the name immediately. */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-border bg-muted/40">
        <MessageCircle className="w-4 h-4 text-muted-foreground shrink-0" />
        <span
          className={`font-terminal text-sm font-semibold transition-all duration-500 ${
            named ? "text-foreground" : "text-muted-foreground"
          }`}
        >
          {named ? ID_NAME : "Vaea Chat"}
        </span>
      </div>
    </div>
  );
}

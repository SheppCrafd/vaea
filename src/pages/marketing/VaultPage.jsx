import { Link } from "react-router-dom";
import {
  ArrowRight, GitBranch, BookOpen, Check, Link2, Search, Sparkles, RefreshCw,
} from "lucide-react";
import MarketingLayout from "./MarketingLayout";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Reveal, StageLight, Grain, useTimeline, Typed, Caret, useDocumentMeta, usePageSchema } from "./effects";
import {
  darkSectionBg, darkText, darkTopEdge, glassPanel, glassSheen, glassTileLight,
  pillOnDark, linkOnDark, eyebrowOnDark, eyebrowOnLight,
  displayXL, displayL, displayM, GLOW,
} from "./theme";

// ─── vault writing demo ─────────────────────────────────────────────────────
// Shows a real vault-log entry being written: the daily note filename in the
// header bar, markdown content appearing line by line (including a [[wikilink]]
// in the signature GLOW cyan), then the git commit strip sliding in below.
// Mirrors the actual WRITE_VAULT_NOTE tool output shape — real file path, real
// markdown, real "committed to your GitHub" strip.

const VAULT_PHASES = [400, 1600, 1400, 1200, 1000, 800];

const LINE_1 = "Finished the connector sprint — Google Calendar, Gmail, Outlook,";
const LINE_2 = "ClickUp, and Slack all wired and deployed.";
const LINE_3 = "Decided to scope the next sprint around ";

function VaultWritingDemo() {
  const { ref, step } = useTimeline(VAULT_PHASES);

  return (
    <div ref={ref} className={`relative w-full max-w-xl mx-auto rounded-2xl overflow-hidden ${glassPanel}`}>
      <div className={glassSheen} />
      {/* file path bar */}
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-foreground/[0.08]">
        <BookOpen className="w-3.5 h-3.5 text-foreground/35" />
        <span className="font-terminal text-[11px] text-foreground/35 flex-1 min-w-0 truncate">
          Daily/2026-08-20.md
        </span>
        {/* unsaved dot while actively typing (steps 1–4) — the single visual
            cue that reads "document editor" rather than "chat window" at a
            glance, the same way VSCode tabs show a dot on unsaved files */}
        {step >= 1 && step < 5 && (
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ background: GLOW }}
            aria-hidden="true"
          />
        )}
        {step >= 5 && (
          <span className="font-terminal text-[10px]" style={{ color: GLOW }}>
            saved
          </span>
        )}
      </div>

      {/* markdown content */}
      <div className="px-5 py-5 font-terminal text-[13px] leading-relaxed text-foreground/85 min-h-[10rem] text-left">
        <p className="text-foreground/40">
          <span className="text-foreground/70">#</span> 2026-08-20
        </p>

        {step >= 1 && (
          <p className="mt-3">
            {step === 1
              ? <><Typed text={LINE_1} play cps={42} /><Caret /></>
              : LINE_1}
          </p>
        )}
        {step >= 2 && (
          <p>
            {step === 2
              ? <><Typed text={LINE_2} play cps={42} /><Caret /></>
              : LINE_2}
          </p>
        )}
        {step >= 3 && (
          <p className="mt-3">
            {step === 3
              ? <><Typed text={LINE_3} play cps={42} /><Caret /></>
              : <>
                  {LINE_3}
                  <span style={{ color: GLOW }}>[[AI feature parity]]</span>
                  {step >= 4 && " next."}
                  {step === 4 && <Caret />}
                </>
            }
          </p>
        )}
      </div>

      {/* git commit strip */}
      <div
        className={`flex items-center gap-2 px-5 py-3 border-t border-foreground/[0.07] bg-foreground/[0.02] transition-all duration-500 ${
          step >= 5 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
        }`}
      >
        <GitBranch className="w-3 h-3 shrink-0" style={{ color: GLOW }} />
        <span className="font-terminal text-[11px] text-foreground/40 flex-1 min-w-0 truncate">
          Committed · Daily/2026-08-20.md · Your GitHub, not ours
        </span>
        <Check className="w-3 h-3 shrink-0 text-emerald-500" />
      </div>
    </div>
  );
}

// ─── wikilink demo ──────────────────────────────────────────────────────────
// Static illustration of connected notes — the knowledge graph idea made
// tangible as a few notes with [[link]] arrows, not an abstract blob diagram.

function WikilinkDemo() {
  const NOTES = [
    { path: "Decisions/Connector architecture.md", excerpt: "Decided on PKCE for Google, server exchange for ClickUp." },
    { path: "Daily/2026-08-18.md", excerpt: "Finished [[Connector architecture]] — Calendar, Gmail done." },
    { path: "Projects/Vaea v1.md", excerpt: "Sprint goal: deploy all connectors before end of month. See [[Connector architecture]]." },
  ];
  return (
    <div className="space-y-3">
      {NOTES.map((note) => (
        <div key={note.path} className={`p-4 rounded-xl ${glassTileLight}`}>
          <p className="font-terminal text-[11px] text-muted-foreground/60 mb-1.5 truncate">{note.path}</p>
          <p className="text-sm text-foreground/80 leading-relaxed">
            {note.excerpt.split(/(\[\[.+?\]\])/).map((part, i) =>
              part.startsWith("[[") ? (
                <span key={i} className="font-terminal" style={{ color: GLOW }}>
                  {part}
                </span>
              ) : part
            )}
          </p>
        </div>
      ))}
      <div className="flex items-center gap-2 pt-1">
        <Link2 className="w-3.5 h-3.5 text-muted-foreground/40" />
        <p className="text-xs text-muted-foreground/50 font-terminal">
          wikilinks connect related notes — Vaea reads them all when answering
        </p>
      </div>
    </div>
  );
}

// ─── vaea self.md static card ────────────────────────────────────────────────
// A small, static glass card that makes "Vaea Self.md" tangible — shows a
// realistic excerpt of what the Notes section looks like in practice, without
// animating or over-dramatising it. Font-terminal at 12px matches the vault
// writing demo's aesthetic without competing with the hero.

function SelfMdCard() {
  const LINES = [
    { prefix: "## Notes", body: null, dim: true },
    { prefix: null, body: "When asked for a quick fix, skip the explanation and just make the change.", dim: false },
    { prefix: null, body: "User prefers seeing the plan before any destructive action, even small ones.", dim: false },
    { prefix: null, body: "Technical decisions land better with the tradeoff named, not just the choice.", dim: false },
  ];
  return (
    <div className={`relative mx-auto mt-10 max-w-sm rounded-2xl overflow-hidden ${glassPanel}`}>
      <div className={glassSheen} />
      <div className="flex items-center gap-2 px-4 py-3 border-b border-foreground/[0.08]">
        <BookOpen className="w-3 h-3 text-foreground/30" />
        <span className="font-terminal text-[10px] text-foreground/30 flex-1 min-w-0 truncate">
          Vaea Self.md
        </span>
      </div>
      <div className="px-4 py-4 font-terminal text-[12px] leading-relaxed space-y-1 text-left">
        {LINES.map(({ prefix, body, dim }, i) => (
          <p key={i} className={dim ? "text-foreground/35" : "text-foreground/70"}>
            {prefix ?? `- ${body}`}
          </p>
        ))}
      </div>
    </div>
  );
}

// ─── vault features ──────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: BookOpen,
    title: "Still your Obsidian",
    body: "Write the way you already do — folders, [[wikilinks]], markdown. Vaea reads them without asking you to change anything about how you take notes.",
  },
  {
    icon: Search,
    title: "Ask what you wrote months ago",
    body: "\"What did I decide about the auth architecture?\" — Vaea goes and looks, rather than asking you to remember which note it's in.",
  },
  {
    icon: GitBranch,
    title: "Every write is automatically saved to your own backup on GitHub",
    body: "Your own GitHub account, your own history — with full version history. Recoverable, portable — not stored anywhere Vaea controls.",
  },
  {
    icon: Sparkles,
    title: "The AI keeps notes on itself",
    body: "Once a day it reviews its own replies and writes what it'd do better into Vaea Self.md — a plain file you can open, read, and edit.",
  },
  {
    icon: RefreshCw,
    title: "/vault-tidy keeps it clean",
    body: "Audits your wikilinks for broken references and isolated notes, then proposes fixes — same confirm-before-anything discipline as every other change.",
  },
  {
    icon: Check,
    title: "Opt in separately from everything else",
    body: "Vault access is its own connection, independent of chat or project data. Connect it when you're ready, skip it if you don't use Obsidian.",
  },
];

// ─── FAQ ────────────────────────────────────────────────────────────────────

const FAQS = [
  {
    q: "Do I need to already use Obsidian?",
    a: "Yes — Vaea Vault assumes you have an Obsidian vault backed up to your own GitHub account. If you don't use Obsidian, the other parts of Vaea (chat, projects, tasks, connectors) all work perfectly without it. Vault is an optional add-on, not a requirement.",
  },
  {
    q: "How does Vaea actually read my notes?",
    a: "You connect your GitHub account in Settings → Vaea Vault. When you ask Vaea something that might be in your notes, it searches and reads the relevant files directly from GitHub. Nothing is pre-indexed or cached on Vaea's servers between requests — it's a live read, per question.",
  },
  {
    q: "What does /vault-log actually write?",
    a: "At the end of a session, /vault-log writes a real summary to Daily/YYYY-MM-DD.md in your vault — the same format a human would write. If a technical decision was made, it also writes a Decisions/ file with the reasoning. Every write is a save to your own GitHub backup; you get a real change history and can recover any version.",
  },
  {
    q: "Can Vaea overwrite or delete my existing notes?",
    a: "Write operations always go through the same confirm-before-anything step as every other change in Vaea. And if you tell Vaea to update an existing note, it reads the current content first and carries everything forward — it never starts from scratch on a note that already exists.",
  },
  {
    q: "What's in Vaea Self.md and who controls it?",
    a: "Vaea Self.md lives in your vault. The Identity section is set by you through Settings → AI Preferences, and Vaea never touches it. The Notes section is where Vaea records its own self-observations — plain prose, one line per observation. You can read it, edit it, and delete any entry you disagree with.",
  },
  {
    q: "Is Vaea Vault available offline?",
    a: "Reading and writing vault notes require a live connection to GitHub's API. In Local Mode, chat itself runs entirely offline, but vault reads still call GitHub when needed. If you need fully offline note-taking, that's Obsidian's own job — Vaea just reads alongside it.",
  },
  {
    q: "How do I set up Vaea Vault?",
    a: "Open Settings → Vaea Vault, paste your GitHub repo URL, and grant read/write access. That's it — no plugin to install in Obsidian, no change to your folder structure. Vaea reads your existing notes exactly as they are.",
  },
  {
    q: "Is my notes data backed up?",
    a: "Yes — because Vaea Vault uses your own GitHub account, every note Vaea writes is automatically saved to your own backup there. You own it, you control the history, and you can recover any version. Nothing is stored on Vaea's servers.",
  },
];

// ─── schema ─────────────────────────────────────────────────────────────────

const VAULT_PAGE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "Vaea Vault — AI that reads and writes your personal notes",
  "url": "https://vaea.base44.app/vault",
  "description": "Connect your Obsidian notes to Vaea Chat via your own GitHub repo. Ask what you decided last month — the AI reads and writes your notes as real git commits.",
  "isPartOf": { "@type": "WebSite", "url": "https://vaea.base44.app/" },
};

const VAULT_FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": FAQS.map(({ q, a }) => ({
    "@type": "Question",
    "name": q,
    "acceptedAnswer": { "@type": "Answer", "text": a },
  })),
};

// ─── page ────────────────────────────────────────────────────────────────────

export default function VaultPage() {
  useDocumentMeta("Vaea Vault — AI that reads and writes your personal notes", "/vault");
  usePageSchema(VAULT_PAGE_SCHEMA);
  usePageSchema(VAULT_FAQ_SCHEMA);

  return (
    <MarketingLayout>

      {/* ── HERO ── dark, demo up front ── */}
      <section className={`relative overflow-hidden ${darkSectionBg} ${darkText} ${darkTopEdge}`}>
        <StageLight />
        <Grain />
        <div className="relative max-w-5xl mx-auto px-6 pt-20 sm:pt-28 pb-16 sm:pb-20">
          <Reveal className="text-center mb-12">
            <p className={`${eyebrowOnDark} mb-5`}>Vaea Vault</p>
            <h1 className={`${displayXL} max-w-3xl mx-auto`}>
              Your notes remember what you do.
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Connect your Obsidian notes (Obsidian is a free note-taking app where your notes are plain files on your computer) and Vaea Chat reads every note for context — and
              writes new ones when you ask. Your own backup on GitHub, your own history,
              your own Obsidian. Nothing changes about how you work.
            </p>
            <div className="mt-8 flex items-center justify-center gap-5 flex-wrap">
              <Link to="/signup" className={pillOnDark}>
                Connect your vault
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link to="/how-it-works" className={linkOnDark}>
                See how it works
              </Link>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <VaultWritingDemo />
            <p className="text-center text-xs text-muted-foreground/45 mt-4 font-terminal tracking-wide">
              /vault-log · live demo · loops automatically
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── HOW IT CONNECTS ── light, wikilinks visual ── */}
      <section className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(55%_60%_at_50%_0%,rgba(70,186,209,0.05),transparent_70%)]" />
        <div className="relative max-w-5xl mx-auto px-6 py-16 sm:py-24">
          <div className="sm:grid sm:grid-cols-2 sm:gap-16 sm:items-start">
            <Reveal>
              <p className={`${eyebrowOnLight} mb-4`}>Connected context</p>
              <h2 className={`${displayL} mb-6`}>It finds the note<br />so you don't have to.</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Ask what you decided about a project three months ago. Vaea searches your
                vault, follows the{" "}
                <span className="font-terminal" style={{ color: GLOW }}>{"[[wikilinks]]"}</span>,
                and surfaces the right note — instead of you digging through folders trying
                to remember where you filed it.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Every note Vaea writes back uses the same{" "}
                <span className="font-terminal" style={{ color: GLOW }}>{"[[wikilink]]"}</span>{" "}
                format, so new entries fit naturally into your existing knowledge graph
                rather than sitting isolated.
              </p>
            </Reveal>
            <Reveal delay={100}>
              <WikilinkDemo />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── VAULT-LOG SECTION ── dark ── */}
      <section className={`relative overflow-hidden ${darkSectionBg} ${darkText} ${darkTopEdge}`}>
        <StageLight />
        <Grain />
        <div className="relative max-w-3xl mx-auto px-6 py-16 sm:py-24 text-center">
          <Reveal>
            <p className={`${eyebrowOnDark} mb-5`}>
              <span className="font-terminal">/vault-log</span>
            </p>
            <h2 className={`${displayL} mb-6`}>
              End every session with a real log entry.
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto leading-relaxed mb-4">
              Type <span className="font-terminal">/vault-log</span> and Vaea writes a
              real daily note from the conversation — what happened, what was decided,
              what moved. One save to your own GitHub backup. Not a transcript, not a chat
              export: an actual note in the format you already use.
            </p>
            <p className="text-muted-foreground max-w-lg mx-auto leading-relaxed">
              If a real technical decision was made, it also writes a{" "}
              <span className="font-terminal text-foreground/60">Decisions/</span> file
              with the reasoning — the kind of note you'd write yourself if you had time,
              automatically, from the conversation that just happened.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── FEATURE GRID ── light ── */}
      <section className="relative">
        <div className="max-w-5xl mx-auto px-6 py-16 sm:py-24">
          <Reveal className="text-center mb-12">
            <h2 className={displayL}>What it actually does.</h2>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(({ icon: Icon, title, body }, i) => (
              <Reveal key={title} delay={i * 55} as="div"
                className={`flex gap-4 p-5 rounded-2xl ${glassTileLight}`}
              >
                <div
                  className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: `${GLOW}14`, border: `1px solid ${GLOW}25` }}
                >
                  <Icon className="w-4 h-4" style={{ color: GLOW }} />
                </div>
                <div>
                  <p className="font-medium text-sm">{title}</p>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── SELF-REFLECTION ── light wash ── */}
      <section className="relative border-t border-foreground/[0.05]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(55%_50%_at_50%_0%,rgba(70,186,209,0.04),transparent_70%)]" />
        <div className="relative max-w-2xl mx-auto px-6 py-16 sm:py-20 text-center">
          <Reveal>
            <p className={`${eyebrowOnLight} mb-4`}>
              <span className="font-terminal">Vaea Self.md</span>
            </p>
            <h2 className={`${displayM} mb-5`}>The AI keeps notes on itself.</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Once a day, Vaea reviews its own recent replies and writes one observation
              into <span className="font-terminal text-foreground/60">Vaea Self.md</span> —
              what it noticed about how it could help you better. It's a plain file in
              your vault: you can read it, edit any line, or delete the whole thing.
            </p>
            <p className="text-muted-foreground leading-relaxed text-sm">
              This is a separate, explicit opt-in from vault access — off by default. We
              considered framing it as the assistant developing "self-awareness." That
              would be dishonest. What you get instead is real: a file it keeps about itself.
            </p>
            <SelfMdCard />
          </Reveal>
        </div>
      </section>

      {/* ── FAQ ── light, SEO ── */}
      <section className="border-t border-foreground/[0.06]">
        <div className="max-w-2xl mx-auto px-6 py-16 sm:py-20">
          <Reveal className="mb-10 text-center">
            <h2 className={displayM}>Questions about Vault</h2>
          </Reveal>
          <Accordion type="single" collapsible className="space-y-1">
            {FAQS.map(({ q, a }) => (
              <AccordionItem key={q} value={q} className="border-b border-foreground/[0.06] last:border-0">
                <AccordionTrigger className="text-left text-sm font-medium py-4 hover:no-underline hover:text-foreground/80 transition-colors">
                  {q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-4">
                  {a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ── CTA ── dark ── */}
      <section className={`relative overflow-hidden ${darkSectionBg} ${darkText} ${darkTopEdge}`}>
        <StageLight />
        <Grain />
        <div className="relative max-w-3xl mx-auto px-6 py-24 sm:py-32 text-center">
          <Reveal>
            <h2 className={displayL}>Your notes. Your backup.<br />Your AI reads them all.</h2>
            <p className="mt-5 text-muted-foreground max-w-md mx-auto leading-relaxed">
              Connect once in Settings → Vaea Vault. After that, "what did I
              decide last month?" is the whole question — Vaea goes and looks.
            </p>
            <div className="mt-10 flex items-center justify-center gap-5 flex-wrap">
              <Link to="/signup" className={pillOnDark}>
                Sign up free
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link to="/features" className={linkOnDark}>
                All features
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

    </MarketingLayout>
  );
}

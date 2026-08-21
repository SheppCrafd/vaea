import { Link } from "react-router-dom";
import {
  ArrowRight, CalendarDays, Mail, Building2, CheckSquare, BookOpen,
  ShieldOff, Key, Zap, Hash, MessageCircle, Settings, Maximize2, X,
} from "lucide-react";
import MarketingLayout from "./MarketingLayout";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import {
  Reveal, StageLight, Grain, Caret, Typed,
  useTimeline, useDocumentMeta, usePageSchema,
} from "./effects";
import {
  darkSectionBg, darkText, darkTopEdge,
  glassTileLight,
  pillOnDark, linkOnDark, eyebrowOnDark, eyebrowOnLight,
  displayXL, displayL, displayM, GLOW,
} from "./theme";

// ─── hero chat demo ────────────────────────────────────────────────────────
// Built to the same discipline as demos.jsx: this is what the real in-app
// chat (ChatBox.jsx/ChatMessageList.jsx) actually looks like, not a
// plausible-looking approximation — a flat terminal transcript ("> " for the
// user's own lines, dim unbulleted tool-log lines while it works, the reply
// at full contrast, no avatars, no chat bubbles), a bg-primary/text-primary
// header bar matching ChatBox's real chrome, and a real pending_action's
// actual "Yes, do it" / "Cancel" buttons — not an invented "card" UI that
// doesn't exist anywhere in the app.

// phase 0 → nothing visible
// phase 1 → user message typed in
// phase 2 → tool-log lines revealing + thinking cursor
// phase 3 → Vaea's response typed in
// phase 4 → pause: full exchange visible
// phase 5 → user follow-up typed in
// phase 6 → brief thinking
// phase 7 → Yes, do it / Cancel buttons appear
// phase 8 → pause (restart)
const DEMO_DURATIONS = [350, 1300, 900, 1700, 1500, 1100, 650, 1900, 2500];

const USER_MSG_1 = "What's tomorrow look like? Check my calendar and any ClickUp tasks due.";
const VAEA_REPLY = "You have a 10am Design Review (1hr). Three ClickUp tasks in the Launch space are due today — one went overdue yesterday. Want me to add a 45-min focus block at 8:30 before the call?";
const USER_MSG_2 = "Yes, add it.";
// describeToolCall()'s real fn("label") shape (chatActions.js) — the same
// literal strings a real liveSteps reveal shows, not "reading Calendar
// ClickUp" pill badges, which is nothing the app renders.
const TOOL_LOG_LINES = ['list_calendar_events()', 'list_clickup_tasks()'];

function ChatDemo() {
  const { ref, step } = useTimeline(DEMO_DURATIONS);

  const showMsg1 = step >= 1;
  const typing1 = step === 1;
  const showToolLog = step >= 2;
  const showThinking1 = step === 2;
  const showReply = step >= 3;
  const typingReply = step === 3;
  const showMsg2 = step >= 5;
  const typing2 = step === 5;
  const showThinking2 = step === 6;
  const showAction = step >= 7;

  return (
    <div
      ref={ref}
      className="relative rounded-2xl overflow-hidden w-full max-w-xl mx-auto bg-card shadow-[0_0_0_1px_hsl(var(--foreground)/0.06),0_28px_58px_-12px_hsl(200_30%_12%/0.35)]"
      style={{ minHeight: 420 }}
    >
      {/* Real ChatBox.jsx header chrome: bg-primary bar, icon + name on the
          left, a row of small icon buttons on the right — never macOS
          traffic-light dots, which nothing in the app renders. */}
      <div className="bg-primary px-4 py-3 flex items-center justify-between text-primary-foreground">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4" />
          <span className="font-terminal font-semibold text-sm">Vaea Chat</span>
        </div>
        <div className="flex items-center gap-2 text-primary-foreground/70">
          <Settings className="w-3.5 h-3.5" />
          <Maximize2 className="w-3.5 h-3.5" />
          <X className="w-4 h-4" />
        </div>
      </div>

      <div className="px-4 py-4 space-y-4 min-h-[360px] font-terminal text-[13px] leading-relaxed bg-background/50">
        {showMsg1 && (
          <p className="text-foreground whitespace-pre-wrap">
            <span className="text-primary">{">"}</span>{" "}
            {typing1 ? <><Typed text={USER_MSG_1} play cps={55} /><Caret /></> : USER_MSG_1}
          </p>
        )}

        {showToolLog && (
          <div className="space-y-0.5">
            <div className="text-muted-foreground space-y-0.5">
              {TOOL_LOG_LINES.map((line) => <p key={line}>{line}</p>)}
            </div>
            {showThinking1 && <Caret />}

            {showReply && (
              <p className="text-foreground mt-2">
                {typingReply ? <><Typed text={VAEA_REPLY} play cps={60} /><Caret /></> : VAEA_REPLY}
              </p>
            )}
          </div>
        )}

        {showMsg2 && (
          <p className="text-foreground whitespace-pre-wrap">
            <span className="text-primary">{">"}</span>{" "}
            {typing2 ? <><Typed text={USER_MSG_2} play cps={60} /><Caret /></> : USER_MSG_2}
          </p>
        )}

        {showThinking2 && (
          <p className="flex items-center gap-1.5">
            <MessageCircle className="w-3.5 h-3.5 text-primary" />
            <Caret />
          </p>
        )}

        {/* Real ChatMessageList.jsx pending_action buttons — plain text
            buttons, not a colored "staged action" card with an icon header
            and a details block, which the app has no such thing of. */}
        {step >= 6 && (
          <div className={`flex gap-2 transition-all duration-500 ${showAction ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}>
            <button type="button" className="text-xs px-2.5 py-1 bg-destructive text-destructive-foreground border border-border rounded-md">
              Yes, do it
            </button>
            <button type="button" className="text-xs px-2.5 py-1 bg-secondary text-secondary-foreground border border-border rounded-md">
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── connectors section ─────────────────────────────────────────────────────

const CONNECTORS = [
  {
    icon: CalendarDays,
    name: "Google Workspace",
    body: "Calendar, Drive, Docs, Sheets, Slides, Tasks, Forms — what's on tomorrow, find a file, edit a doc, add events with a real Meet link if you want one.",
  },
  {
    icon: Mail,
    name: "Gmail",
    body: "Read what landed, search your inbox, send a reply — outgoing mail always needs a confirm.",
  },
  {
    icon: Building2,
    name: "Microsoft 365",
    body: "Outlook calendar, Exchange mail, and Teams meeting links. One sign-in covers all three.",
  },
  {
    icon: CheckSquare,
    name: "ClickUp",
    body: "Create or update tasks, read ClickUp Chat channels, post a message. Work stays in sync.",
  },
  {
    icon: Hash,
    name: "Slack",
    body: "Read channel messages or post to a channel when you ask — sent as you, not a bot. Works with any public channel in your workspace.",
  },
  {
    icon: BookOpen,
    name: "Vaea Brain",
    body: "Your Obsidian notes on GitHub. Ask what you decided last quarter and it'll go look.",
  },
  {
    icon: ShieldOff,
    name: "Local Mode",
    body: "No service connected at all — your own AI model answers locally. Nothing leaves your device.",
  },
];

// ─── three modes section ────────────────────────────────────────────────────

const MODES = [
  {
    icon: Zap,
    label: "Built-in",
    tagline: "Ready the moment you sign in.",
    body: "Vaea's hosted assistant, powered by the strongest available model, already knows your full workspace. No keys to paste, nothing to configure.",
    accent: GLOW,
  },
  {
    icon: Key,
    label: "Bring your own key",
    tagline: "Your account key, your model, Vaea's context.",
    body: "Connect any provider — Anthropic, OpenAI, Google — and your key goes straight to them. Vaea is just the interface; it never stores your key.",
    accent: "#a78bfa",
  },
  {
    icon: ShieldOff,
    label: "Local Mode",
    tagline: "No server. Not even ours.",
    body: "Connect a folder. Vaea writes a prompt file; your own script — or Claude Code — reads it and replies. Vaea makes no network call of its own. Nothing leaves your machine.",
    accent: "#34d399",
  },
];

// ─── faq ───────────────────────────────────────────────────────────────────

const FAQS = [
  {
    q: "How does Vaea Chat know what's on my calendar or in my inbox?",
    a: "You connect your accounts in Settings (one click, no setup on your end). When you ask about your schedule or email, Vaea reads it on the spot for that request only — nothing is stored on our servers between requests. The credentials that grant access live on your own device.",
  },
  {
    q: "Can Vaea Chat actually delete things, or just read them?",
    a: "It can read, create, edit, and delete — but anything that changes or removes something goes through a confirm step first. You see exactly what's about to happen (the full event details, the task, the message) before it does. Vaea never removes something silently.",
  },
  {
    q: "What's the difference between Built-in, Bring Your Own Key, and Local Mode?",
    a: "Built-in uses Vaea's hosted model — sign in, start chatting. Bring Your Own Key sends your message directly to your chosen provider (Anthropic, OpenAI, Google) using your own account key, so Vaea is just the interface. Local Mode removes any hosted AI entirely — Vaea writes a file to a folder and your own model (or Claude Code) answers it. Vaea sends nothing on its own in that mode.",
  },
  {
    q: "Is Vaea Chat available when I'm not signed in?",
    a: "Local Mode and Bring Your Own Key both work without a Vaea account — they only need a device and either a local AI model or an account key. The built-in assistant requires a free account.",
  },
  {
    q: "Does connecting Gmail or Outlook mean Vaea stores my emails?",
    a: "No. When Vaea Chat needs to check your inbox it reads what's relevant at that moment, uses it for the reply, and doesn't store it. The access credential that lets Vaea read your email lives in your browser's own storage — not on any Vaea server.",
  },
  {
    q: "Can Vaea Chat learn from my conversations over time?",
    a: "Yes, two ways, if you've connected Vaea Brain. It notices durable facts about you and your work as they come up in conversation — no need to say \"remember this\" — and writes them to a note in your own vault you can read or correct anytime. Separately, a review pass (opt-in, off by default) lets it write notes to itself about how it's doing. Both are just files in your own vault, nothing hidden.",
  },
];

// ─── schema ─────────────────────────────────────────────────────────────────

const CHAT_PAGE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "Vaea Chat — AI assistant that acts on your work",
  "url": "https://vaea.base44.app/chat",
  "description": "Vaea Chat reads your Google Workspace (Calendar, Drive, Docs, Sheets, Slides, Tasks, Forms), Gmail, Outlook, ClickUp tasks, and personal notes — then handles things when you ask, with a confirm step before anything changes. Free, local-first.",
  "isPartOf": { "@type": "WebSite", "url": "https://vaea.base44.app/" },
};

const CHAT_FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": FAQS.map(({ q, a }) => ({
    "@type": "Question",
    "name": q,
    "acceptedAnswer": { "@type": "Answer", "text": a },
  })),
};

// ─── page ───────────────────────────────────────────────────────────────────

export default function ChatPage() {
  useDocumentMeta(
    "Vaea Chat — AI that acts on your work, not just talks about it",
    "/chat"
  );
  usePageSchema(CHAT_PAGE_SCHEMA);
  usePageSchema(CHAT_FAQ_SCHEMA);

  return (
    <MarketingLayout>

      {/* ── HERO ── dark band, chat demo front-and-center ── */}
      <section className={`relative overflow-hidden ${darkSectionBg} ${darkText} ${darkTopEdge}`}>
        <StageLight />
        <Grain />
        <div className="relative max-w-5xl mx-auto px-6 pt-20 sm:pt-28 pb-16 sm:pb-20">
          <Reveal className="text-center mb-12">
            <p className={`${eyebrowOnDark} mb-5`}>Vaea Chat</p>
            <h1 className={`${displayXL} max-w-3xl mx-auto`}>
              The AI that already knows your work.
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Not another assistant you have to explain everything to. Vaea Chat reads your
              calendar, inbox, tasks, and notes — and acts on them when you ask.
            </p>
            <div className="mt-8 flex items-center justify-center gap-5 flex-wrap">
              <Link to="/signup" className={pillOnDark}>
                Try it free
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link to="/how-it-works" className={linkOnDark}>
                See how it works
              </Link>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <ChatDemo />
            <p className="text-center text-xs text-muted-foreground/50 mt-4 font-terminal tracking-wide">
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── CONNECTORS ── light section ── */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(55%_60%_at_50%_0%,rgba(70,186,209,0.055),transparent_70%)]" />
        <div className="relative max-w-5xl mx-auto px-6 py-16 sm:py-24">
          <Reveal className="text-center mb-12">
            <p className={`${eyebrowOnLight} mb-3`}>One conversation</p>
            <h2 className={displayL}>Every surface it can read.</h2>
            <p className="mt-4 text-muted-foreground max-w-lg mx-auto">
              Connect once in Settings. After that, asking "what's on my calendar" is the
              whole interaction — no copy-paste, no tab-switching.
            </p>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {CONNECTORS.map(({ icon: Icon, name, body }, i) => (
              <Reveal key={name} delay={i * 60} as="div"
                className={`flex gap-4 p-5 rounded-2xl transition-all duration-300 ${glassTileLight}`}
              >
                <div
                  className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: `${GLOW}14`, border: `1px solid ${GLOW}25` }}
                >
                  <Icon className="w-4 h-4" style={{ color: GLOW }} />
                </div>
                <div>
                  <p className="font-medium text-sm">{name}</p>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── STAGED ACTIONS ── dark band ── */}
      <section className={`relative overflow-hidden ${darkSectionBg} ${darkText} ${darkTopEdge}`}>
        <StageLight />
        <Grain />
        <div className="relative max-w-4xl mx-auto px-6 py-16 sm:py-24">
          <div className="sm:grid sm:grid-cols-2 sm:gap-16 sm:items-center">
            <Reveal>
              <p className={`${eyebrowOnDark} mb-4`}>How it acts</p>
              <h2 className={`${displayL} mb-6`}>It proposes.<br />You approve.</h2>
              <p className="text-muted-foreground leading-relaxed">
                Anything that changes something — creating an event, sending an email,
                deleting a task — goes through a confirm step first. You see exactly
                what's about to happen before it does.
              </p>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                This isn't a safety disclaimer. It's a design decision: an AI tool that acts
                on your accounts should never surprise you.
              </p>
            </Reveal>

            <Reveal delay={100}>
              {/* Real ChatMessageList.jsx pending_action pattern: one reply
                  message describing the proposed action(s) in plain English,
                  then that message's own "Yes, do it" / "Cancel" buttons —
                  not a per-action card UI with individual Confirm/Skip
                  buttons and safe/unsafe color coding, which the app has no
                  such thing of. Same bg-primary header chrome as ChatDemo
                  above, for the same reason: it's what the header actually
                  looks like. */}
              <div className="rounded-2xl overflow-hidden bg-card shadow-[0_0_0_1px_hsl(var(--foreground)/0.06),0_28px_58px_-12px_hsl(200_30%_12%/0.35)]">
                <div className="bg-primary px-4 py-3 flex items-center gap-2 text-primary-foreground">
                  <MessageCircle className="w-4 h-4" />
                  <span className="font-terminal font-semibold text-sm">Vaea Chat</span>
                </div>
                <div className="p-5 font-terminal text-[13px] leading-relaxed bg-background/50">
                  <p className="text-foreground">
                    <span className="text-primary">{">"}</span> Clean up my calendar and file the design QA task.
                  </p>
                  <p className="text-foreground mt-3">
                    I'll add a Focus block tomorrow at 8:30am, create a "Design QA" task in the Launch space, and
                    delete the old 2pm planning session that's no longer on anyone's calendar. Want me to go ahead?
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button type="button" className="text-xs px-2.5 py-1 bg-destructive text-destructive-foreground border border-border rounded-md">
                      Yes, do it
                    </button>
                    <button type="button" className="text-xs px-2.5 py-1 bg-secondary text-secondary-foreground border border-border rounded-md">
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── THREE MODES ── light section ── */}
      <section className="relative">
        <div className="max-w-5xl mx-auto px-6 py-16 sm:py-24">
          <Reveal className="text-center mb-12">
            <p className={`${eyebrowOnLight} mb-3`}>Pick your setup</p>
            <h2 className={displayL}>Three ways to run it.</h2>
            <p className="mt-4 text-muted-foreground max-w-md mx-auto">
              The same Vaea Chat interface, three completely different levels of trust
              and control. Change anytime in Settings.
            </p>
          </Reveal>

          <div className="grid sm:grid-cols-3 gap-5">
            {MODES.map(({ icon: Icon, label, tagline, body, accent }, i) => (
              <Reveal key={label} delay={i * 80} as="div"
                className="p-6 rounded-2xl border border-foreground/[0.07] bg-gradient-to-b from-card to-muted/30 hover:-translate-y-0.5 transition-all duration-300"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: `${accent}16`, border: `1px solid ${accent}30` }}
                >
                  <Icon className="w-4.5 h-4.5" style={{ color: accent }} />
                </div>
                <p className="font-semibold mb-1">{label}</p>
                <p className="text-xs font-terminal tracking-wide mb-3" style={{ color: accent }}>
                  {tagline}
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── light, SEO ── */}
      <section className="border-t border-foreground/[0.06]">
        <div className="max-w-2xl mx-auto px-6 py-16 sm:py-20">
          <Reveal className="mb-10 text-center">
            <h2 className={displayM}>Common questions</h2>
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

      {/* ── CTA ── dark band ── */}
      <section className={`relative overflow-hidden ${darkSectionBg} ${darkText} ${darkTopEdge}`}>
        <StageLight />
        <Grain />
        <div className="relative max-w-3xl mx-auto px-6 py-24 sm:py-32 text-center">
          <Reveal>
            <p className={`${eyebrowOnDark} mb-5`}>Start now</p>
            <h2 className={displayL}>
              Stop managing it yourself.
            </h2>
            <p className="mt-5 text-muted-foreground max-w-md mx-auto leading-relaxed">
              Free. Your data stays on your device by default. No card, no tiers —
              connect your accounts and start talking to your work.
            </p>
            <div className="mt-10 flex items-center justify-center gap-5 flex-wrap">
              <Link to="/signup" className={pillOnDark}>
                Sign up free
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link to="/features" className={linkOnDark}>
                See all features
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

    </MarketingLayout>
  );
}

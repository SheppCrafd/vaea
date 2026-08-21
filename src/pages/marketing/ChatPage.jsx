import { Link } from "react-router-dom";
import {
  ArrowRight, CalendarDays, Mail, Building2, CheckSquare, BookOpen,
  ShieldOff, Key, Check, Plus, Zap, Hash,
} from "lucide-react";
import MarketingLayout from "./MarketingLayout";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import {
  Reveal, StageLight, Grain, Caret, Typed,
  useTimeline, useDocumentMeta, usePageSchema,
} from "./effects";
import {
  darkSectionBg, darkText, darkTopEdge, glassPanel, glassSheen,
  glassTileLight,
  pillOnDark, linkOnDark, eyebrowOnDark, eyebrowOnLight,
  displayXL, displayL, displayM, GLOW,
} from "./theme";

// ─── hero chat demo ────────────────────────────────────────────────────────

// phase 0 → nothing visible
// phase 1 → user message typed in
// phase 2 → "reading" badges + thinking cursor
// phase 3 → Vaea's response typed in
// phase 4 → pause: full exchange visible
// phase 5 → user follow-up typed in
// phase 6 → brief thinking
// phase 7 → staged action card appears
// phase 8 → pause on staged action (restart)
const DEMO_DURATIONS = [350, 1300, 900, 1700, 1500, 1100, 650, 1900, 2500];

const USER_MSG_1 = "What's tomorrow look like? Check my calendar and any ClickUp tasks due.";
const VAEA_REPLY = "You have a 10am Design Review (1hr). Three ClickUp tasks in the Launch space are due today — one went overdue yesterday. Want me to add a 45-min focus block at 8:30 before the call?";
const USER_MSG_2 = "Yes, add it.";

function ServiceBadge({ label }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-terminal tracking-wide"
      style={{ background: `${GLOW}18`, color: GLOW, border: `1px solid ${GLOW}30` }}
    >
      {label}
    </span>
  );
}

function StagedActionCard({ visible }) {
  return (
    <div
      className={`mt-3 rounded-xl border transition-all duration-500 overflow-hidden ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      }`}
      style={{ borderColor: `${GLOW}35`, background: `${GLOW}09` }}
    >
      <div className="flex items-center gap-2 px-4 py-2.5 border-b" style={{ borderColor: `${GLOW}25` }}>
        <Plus className="w-3.5 h-3.5 shrink-0" style={{ color: GLOW }} />
        <span className="font-terminal text-[11px] tracking-widest uppercase" style={{ color: GLOW }}>
          Add calendar event
        </span>
      </div>
      <div className="px-4 py-3">
        <p className="text-sm font-medium text-foreground/90">Focus block</p>
        <p className="text-xs text-muted-foreground mt-0.5">Tomorrow · 8:30 – 9:15am</p>
      </div>
      <div className="px-4 pb-3 flex gap-2">
        <button
          type="button"
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
          style={{ background: GLOW, color: "#0b1a1e" }}
        >
          <Check className="w-3 h-3" />
          Confirm
        </button>
        <button
          type="button"
          className="text-xs px-3 py-1.5 rounded-lg transition-colors text-muted-foreground hover:text-foreground border border-foreground/10 hover:border-foreground/20"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

function ChatDemo() {
  const { ref, step } = useTimeline(DEMO_DURATIONS);

  const showMsg1 = step >= 1;
  const typing1 = step === 1;
  const showBadges = step >= 2;
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
      className={`relative rounded-2xl overflow-hidden w-full max-w-xl mx-auto ${glassPanel}`}
      style={{ minHeight: 320 }}
    >
      <div className={glassSheen} />
      {/* chrome bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-foreground/[0.07]">
        <div className="flex gap-1.5">
          {["bg-foreground/15", "bg-foreground/10", "bg-foreground/10"].map((c, i) => (
            <div key={i} className={`w-2.5 h-2.5 rounded-full ${c}`} />
          ))}
        </div>
        <span className="font-terminal text-[11px] tracking-[0.18em] uppercase text-foreground/35 mx-auto">
          Vaea Chat
        </span>
      </div>

      <div className="px-5 py-4 space-y-4 min-h-[260px]">
        {/* user msg 1 */}
        {showMsg1 && (
          <div className="flex justify-end">
            <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-foreground/[0.07] px-4 py-2.5 text-sm text-foreground/85">
              {typing1
                ? <><Typed text={USER_MSG_1} play cps={55} /><Caret /></>
                : USER_MSG_1}
            </div>
          </div>
        )}

        {/* reading badges + vaea reply */}
        {showBadges && (
          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-terminal text-[10px] text-foreground/30 tracking-wider">reading</span>
              <ServiceBadge label="Calendar" />
              <ServiceBadge label="ClickUp" />
              {showThinking1 && <Caret />}
            </div>

            {showReply && (
              <div className="flex gap-2.5">
                <div
                  className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5 font-terminal text-[10px] font-bold"
                  style={{ background: `${GLOW}22`, color: GLOW }}
                >
                  V
                </div>
                <div className="flex-1 text-sm text-foreground/80 leading-relaxed">
                  {typingReply
                    ? <><Typed text={VAEA_REPLY} play cps={60} /><Caret /></>
                    : VAEA_REPLY}
                </div>
              </div>
            )}
          </div>
        )}

        {/* user follow-up */}
        {showMsg2 && (
          <div className="flex justify-end">
            <div className="max-w-[60%] rounded-2xl rounded-tr-sm bg-foreground/[0.07] px-4 py-2.5 text-sm text-foreground/85">
              {typing2
                ? <><Typed text={USER_MSG_2} play cps={60} /><Caret /></>
                : USER_MSG_2}
            </div>
          </div>
        )}

        {showThinking2 && (
          <div className="flex gap-2.5">
            <div
              className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center font-terminal text-[10px] font-bold"
              style={{ background: `${GLOW}22`, color: GLOW }}
            >
              V
            </div>
            <div className="flex items-center h-6"><Caret /></div>
          </div>
        )}

        {/* staged action card */}
        {(step >= 6) && <StagedActionCard visible={showAction} />}
      </div>
    </div>
  );
}

// ─── connectors section ─────────────────────────────────────────────────────

const CONNECTORS = [
  {
    icon: CalendarDays,
    name: "Google Calendar",
    body: "What's on tomorrow, what's free, add events — with a real Meet link if you want one.",
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
    name: "Vaea Vault",
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
    a: "It keeps your chat history so you can refer back to earlier exchanges. Beyond that, a separate opt-in (off by default) lets it review its own replies and write notes to itself — so it can get better at helping you without making assumptions about you that it hasn't been told to make.",
  },
];

// ─── schema ─────────────────────────────────────────────────────────────────

const CHAT_PAGE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "Vaea Chat — AI assistant that acts on your work",
  "url": "https://vaea.base44.app/chat",
  "description": "Vaea Chat reads your Google Calendar, Gmail, Outlook, ClickUp tasks, and personal notes — then handles things when you ask, with a confirm step before anything changes. Free, local-first.",
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
              This is what it looks like in practice
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
              {/* Static staged action illustration */}
              <div className={`rounded-2xl overflow-hidden ${glassPanel}`}>
                <div className="glassSheen pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/[0.07] to-transparent" />
                <div className="flex items-center gap-2 px-4 py-3 border-b border-foreground/[0.07]">
                  <div className="flex gap-1.5">
                    {["bg-foreground/15","bg-foreground/10","bg-foreground/10"].map((c,i) => (
                      <div key={i} className={`w-2.5 h-2.5 rounded-full ${c}`} />
                    ))}
                  </div>
                  <span className="font-terminal text-[11px] tracking-[0.18em] uppercase text-foreground/35 mx-auto">
                    Proposed action
                  </span>
                </div>
                <div className="p-5 space-y-3">
                  {[
                    { type: "Add calendar event", detail: "Focus block · Tomorrow 8:30am", safe: true },
                    { type: "Create ClickUp task", detail: "Design QA — Launch space", safe: true },
                    { type: "Delete calendar event", detail: "Old planning session · 2pm", safe: false },
                  ].map(({ type, detail, safe }) => (
                    <div key={type} className="rounded-xl border border-foreground/[0.08] overflow-hidden">
                      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-foreground/[0.06]" style={{ background: safe ? `${GLOW}09` : "rgba(239,68,68,0.06)" }}>
                        <span className="font-terminal text-[10px] tracking-widest uppercase" style={{ color: safe ? GLOW : "#f87171" }}>
                          {type}
                        </span>
                      </div>
                      <div className="flex items-center justify-between px-4 py-3">
                        <p className="text-xs text-foreground/70">{detail}</p>
                        <div className="flex gap-1.5">
                          <button className="text-[11px] px-2.5 py-1 rounded-lg font-medium" style={{ background: safe ? GLOW : "#ef4444", color: safe ? "#0b1a1e" : "#fff" }}>
                            Confirm
                          </button>
                          <button className="text-[11px] px-2.5 py-1 rounded-lg border border-foreground/15 text-foreground/50">
                            Skip
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
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

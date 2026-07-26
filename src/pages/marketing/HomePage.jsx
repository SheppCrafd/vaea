import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Bot, Fingerprint, Command, LockKeyhole, ArrowRight, BookOpen, GitBranch, MessageCircle } from "lucide-react";
import MarketingLayout from "./MarketingLayout";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Reveal, GlowOrb } from "./effects";
import {
  darkSectionBg, darkText, glassPanel, glassTileLight,
  pillOnDark, linkOnDark, linkOnLight, eyebrowOnDark, eyebrowOnLight,
} from "./theme";

const FAQS = [
  {
    q: "Do I need to be technical to use this?",
    a: "No. If you can use a chat app, you can use Vaea — type what's on your plate in plain English and it sorts it out. The only technical-ish step is optional (Vaea Vault, for Obsidian users).",
  },
  {
    q: "How long does it actually take to get set up?",
    a: "About a minute. Sign in, pick where your stuff lives (or skip that and just use the browser), and start telling Vaea Chat what's going on. There's no setup wizard standing between you and using it.",
  },
  {
    q: "Is my data actually private?",
    a: "Yes — everything except your chat history with Vaea lives on your own device, not our servers. When chat needs your data to answer, it's sent for that one request only and never stored on our end.",
  },
  {
    q: "What if I don't use Obsidian or take notes anywhere?",
    a: "Then skip Vaea Vault entirely — it's optional. Everything else (projects, tasks, Vaea Chat) works exactly the same without it.",
  },
  {
    q: "Does this cost anything?",
    a: "No pricing plans, no usage limits to worry about. It's free.",
  },
];

const HIGHLIGHTS = [
  {
    icon: Bot,
    title: "Tell it what's piling up — it handles it",
    body: "\"Archive anything I haven't touched in a month\" or \"this project's a mess, sort it out.\" Vaea Chat plans the actual changes and makes them — it doesn't just hand you another to-do about your to-dos.",
  },
  {
    icon: Fingerprint,
    title: "Give it a name and a personality",
    body: "So it feels like something helping you, not one more form to fill out. Set its name, role, and tone yourself, or just chat with it for a minute and let it work out a personality that fits.",
  },
  {
    icon: Command,
    title: "Just start typing",
    body: "When there's a lot going on, you shouldn't have to remember where you filed it. One search box finds it — or does it — instead of you hunting through menus.",
  },
  {
    icon: LockKeyhole,
    title: "Your stuff stays yours",
    body: "No account somewhere else quietly becoming another thing to manage. It all lives on your own device — signing in only unlocks Vaea Chat.",
  },
];

const VAULT_REASONS = [
  {
    icon: BookOpen,
    title: "Your notes, your app",
    body: "Keep writing in Obsidian the way you already do — Vaea Vault just gets to read and write alongside you.",
  },
  {
    icon: GitBranch,
    title: "Backed up on every change",
    body: "Every note is a real commit to your own GitHub account. Nothing to lose, and none of it stored on our servers.",
  },
  {
    icon: MessageCircle,
    title: "The assistant actually uses it",
    body: "Ask what you decided last month and it'll go look, instead of you digging back through old notes yourself.",
  },
];

// The hero's signature visual: a real transcript shape, not a chat-bubble
// mockup — this is what the agent actually does (works through a list, then
// takes real actions, then a plain-language result), rendered in the same
// terminal font/register the app already reserves for real command output
// (see --font-terminal in index.css). Kept in plain English on purpose —
// the real in-app transcript shows the literal function-style tool calls
// (chatActions.js's describeToolCall), but that reads as code, not as
// something a first-time, non-technical visitor should have to parse.
// Glass treatment + the shared cursor-blink keyframe stand in for the
// product photography Apple would use here — there's no physical device to
// shoot, so the app's own real UI, lit like one, is the hero shot instead.
function AgentTranscript() {
  return (
    <div className={`relative w-full max-w-lg mx-auto rounded-2xl overflow-hidden ${glassPanel}`}>
      <div className="flex items-center gap-1.5 px-5 py-3.5 border-b border-white/10">
        <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
        <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
        <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
        <span className="ml-2 font-terminal text-[11px] text-white/40">Vaea Chat</span>
      </div>
      <div className="p-5 font-terminal text-[13px] leading-relaxed">
        <p className="text-white/90">
          <span className="text-[#46BAD1]">{'>'}</span> Marketing's a mess and I don't have time to sort it, can you clean it up
        </p>
        <p className="mt-3 text-white/90">
          Staging that now. Once that goes through, it'll be a lot easier to see what we're actually working on. What's next on the cleanup list? We still have those ownership and department gaps to sort out if you want to keep rolling.
        </p>
        <div className="mt-3 space-y-1 text-white/40">
          <p>plan · reviewing 14 projects across 3 products</p>
          <p>tool call · archive_project("Q1 Newsletter")</p>
          <p>tool call · move_project("Landing Page Copy" → Growth)</p>
          <p>tool call · archive_project("Old Brand Deck")</p>
        </div>
        <p className="mt-3 text-white/90">
          Done.
          <span className="inline-block w-[7px] h-[13px] bg-[#46BAD1]/70 align-middle ml-0.5 chat-cursor-blink" />
        </p>
      </div>
    </div>
  );
}

// The Vault section's own signature visual — deliberately not a repeat of
// AgentTranscript's terminal chrome above: a file card (path + note content,
// a [[wikilink]] rendered the way Obsidian would) instead of a command
// transcript, so the two focal points read as related but distinct. The
// commit strip at the bottom does real work, not just decoration — it's the
// one visual that makes "backed up to your own GitHub, not stored by us"
// land at a glance instead of requiring the reader to trust the copy alone.
function VaultNoteMock() {
  return (
    <div className={`relative w-full max-w-lg mx-auto rounded-2xl overflow-hidden ${glassPanel}`}>
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-white/10">
        <BookOpen className="w-3.5 h-3.5 text-white/40" />
        <span className="font-terminal text-[11px] text-white/40">Daily/2026-07-24.md</span>
      </div>
      <div className="p-5 font-terminal text-[13px] leading-relaxed text-white/90 text-left">
        <p># Today</p>
        <p className="mt-2">Sorted Marketing, archived two stale projects.</p>
        <p className="mt-2">
          Decided to move launch prep under <span className="text-[#46BAD1]">[[Growth]]</span> instead of leaving it standalone.
        </p>
      </div>
      <div className="flex items-center gap-1.5 px-5 py-3 border-t border-white/10 bg-white/[0.02]">
        <GitBranch className="w-3 h-3 text-[#46BAD1] shrink-0" />
        <span className="font-terminal text-[11px] text-white/40">Committed to your GitHub — not ours</span>
      </div>
    </div>
  );
}

export default function HomePage() {
  useEffect(() => {
    document.title = "Vaea — for when you have too much going on";
  }, []);

  return (
    <MarketingLayout>
      {/* Hero — the thesis, styled like a product page's opening screen */}
      <div className={`relative overflow-hidden ${darkSectionBg} ${darkText}`}>
        <GlowOrb className="w-[640px] h-[640px] -top-72 left-1/2 -translate-x-1/2" />
        <div className="relative max-w-4xl mx-auto px-6 pt-28 sm:pt-36 text-center">
          <Reveal>
            <p className={`${eyebrowOnDark} mb-5`}>For when it's all a bit too much</p>
            <h1 className="font-heading text-5xl sm:text-6xl md:text-7xl font-semibold tracking-tight leading-[1.05]">
              There's a lot going on.
              <br className="hidden sm:block" /> Let's make it manageable.
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-white/60 max-w-xl mx-auto leading-relaxed">
              Vaea gives every project, task, and stray "I should really deal with that"
              one real place to live — and an AI that actually files, sorts, and cleans
              it up when you ask, instead of one more list you have to maintain yourself.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-5">
              <Link to="/login" className={pillOnDark}>
                Get started
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link to="/how-it-works" className={linkOnDark}>
                See how it works
              </Link>
            </div>
            <p className="mt-5 text-xs text-white/35">Free. Data stays on your device either way.</p>
          </Reveal>
        </div>
        <Reveal delay={150} className="relative px-6 pt-16 pb-24 sm:pt-20 sm:pb-32">
          <AgentTranscript />
        </Reveal>
      </div>

      {/* Vaea Chat — product section, light */}
      <div className="relative bg-background">
        <div className="max-w-5xl mx-auto px-6 py-24 sm:py-32">
          <Reveal className="text-center max-w-2xl mx-auto">
            <p className={`${eyebrowOnLight} mb-4`}>Vaea Chat</p>
            <h2 className="font-heading text-3xl sm:text-4xl font-semibold tracking-tight leading-tight">
              What that actually looks like
            </h2>
            <Link to="/features" className={`mt-5 inline-flex items-center gap-1.5 ${linkOnLight}`}>
              See all features
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </Reveal>

          <Reveal delay={150} className="mt-16 grid sm:grid-cols-2 gap-5">
            {HIGHLIGHTS.map(({ icon: Icon, title, body }) => (
              <div key={title} className={`flex gap-4 p-5 rounded-2xl ${glassTileLight}`}>
                <div className="shrink-0 w-10 h-10 rounded-xl bg-background border border-border/70 flex items-center justify-center shadow-sm">
                  <Icon className="w-4 h-4 text-foreground" />
                </div>
                <div>
                  <h3 className="font-medium">{title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{body}</p>
                </div>
              </div>
            ))}
          </Reveal>
        </div>
      </div>

      {/* Vaea Vault — product section, dark, bookends the hero's treatment */}
      <div className={`relative overflow-hidden ${darkSectionBg} ${darkText}`}>
        <GlowOrb className="w-[560px] h-[560px] top-1/3 -right-52" />
        <div className="relative max-w-4xl mx-auto px-6 py-24 sm:py-32 text-center">
          <Reveal>
            <p className={`${eyebrowOnDark} mb-4`}>Vaea Vault · optional</p>
            <h2 className="font-heading text-3xl sm:text-4xl font-semibold tracking-tight leading-tight max-w-xl mx-auto">
              Already keeping notes somewhere? Bring them in too.
            </h2>
            <p className="mt-4 text-white/60 max-w-lg mx-auto leading-relaxed">
              Vaea Vault connects your own Obsidian notes — decisions, things you've learned, a running log of
              what happened and why — right into the assistant. It reads them for context, and writes to them
              when you ask.
            </p>
            <Link to="/features" className={`mt-6 inline-flex items-center gap-1.5 ${linkOnDark}`}>
              See how it connects
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </Reveal>

          <Reveal delay={150} className="mt-14">
            <VaultNoteMock />
          </Reveal>

          <Reveal delay={250} className="mt-14 grid sm:grid-cols-3 gap-8 text-left max-w-3xl mx-auto">
            {VAULT_REASONS.map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex gap-3">
                <div className="shrink-0 w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                  <Icon className="w-3.5 h-3.5 text-white/80" />
                </div>
                <div>
                  <h3 className="text-sm font-medium">{title}</h3>
                  <p className="mt-0.5 text-sm text-white/50">{body}</p>
                </div>
              </div>
            ))}
          </Reveal>
        </div>
      </div>

      {/* FAQ — light, restrained */}
      <div className="relative bg-background">
        <div className="max-w-2xl mx-auto px-6 py-24 sm:py-28">
          <Reveal className="text-center">
            <p className={`${eyebrowOnLight} mb-4`}>FAQ</p>
            <h2 className="font-heading text-3xl sm:text-4xl font-semibold tracking-tight">
              Before you're sold, the honest questions
            </h2>
          </Reveal>
          <Reveal delay={150} className="mt-10 rounded-2xl p-2 sm:p-4 bg-gradient-to-b from-card to-muted/50 border border-border/70 shadow-sm">
            <Accordion type="single" collapsible>
              {FAQS.map(({ q, a }) => (
                <AccordionItem key={q} value={q}>
                  <AccordionTrigger className="text-base px-2">{q}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground px-2">{a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Reveal>
        </div>
      </div>

      {/* Final CTA — dark, bookends the hero */}
      <div className={`relative overflow-hidden ${darkSectionBg} ${darkText}`}>
        <GlowOrb className="w-[520px] h-[520px] -bottom-56 left-1/2 -translate-x-1/2" />
        <div className="relative max-w-3xl mx-auto px-6 py-24 sm:py-32 text-center">
          <Reveal>
            <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight">
              Ready to get it out of your head?
            </h2>
            <div className="mt-8">
              <Link to="/login" className={pillOnDark}>
                Get started
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </Reveal>
        </div>
      </div>
    </MarketingLayout>
  );
}

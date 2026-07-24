import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Bot, Fingerprint, Command, LockKeyhole, ArrowRight, BookOpen, GitBranch, MessageCircle } from "lucide-react";
import MarketingLayout from "./MarketingLayout";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";

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
// Static, not an animation loop — it reads once, correctly, rather than
// looping like a marketing gif.
function AgentTranscript() {
  return (
    <div className="w-full max-w-md mx-auto rounded-xl border border-border bg-card shadow-lg overflow-hidden">
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-border">
        <span className="w-2.5 h-2.5 rounded-full bg-foreground/15" />
        <span className="w-2.5 h-2.5 rounded-full bg-foreground/15" />
        <span className="w-2.5 h-2.5 rounded-full bg-foreground/15" />
        <span className="ml-2 font-terminal text-[11px] text-muted-foreground">Vaea Chat</span>
      </div>
      <div className="p-4 font-terminal text-[13px] leading-relaxed">
        <p className="text-foreground">
          <span className="text-primary">{'>'}</span> Marketing's a mess and I don't have time to sort it, can you clean it up
        </p>
        <div className="mt-3 space-y-1 text-muted-foreground">
          <p>Looking through all 14 things in Marketing...</p>
          <p>Archived "Q1 Newsletter" — nobody's touched it in 6 weeks</p>
          <p>Moved "Landing Page Copy" over to Growth, where it belongs</p>
          <p>Archived "Old Brand Deck"</p>
        </div>
        <p className="mt-3 text-foreground">
          Archived 2, moved 1. Marketing's down to 11 active projects —
          want the same pass on Ops?
          <span className="inline-block w-[7px] h-[13px] bg-primary/70 align-middle ml-0.5" />
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
    <div className="w-full max-w-md mx-auto rounded-xl border border-border bg-card shadow-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="font-terminal text-[11px] text-muted-foreground">Daily/2026-07-24.md</span>
      </div>
      <div className="p-4 font-terminal text-[13px] leading-relaxed text-foreground">
        <p># Today</p>
        <p className="mt-2">Sorted Marketing, archived two stale projects.</p>
        <p className="mt-2">
          Decided to move launch prep under <span className="text-primary">[[Growth]]</span> instead of leaving it standalone.
        </p>
      </div>
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-t border-border bg-muted/40">
        <GitBranch className="w-3 h-3 text-primary shrink-0" />
        <span className="font-terminal text-[11px] text-muted-foreground">Committed to your GitHub — not ours</span>
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
      <div className="max-w-6xl mx-auto px-6 pt-16 sm:pt-24">
        <div className="grid md:grid-cols-[1.15fr_1fr] gap-12 md:gap-16 items-center pb-16 sm:pb-24">
          <div>
            <p className="font-terminal text-xs uppercase tracking-widest text-primary mb-4">
              For when it's all a bit too much
            </p>
            <h1 className="font-heading text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.1]">
              There's a lot going on. Let's make it manageable.
            </h1>
            <p className="mt-5 text-lg text-muted-foreground max-w-md">
              Vaea gives every project, task, and stray "I should really deal with that"
              one real place to live — and an AI that actually files, sorts, and cleans
              it up when you ask, instead of one more list you have to maintain yourself.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-sm px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md transition-colors"
              >
                Get started
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                to="/how-it-works"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                See how it works
              </Link>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">Free. Data stays on your device either way.</p>
          </div>

          <AgentTranscript />
        </div>
      </div>

      <div className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-16 sm:py-20">
          <div className="flex items-end justify-between gap-6 flex-wrap">
            <h2 className="font-heading text-2xl font-semibold tracking-tight">What that actually looks like</h2>
            <Link to="/features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              See all features →
            </Link>
          </div>
          <div className="mt-10 grid sm:grid-cols-2 gap-8">
            {HIGHLIGHTS.map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex gap-4">
                <div className="shrink-0 w-9 h-9 rounded-lg border border-border bg-card flex items-center justify-center">
                  <Icon className="w-4 h-4 text-foreground" />
                </div>
                <div>
                  <h3 className="font-medium">{title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-border bg-muted/30">
        <div className="max-w-6xl mx-auto px-6 py-16 sm:py-20">
          <div className="grid md:grid-cols-[1fr_1.15fr] gap-12 md:gap-16 items-center">
            <VaultNoteMock />
            <div>
              <p className="font-terminal text-xs uppercase tracking-widest text-primary mb-4">
                Vaea Vault · optional
              </p>
              <h2 className="font-heading text-2xl sm:text-3xl font-semibold tracking-tight leading-tight">
                Already keeping notes somewhere? Bring them in too.
              </h2>
              <p className="mt-4 text-muted-foreground max-w-md">
                Vaea Vault connects your own Obsidian notes — decisions, things you've learned, a running log of
                what happened and why — right into the assistant. It reads them for context, and writes to them
                when you ask.
              </p>
              <div className="mt-8 flex flex-col gap-5">
                {VAULT_REASONS.map(({ icon: Icon, title, body }) => (
                  <div key={title} className="flex gap-3">
                    <div className="shrink-0 w-8 h-8 rounded-lg border border-border bg-card flex items-center justify-center">
                      <Icon className="w-3.5 h-3.5 text-foreground" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium">{title}</h3>
                      <p className="mt-0.5 text-sm text-muted-foreground">{body}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Link
                to="/features"
                className="mt-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                See how it connects
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="max-w-2xl mx-auto px-6 py-16 sm:py-20">
          <h2 className="font-heading text-2xl sm:text-3xl font-semibold tracking-tight text-center">
            Before you're sold, the honest questions
          </h2>
          <Accordion type="single" collapsible className="mt-8">
            {FAQS.map(({ q, a }) => (
              <AccordionItem key={q} value={q}>
                <AccordionTrigger className="text-base">{q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-16 sm:py-20 text-center">
          <h2 className="font-heading text-2xl sm:text-3xl font-semibold tracking-tight">
            Ready to get it out of your head?
          </h2>
          <div className="mt-6">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-sm px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md transition-colors"
            >
              Get started
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </MarketingLayout>
  );
}

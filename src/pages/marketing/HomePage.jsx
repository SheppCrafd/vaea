import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, GitBranch, MessageCircle, HardDrive, LockKeyhole, Sparkles } from "lucide-react";
import MarketingLayout from "./MarketingLayout";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Reveal, StageLight, Grain, useTimeline } from "./effects";
import {
  ChatFilm, CHAT_PHASES, CHAT_CAPTIONS,
  PaletteFilm, PALETTE_PHASES,
  NestFilm, NEST_PHASES,
  VaultFilm, VAULT_PHASES,
  IdentityFilm, IDENTITY_PHASES,
} from "./demos";
import {
  darkSectionBg, darkText, darkTopEdge, lightStage,
  pillOnDark, linkOnDark, linkOnLight, eyebrowOnDark, eyebrowOnLight,
  displayXL, displayL, displayM,
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

const QUIET_TRUTHS = [
  { icon: HardDrive, title: "It lives on your device", body: "Real files in a folder you picked — not an account somewhere else." },
  { icon: LockKeyhole, title: "Signing in only unlocks chat", body: "Organizing, editing, importing all work whether you're signed in or not." },
  { icon: Sparkles, title: "Free, with no plans to compare", body: "No tiers, no usage limits to keep an eye on." },
];

// A dark full-bleed band. The gradient, the directional stage light, and the
// grain are one unit — used together everywhere so every dark section on the
// site is lit the same way.
function DarkBand({ children, light = true, className = "" }) {
  return (
    <section className={`relative overflow-hidden ${darkSectionBg} ${darkText} ${darkTopEdge} ${className}`}>
      {light && <StageLight />}
      <Grain />
      <div className="relative">{children}</div>
    </section>
  );
}

// The hero. Its film and the three captions beneath it run off one clock, so
// each caption lights up exactly while the frame it describes is on screen —
// the page teaches the product by narrating a real session as it plays.
function HeroSection() {
  const { ref, step } = useTimeline(CHAT_PHASES);

  return (
    <DarkBand>
      <div ref={ref} className="max-w-6xl mx-auto px-6 pt-28 sm:pt-36 pb-24 sm:pb-32">
        <Reveal className="text-center max-w-3xl mx-auto">
          <p className={`${eyebrowOnDark} mb-5`}>For when it&apos;s all a bit too much</p>
          <h1 className={displayXL}>
            From overwhelmed
            <br className="hidden sm:block" /> to organized.
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-white/60 max-w-xl mx-auto leading-relaxed">
            Vaea gives every project, task, and stray &quot;I should really deal with that&quot;
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

        <Reveal delay={150} className="mt-16 sm:mt-20 max-w-3xl mx-auto">
          <ChatFilm step={step} />
        </Reveal>

        <div className="mt-12 grid sm:grid-cols-3 gap-8 max-w-4xl mx-auto text-left">
          {CHAT_CAPTIONS.map(({ title, body, from, to }) => {
            const active = step >= from && step <= to;
            return (
              <div
                key={title}
                className={`border-l pl-4 transition-all duration-300 ${
                  active ? "border-[#46BAD1]/70" : "border-white/10"
                }`}
              >
                <h3 className={`text-sm font-medium transition-colors duration-300 ${active ? "text-white" : "text-white/45"}`}>
                  {title}
                </h3>
                <p className={`mt-1 text-sm transition-colors duration-300 ${active ? "text-white/65" : "text-white/30"}`}>
                  {body}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </DarkBand>
  );
}

function PaletteSection() {
  const { ref, step } = useTimeline(PALETTE_PHASES);

  return (
    <section className="relative bg-background border-t border-border/60">
      <div ref={ref} className="max-w-6xl mx-auto px-6 py-24 sm:py-32">
        <div className="grid lg:grid-cols-[0.85fr_1.15fr] gap-12 lg:gap-16 items-center">
          <Reveal>
            <p className={`${eyebrowOnLight} mb-4`}>Find anything</p>
            <h2 className={displayL}>Just start typing.</h2>
            <p className="mt-5 text-muted-foreground leading-relaxed max-w-md">
              When there&apos;s a lot going on, you shouldn&apos;t have to remember where you filed
              something. One box finds it — or does it — instead of you clicking through
              menu after menu to get there.
            </p>
            <Link to="/features" className={`mt-6 inline-flex items-center gap-1.5 ${linkOnLight}`}>
              See all features
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </Reveal>

          <Reveal delay={120} className={`${lightStage} p-6 sm:p-12`}>
            <PaletteFilm step={step} />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function NestSection() {
  const { ref, step } = useTimeline(NEST_PHASES);

  return (
    <section className="relative bg-muted/25 border-t border-border/60">
      <div ref={ref} className="max-w-6xl mx-auto px-6 py-24 sm:py-32">
        <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-12 lg:gap-16 items-center">
          <Reveal delay={120} className={`${lightStage} p-6 sm:p-12 lg:order-1 order-2`}>
            <NestFilm step={step} />
          </Reveal>

          <Reveal className="lg:order-2 order-1">
            <p className={`${eyebrowOnLight} mb-4`}>Organize</p>
            <h2 className={displayL}>Everything nests inside something bigger.</h2>
            <p className="mt-5 text-muted-foreground leading-relaxed max-w-md">
              A big area of your life or work, broken down into smaller pieces, broken down
              into the actual tasks — nothing just floating on its own with no home. Open
              something and what&apos;s inside it opens right there with it, so you never lose
              your place.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// Deliberately unlit — no StageLight here, so this band sits visibly dimmer
// than the hero and the vault around it. The light app window floating on it
// is the only thing that catches light, which is the whole point of the
// section: the thing you're configuring is the assistant itself.
function IdentitySection() {
  const { ref, step } = useTimeline(IDENTITY_PHASES);

  return (
    <DarkBand light={false}>
      <div ref={ref} className="max-w-6xl mx-auto px-6 py-24 sm:py-32">
        <div className="grid lg:grid-cols-[0.85fr_1.15fr] gap-12 lg:gap-16 items-center">
          <Reveal>
            <p className={`${eyebrowOnDark} mb-4`}>Make it yours</p>
            <h2 className={displayL}>Give it a name and a personality.</h2>
            <p className="mt-5 text-white/60 leading-relaxed max-w-md">
              So it feels like something helping you, not one more form to fill out. Set its
              name, role, and tone yourself — or just chat with it for a minute and let it
              work out a personality that fits.
            </p>
          </Reveal>

          <Reveal delay={120}>
            <IdentityFilm step={step} />
          </Reveal>
        </div>
      </div>
    </DarkBand>
  );
}

function VaultSection() {
  const { ref, step } = useTimeline(VAULT_PHASES);

  return (
    <DarkBand>
      <div ref={ref} className="max-w-4xl mx-auto px-6 py-24 sm:py-32 text-center">
        <Reveal>
          <p className={`${eyebrowOnDark} mb-4`}>Vaea Vault · optional</p>
          <h2 className={`${displayL} max-w-2xl mx-auto`}>
            Already keeping notes somewhere? Bring them in too.
          </h2>
          <p className="mt-5 text-white/60 max-w-lg mx-auto leading-relaxed">
            Vaea Vault connects your own Obsidian notes — decisions, things you&apos;ve learned, a
            running log of what happened and why — right into the assistant. It reads them for
            context, and writes to them when you ask.
          </p>
        </Reveal>

        <Reveal delay={120} className="mt-14 max-w-2xl mx-auto">
          <VaultFilm step={step} />
        </Reveal>

        <Reveal delay={200} className="mt-14 grid sm:grid-cols-3 gap-8 text-left max-w-3xl mx-auto">
          {VAULT_REASONS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex gap-3">
              <div className="shrink-0 w-8 h-8 rounded-lg bg-white/[0.06] border border-white/10 flex items-center justify-center">
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
    </DarkBand>
  );
}

export default function HomePage() {
  useEffect(() => {
    document.title = "Vaea — from overwhelmed to organized";
  }, []);

  return (
    <MarketingLayout>
      <HeroSection />
      <PaletteSection />
      <NestSection />
      <IdentitySection />
      <VaultSection />

      <section className="relative bg-background border-t border-border/60">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <Reveal className="grid sm:grid-cols-3 gap-8">
            {QUIET_TRUTHS.map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex gap-3">
                <div className="shrink-0 w-8 h-8 rounded-lg bg-gradient-to-b from-card to-muted/60 border border-border/70 shadow-sm flex items-center justify-center">
                  <Icon className="w-3.5 h-3.5 text-foreground" />
                </div>
                <div>
                  <h3 className="text-sm font-medium">{title}</h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">{body}</p>
                </div>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      <section className="relative bg-muted/25 border-t border-border/60">
        <div className="max-w-2xl mx-auto px-6 py-24 sm:py-28">
          <Reveal className="text-center">
            <p className={`${eyebrowOnLight} mb-4`}>FAQ</p>
            <h2 className={displayM}>Before you&apos;re sold, the honest questions</h2>
          </Reveal>
          <Reveal delay={120} className={`mt-10 ${lightStage} p-2 sm:p-5`}>
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
      </section>

      <DarkBand>
        <div className="max-w-3xl mx-auto px-6 py-24 sm:py-32 text-center">
          <Reveal>
            <h2 className={displayL}>Ready to get it out of your head?</h2>
            <div className="mt-8">
              <Link to="/login" className={pillOnDark}>
                Get started
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </Reveal>
        </div>
      </DarkBand>
    </MarketingLayout>
  );
}

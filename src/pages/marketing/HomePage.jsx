import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, GitBranch, MessageCircle, HardDrive, LockKeyhole, Sparkles, ToggleLeft } from "lucide-react";
import MarketingLayout from "./MarketingLayout";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Reveal, StageLight, Grain, useTimeline, useDocumentMeta } from "./effects";
import {
  ChatFilm, CHAT_PHASES, CHAT_CAPTIONS,
  PaletteFilm, PALETTE_PHASES,
  NestFilm, NEST_PHASES,
  VaultFilm, VAULT_PHASES,
  SelfNoteFilm, SELFNOTE_PHASES,
  IdentityFilm, IDENTITY_PHASES,
} from "./demos";
import {
  darkSectionBg, darkText, darkTopEdge, lightStage, lightWash, glowTop,
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
    a: "About a minute. Pick where your stuff lives — a folder on your device, or the cloud if you'd rather sign in and have it follow you everywhere — and start telling Vaea Chat what's going on. There's no setup wizard standing between you and using it.",
  },
  {
    q: "Is my data actually private?",
    a: "By default, yes — everything except your chat history with Vaea lives on your own device, not our servers. You can opt into cloud storage instead (tied to your account, so it follows you across devices) — that's the one case where your project data itself sits on our servers, and it's always your choice, never the default. Either way, when chat needs your data to answer, it's sent for that one request only and never stored on our end.",
  },
  {
    q: "What if I don't use Obsidian or take notes anywhere?",
    a: "Then skip Vaea Vault entirely — it's optional. Everything else (projects, tasks, Vaea Chat) works exactly the same without it.",
  },
  {
    q: "Does this cost anything?",
    a: "No pricing plans, no usage limits to worry about. It's free.",
  },
  {
    q: "Does it get to know ME, not just my data?",
    a: "Only if you say so, separately. By default it only reviews its own replies to get better at helping you — never your tone, habits, or personality. A second, explicit opt-in (off unless you turn it on) lets it also notice real patterns in how you work, and even that's enforced in code, not just promised in a prompt. We looked hard at framing this as the assistant developing genuine self-awareness — a real sense of itself — and decided that's not something an AI can honestly claim, so we didn't. What you get instead is real: a plain file it keeps about itself, that you can open and read.",
  },
];

const VAULT_REASONS = [
  {
    icon: BookOpen,
    title: "Still just markdown files",
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

const SELFNOTE_REASONS = [
  {
    icon: BookOpen,
    title: "A real file, not a black box",
    body: "Vaea Self.md lives right in your connected vault — open it, edit a line, or delete the whole thing whenever you want.",
  },
  {
    icon: ToggleLeft,
    title: "Off by default, on two separate switches",
    body: "Reviewing its own replies is one opt-in. Noticing anything about how you work is a second, separate one — off unless you turn it on.",
  },
];

const QUIET_TRUTHS = [
  { icon: HardDrive, title: "Your device by default", body: "Real files in a folder you picked — cloud storage is there if you'd rather sign in and use that instead." },
  { icon: LockKeyhole, title: "Signing in unlocks chat and cloud", body: "Organizing, editing, and importing all work whether you're signed in or not." },
  { icon: Sparkles, title: "Free, with no plans to compare", body: "No tiers, no usage limits to keep an eye on." },
];

// A full-bleed band. The gradient, the directional stage light, and the
// grain are one unit — used together everywhere so every band on the site
// is lit the same way. darkSectionBg is theme-aware (see theme.js/index.css'
// --band-* tokens), so a band handing off to the next section already lands
// close enough in tone that no extra seam treatment is needed.
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
          <p className={`${eyebrowOnDark} mb-5`}>Watch it actually happen</p>
          <h1 className={displayXL}>
            From overwhelmed
            <br className="hidden sm:block" /> to organized.
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Vaea gives every project, task, and stray &quot;I should really deal with that&quot;
            one real place to live — and an AI that actually files, sorts, and cleans
            it up when you ask, instead of one more list you have to maintain yourself.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-5">
            <Link to="/signup" className={pillOnDark}>
              Sign up free
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link to="/how-it-works" className={linkOnDark}>
              See how it works
            </Link>
          </div>
          <p className="mt-5 text-xs text-foreground/35">Free. Your data stays on your device unless you choose otherwise.</p>
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
                  active ? "border-[#46BAD1]/70" : "border-foreground/10"
                }`}
              >
                {/* A <p>, not a heading — these are captions timed to the
                    demo film beside them, not sub-sections of anything, and
                    an <h3> here skipped straight past the page's first real
                    <h2> (the next section down), breaking the heading
                    outline a screen reader user navigates by. */}
                <p className={`text-sm font-medium transition-colors duration-300 ${active ? "text-foreground" : "text-foreground/45"}`}>
                  {title}
                </p>
                <p className={`mt-1 text-sm transition-colors duration-300 ${active ? "text-foreground/65" : "text-foreground/30"}`}>
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
    <section className="relative bg-background">
      <div aria-hidden="true" className={glowTop} />
      <div ref={ref} className="relative max-w-6xl mx-auto px-6 py-24 sm:py-32">
        <div className="grid lg:grid-cols-[0.85fr_1.15fr] gap-12 lg:gap-16 items-center">
          <Reveal>
            <p className={`${eyebrowOnLight} mb-4`}>Find it, or just do it</p>
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
    <section className={`relative ${lightWash}`}>
      <div ref={ref} className="max-w-6xl mx-auto px-6 py-24 sm:py-32">
        <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-12 lg:gap-16 items-center">
          <Reveal delay={120} className={`${lightStage} p-6 sm:p-12 lg:order-1 order-2`}>
            <NestFilm step={step} />
          </Reveal>

          <Reveal className="lg:order-2 order-1">
            <p className={`${eyebrowOnLight} mb-4`}>Area → Product → Project → Task</p>
            <h2 className={displayL}>Everything nests inside something bigger.</h2>
            <p className="mt-5 text-muted-foreground leading-relaxed max-w-md">
              A big area of your life or work, broken down into smaller pieces, broken down
              into the actual tasks — nothing just floating on its own with no home. Open
              something and what&apos;s inside it opens right there with it, so you never lose
              your place.
            </p>
            <p className="mt-4 text-muted-foreground leading-relaxed max-w-md">
              Freelancing or juggling a few clients at once? It&apos;s the same ladder: Area is
              your practice, Product is each client, Project is each engagement or deliverable
              underneath them — no separate system to invent for it.
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
            <p className={`${eyebrowOnDark} mb-4`}>Watch the header change</p>
            <h2 className={displayL}>A name, a tone, a standing instruction it actually follows.</h2>
            <p className="mt-5 text-muted-foreground leading-relaxed max-w-md">
              Set its name, role, and tone yourself — or just chat with it for a minute and let
              it work out a personality that fits. Correct it once, directly, and that becomes a
              standing instruction it keeps from then on.
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
          <p className="mt-5 text-muted-foreground max-w-lg mx-auto leading-relaxed">
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
              <div className="shrink-0 w-8 h-8 rounded-lg bg-foreground/[0.06] border border-foreground/10 flex items-center justify-center">
                <Icon className="w-3.5 h-3.5 text-foreground/80" />
              </div>
              <div>
                <h3 className="text-sm font-medium">{title}</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">{body}</p>
              </div>
            </div>
          ))}
        </Reveal>
      </div>
    </DarkBand>
  );
}

// A light band, deliberately — Identity and Vault above are both dark, so
// this closes that run rather than extending it. Centered like VaultSection,
// since this earned its own named artifact (Vaea Self.md) the same way the
// vault did, not just a feature bullet buried in a list.
function CheckInSection() {
  const { ref, step } = useTimeline(SELFNOTE_PHASES);

  return (
    <section className={`relative ${lightWash}`}>
      <div ref={ref} className="max-w-4xl mx-auto px-6 py-24 sm:py-32 text-center">
        <Reveal>
          <p className={`${eyebrowOnLight} mb-4`}>Checks in on its own · opt-in</p>
          <h2 className={`${displayL} max-w-2xl mx-auto`}>
            It keeps a file on itself — and shows you exactly what&apos;s in it.
          </h2>
          <p className="mt-5 text-muted-foreground max-w-lg mx-auto leading-relaxed">
            Roughly once a day, it looks back at its own replies from that day and writes down
            what it&apos;d do differently — not a vague promise to get smarter, a specific line in
            a file you can read. It never touches anything about how <em>you</em> talk or work
            unless you flip a second, separate switch — off by default.
          </p>
        </Reveal>

        <Reveal delay={120} className="mt-14 max-w-2xl mx-auto">
          <SelfNoteFilm step={step} />
        </Reveal>

        <Reveal delay={200} className="mt-14 grid sm:grid-cols-2 gap-8 text-left max-w-2xl mx-auto">
          {SELFNOTE_REASONS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex gap-3">
              <div className="shrink-0 w-8 h-8 rounded-lg bg-gradient-to-b from-card to-muted/60 shadow-[0_0_0_1px_hsl(var(--foreground)/0.05),0_1px_2px_0_hsl(200_30%_12%/0.06)] dark:shadow-[0_0_0_1px_hsl(var(--foreground)/0.08),0_0_10px_-2px_hsl(var(--foreground)/0.14)] flex items-center justify-center">
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
  );
}

export default function HomePage() {
  useDocumentMeta("Vaea — from overwhelmed to organized", "/");

  return (
    <MarketingLayout>
      <HeroSection />
      <PaletteSection />
      <NestSection />
      <IdentitySection />
      <VaultSection />
      <CheckInSection />

      <section className="relative bg-background">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <Reveal className="grid sm:grid-cols-3 gap-8">
            {QUIET_TRUTHS.map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex gap-3">
                <div className="shrink-0 w-8 h-8 rounded-lg bg-gradient-to-b from-card to-muted/60 shadow-[0_0_0_1px_hsl(var(--foreground)/0.05),0_1px_2px_0_hsl(200_30%_12%/0.06)] dark:shadow-[0_0_0_1px_hsl(var(--foreground)/0.08),0_0_10px_-2px_hsl(var(--foreground)/0.14)] flex items-center justify-center">
                  <Icon className="w-3.5 h-3.5 text-foreground" />
                </div>
                <div>
                  {/* <p>, not a heading — this row has no section heading of
                      its own to nest under (deliberately quiet by design),
                      so an <h3> here would be a heading with no real parent
                      in the outline, same problem as the hero captions
                      above. */}
                  <p className="text-sm font-medium">{title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{body}</p>
                </div>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      <section className={`relative ${lightWash}`}>
        <div className="max-w-2xl mx-auto px-6 py-24 sm:py-28">
          <Reveal className="text-center">
            <p className={`${eyebrowOnLight} mb-4`}>FAQ</p>
            <h2 className={displayM}>Before you&apos;re sold, the honest questions</h2>
          </Reveal>
          <Reveal delay={120} className={`mt-10 ${lightStage} p-2 sm:p-5`}>
            <Accordion type="single" collapsible>
              {FAQS.map(({ q, a }) => (
                <AccordionItem key={q} value={q} className="border-foreground/[0.07] last:border-b-0">
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
            <h2 className={displayL}>Say what&apos;s piling up. Vaea sorts it.</h2>
            <div className="mt-8">
              <Link to="/signup" className={pillOnDark}>
                Sign up free
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </Reveal>
        </div>
      </DarkBand>
    </MarketingLayout>
  );
}

import { Link } from "react-router-dom";
import { ArrowRight, Workflow, MousePointerClick, Smartphone, MessageCircle, Bell } from "lucide-react";
import MarketingLayout from "./MarketingLayout";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Reveal, StageLight, Grain, useTimeline, useDocumentMeta, usePageSchema } from "./effects";
import {
  darkSectionBg, darkText, darkTopEdge, glassPanel, glassSheen, glassTileLight,
  pillOnDark, linkOnDark, eyebrowOnDark, eyebrowOnLight,
  displayXL, displayL, displayM, GLOW,
} from "./theme";

// ─── canvas demo ─────────────────────────────────────────────────────────────
// Illustrates WorkflowCanvasPage.jsx's real behavior honestly: sticky-note
// cards appearing on an open canvas, draggable, nothing more claimed — no
// automation-engine visuals, since that isn't wired up yet (see that file's
// own header comment).

const CANVAS_PHASES = [500, 700, 700, 900, 1200];

const CARDS = [
  { id: "a", label: "Client sends brief", x: 8, y: 20 },
  { id: "b", label: "Draft outline", x: 40, y: 8 },
  { id: "c", label: "Review call", x: 40, y: 55 },
  { id: "d", label: "Send for approval", x: 74, y: 32 },
];

function CanvasDemo() {
  const { ref, step } = useTimeline(CANVAS_PHASES);
  return (
    <div ref={ref} className={`relative w-full max-w-xl mx-auto rounded-2xl overflow-hidden ${glassPanel}`}>
      <div className={glassSheen} />
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-foreground/[0.08]">
        <Workflow className="w-3.5 h-3.5 text-foreground/35" />
        <span className="font-terminal text-[11px] text-foreground/35 flex-1 min-w-0 truncate">Workflows</span>
        {step >= 4 && (
          <span className="font-terminal text-[10px]" style={{ color: GLOW }}>
            saved to this device
          </span>
        )}
      </div>
      <div className="relative min-h-[220px]">
        {CARDS.map((card, i) => (
          <div
            key={card.id}
            className={`absolute w-32 rounded-xl px-3 py-2.5 text-[11px] leading-snug transition-all duration-500 ${glassTileLight} ${
              step >= i + 1 ? "opacity-100 scale-100" : "opacity-0 scale-90"
            }`}
            style={{ left: `${card.x}%`, top: `${card.y}%` }}
          >
            {card.label}
          </div>
        ))}
        {step >= 5 && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
            <line x1="22%" y1="30%" x2="42%" y2="20%" stroke={GLOW} strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />
            <line x1="60%" y1="20%" x2="76%" y2="35%" stroke={GLOW} strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />
          </svg>
        )}
      </div>
    </div>
  );
}

// ─── features ────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: MousePointerClick,
    title: "A genuinely open canvas",
    body: "Add a card, drag it anywhere, type whatever it needs to say — no template, no fixed lanes. Sketch a process the way you'd actually think through it on paper.",
  },
  {
    icon: Smartphone,
    title: "Saved per device, instantly",
    body: "Every card persists as you go — close the tab, come back, it's exactly where you left it.",
  },
  {
    icon: MessageCircle,
    title: "Vaea Chat can add or edit cards too",
    body: "Ask Vaea to sketch out a process and it can place, update, or clear cards on this same canvas — the chat and the board share one set of cards, not two.",
  },
  {
    icon: Bell,
    title: "Automation is next, not yet",
    body: "Today the canvas is a real sketchpad, not an automation engine — wiring these cards to actually trigger something lives in the Notifications page's automation work, still in progress.",
  },
];

// ─── FAQ ─────────────────────────────────────────────────────────────────────

const FAQS = [
  {
    q: "Does Workflows actually automate anything yet?",
    a: "Not yet. Today it's a genuine freeform canvas — add cards, drag them anywhere, write whatever they need to say, and it's saved per device. Wiring these cards into a real trigger/automation engine is planned but not built.",
  },
  {
    q: "Can Vaea Chat see or change what's on the canvas?",
    a: "Yes — ask it to add, update, or remove a card and it acts on the exact same set of cards this page shows. There's no separate chat-only version.",
  },
  {
    q: "Where are my cards stored?",
    a: "On your own device, the same local-first storage the rest of Vaea uses. There's no server-side workflow database to sync from elsewhere yet.",
  },
  {
    q: "Is this a Kanban board?",
    a: "No fixed columns or statuses — just an open canvas you place notes on freely. If you want tracked status/workflow state, that's what Projects and Tasks already do.",
  },
];

const WORKFLOWS_PAGE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "Vaea Workflows — sketch it before you build it",
  "url": "https://vaea.base44.app/workflows",
  "description": "Vaea Workflows is a freeform sticky-note canvas for sketching out a process, saved per device and editable through Vaea Chat.",
  "isPartOf": { "@type": "WebSite", "url": "https://vaea.base44.app/" },
};

const WORKFLOWS_FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": FAQS.map(({ q, a }) => ({ "@type": "Question", "name": q, "acceptedAnswer": { "@type": "Answer", "text": a } })),
};

export default function WorkflowsPage() {
  useDocumentMeta("Vaea Workflows — sketch it before you build it", "/workflows");
  usePageSchema(WORKFLOWS_PAGE_SCHEMA);
  usePageSchema(WORKFLOWS_FAQ_SCHEMA);

  return (
    <MarketingLayout>
      <section className={`relative overflow-hidden ${darkSectionBg} ${darkText} ${darkTopEdge}`}>
        <StageLight />
        <Grain />
        <div className="relative max-w-5xl mx-auto px-6 pt-20 sm:pt-28 pb-16 sm:pb-20">
          <Reveal className="text-center mb-12">
            <p className={`${eyebrowOnDark} mb-5`}>Vaea Workflows</p>
            <h1 className={`${displayXL} max-w-3xl mx-auto`}>
              Sketch it before you build it.
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
              An open canvas for sticky-note-style cards you place and drag
              anywhere — real, saved, and editable from Vaea Chat too.
            </p>
            <div className="mt-8 flex items-center justify-center gap-5 flex-wrap">
              <Link to="/signup" className={pillOnDark}>
                Open a canvas
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link to="/how-it-works" className={linkOnDark}>
                See how it works
              </Link>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <CanvasDemo />
          </Reveal>
        </div>
      </section>

      <section className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(55%_60%_at_50%_0%,rgba(70,186,209,0.05),transparent_70%)]" />
        <div className="relative max-w-5xl mx-auto px-6 py-16 sm:py-24">
          <div className="sm:grid sm:grid-cols-2 sm:gap-16 sm:items-start">
            <Reveal>
              <p className={`${eyebrowOnLight} mb-4`}>Genuinely open</p>
              <h2 className={`${displayL} mb-6`}>No lanes.<br />No template.</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                A card, a position, and whatever text it needs — that's the
                whole model. Sketch a process the way you'd actually draw it
                on a whiteboard, not the way a Kanban tool wants it structured.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                It's honest about where it is today: a real canvas, not yet an
                automation engine. That part's still being built.
              </p>
            </Reveal>
            <Reveal delay={100}>
              <div className={`p-5 rounded-2xl ${glassTileLight}`}>
                <p className="text-sm font-medium mb-1">"Sketch out our onboarding steps"</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Vaea Chat can place the cards for you on this same board — start
                  from a conversation instead of a blank canvas.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="relative">
        <div className="max-w-5xl mx-auto px-6 py-16 sm:py-24">
          <Reveal className="text-center mb-12">
            <h2 className={displayL}>What it actually does.</h2>
          </Reveal>
          <div className="grid sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
            {FEATURES.map(({ icon: Icon, title, body }, i) => (
              <Reveal key={title} delay={i * 55} as="div" className={`flex gap-4 p-5 rounded-2xl ${glassTileLight}`}>
                <div className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${GLOW}14`, border: `1px solid ${GLOW}25` }}>
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

      <section className="border-t border-foreground/[0.06]">
        <div className="max-w-2xl mx-auto px-6 py-16 sm:py-20">
          <Reveal className="mb-10 text-center">
            <h2 className={displayM}>Questions about Workflows</h2>
          </Reveal>
          <Accordion type="single" collapsible className="space-y-1">
            {FAQS.map(({ q, a }) => (
              <AccordionItem key={q} value={q} className="border-b border-foreground/[0.06] last:border-0">
                <AccordionTrigger className="text-left text-sm font-medium py-4 hover:no-underline hover:text-foreground/80 transition-colors">{q}</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-4">{a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      <section className={`relative overflow-hidden ${darkSectionBg} ${darkText} ${darkTopEdge}`}>
        <StageLight />
        <Grain />
        <div className="relative max-w-3xl mx-auto px-6 py-24 sm:py-32 text-center">
          <Reveal>
            <h2 className={displayL}>An open canvas.<br />Ready when the idea is.</h2>
            <p className="mt-5 text-muted-foreground max-w-md mx-auto leading-relaxed">
              No setup required — open Workflows and start placing cards.
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

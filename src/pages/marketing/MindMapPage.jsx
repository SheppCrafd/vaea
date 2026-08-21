import { Link } from "react-router-dom";
import { ArrowRight, Network, GitBranch, Sparkles, MousePointerClick } from "lucide-react";
import MarketingLayout from "./MarketingLayout";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Reveal, StageLight, Grain, useDocumentMeta, usePageSchema } from "./effects";
import {
  darkSectionBg, darkText, darkTopEdge, glassPanel, glassSheen, glassTileLight,
  pillOnDark, linkOnDark, eyebrowOnDark, eyebrowOnLight,
  displayXL, displayL, displayM, GLOW,
} from "./theme";

// ─── graph demo ──────────────────────────────────────────────────────────────
// Static illustration of the real MindMapPage.jsx: solid lines are resolved
// [[wikilinks]] (graph.links), dashed lines are suggested_links — topically
// related notes with no link yet — exactly the two edge types that page
// draws, at fixed positions instead of running the real force simulation.

const NODES = [
  { id: "pricing", label: "Client pricing", x: 20, y: 60 },
  { id: "onboarding", label: "Client onboarding", x: 45, y: 25 },
  { id: "q3", label: "Q3 goals", x: 72, y: 55 },
  { id: "sarah", label: "2026-08-18", x: 50, y: 82 },
  { id: "renewal", label: "Renewal terms", x: 82, y: 20 },
];
const LINKS = [
  { from: "pricing", to: "onboarding" },
  { from: "pricing", to: "sarah" },
  { from: "pricing", to: "q3" },
];
const SUGGESTED = [{ from: "onboarding", to: "renewal" }];

function GraphDemo() {
  const byId = Object.fromEntries(NODES.map((n) => [n.id, n]));
  return (
    <div className={`relative w-full max-w-xl mx-auto rounded-2xl overflow-hidden ${glassPanel}`}>
      <div className={glassSheen} />
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-foreground/[0.08]">
        <Network className="w-3.5 h-3.5 text-foreground/35" />
        <span className="font-terminal text-[11px] text-foreground/35 flex-1 min-w-0 truncate">Mind Map</span>
      </div>
      <div className="relative h-[220px]">
        <svg className="absolute inset-0 w-full h-full" aria-hidden="true">
          {LINKS.map(({ from, to }) => (
            <line
              key={`${from}-${to}`}
              x1={`${byId[from].x}%`} y1={`${byId[from].y}%`}
              x2={`${byId[to].x}%`} y2={`${byId[to].y}%`}
              stroke="currentColor" className="text-foreground/15" strokeWidth="1"
            />
          ))}
          {SUGGESTED.map(({ from, to }) => (
            <line
              key={`sug-${from}-${to}`}
              x1={`${byId[from].x}%`} y1={`${byId[from].y}%`}
              x2={`${byId[to].x}%`} y2={`${byId[to].y}%`}
              stroke={GLOW} strokeWidth="1" strokeDasharray="4 4" opacity="0.55"
            />
          ))}
        </svg>
        {NODES.map((n) => (
          <div key={n.id} className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1" style={{ left: `${n.x}%`, top: `${n.y}%` }}>
            <span className="w-2 h-2 rounded-full bg-foreground/70" />
            <span className="font-terminal text-[10px] text-foreground/55 whitespace-nowrap">{n.label}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 px-5 py-3 border-t border-foreground/[0.07] text-[10px] font-terminal text-foreground/40">
        <span className="flex items-center gap-1.5"><span className="w-3 h-px bg-foreground/30" /> linked</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-px" style={{ background: GLOW, opacity: 0.6 }} /> suggested</span>
      </div>
    </div>
  );
}

// ─── features ────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: GitBranch,
    title: "Built from your real wikilinks",
    body: "Every [[link]] between your vault notes becomes an edge on the graph — no manual tagging, no separate map to maintain.",
  },
  {
    icon: Sparkles,
    title: "Suggested links, shown differently",
    body: "Notes that seem topically related but aren't linked yet appear as dashed edges — a suggestion, not a fact, so you can tell the difference at a glance.",
  },
  {
    icon: MousePointerClick,
    title: "A live layout, not a static export",
    body: "Nodes settle into place with a real force simulation and respond as you hover — this is a rendered view of your actual notes, not a snapshot.",
  },
  {
    icon: Network,
    title: "Needs Vaea Brain connected",
    body: "The map reads directly from your connected Obsidian vault — connect it in Settings and add a few [[wikilinks]] between notes to see it fill in.",
  },
];

// ─── FAQ ─────────────────────────────────────────────────────────────────────

const FAQS = [
  {
    q: "What do I need connected to see anything here?",
    a: "Vaea Brain (your Obsidian vault, connected via GitHub in Settings). Without it, this page shows an empty state rather than any placeholder graph.",
  },
  {
    q: "What are the dashed lines?",
    a: "Suggested links — notes that look topically related but don't have a [[wikilink]] between them yet. They're drawn differently from real links on purpose, so the graph never overstates what's actually connected.",
  },
  {
    q: "Do I have to organize my notes differently for this to work?",
    a: "No — it reads the [[wikilinks]] you're likely already writing in Obsidian. Nothing new to learn or restructure.",
  },
  {
    q: "Is this graph editable?",
    a: "Not directly — it's a read view of your real link structure. Adding a [[wikilink]] in Obsidian (or asking Vaea Chat to write one) is what changes what shows up here.",
  },
];

const MINDMAP_PAGE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "Vaea Mind Map — how your notes actually connect",
  "url": "https://vaea.base44.app/mindmap",
  "description": "Vaea Mind Map renders a live force-directed graph from your real Obsidian [[wikilinks]], plus dashed suggested links for topically related notes with no link yet.",
  "isPartOf": { "@type": "WebSite", "url": "https://vaea.base44.app/" },
};

const MINDMAP_FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": FAQS.map(({ q, a }) => ({ "@type": "Question", "name": q, "acceptedAnswer": { "@type": "Answer", "text": a } })),
};

export default function MindMapPage() {
  useDocumentMeta("Vaea Mind Map — how your notes actually connect", "/mindmap");
  usePageSchema(MINDMAP_PAGE_SCHEMA);
  usePageSchema(MINDMAP_FAQ_SCHEMA);

  return (
    <MarketingLayout>
      <section className={`relative overflow-hidden ${darkSectionBg} ${darkText} ${darkTopEdge}`}>
        <StageLight />
        <Grain />
        <div className="relative max-w-5xl mx-auto px-6 pt-20 sm:pt-28 pb-16 sm:pb-20">
          <Reveal className="text-center mb-12">
            <p className={`${eyebrowOnDark} mb-5`}>Mind Map</p>
            <h1 className={`${displayXL} max-w-3xl mx-auto`}>
              See how your notes actually connect.
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
              A live graph built from your real Obsidian [[wikilinks]] — plus
              suggested links for notes that look related but aren't linked yet.
            </p>
            <div className="mt-8 flex items-center justify-center gap-5 flex-wrap">
              <Link to="/signup" className={pillOnDark}>
                Connect your vault
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link to="/vault" className={linkOnDark}>
                About Vaea Brain
              </Link>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <GraphDemo />
          </Reveal>
        </div>
      </section>

      <section className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(55%_60%_at_50%_0%,rgba(70,186,209,0.05),transparent_70%)]" />
        <div className="relative max-w-5xl mx-auto px-6 py-16 sm:py-24">
          <div className="sm:grid sm:grid-cols-2 sm:gap-16 sm:items-start">
            <Reveal>
              <p className={`${eyebrowOnLight} mb-4`}>No manual mapping</p>
              <h2 className={`${displayL} mb-6`}>Your links,<br />already the map.</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Nothing to configure — every [[wikilink]] you've already written
                in Obsidian becomes an edge here. The graph is a reflection of
                notes you were writing anyway, not a second system to keep up.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Suggested links stay visually distinct from real ones — dashed,
                a different color — so the graph is always honest about what's
                actually connected versus what merely looks related.
              </p>
            </Reveal>
            <Reveal delay={100}>
              <div className={`p-5 rounded-2xl ${glassTileLight}`}>
                <p className="text-sm font-medium mb-1">Real force simulation</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Nodes settle into place on their own — dense clusters spread out,
                  isolated notes drift to the edges.
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
            <h2 className={displayM}>Questions about Mind Map</h2>
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
            <h2 className={displayL}>Your notes were already connected.<br />Now you can see it.</h2>
            <p className="mt-5 text-muted-foreground max-w-md mx-auto leading-relaxed">
              Connect Vaea Brain in Settings — the map fills in from notes you've
              already written.
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

import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Network, Workflow, GitBranch, Sparkles, MousePointerClick, PenTool, MoveHorizontal, Bot } from "lucide-react";
import MarketingLayout from "./MarketingLayout";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import VaultGraph from "@/components/mindmap/VaultGraph";
import WorkflowCanvas from "@/components/mindmap/WorkflowCanvas";
import { Reveal, StageLight, Grain, useDocumentMeta, usePageSchema } from "./effects";
import {
  darkSectionBg, darkText, darkTopEdge, glassPanel, glassSheen, glassTileLight,
  pillOnDark, linkOnDark, eyebrowOnDark, eyebrowOnLight,
  displayXL, displayL, displayM, GLOW,
} from "./theme";

// ─── live demo ───────────────────────────────────────────────────────────────
// Two tabs, exactly like the real /app/mindmap page (src/pages/MindMapPage.jsx)
// — because it's not a hand-drawn illustration of that page, it IS that
// page's own VaultGraph/WorkflowCanvas components, rendered here in `demo`
// mode (fixed sample data, dragging/hover/persistence all disabled). If the
// real page's UI changes, this demo changes with it automatically.
function MindMapDemo() {
  const [tab, setTab] = useState("vault");
  return (
    <div className={`relative w-full max-w-xl mx-auto rounded-2xl overflow-hidden ${glassPanel}`}>
      <div className={glassSheen} />
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-foreground/[0.08]">
        <Network className="w-3.5 h-3.5 text-foreground/35" />
        <span className="font-terminal text-[11px] text-foreground/35 flex-1 min-w-0 truncate">Mind Map</span>
      </div>
      <div className="flex items-center gap-1 px-3 pt-2 border-b border-foreground/[0.08]">
        {[{ key: "vault", label: "Vault", Icon: Network }, { key: "workflows", label: "Workflows", Icon: Workflow }].map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 font-terminal text-[10px] px-2.5 py-1.5 border-b-2 -mb-px transition-colors ${tab === key ? "border-current text-foreground/70" : "border-transparent text-foreground/35"}`}
            style={tab === key ? { borderColor: GLOW } : undefined}
          >
            <Icon className="w-3 h-3" /> {label}
          </button>
        ))}
      </div>
      <div className="relative h-[240px] flex flex-col">
        {tab === "vault" ? <VaultGraph demo /> : <WorkflowCanvas demo />}
      </div>
      <div className="flex items-center gap-4 px-5 py-3 border-t border-foreground/[0.07] text-[10px] font-terminal text-foreground/40">
        {tab === "vault" ? (
          <>
            <span className="flex items-center gap-1.5"><span className="w-3 h-px bg-foreground/30" /> linked</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-px" style={{ background: GLOW, opacity: 0.6 }} /> suggested</span>
          </>
        ) : (
          <span>Editable from Vaea Chat too</span>
        )}
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
    body: "The vault graph reads directly from your connected Obsidian vault — connect it in Settings and add a few [[wikilinks]] between notes to see it fill in.",
  },
  {
    icon: PenTool,
    title: "An open canvas for sketching a process",
    body: "The Workflows tab is a freeform surface — sticky-note-style cards you place and connect in your head, not a form to fill in.",
  },
  {
    icon: MoveHorizontal,
    title: "Drag anywhere, saved per-device",
    body: "Cards remember where you put them — real, persisted, not a session that resets when you close the tab.",
  },
  {
    icon: Bot,
    title: "Editable from Vaea Chat too",
    body: "Ask the assistant to add, move, or remove a card and it acts on the exact same cards you placed by hand — one surface, not two.",
  },
];

// ─── FAQ ─────────────────────────────────────────────────────────────────────

const FAQS = [
  {
    q: "What do I need connected to see anything on the Vault tab?",
    a: "Vaea Brain (your Obsidian vault, connected via GitHub in Settings). Without it, that tab shows an empty state rather than any placeholder graph. The Workflows tab needs nothing connected — it's a local canvas.",
  },
  {
    q: "What are the dashed lines on the Vault tab?",
    a: "Suggested links — notes that look topically related but don't have a [[wikilink]] between them yet. They're drawn differently from real links on purpose, so the graph never overstates what's actually connected.",
  },
  {
    q: "Is the Vault graph editable?",
    a: "Not directly — it's a read view of your real link structure. Adding a [[wikilink]] in Obsidian (or asking Vaea Chat to write one) is what changes what shows up here. The Workflows tab, by contrast, is fully editable — drag, add, and delete cards freely.",
  },
  {
    q: "Does Workflows automate anything yet?",
    a: "No — it's a genuine sketching surface today, not wired to an automation engine. It's real (drag, add, delete, persisted, editable from chat), just not automated yet.",
  },
];

const MINDMAP_PAGE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "Vaea Mind Map — how your notes actually connect",
  "url": "https://vaea.base44.app/mindmap",
  "description": "Vaea Mind Map renders a live force-directed graph from your real Obsidian [[wikilinks]], plus a Workflows tab for freeform process sketching.",
  "isPartOf": { "@type": "WebSite", "url": "https://vaea.base44.app/" },
};

const MINDMAP_FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": FAQS.map(({ q, a }) => ({ "@type": "Question", "name": q, "acceptedAnswer": { "@type": "Answer", "text": a } })),
};

export default function MindMapPage() {
  useDocumentMeta(
    "Vaea Mind Map — how your notes actually connect",
    "/mindmap",
    "A live graph of your real Obsidian wikilinks, plus a Workflows tab for freeform process sketching — the same two-tab page as the real app, not two separate things."
  );
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
              See your notes. Sketch your process.
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
              One page, two tabs: a live graph of your real Obsidian [[wikilinks]],
              and a freeform canvas for sketching out how something should work.
            </p>
            <div className="mt-8 flex items-center justify-center gap-5 flex-wrap">
              <Link to="/signup" className={pillOnDark}>
                Open Mind Map
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link to="/vault" className={linkOnDark}>
                About Vaea Brain
              </Link>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <MindMapDemo />
          </Reveal>
        </div>
      </section>

      <section className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(55%_60%_at_50%_0%,rgba(70,186,209,0.05),transparent_70%)]" />
        <div className="relative max-w-5xl mx-auto px-6 py-16 sm:py-24">
          <div className="sm:grid sm:grid-cols-2 sm:gap-16 sm:items-start">
            <Reveal>
              <p className={`${eyebrowOnLight} mb-4`}>Two views, one page</p>
              <h2 className={`${displayL} mb-6`}>Your links,<br />already the map.</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Nothing to configure on the Vault tab — every [[wikilink]] you've
                already written in Obsidian becomes an edge here. The graph is a
                reflection of notes you were writing anyway, not a second system
                to keep up.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Switch to Workflows for an open canvas instead — sticky-note-style
                cards you place and drag anywhere, no vault connection required.
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
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
            <h2 className={displayL}>Your notes were already connected.<br />Now you can see it — and sketch what's next.</h2>
            <p className="mt-5 text-muted-foreground max-w-md mx-auto leading-relaxed">
              Connect Vaea Brain in Settings for the Vault tab — Workflows is ready
              with no setup at all.
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

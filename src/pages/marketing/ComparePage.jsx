import { Link } from "react-router-dom";
import { ArrowRight, Check, X } from "lucide-react";
import MarketingLayout from "./MarketingLayout";
import { Reveal, StageLight, Grain, useDocumentMeta, usePageSchema } from "./effects";
import {
  darkSectionBg, darkText, darkTopEdge, lightWash, glowTop, glassTileLight,
  pillOnDark, linkOnDark, linkOnLight, eyebrowOnDark, eyebrowOnLight, displayXL, displayL,
  hairlineH, GLOW,
} from "./theme";

// Every row here is a genuinely verifiable property of Vaea itself (see
// AGENTS.md / README.md) compared against the category norm for task
// managers generally — never a specific claim about a specific competitor
// product we can't verify. "Typical task manager" means the common pattern
// across mainstream tools, not any one named product.
const ROWS = [
  {
    label: "Where your data lives",
    vaea: "Local-first by default — real files on your own device or a folder you pick. Cloud sync is there if you want it, never the default.",
    typical: "Cloud-only. Your data lives on their servers by default, and usually has to.",
  },
  {
    label: "What the AI assistant actually does",
    vaea: "Reads your real workspace and directly creates, updates, or completes things in it (with a confirmation step before anything destructive) — not just a chat window bolted on the side.",
    typical: "Describes what you should do, or drafts a suggestion — you're still the one making every change by hand.",
  },
  {
    label: "Pricing",
    vaea: "Free. No tiers, no seat limits, no usage caps to keep an eye on.",
    typical: "Freemium — a free tier with limits, then a paywall for the features (or the AI) you actually want.",
  },
  {
    label: "Which AI model runs it",
    vaea: "Bring your own key for Anthropic, OpenAI, Google, or xAI — or use Local Mode to run it against your own model, or Claude Code, through a folder on your disk. No key, and Vaea itself makes no network call of its own.",
    typical: "Locked to whatever model the vendor picked. No choice, no local option.",
  },
  {
    label: "How work is structured",
    vaea: "Area → Product → Project → Task — everything nests inside something bigger, nothing floating with no home. Maps cleanly onto freelance work too: Area as your practice, Product as each client, Project as each engagement.",
    typical: "A flat list of projects and tasks, or boards you have to build the structure into yourself.",
  },
];

// The Vaea checkmark gets the site's one reserved accent color — the small,
// specific use GLOW's own comment calls out ("glow halos, the caret, small
// accent details"), and it's what actually pulls the eye to Vaea's column
// instead of the two columns competing on equal footing.
function RowIcon({ good }) {
  return good ? (
    <Check className="w-4 h-4 shrink-0" style={{ color: GLOW }} aria-hidden="true" />
  ) : (
    <X className="w-4 h-4 text-muted-foreground/35 shrink-0" aria-hidden="true" />
  );
}

const COMPARE_PAGE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "Vaea vs. the typical task manager",
  "url": "https://vaea.base44.app/compare",
  "description": "How Vaea differs from mainstream task managers like Todoist, ClickUp, and Motion: local-first data storage, an AI that actually acts on your workspace, free with no tiers, bring-your-own-key AI, and a hierarchical structure that maps cleanly onto freelance work.",
  "isPartOf": { "@type": "WebSite", "url": "https://vaea.base44.app/" },
};

export default function ComparePage() {
  useDocumentMeta("Vaea vs. the typical task manager | Vaea", "/compare");
  usePageSchema(COMPARE_PAGE_SCHEMA);

  return (
    <MarketingLayout>
      <section className={`relative overflow-hidden ${darkSectionBg} ${darkText} ${darkTopEdge}`}>
        <StageLight />
        <Grain />
        <div className="relative max-w-3xl mx-auto px-6 pt-24 sm:pt-32 pb-20 sm:pb-28 text-center">
          <Reveal>
            <p className={`${eyebrowOnDark} mb-4`}>Vaea vs. the category</p>
            <h1 className={displayXL}>
              The AI does the work. Your data stays put.
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Most task managers people compare when hunting for &quot;AI for freelancers&quot; — Todoist,
              ClickUp, Motion, and the rest of that shelf — share the same shape: cloud-only storage,
              a paid tier for anything real, and an AI that talks instead of acts. Here&apos;s what&apos;s
              actually different about Vaea, point by point.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="relative bg-background">
        <div aria-hidden="true" className={glowTop} />
        <div className="relative max-w-4xl mx-auto px-6 py-16 sm:py-20">
          {/* Table on wider screens, stacked cards on narrow ones — the
              underlying data is one array (ROWS) either way. */}
          <Reveal className="hidden sm:block overflow-x-auto">
            <table className="w-full border-separate border-spacing-0">
              <thead>
                <tr>
                  <th scope="col" className="text-left text-xs font-terminal uppercase tracking-[0.2em] text-muted-foreground pb-4 pr-4 w-1/4">
                    &nbsp;
                  </th>
                  {/* The Vaea header cell carries the same rounded highlight
                      the body cells below it do, so the emphasized column
                      reads as one continuous card from the header down. */}
                  <th scope="col" className="text-left text-sm font-heading font-semibold pb-4 px-5 pt-4 rounded-t-2xl bg-foreground/[0.035]">
                    Vaea
                  </th>
                  <th scope="col" className="text-left text-sm font-heading font-semibold text-muted-foreground pb-4 pl-5">
                    Typical task manager
                  </th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map(({ label, vaea, typical }, i) => {
                  const isLast = i === ROWS.length - 1;
                  return (
                    <tr key={label}>
                      <th scope="row" className={`text-left align-top text-sm font-medium pr-4 py-5 ${i > 0 ? "border-t border-foreground/[0.07]" : ""}`}>
                        {label}
                      </th>
                      <td
                        className={`align-top px-5 py-5 bg-foreground/[0.035] ${isLast ? "rounded-b-2xl" : ""} ${i > 0 ? "border-t border-foreground/[0.06]" : ""}`}
                      >
                        <div className="flex items-start gap-2">
                          <RowIcon good />
                          <p className="text-sm text-foreground/85 leading-relaxed">{vaea}</p>
                        </div>
                      </td>
                      <td className={`align-top pl-5 py-5 ${i > 0 ? "border-t border-foreground/[0.07]" : ""}`}>
                        <div className="flex items-start gap-2">
                          <RowIcon good={false} />
                          <p className="text-sm text-muted-foreground leading-relaxed">{typical}</p>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Reveal>

          <div className="sm:hidden space-y-4">
            {ROWS.map(({ label, vaea, typical }, i) => (
              <Reveal key={label} delay={i * 60} className={`rounded-2xl p-5 ${glassTileLight}`}>
                <p className="text-sm font-medium mb-3">{label}</p>
                <div className="flex items-start gap-2 mb-3">
                  <RowIcon good />
                  <div>
                    <p className="text-xs font-terminal uppercase tracking-widest text-muted-foreground mb-0.5">Vaea</p>
                    <p className="text-sm text-foreground/85 leading-relaxed">{vaea}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <RowIcon good={false} />
                  <div>
                    <p className="text-xs font-terminal uppercase tracking-widest text-muted-foreground mb-0.5">Typical</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{typical}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className={`relative ${lightWash}`}>
        <div aria-hidden="true" className={hairlineH} />
        <div className="max-w-3xl mx-auto px-6 py-20 sm:py-24">
          <Reveal>
            <p className={`${eyebrowOnLight} mb-4`}>For freelancers and solo project-jugglers</p>
            <h2 className={displayL}>Built around one person doing a lot of things at once.</h2>
            <p className="mt-5 text-muted-foreground leading-relaxed max-w-xl">
              If you&apos;re running your own practice, Area is the whole business, Product is each
              client, and Project is each engagement or deliverable underneath them — the hierarchy
              Vaea already uses maps onto freelance work without you having to invent a system for
              it. Tell Vaea Chat what&apos;s on your plate across every client and it sorts it into
              that structure, instead of you maintaining a separate list per client by hand.
            </p>
            <Link
              to="/how-it-works"
              className={`mt-6 inline-flex items-center gap-1.5 ${linkOnLight}`}
            >
              See how it works
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </Reveal>
        </div>
      </section>

      <section className={`relative overflow-hidden ${darkSectionBg} ${darkText} ${darkTopEdge}`}>
        <StageLight />
        <Grain />
        <div className="relative max-w-3xl mx-auto px-6 py-24 sm:py-32 text-center">
          <Reveal>
            <h2 className={displayL}>Say what&apos;s piling up. Vaea sorts it.</h2>
            <div className="mt-8 flex items-center justify-center gap-5 flex-wrap">
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

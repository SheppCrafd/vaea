import { Link } from "react-router-dom";
import { ArrowRight, Video, FileText, ListChecks, Link2 } from "lucide-react";
import MarketingLayout from "./MarketingLayout";
import { Reveal, StageLight, Grain, useDocumentMeta, usePageSchema } from "./effects";
import {
  darkSectionBg, darkText, darkTopEdge, glassPanel, glassSheen, glassTileLight,
  pillOnDark, linkOnDark, eyebrowOnDark, eyebrowOnLight,
  displayXL, displayL, GLOW,
} from "./theme";

// This page is deliberately restrained compared to Calendar/Vmail/Workflows/
// Mind Map: MeetingsPage.jsx (the real in-app tab) is an honest empty state
// today — no Zoom/Meet/Teams transcript connector exists yet, each needing
// a new OAuth app or re-consented scopes this project can't self-register.
// No animated demo here for exactly that reason: there's no real screen to
// show yet, and building a fake one is the thing this whole marketing pass
// was corrected for doing once already this session.

const PLANNED = [
  {
    icon: FileText,
    title: "Meeting notes, from the actual call",
    body: "A transcript from Zoom, Google Meet, or Microsoft Teams becomes real notes — not a manual write-up after the fact.",
  },
  {
    icon: ListChecks,
    title: "Action items extracted automatically",
    body: "Commitments made out loud on a call become real tasks, linked to the project the meeting was about.",
  },
  {
    icon: Link2,
    title: "A pre-meeting briefing",
    body: "Before a call starts, a short summary of the project and open items — no digging through old notes beforehand.",
  },
];

const MEETINGS_PAGE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "Vaea Meetings",
  "url": "https://vaea.base44.app/meetings",
  "description": "Vaea Meetings will turn call transcripts from Zoom, Google Meet, and Microsoft Teams into real notes, action items, and decisions — connector work not yet built.",
  "isPartOf": { "@type": "WebSite", "url": "https://vaea.base44.app/" },
};

export default function MeetingsPage() {
  useDocumentMeta(
    "Vaea Meetings — coming soon",
    "/meetings",
    "Notes, action items, and decisions pulled from your actual calls. Being built honestly, in order — a real transcript connector before anything gets faked."
  );
  usePageSchema(MEETINGS_PAGE_SCHEMA);

  return (
    <MarketingLayout>
      <section className={`relative overflow-hidden ${darkSectionBg} ${darkText} ${darkTopEdge}`}>
        <StageLight />
        <Grain />
        <div className="relative max-w-4xl mx-auto px-6 pt-20 sm:pt-28 pb-16 sm:pb-20 text-center">
          <Reveal>
            <p className={`${eyebrowOnDark} mb-5`}>Vaea Meetings — coming soon</p>
            <h1 className={`${displayXL} max-w-2xl mx-auto`}>
              Notes, action items, and decisions — from the actual call.
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
              We're building this honestly, in order: it needs a real transcript
              connector (Zoom, Google Meet, Microsoft Teams) before there's
              anything real to show. Nothing faked in the meantime.
            </p>
            <div className="mt-8 flex items-center justify-center gap-5 flex-wrap">
              <Link to="/signup" className={pillOnDark}>
                Get notified at launch
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link to="/features" className={linkOnDark}>
                See what's live today
              </Link>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <div className={`relative w-full max-w-md mx-auto mt-12 rounded-2xl overflow-hidden ${glassPanel}`}>
              <div className={glassSheen} />
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-foreground/[0.08]">
                <Video className="w-3.5 h-3.5 text-foreground/35" />
                <span className="font-terminal text-[11px] text-foreground/35">Meetings</span>
              </div>
              <div className="px-5 py-10 text-center">
                <Video className="w-6 h-6 text-foreground/25 mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground/80">No meeting source connected yet</p>
                <p className="text-xs text-foreground/40 mt-1.5 max-w-xs mx-auto leading-relaxed">
                  What the real tab shows today — a plain, honest empty state,
                  not a mockup of a feature that doesn't exist.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(55%_60%_at_50%_0%,rgba(70,186,209,0.05),transparent_70%)]" />
        <div className="relative max-w-4xl mx-auto px-6 py-16 sm:py-24">
          <Reveal className="text-center mb-12">
            <p className={`${eyebrowOnLight} mb-4`}>What's planned</p>
            <h2 className={displayL}>Built once the connector's real.</h2>
          </Reveal>
          <div className="grid sm:grid-cols-3 gap-4">
            {PLANNED.map(({ icon: Icon, title, body }, i) => (
              <Reveal key={title} delay={i * 55} as="div" className={`p-5 rounded-2xl ${glassTileLight}`}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: `${GLOW}14`, border: `1px solid ${GLOW}25` }}>
                  <Icon className="w-4 h-4" style={{ color: GLOW }} />
                </div>
                <p className="font-medium text-sm">{title}</p>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className={`relative overflow-hidden ${darkSectionBg} ${darkText} ${darkTopEdge}`}>
        <StageLight />
        <Grain />
        <div className="relative max-w-3xl mx-auto px-6 py-24 sm:py-32 text-center">
          <Reveal>
            <h2 className={displayL}>Everything else already works.</h2>
            <p className="mt-5 text-muted-foreground max-w-md mx-auto leading-relaxed">
              Chat, Calendar, Vmail, Workflows, Mind Map, and your Vaea Brain
              are real today — Meetings is the one piece still waiting on a
              connector.
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

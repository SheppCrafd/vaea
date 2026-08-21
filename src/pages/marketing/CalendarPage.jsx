import { Link } from "react-router-dom";
import { ArrowRight, CalendarDays, Video, Layers, MessageCircle, Check, Building2 } from "lucide-react";
import MarketingLayout from "./MarketingLayout";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Reveal, StageLight, Grain, useTimeline, useDocumentMeta, usePageSchema } from "./effects";
import {
  darkSectionBg, darkText, darkTopEdge, glassPanel, glassSheen, glassTileLight,
  pillOnDark, linkOnDark, eyebrowOnDark, eyebrowOnLight,
  displayXL, displayL, displayM, GLOW,
} from "./theme";

// ─── calendar agenda demo ───────────────────────────────────────────────────
// Mirrors VaeaCalendarPage.jsx's real agenda list exactly: a day header,
// then time + title + source tag rows, a video icon only on items with a
// real meeting link. Google Workspace and Microsoft 365 items appear
// side by side under one day — that merge is the actual feature, not an
// invented layout.

const CALENDAR_PHASES = [500, 700, 700, 700, 900];

const AGENDA = [
  { time: "9:00 AM", title: "Design review", source: "Google Calendar", meetLink: true },
  { time: "11:30 AM", title: "Vendor sync", source: "Outlook", meetLink: true },
  { time: "2:00 PM", title: "Q3 roadmap due", source: "Vaea project", meetLink: false },
];

function CalendarAgendaDemo() {
  const { ref, step } = useTimeline(CALENDAR_PHASES);
  return (
    <div ref={ref} className={`relative w-full max-w-xl mx-auto rounded-2xl overflow-hidden ${glassPanel}`}>
      <div className={glassSheen} />
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-foreground/[0.08]">
        <CalendarDays className="w-3.5 h-3.5 text-foreground/35" />
        <span className="font-terminal text-[11px] text-foreground/35 flex-1 min-w-0 truncate">Today</span>
        {step >= 4 && (
          <span className="font-terminal text-[10px]" style={{ color: GLOW }}>
            2 sources merged
          </span>
        )}
      </div>
      <div className="px-5 py-5 min-h-[180px] text-left flex flex-col divide-y divide-foreground/[0.06]">
        {AGENDA.map((item, i) => (
          <div
            key={item.title}
            className={`flex items-center gap-3 py-2.5 first:pt-0 last:pb-0 transition-all duration-500 ${
              step >= i + 1 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
            }`}
          >
            <span className="font-terminal text-[11px] text-foreground/40 shrink-0 w-16">{item.time}</span>
            <span className="text-sm text-foreground/85 truncate flex-1">{item.title}</span>
            {item.meetLink && <Video className="w-3.5 h-3.5 shrink-0" style={{ color: GLOW }} />}
            <span className="font-terminal text-[10px] text-foreground/35 shrink-0">{item.source}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── features ────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Layers,
    title: "Every calendar, one list",
    body: "Connect Google Workspace and Microsoft 365 and Vaea Calendar merges both into one agenda — no more checking two tabs to see what's actually on your day.",
  },
  {
    icon: Check,
    title: "Your committed project due dates show up too",
    body: "A project you've committed a due date to appears right alongside your real meetings — not a separate to-do list you have to cross-reference by hand.",
  },
  {
    icon: Video,
    title: "Real meeting links, not just a title",
    body: "A Google Meet or Teams link attached to an event shows up as a real join icon in the agenda — click through instead of hunting for the invite.",
  },
  {
    icon: MessageCircle,
    title: "Edit it by asking",
    body: "\"Move my 2pm to Thursday\" — Vaea Chat already has the same calendar tools this page reads from, so a change in chat shows up here immediately.",
  },
  {
    icon: Building2,
    title: "Connect one, both, or neither",
    body: "Google Workspace and Microsoft 365 are independent connections. Use one, use both, or skip calendar entirely — the rest of Vaea works either way.",
  },
  {
    icon: CalendarDays,
    title: "Agenda or week, your call",
    body: "Switch between a scrolling agenda and a 7-day grid — same merged data, whichever shape you think in.",
  },
];

// ─── FAQ ─────────────────────────────────────────────────────────────────────

const FAQS = [
  {
    q: "Which calendars does it actually connect to?",
    a: "Google Workspace Calendar and Microsoft 365 / Outlook Calendar, connected independently in Settings. Connect either one, both, or neither — Vaea Calendar just merges whatever's connected.",
  },
  {
    q: "Can I create or move events from this page directly?",
    a: "Today this page is a read view — the merged agenda and week grid. Creating, moving, and cancelling events already works through Vaea Chat (\"schedule a call with Sam Thursday at 2\"), using the same calendar connection this page reads from, so a change you make in chat shows up here right away.",
  },
  {
    q: "Does it do auto-scheduling or protected focus blocks?",
    a: "Not yet — that's real backlog, not shipped. What's live today is the merged read view (Google Workspace + Microsoft 365 + your committed project due dates) and full editing through chat.",
  },
  {
    q: "Where do the project due dates come from?",
    a: "Any project with a due date you've marked committed (not just estimated) shows up on the calendar automatically — no separate setup, it reads the same project data as the rest of Vaea.",
  },
];

const CALENDAR_PAGE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "Vaea Calendar — every connected calendar, merged",
  "url": "https://vaea.base44.app/calendar",
  "description": "Vaea Calendar merges Google Workspace and Microsoft 365 calendars, plus your committed project due dates, into one native agenda — editable through Vaea Chat.",
  "isPartOf": { "@type": "WebSite", "url": "https://vaea.base44.app/" },
};

const CALENDAR_FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": FAQS.map(({ q, a }) => ({ "@type": "Question", "name": q, "acceptedAnswer": { "@type": "Answer", "text": a } })),
};

export default function CalendarPage() {
  useDocumentMeta(
    "Vaea Calendar — every connected calendar, merged",
    "/calendar",
    "Google Workspace and Microsoft 365, merged into one agenda alongside your committed project due dates. Ask Vaea Chat to add, move, or cancel events for you."
  );
  usePageSchema(CALENDAR_PAGE_SCHEMA);
  usePageSchema(CALENDAR_FAQ_SCHEMA);

  return (
    <MarketingLayout>
      <section className={`relative overflow-hidden ${darkSectionBg} ${darkText} ${darkTopEdge}`}>
        <StageLight />
        <Grain />
        <div className="relative max-w-5xl mx-auto px-6 pt-20 sm:pt-28 pb-16 sm:pb-20">
          <Reveal className="text-center mb-12">
            <p className={`${eyebrowOnDark} mb-5`}>Vaea Calendar</p>
            <h1 className={`${displayXL} max-w-3xl mx-auto`}>
              One calendar. Every source.
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Google Workspace and Microsoft 365, merged into one agenda — plus your
              committed project due dates, right alongside your real meetings.
            </p>
            <div className="mt-8 flex items-center justify-center gap-5 flex-wrap">
              <Link to="/signup" className={pillOnDark}>
                Connect your calendar
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link to="/how-it-works" className={linkOnDark}>
                See how it works
              </Link>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <CalendarAgendaDemo />
          </Reveal>
        </div>
      </section>

      <section className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(55%_60%_at_50%_0%,rgba(70,186,209,0.05),transparent_70%)]" />
        <div className="relative max-w-5xl mx-auto px-6 py-16 sm:py-24">
          <div className="sm:grid sm:grid-cols-2 sm:gap-16 sm:items-start">
            <Reveal>
              <p className={`${eyebrowOnLight} mb-4`}>Not another wrapper</p>
              <h2 className={`${displayL} mb-6`}>Two calendars.<br />One real answer.</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Instead of embedding Google Calendar in one tab and Outlook in
                another, Vaea Calendar asks each connected source for what's
                coming up and merges the results into a single, sorted list.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Ask Vaea Chat to move something and the change happens on the
                real calendar it lives on — this page just reflects it, the
                next time you look.
              </p>
            </Reveal>
            <Reveal delay={100}>
              <div className={`p-5 rounded-2xl ${glassTileLight}`}>
                <p className="text-sm font-medium mb-1">"What's on my day?"</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Vaea Chat can already answer this from the same merged data this
                  page shows — no need to open the tab to check.
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
            <h2 className={displayM}>Questions about Calendar</h2>
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
            <h2 className={displayL}>Stop checking two tabs.<br />Vaea already merged them.</h2>
            <p className="mt-5 text-muted-foreground max-w-md mx-auto leading-relaxed">
              Connect once in Settings. From then on, "what's on my day" is
              the whole question.
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

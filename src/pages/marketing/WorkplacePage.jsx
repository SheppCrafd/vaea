import { Link } from "react-router-dom";
import {
  ArrowRight, CalendarDays, Video, Layers, MessageCircle, Check, Building2,
  Inbox, Send, ShieldAlert, PenSquare, Apple, FileText, ListChecks, Link2,
} from "lucide-react";
import MarketingLayout from "./MarketingLayout";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import CalendarView from "@/components/calendar/CalendarView";
import InboxFrame from "@/components/vmail/InboxFrame";
import { Reveal, StageLight, Grain, useTimeline, useDocumentMeta, usePageSchema } from "./effects";
import {
  darkSectionBg, darkText, darkTopEdge, glassPanel, glassSheen, glassTileLight,
  pillOnDark, linkOnDark, eyebrowOnDark, eyebrowOnLight,
  displayXL, displayL, displayM, GLOW,
} from "./theme";

// Vaea Workplace = Calendar + Vmail + Meetings, one page. "Workplace" rather
// than "Workspace" — that name's already taken in-app by the Google Workspace
// connector, so reusing it here would read as the same thing.

// ─── calendar agenda demo ───────────────────────────────────────────────────
// Renders the real CalendarView.jsx — the exact agenda-list component
// VaeaCalendarPage.jsx uses — with fixed sample events. Full sample dataset
// always mounted (never progressively sliced): every row appearing/
// disappearing over time is exactly the DOM-growth-during-animation shape
// that caused this file's real layout-shift bug in the first place. The
// timeline only drives the "2 sources merged" label.

const CALENDAR_PHASES = [500, 700, 700, 700, 900];
const TODAY_KEY = new Date().toISOString().slice(0, 10);

const AGENDA_ITEMS = [
  { id: "e1", date: new Date(new Date().setHours(9, 0, 0, 0)), title: "Design review", source: "Google Calendar", meetLink: true },
  { id: "e2", date: new Date(new Date().setHours(11, 30, 0, 0)), title: "Vendor sync", source: "Outlook", meetLink: true },
  { id: "e3", date: new Date(new Date().setHours(14, 0, 0, 0)), title: "Q3 roadmap due", source: "Vaea project", meetLink: false },
];

function CalendarAgendaDemo() {
  const { ref, step } = useTimeline(CALENDAR_PHASES);
  const groups = [[TODAY_KEY, AGENDA_ITEMS]];
  return (
    <div ref={ref} className={`relative w-full max-w-xl mx-auto rounded-2xl overflow-hidden ${glassPanel}`}>
      <div className={glassSheen} />
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-foreground/[0.08]">
        <CalendarDays className="w-3.5 h-3.5 text-foreground/35" />
        <span className="font-terminal text-[11px] text-foreground/35 flex-1 min-w-0 truncate">Today</span>
        <span
          className={`font-terminal text-[10px] transition-opacity duration-500 ${step >= 2 ? "opacity-100" : "opacity-0"}`}
          style={{ color: GLOW }}
        >
          2 sources merged
        </span>
      </div>
      <div className="px-5 py-5 text-left">
        <CalendarView view="agenda" groups={groups} demo />
      </div>
    </div>
  );
}

// ─── inbox demo ──────────────────────────────────────────────────────────────
// Renders the real InboxFrame.jsx — the exact folder-tabs + message-list
// component VmailPage.jsx uses — in `demo` mode, animated by revealing
// messages one at a time and ending on a fixed-height footer beat.

const VMAIL_PHASES = [500, 700, 700, 900, 900];

const DEMO_MESSAGES = [
  { id: "m1", provider: "gmail", label: "Gmail", from: "Priya Shah", subject: "Contract redline attached", date: new Date(Date.now() - 12 * 60000).toISOString(), unread: true },
  { id: "m2", provider: "outlook", label: "Outlook", from: "Dana Kim", subject: "Re: Thursday's agenda", date: new Date(Date.now() - 48 * 60000).toISOString(), unread: true },
  { id: "m3", provider: "gmail", label: "Gmail", from: '"IT Security"', subject: "URGENT: verify your account now", date: new Date(Date.now() - 60 * 60000).toISOString(), unread: true, flagged: true },
];

function InboxDemo() {
  const { ref, step } = useTimeline(VMAIL_PHASES);
  const flaggedGone = step >= 4;
  const visible = DEMO_MESSAGES
    .slice(0, Math.min(step, DEMO_MESSAGES.length))
    .filter((m) => !(flaggedGone && m.flagged));

  return (
    <div ref={ref} className={`relative w-full max-w-xl mx-auto rounded-2xl overflow-hidden ${glassPanel}`}>
      <div className={glassSheen} />
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-foreground/[0.08]">
        <Inbox className="w-3.5 h-3.5 text-foreground/35" />
        <span className="font-terminal text-[11px] text-foreground/35 flex-1 min-w-0 truncate">Vmail</span>
        <span className="font-terminal text-[10px] text-foreground/25">2 accounts</span>
      </div>
      <div className="min-h-[240px] flex flex-col text-left">
        <InboxFrame folder="inbox" onFolderChange={() => {}} messages={visible} demo />
      </div>
      <div
        className={`px-5 py-3 border-t border-foreground/[0.08] flex items-center gap-2 transition-all duration-500 ${flaggedGone ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}
      >
        <MessageCircle className="w-3.5 h-3.5 shrink-0" style={{ color: GLOW }} />
        <span className="font-terminal text-[11px] text-foreground/50">"That IT Security email is phishing — I reported it as spam."</span>
      </div>
    </div>
  );
}

// ─── features ────────────────────────────────────────────────────────────────

const CALENDAR_FEATURES = [
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

const VMAIL_FEATURES = [
  {
    icon: Inbox,
    title: "A real inbox — Gmail and Outlook, merged",
    body: "Inbox, Sent, Archive, Junk, and Trash — the same folders either account already has, sorted newest-first across both in one native tab, no switching apps.",
  },
  {
    icon: PenSquare,
    title: "Compose from whichever account you want",
    body: "Connect both Gmail and Outlook and Compose lets you pick which one a message actually sends from. Connect just one, and it's already selected.",
  },
  {
    icon: MessageCircle,
    title: "Vaea Chat manages the inbox itself",
    body: "Ask it to archive, delete, or draft a reply to any message and it acts on the real account the message is on — deleting always goes through the same confirm step every other destructive action does, everything else runs immediately and shows up right in the chat log.",
  },
  {
    icon: ShieldAlert,
    title: "It catches scams, not just messages",
    body: "Point it at a suspicious message — or let it flag one while triaging — and it reports the real thing as spam through the actual Gmail/Outlook API, moving it out of the inbox for good.",
  },
  {
    icon: Send,
    title: "Drafts, not surprise sends",
    body: "Ask for a reply and Vaea Chat drafts it — threaded onto the real message, in your real Gmail or Outlook drafts folder — for you to read and send yourself, unless you specifically ask it to send outright.",
  },
  {
    icon: Apple,
    title: "Apple Mail is on the way",
    body: "Connect an iCloud address with an app-specific password today — message sync for it is still being built, so Gmail and Outlook are what actually show up in the list right now.",
  },
];

const MEETINGS_PLANNED = [
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

// ─── FAQ ─────────────────────────────────────────────────────────────────────

const FAQS = [
  {
    q: "Which calendars does Vaea Workplace actually connect to?",
    a: "Google Workspace Calendar and Microsoft 365 / Outlook Calendar, connected independently in Settings. Connect either one, both, or neither — Vaea Calendar just merges whatever's connected.",
  },
  {
    q: "Can I create or move events from this page directly?",
    a: "Today the calendar is a read view — the merged agenda and week grid. Creating, moving, and cancelling events already works through Vaea Chat (\"schedule a call with Sam Thursday at 2\"), using the same calendar connection this page reads from, so a change you make in chat shows up here right away.",
  },
  {
    q: "What accounts does Vmail actually connect to right now?",
    a: "Gmail and Outlook/Exchange mail, connected independently in Settings. Apple Mail can be connected too (email + app-specific password), but message sync for it is still being built — its messages don't appear in the merged list yet.",
  },
  {
    q: "Can I send email from Vmail directly?",
    a: "Yes — Compose is a real send, right from the tab, with a from-account picker whenever you have more than one connected. You can also ask Vaea Chat to send or draft a reply to whichever account a message is on.",
  },
  {
    q: "Does the assistant actually delete or send things on its own?",
    a: "Sending and drafting run immediately (they're reversible or never sent at all). Deleting a message goes through the same real confirm step every other destructive action in Vaea does — nothing gets removed without you seeing it first and choosing Yes.",
  },
  {
    q: "Where is my email or calendar data stored?",
    a: "Nowhere on Vaea's servers. Each connection's access token lives on your own device and is sent along transiently, only for the moment a request actually needs it.",
  },
  {
    q: "Is Meetings live yet?",
    a: "Not yet — it needs a real transcript connector (Zoom, Google Meet, or Microsoft Teams) before there's anything real to show, and nothing's faked in the meantime. Calendar and Vmail, alongside it on this page, are both real and working today.",
  },
];

const WORKPLACE_PAGE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "Vaea Workplace — calendar, inbox, and meetings, merged",
  "url": "https://vaea.base44.app/workplace",
  "description": "Vaea Workplace merges Google Workspace and Microsoft 365 calendars, Gmail and Outlook inboxes, and (coming soon) meeting transcripts into one native surface — editable through Vaea Chat.",
  "isPartOf": { "@type": "WebSite", "url": "https://vaea.base44.app/" },
};

const WORKPLACE_FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": FAQS.map(({ q, a }) => ({ "@type": "Question", "name": q, "acceptedAnswer": { "@type": "Answer", "text": a } })),
};

export default function WorkplacePage() {
  useDocumentMeta("Vaea Workplace — calendar, inbox, and meetings, merged", "/workplace");
  usePageSchema(WORKPLACE_PAGE_SCHEMA);
  usePageSchema(WORKPLACE_FAQ_SCHEMA);

  return (
    <MarketingLayout>
      {/* ── HERO ── dark ── */}
      <section className={`relative overflow-hidden ${darkSectionBg} ${darkText} ${darkTopEdge}`}>
        <StageLight />
        <Grain />
        <div className="relative max-w-5xl mx-auto px-6 pt-20 sm:pt-28 pb-16 sm:pb-20">
          <Reveal className="text-center mb-12">
            <p className={`${eyebrowOnDark} mb-5`}>Vaea Workplace</p>
            <h1 className={`${displayXL} max-w-3xl mx-auto`}>
              Your calendar, your inbox — one real surface.
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Google Workspace and Microsoft 365 calendars merged into one agenda. Gmail
              and Outlook merged into one inbox. Meetings joins once a real transcript
              connector exists — nothing faked in the meantime.
            </p>
            <div className="mt-8 flex items-center justify-center gap-5 flex-wrap">
              <Link to="/signup" className={pillOnDark}>
                Connect your workplace
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link to="/how-it-works" className={linkOnDark}>
                See how it works
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── CALENDAR ── light ── */}
      <section className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(55%_60%_at_50%_0%,rgba(70,186,209,0.05),transparent_70%)]" />
        <div className="relative max-w-5xl mx-auto px-6 py-16 sm:py-24">
          <Reveal className="text-center mb-10">
            <p className={`${eyebrowOnLight} mb-4`}>Calendar</p>
            <h2 className={displayL}>One calendar. Every source.</h2>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Instead of embedding Google Calendar in one tab and Outlook in another, Vaea
              Calendar asks each connected source for what's coming up and merges the
              results into a single, sorted list.
            </p>
          </Reveal>
          <Reveal delay={100}>
            <CalendarAgendaDemo />
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-12">
            {CALENDAR_FEATURES.map(({ icon: Icon, title, body }, i) => (
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

      {/* ── VMAIL ── dark ── */}
      <section className={`relative overflow-hidden ${darkSectionBg} ${darkText} ${darkTopEdge}`}>
        <StageLight />
        <Grain />
        <div className="relative max-w-5xl mx-auto px-6 py-16 sm:py-24">
          <Reveal className="text-center mb-10">
            <p className={`${eyebrowOnDark} mb-4`}>Vmail</p>
            <h2 className={`${displayL} max-w-2xl mx-auto`}>One inbox. Managed for you.</h2>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Gmail and Outlook, merged into one real inbox — folders, search, compose. Ask
              Vaea Chat to triage it, flag scams, archive the noise, or draft a reply, and
              it acts on your real account.
            </p>
          </Reveal>
          <Reveal delay={100}>
            <InboxDemo />
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-12">
            {VMAIL_FEATURES.map(({ icon: Icon, title, body }, i) => (
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

      {/* ── MEETINGS ── light ── deliberately restrained: an honest
          coming-soon, not a mockup of a feature that doesn't exist yet. */}
      <section className="relative">
        <div className="max-w-5xl mx-auto px-6 py-16 sm:py-24">
          <Reveal className="text-center mb-10">
            <p className={`${eyebrowOnLight} mb-4`}>Meetings — coming soon</p>
            <h2 className={displayL}>Notes, action items, and decisions — from the actual call.</h2>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Built honestly, in order: it needs a real transcript connector (Zoom, Google
              Meet, Microsoft Teams) before there's anything real to show.
            </p>
          </Reveal>
          <Reveal delay={100}>
            <div className={`relative w-full max-w-md mx-auto rounded-2xl overflow-hidden ${glassPanel}`}>
              <div className={glassSheen} />
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-foreground/[0.08]">
                <Video className="w-3.5 h-3.5 text-foreground/35" />
                <span className="font-terminal text-[11px] text-foreground/35">Meetings</span>
              </div>
              <div className="px-5 py-10 text-center">
                <Video className="w-6 h-6 text-foreground/25 mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground/80">No meeting source connected yet</p>
                <p className="text-xs text-foreground/40 mt-1.5 max-w-xs mx-auto leading-relaxed">
                  What the real tab shows today — a plain, honest empty state, not a mockup
                  of a feature that doesn't exist.
                </p>
              </div>
            </div>
          </Reveal>
          <div className="grid sm:grid-cols-3 gap-4 mt-12 max-w-4xl mx-auto">
            {MEETINGS_PLANNED.map(({ icon: Icon, title, body }, i) => (
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

      {/* ── FAQ ── light ── */}
      <section className="border-t border-foreground/[0.06]">
        <div className="max-w-2xl mx-auto px-6 py-16 sm:py-20">
          <Reveal className="mb-10 text-center">
            <h2 className={displayM}>Questions about Workplace</h2>
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

      {/* ── CTA ── dark ── */}
      <section className={`relative overflow-hidden ${darkSectionBg} ${darkText} ${darkTopEdge}`}>
        <StageLight />
        <Grain />
        <div className="relative max-w-3xl mx-auto px-6 py-24 sm:py-32 text-center">
          <Reveal>
            <h2 className={displayL}>Stop checking five tabs.<br />Vaea already merged them.</h2>
            <p className="mt-5 text-muted-foreground max-w-md mx-auto leading-relaxed">
              Connect once in Settings. From then on, "what's on my day" is the whole
              question.
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

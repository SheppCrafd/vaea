import { Link } from "react-router-dom";
import { ArrowRight, Inbox, Send, Archive, ShieldAlert, Trash2, PenSquare, MessageCircle, Apple, Check } from "lucide-react";
import MarketingLayout from "./MarketingLayout";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Reveal, StageLight, Grain, useTimeline, useDocumentMeta, usePageSchema } from "./effects";
import {
  darkSectionBg, darkText, darkTopEdge, glassPanel, glassSheen, glassTileLight,
  pillOnDark, linkOnDark, eyebrowOnDark, eyebrowOnLight,
  displayXL, displayL, displayM, GLOW,
} from "./theme";

// ─── inbox demo ──────────────────────────────────────────────────────────────
// Mirrors the real VmailPage.jsx: folder tabs (Inbox/Sent/Archive/Junk/
// Trash) across the top, a merged Gmail+Outlook message list, and the same
// per-message actions that page renders on hover — ending on Vaea Chat
// flagging one message as spam, exactly what REPORT_GMAIL_SPAM/
// REPORT_OUTLOOK_SPAM do for real.

const FOLDERS = [
  { key: "inbox", label: "Inbox", Icon: Inbox },
  { key: "sent", label: "Sent", Icon: Send },
  { key: "archive", label: "Archive", Icon: Archive },
  { key: "junk", label: "Junk", Icon: ShieldAlert },
  { key: "trash", label: "Trash", Icon: Trash2 },
];

const VMAIL_PHASES = [500, 700, 700, 900, 900];

const MESSAGES = [
  { provider: "Gmail", from: "Priya Shah", subject: "Contract redline attached", time: "12m ago", unread: true },
  { provider: "Outlook", from: "Dana Kim", subject: "Re: Thursday's agenda", time: "48m ago", unread: true },
  { provider: "Gmail", from: "\"IT Security\"", subject: "URGENT: verify your account now", time: "1h ago", unread: true, flagged: true },
];

function InboxDemo() {
  const { ref, step } = useTimeline(VMAIL_PHASES);
  return (
    <div ref={ref} className={`relative w-full max-w-xl mx-auto rounded-2xl overflow-hidden ${glassPanel}`}>
      <div className={glassSheen} />
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-foreground/[0.08]">
        <Inbox className="w-3.5 h-3.5 text-foreground/35" />
        <span className="font-terminal text-[11px] text-foreground/35 flex-1 min-w-0 truncate">Vmail</span>
        <span className="font-terminal text-[10px] text-foreground/25">2 accounts</span>
      </div>
      <div className="flex items-center gap-4 px-5 pt-3 border-b border-foreground/[0.08]">
        {FOLDERS.map(({ key, label, Icon }) => (
          <span key={key} className={`flex items-center gap-1.5 text-[11px] pb-2.5 border-b-2 ${key === "inbox" ? "border-current text-foreground/80" : "border-transparent text-foreground/30"}`}>
            <Icon className="w-3 h-3" /> {label}
          </span>
        ))}
      </div>
      <div className="px-5 py-5 min-h-[190px] text-left flex flex-col divide-y divide-foreground/[0.06]">
        {MESSAGES.map((m, i) => (
          <div
            key={m.subject}
            className={`flex items-center gap-2.5 py-2.5 first:pt-0 last:pb-0 transition-all duration-500 ${
              step >= i + 1 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
            } ${step >= 4 && m.flagged ? "opacity-30" : ""}`}
          >
            {m.unread && !(step >= 4 && m.flagged) && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: GLOW }} />}
            <span className="font-terminal text-[10px] text-foreground/35 uppercase tracking-wider shrink-0 w-14">{m.provider}</span>
            <span className={`text-sm truncate shrink-0 w-32 ${m.unread ? "text-foreground/90 font-medium" : "text-foreground/50"}`}>{m.from}</span>
            <span className={`text-sm truncate flex-1 ${m.unread ? "text-foreground/85 font-medium" : "text-foreground/50"}`}>{m.subject}</span>
            {step >= 4 && m.flagged ? (
              <span className="flex items-center gap-1 font-terminal text-[10px] shrink-0" style={{ color: GLOW }}>
                <ShieldAlert className="w-3 h-3" /> moved to junk
              </span>
            ) : (
              <span className="font-terminal text-[10px] text-foreground/35 shrink-0">{m.time}</span>
            )}
          </div>
        ))}
      </div>
      {step >= 4 && (
        <div className="px-5 py-3 border-t border-foreground/[0.08] flex items-center gap-2">
          <MessageCircle className="w-3.5 h-3.5 shrink-0" style={{ color: GLOW }} />
          <span className="font-terminal text-[11px] text-foreground/50">"That IT Security email is phishing — I reported it as spam."</span>
        </div>
      )}
    </div>
  );
}

// ─── features ────────────────────────────────────────────────────────────────

const FEATURES = [
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
    icon: ShieldAlert,
    title: "Each account is its own consent",
    body: "Gmail and Outlook mail are separate connections from each other and from your calendar — grant one without the other, revoke either anytime in Settings.",
  },
  {
    icon: Apple,
    title: "Apple Mail is on the way",
    body: "Connect an iCloud address with an app-specific password today — message sync for it is still being built, so Gmail and Outlook are what actually show up in the list right now.",
  },
  {
    icon: Check,
    title: "Nothing sits on Vaea's servers",
    body: "Every account's connection lives on your own device and is sent along only for the moment a request needs it — never stored at rest.",
  },
];

// ─── FAQ ─────────────────────────────────────────────────────────────────────

const FAQS = [
  {
    q: "What accounts does Vmail actually connect to right now?",
    a: "Gmail and Outlook/Exchange mail, connected independently in Settings. Apple Mail can be connected too (email + app-specific password), but message sync for it is still being built — its messages don't appear in the merged list yet.",
  },
  {
    q: "Is Outlook mail the same connection as my Microsoft 365 calendar?",
    a: "No — they're two separate, independently-consented connections off the same Microsoft account, so you can grant calendar access without also granting inbox access, or the other way around.",
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
    q: "What happens when it flags something as spam?",
    a: "It calls the real Gmail or Outlook API to move that exact message into Spam/Junk, the same as clicking \"Report spam\" yourself would — nothing simulated about it.",
  },
  {
    q: "Where is my email stored?",
    a: "Nowhere on Vaea's servers. Each connection's access token lives on your own device and is sent along transiently, only for the moment a request actually needs it.",
  },
];

const VMAIL_PAGE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "Vmail — one inbox, managed for you",
  "url": "https://vaea.base44.app/vmail",
  "description": "Vmail merges Gmail and Outlook (with Apple Mail coming) into one native inbox with real folders, search, and compose — and Vaea Chat can triage, archive, flag spam, or draft replies on your behalf.",
  "isPartOf": { "@type": "WebSite", "url": "https://vaea.base44.app/" },
};

const VMAIL_FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": FAQS.map(({ q, a }) => ({ "@type": "Question", "name": q, "acceptedAnswer": { "@type": "Answer", "text": a } })),
};

export default function VmailPage() {
  useDocumentMeta(
    "Vmail — one inbox, managed for you",
    "/vmail",
    "Gmail and Outlook merged into one real inbox with folders, search, and compose. Ask Vaea Chat to triage it, flag scams, archive the noise, or draft a reply."
  );
  usePageSchema(VMAIL_PAGE_SCHEMA);
  usePageSchema(VMAIL_FAQ_SCHEMA);

  return (
    <MarketingLayout>
      <section className={`relative overflow-hidden ${darkSectionBg} ${darkText} ${darkTopEdge}`}>
        <StageLight />
        <Grain />
        <div className="relative max-w-5xl mx-auto px-6 pt-20 sm:pt-28 pb-16 sm:pb-20">
          <Reveal className="text-center mb-12">
            <p className={`${eyebrowOnDark} mb-5`}>Vmail</p>
            <h1 className={`${displayXL} max-w-3xl mx-auto`}>
              One inbox. Managed for you.
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Gmail and Outlook, merged into one real inbox — folders, search,
              compose. Ask Vaea Chat to triage it, flag scams, archive the
              noise, or draft a reply, and it acts on your real account.
            </p>
            <div className="mt-8 flex items-center justify-center gap-5 flex-wrap">
              <Link to="/signup" className={pillOnDark}>
                Connect your inbox
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link to="/how-it-works" className={linkOnDark}>
                See how it works
              </Link>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <InboxDemo />
          </Reveal>
        </div>
      </section>

      <section className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(55%_60%_at_50%_0%,rgba(70,186,209,0.05),transparent_70%)]" />
        <div className="relative max-w-5xl mx-auto px-6 py-16 sm:py-24">
          <div className="sm:grid sm:grid-cols-2 sm:gap-16 sm:items-start">
            <Reveal>
              <p className={`${eyebrowOnLight} mb-4`}>Not a mail client bolted on</p>
              <h2 className={`${displayL} mb-6`}>Your real accounts.<br />One managed inbox.</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Vaea doesn't run its own mail service — Vmail is what your real
                Gmail and Outlook accounts look like once Vaea reads both,
                sorts the result into real folders, and lets you compose from
                either one.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Each account is its own consent screen and its own token,
                stored on your device — connect one, connect both, or skip
                mail entirely.
              </p>
            </Reveal>
            <Reveal delay={100}>
              <div className={`p-5 rounded-2xl ${glassTileLight}`}>
                <p className="text-sm font-medium mb-1">"Clean up my inbox — anything that looks like a scam, flag it."</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Vaea Chat reads what's actually there and reports the real
                  ones as spam through Gmail/Outlook's own API — the same
                  action clicking the button yourself would take.
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
            <h2 className={displayM}>Questions about Vmail</h2>
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
            <h2 className={displayL}>Stop triaging your own inbox.<br />Let Vaea do the first pass.</h2>
            <p className="mt-5 text-muted-foreground max-w-md mx-auto leading-relaxed">
              Connect once in Settings. From then on, "clean this up" is the
              whole request.
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

import { Link } from "react-router-dom";
import MarketingLayout, { MAINTAINER } from "./MarketingLayout";
import { Reveal, useDocumentMeta } from "./effects";
import { hairlineH, lightWash, glassTileLight, glowTop, eyebrowOnLight, displayL, focusRing } from "./theme";

const SECTIONS = [
  {
    id: "short-version",
    title: "The short version",
    body: (
      <>
        <p>
          Vaea is built so most of your data never leaves your device in the first place. Projects,
          tasks, and notes are stored as real files — either in a folder you pick on your own
          computer, or (only if you choose it) in a cloud account tied to your sign-in. Chat
          messages are the one exception: sending a message to Vaea Chat means it's sent to
          whichever AI model is answering it, for that one request, and it's never stored on our
          servers afterward.
        </p>
      </>
    ),
  },
  {
    id: "project-data",
    title: "Your project data",
    body: (
      <>
        <p>
          By default, everything you build in Vaea — areas, products, projects, tasks — is
          local-first. On Chrome or Edge, you grant the app access to a folder on your own
          computer once, and every change is written there as real files you can open and read
          yourself, no server involved. On other browsers, you save and load a file by hand
          instead; nothing is written anywhere automatically.
        </p>
        <p className="mt-3">
          Cloud sync is optional and opt-in only, never the default. If you sign in and switch to
          it — in the first-run setup or later in Settings — your project data is stored in a
          Base44-hosted database, scoped to your account, so it follows you across devices. You
          can switch back to device storage at any time; nothing is permanently stuck wherever you
          first put it.
        </p>
      </>
    ),
  },
  {
    id: "chat",
    title: "Vaea Chat and your messages",
    body: (
      <>
        <p>
          For the built-in AI and BYOK, Vaea Chat needs you signed in to use — that account is
          what a resumable conversation history gets scoped to. Local Mode is the one exception:
          it runs without signing in at all (see Local Mode below). Whichever way you're chatting,
          when you send a message it's forwarded to whichever AI model is answering it — Vaea's
          own provider, your own API key, or your own Local Mode connection — for that single
          request. Your message content is not stored on Vaea's servers once the reply comes back.
        </p>
        <p className="mt-3">
          For the built-in AI and BYOK, your chat session history (the list of past conversations
          and their messages, so you can come back to them) lives on our servers rather than your
          device, scoped to your account — the one piece of data outside the local-first/cloud-opt-in
          rules above. Local Mode keeps this local too: your conversation history is written as
          files on your device instead. Everything else Vaea Chat touches — the projects, tasks,
          and notes it reads or edits on your behalf — follows the same local-first or cloud-opt-in
          rules as the rest of your data above, regardless of which of the three ways you're
          chatting.
        </p>
      </>
    ),
  },
  {
    id: "byok",
    title: "Bring your own API key (BYOK)",
    body: (
      <>
        <p>
          If you connect your own API key for an AI provider instead of using Vaea's default, that
          key is stored locally on your device — in your browser's own storage, never uploaded to
          or held by Vaea's servers. When Vaea Chat needs it, requests go directly from your
          browser to that provider's API. We never see the key and we never see the response
          before your browser does.
        </p>
      </>
    ),
  },
  {
    id: "local-mode",
    title: "Local Mode",
    body: (
      <>
        <p>
          Local Mode skips hosted AI entirely. You connect a folder on your own device; Vaea writes
          each message as a plain file there, and whatever's answering — a model you run yourself,
          or Claude Code — reads it and writes a reply back the same way. Vaea makes no network
          call of its own in this mode, doesn't require you to be signed in, and keeps your
          conversation history in that same folder rather than on our servers. The one thing this
          page can't promise on your behalf is what your chosen model itself does with what you
          send it — if that's Claude Code, its own request to Anthropic is outside Vaea's control,
          the same as it would be if you used Claude Code directly for anything else.
        </p>
      </>
    ),
  },
  {
    id: "sign-in",
    title: "Signing in",
    body: (
      <>
        <p>
          Sign-in (Google, Microsoft, Apple, or email) is handled by Base44, the platform Vaea is
          built and hosted on — Vaea itself never sees or stores your password. Signing in
          unlocks the built-in AI, BYOK chat, and cloud storage; browsing, organizing, editing,
          and importing a spreadsheet all work the same whether you're signed in or not — and
          Local Mode runs chat without signing in too.
        </p>
      </>
    ),
  },
  {
    id: "vault",
    title: "Vaea Vault (optional)",
    body: (
      <>
        <p>
          Vaea Vault is a separate, optional feature that connects an Obsidian notes vault backed
          by your own GitHub repository. If you turn it on, Vaea reads and writes notes there on
          your behalf using a GitHub connection you authorize — every write is a real commit to
          your own repo, recoverable from GitHub's own history, and nothing about your vault is
          copied to or held by Vaea's servers beyond what's needed to make that one read or write.
          Two further opt-ins inside Vaea Vault — the assistant reviewing its own replies, and
          separately, it noticing patterns in how you work — are both off by default and controlled
          entirely by you in Settings.
        </p>
      </>
    ),
  },
  {
    id: "what-we-dont-do",
    title: "What we don't do",
    body: (
      <>
        <p>
          Vaea doesn't run third-party analytics or advertising trackers, doesn't sell or share
          your data with anyone, and doesn't use your chat messages or project content to train
          any model. There are no pricing tiers gating features behind data collection — Vaea is
          free.
        </p>
      </>
    ),
  },
  {
    id: "questions",
    title: "Questions",
    body: (
      <>
        <p>
          Vaea is built and maintained solo. If anything here is unclear, or you want details
          beyond what's on this page, email{" "}
          <a href={`mailto:${MAINTAINER.email}`} className={`text-foreground underline underline-offset-2 rounded-sm ${focusRing}`}>
            {MAINTAINER.email}
          </a>{" "}
          or open an issue on{" "}
          <a
            href={MAINTAINER.github + "/vaea"}
            target="_blank"
            rel="noopener noreferrer"
            className={`text-foreground underline underline-offset-2 rounded-sm ${focusRing}`}
          >
            GitHub
          </a>.
        </p>
      </>
    ),
  },
];

export default function PrivacyPage() {
  useDocumentMeta("Privacy Policy | Vaea", "/privacy");

  return (
    <MarketingLayout>
      <section className={`relative ${lightWash}`}>
        <div aria-hidden="true" className={glowTop} />
        <div className="relative max-w-3xl mx-auto px-6 py-24 sm:py-32">
          <Reveal>
            <p className={eyebrowOnLight}>Privacy</p>
            <h1 className={`${displayL} mt-3 mb-3`}>Privacy Policy</h1>
            <p className="text-sm text-muted-foreground mb-10 max-w-xl">
              Last updated August 2026. Plain language, no legal filler — this is what actually
              happens to your data.
            </p>
          </Reveal>

          {/* Quick-jump index — a legal page is read by scanning for the one
              section that matters, not top to bottom, so give that scan a
              real target list instead of forcing a scroll-and-hunt. */}
          <Reveal delay={80} className={`rounded-2xl p-5 sm:p-6 mb-4 ${glassTileLight}`}>
            <p className="font-terminal text-xs uppercase tracking-[0.22em] text-muted-foreground mb-3">
              On this page
            </p>
            <nav aria-label="Sections on this page">
              <ol className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
                {SECTIONS.map((section, i) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className={`group flex items-baseline gap-2.5 py-1 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-sm ${focusRing}`}
                    >
                      <span className="font-terminal text-xs text-foreground/35 group-hover:text-primary transition-colors">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      {section.title}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </Reveal>

          <div className="mt-8">
            {SECTIONS.map((section, i) => (
              <div key={section.id} id={section.id} className="scroll-mt-24">
                <Reveal
                  delay={Math.min(i * 40, 200)}
                  className="py-8 sm:grid sm:grid-cols-[220px_1fr] sm:gap-10"
                >
                  {i > 0 && (
                    <div aria-hidden="true" className={`${hairlineH} sm:col-span-2 -mt-8 mb-8`} />
                  )}
                  <div className="mb-3 sm:mb-0">
                    <p className="font-terminal text-xs text-primary/70 mb-1.5">
                      {String(i + 1).padStart(2, "0")}
                    </p>
                    <h2 className="font-heading text-lg font-semibold tracking-tight">{section.title}</h2>
                  </div>
                  <div className="text-sm text-muted-foreground leading-relaxed">{section.body}</div>
                </Reveal>
              </div>
            ))}
          </div>

          <Reveal delay={280}>
            <p className="mt-4 text-sm text-muted-foreground">
              See also our{" "}
              <Link to="/terms" className={`text-foreground underline underline-offset-2 rounded-sm ${focusRing}`}>
                Terms of Service
              </Link>.
            </p>
          </Reveal>
        </div>
      </section>
    </MarketingLayout>
  );
}

import { Link } from "react-router-dom";
import MarketingLayout, { MAINTAINER } from "./MarketingLayout";
import { Reveal, useDocumentMeta } from "./effects";
import { hairlineH, lightWash, glassTileLight, glowTop, eyebrowOnLight, displayL, focusRing } from "./theme";

const SECTIONS = [
  {
    id: "what-vaea-is",
    title: "What Vaea is",
    body: (
      <>
        <p>
          Vaea is a free personal project and task manager, built and maintained solo, with an
          optional AI assistant (Vaea Chat) and an optional notes vault integration (Vaea Vault).
          There are no paid tiers and no usage limits — using it means agreeing to these terms.
        </p>
      </>
    ),
  },
  {
    id: "account-and-data",
    title: "Your account and your data",
    body: (
      <>
        <p>
          You're responsible for whatever you enter into Vaea — projects, tasks, notes, and chat
          messages — and for keeping your sign-in credentials secure. Your project data belongs to
          you; see the{" "}
          <Link to="/privacy" className={`text-foreground underline underline-offset-2 rounded-sm ${focusRing}`}>
            Privacy Policy
          </Link>{" "}
          for exactly where it lives and who can see it. If you use device storage, you're
          responsible for your own backups (Vaea Vault's git history aside) — losing the folder or
          file means losing that data, since it's never copied to our servers.
        </p>
      </>
    ),
  },
  {
    id: "chat-and-ai-actions",
    title: "Vaea Chat and AI-generated actions",
    body: (
      <>
        <p>
          Vaea Chat can create, edit, and delete things in your workspace directly, not just
          describe what it would do. It's built to confirm meaningfully destructive actions before
          taking them, but AI output can still be wrong — review what it does, especially for
          anything you'd be upset to lose. Vaea isn't liable for actions Vaea Chat takes on your
          data, whether initiated by you or the assistant acting on your instructions.
        </p>
        <p className="mt-3">
          If you bring your own API key for an AI provider, or use Local Mode with Claude Code or
          a model of your own, your use of that provider or model is also governed by its own
          terms — Vaea has no control over how they handle requests sent through your key or your
          own connection.
        </p>
      </>
    ),
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    body: (
      <>
        <p>
          Don't use Vaea to store or generate unlawful content, attempt to disrupt, scrape, or
          reverse-engineer the service, or use Vaea Chat to abuse the underlying AI providers in
          ways that violate their own usage policies.
        </p>
      </>
    ),
  },
  {
    id: "availability-and-changes",
    title: "Availability and changes",
    body: (
      <>
        <p>
          Vaea is a solo, free project — there's no uptime guarantee or support SLA. Features can
          change, and this document can be updated as they do; material changes will be reflected
          here with an updated date at the top. Continuing to use Vaea after a change means you
          accept the update.
        </p>
      </>
    ),
  },
  {
    id: "source-code",
    title: "The source code",
    body: (
      <>
        <p>
          Vaea's source is visible on{" "}
          <a
            href={MAINTAINER.github + "/vaea"}
            target="_blank"
            rel="noopener noreferrer"
            className={`text-foreground underline underline-offset-2 rounded-sm ${focusRing}`}
          >
            GitHub
          </a>{" "}
          so you can see exactly what the app does — but it's all rights reserved (see the
          repository's LICENSE.md), not open source. You're welcome to read it; copying,
          modifying, or redistributing it isn't permitted without asking first. These terms
          otherwise cover using the hosted app at vaea.base44.app.
        </p>
      </>
    ),
  },
  {
    id: "no-warranty",
    title: "No warranty",
    body: (
      <>
        <p>
          Vaea is provided as-is, with no warranty of any kind. It's a personal project maintained
          by one person in their own time, not a company with a support team behind it.
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
          Email{" "}
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

export default function TermsPage() {
  useDocumentMeta("Terms of Service | Vaea", "/terms");

  return (
    <MarketingLayout>
      <section className={`relative ${lightWash}`}>
        <div aria-hidden="true" className={glowTop} />
        <div className="relative max-w-3xl mx-auto px-6 py-24 sm:py-32">
          <Reveal>
            <p className={eyebrowOnLight}>Terms</p>
            <h1 className={`${displayL} mt-3 mb-3`}>Terms of Service</h1>
            <p className="text-sm text-muted-foreground mb-10 max-w-xl">
              Last updated August 2026. Plain language, no legal filler.
            </p>
          </Reveal>

          {/* Quick-jump index — same scan-first pattern as the Privacy page,
              so the two documents feel like one considered pair rather than
              two independently-built pages. */}
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
              <Link to="/privacy" className={`text-foreground underline underline-offset-2 rounded-sm ${focusRing}`}>
                Privacy Policy
              </Link>.
            </p>
          </Reveal>
        </div>
      </section>
    </MarketingLayout>
  );
}

import { Container, Eyebrow, Reveal } from "../components/ui";
import { ClosingCta } from "../components/blocks";
import ParallaxBackdrop from "../components/ParallaxBackdrop";
import { MAKER } from "../seo";

// A hand-built profile card using the site's own tokens — deliberately not
// Gravatar's embedded widget (fixed internal layout, no dark-mode hook, and
// it reads as a card-in-a-card). Every value comes from the maintainer's own
// public Gravatar profile; the avatar is self-hosted in /public so there's
// no third-party request or layout shift.
function MakerCard() {
  return (
    <div className="rounded-2xl border border-foreground/[0.08] bg-card/60 p-7 shadow-[0_1px_3px_0_hsl(200_30%_12%/0.08),0_28px_60px_-32px_hsl(200_30%_12%/0.3)] backdrop-blur sm:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
        <img
          src={MAKER.avatar}
          alt={`${MAKER.name}, maintainer of Vaea`}
          width="88"
          height="88"
          className="h-[88px] w-[88px] shrink-0 rounded-2xl border border-foreground/[0.08] object-cover"
        />
        <div className="min-w-0">
          <p className="font-display text-2xl font-semibold tracking-[-0.02em] text-foreground">
            {MAKER.name}
          </p>
          <p className="mt-1 font-mono text-[0.72rem] uppercase tracking-[0.16em] text-muted-foreground">
            {MAKER.role}
          </p>
          <p className="mt-3 text-[1.02rem] font-medium leading-snug text-foreground">{MAKER.bio}</p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 border-t border-foreground/[0.08] pt-5 text-sm">
        <a
          href={MAKER.github}
          target="_blank"
          rel="noreferrer"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          GitHub
        </a>
        <a
          href={MAKER.gravatar}
          target="_blank"
          rel="noreferrer"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          Gravatar profile
        </a>
        <a
          href={`mailto:${MAKER.email}`}
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          {MAKER.email}
        </a>
      </div>
    </div>
  );
}

export default function About() {
  return (
    <>
      <section className="pt-12 sm:pt-16">
        <Container>
          <div className="grid items-start gap-10 md:grid-cols-[1fr_minmax(0,26rem)] md:gap-14">
            <div className="max-w-[40rem]">
              <Eyebrow className="mb-4">who builds Vaea</Eyebrow>
              <h1 className="text-balance font-display text-[clamp(2.4rem,6vw,4.2rem)] font-semibold leading-[1.02] tracking-[-0.038em] text-foreground">
                Built and maintained by one person.
              </h1>
              <p className="mt-6 max-w-[36rem] text-[1.06rem] leading-relaxed text-muted-foreground">
                Vaea is designed, built, and supported by a single maintainer. The public profile and
                contact details are below, and the full source is on GitHub.
              </p>
            </div>
            <Reveal delay={80} className="md:pt-6">
              <MakerCard />
            </Reveal>
          </div>
        </Container>
      </section>

      <ParallaxBackdrop
        as="section"
        src="/img/marketing/about-band.jpg"
        strength={48}
        scrim={0.85}
        position="50% 70%"
        className="py-[calc(var(--mkt-section-y)*0.95)]"
      >
        <Container className="max-w-[42rem]">
          <Reveal className="space-y-8">
            <div>
              <h2 className="font-display text-[clamp(1.5rem,2.8vw,2rem)] font-semibold tracking-[-0.025em] text-foreground">
                What a single-maintainer product means for you
              </h2>
              <div className="mt-3.5 space-y-3.5 text-[1rem] leading-relaxed text-muted-foreground">
                <p>
                  The source is public, and your board is stored as plain files on your own computer
                  by default. If development ever paused, those files would still open and the code
                  would still be available.
                </p>
                <p>
                  Vaea is a single-user product today — there are no shared team spaces, roles, or
                  admin console. It is built for one person managing a portfolio of work.
                </p>
              </div>
            </div>

            <div>
              <h2 className="font-display text-[clamp(1.5rem,2.8vw,2rem)] font-semibold tracking-[-0.025em] text-foreground">
                Contact
              </h2>
              <div className="mt-3.5 space-y-3.5 text-[1rem] leading-relaxed text-muted-foreground">
                <p>
                  Bug reports, feature requests, and questions are welcome. Open an issue on{" "}
                  <a
                    href={MAKER.github}
                    target="_blank"
                    rel="noreferrer"
                    className="text-foreground underline decoration-foreground/25 underline-offset-2 hover:decoration-foreground"
                  >
                    the repository
                  </a>
                  , or write to{" "}
                  <a
                    href={`mailto:${MAKER.email}`}
                    className="text-foreground underline decoration-foreground/25 underline-offset-2 hover:decoration-foreground"
                  >
                    {MAKER.email}
                  </a>
                  .
                </p>
              </div>
            </div>
          </Reveal>
        </Container>
      </ParallaxBackdrop>

      <ClosingCta title="Put your portfolio on one board." note="No card required · your information stays on your computer" />
    </>
  );
}

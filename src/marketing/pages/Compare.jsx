import { Container, Eyebrow, Reveal } from "../components/ui";
import { ClosingCta } from "../components/blocks";
import ParallaxBackdrop from "../components/ParallaxBackdrop";

// An honest category comparison — Vaea against the general pattern most
// people use (a cloud task manager plus a separate AI), NOT a named
// competitor. The right-hand column is deliberately hedged ("usually") and
// concedes where that pattern is the better call. No claim here is about any
// specific product.

const ROWS = [
  ["Where your work is stored", "Plain files on your own computer, by default", "On the vendor's server"],
  ["Does the AI change things?", "Yes — it edits the board itself, after you approve each step", "Often suggests; you make the edit"],
  ["Cost", "You pay your own AI provider directly if you connect one", "Typically a per-seat subscription"],
  ["Works offline", "Yes — the board, and Vaea Chat too if you run a local model", "Usually not"],
  ["Team features (roles, shared spaces, admin)", "No — it's a single-person tool", "Usually yes"],
  ["Native mobile apps", "No — it's a responsive web app", "Usually iOS and Android"],
  ["Integrations", "A small set — calendar and mail through a connected account", "Usually a larger catalogue"],
  ["Support", "One person, best-effort, via GitHub or email", "Usually a support team, with SLAs on paid tiers"],
  ["If it stops being maintained", "Your files stay; the code is public", "You export what you can and move"],
];

export default function Compare() {
  return (
    <>
      <ParallaxBackdrop
        as="section"
        src="/img/marketing/compare-hero.jpg"
        eager
        strength={34}
        position="50% 40%"
        className="pt-12 pb-[calc(var(--mkt-section-y)*0.5)] sm:pt-16"
      >
        <Container>
          <div className="max-w-[46rem]">
            <Eyebrow className="mb-4">an honest comparison</Eyebrow>
            <h1 className="text-balance font-display text-[clamp(2.3rem,5.6vw,3.9rem)] font-semibold leading-[1.03] tracking-[-0.035em] text-foreground">
              Vaea vs. the usual setup
            </h1>
            <p className="mt-5 max-w-[42rem] text-[1.05rem] leading-relaxed text-muted-foreground">
              Most people run a cloud task manager plus a separate AI, or a stack of apps they hold
              together in their head. Vaea is the better fit if you're one person who wants the work
              in files you own and Vaea Chat to make the change itself. The usual setup is the better
              fit if you need a team system of record, native mobile apps, or a support contract —
              Vaea has none of those. Everything below is about that general pattern, not any one
              product.
            </p>
          </div>
        </Container>
      </ParallaxBackdrop>

      <section className="py-[calc(var(--mkt-section-y)*0.8)]">
        <Container>
          <p className="mb-3 font-mono text-[0.68rem] tracking-tight text-muted-foreground md:hidden">
            Swipe the table sideways to see both columns →
          </p>
          <Reveal className="overflow-x-auto">
            <table className="w-full min-w-[46rem] border-collapse text-left text-[0.95rem]">
              <thead>
                <tr className="border-b border-foreground/[0.12]">
                  <th className="py-3 pr-4 font-mono text-[0.7rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    &nbsp;
                  </th>
                  <th className="py-3 pr-4 font-display text-base font-semibold text-foreground">Vaea</th>
                  <th className="py-3 font-display text-base font-semibold text-muted-foreground">
                    The usual setup
                  </th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map(([dim, vaea, usual]) => (
                  <tr key={dim} className="border-b border-foreground/[0.08] align-top">
                    <td className="py-3.5 pr-4 font-medium text-foreground">{dim}</td>
                    <td className="py-3.5 pr-4 text-muted-foreground">{vaea}</td>
                    <td className="py-3.5 text-muted-foreground">{usual}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Reveal>
        </Container>
      </section>

      <section className="py-[calc(var(--mkt-section-y)*0.75)]">
        <Container>
          <div className="grid gap-10 md:grid-cols-2 md:gap-14">
            <Reveal>
              <h2 className="font-display text-[clamp(1.4rem,2.6vw,1.9rem)] font-semibold tracking-[-0.025em] text-foreground">
                Pick Vaea if…
              </h2>
              <ul className="mt-4 space-y-2.5 text-[0.98rem] leading-relaxed text-muted-foreground">
                <li>You're managing your own portfolio of work, not a team's.</li>
                <li>You want your projects in files on your machine, not a database you don't control.</li>
                <li>You want Vaea Chat to do the edit — and to see it before it runs.</li>
                <li>You're fine bringing your own AI key instead of a per-seat subscription.</li>
              </ul>
            </Reveal>
            <Reveal delay={70}>
              <h2 className="font-display text-[clamp(1.4rem,2.6vw,1.9rem)] font-semibold tracking-[-0.025em] text-foreground">
                Stay with the usual setup if…
              </h2>
              <ul className="mt-4 space-y-2.5 text-[0.98rem] leading-relaxed text-muted-foreground">
                <li>Your team needs shared spaces, roles, or an admin console.</li>
                <li>Native iOS / Android apps are non-negotiable.</li>
                <li>You need a vendor with a support SLA and a security questionnaire on file.</li>
                <li>You rely on a wide integration marketplace.</li>
              </ul>
            </Reveal>
          </div>
        </Container>
      </section>

      <ClosingCta title="Your work, in files you own." note="No card · try the board before you sign in" />
    </>
  );
}

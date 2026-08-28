import { Link } from "react-router-dom";
import { Container, Eyebrow, Reveal } from "./ui";
import { SITE_MODIFIED } from "../seo";

const UPDATED = new Date(`${SITE_MODIFIED}T00:00:00`).toLocaleDateString("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

// Shared shell for the two formal legal documents. Plain, sober, one column,
// real heading outline. `sections` is [{ heading, body: [paragraph, …] }].
export default function LegalDoc({ eyebrow, title, intro, sections, companion }) {
  return (
    <>
      <section className="pt-12 sm:pt-16">
        <Container className="max-w-[46rem]">
          <Eyebrow className="mb-4">{eyebrow}</Eyebrow>
          <h1 className="text-balance font-display text-[clamp(2.1rem,4.8vw,3.2rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-foreground">
            {title}
          </h1>
          {intro && (
            <p className="mt-5 text-[1.02rem] leading-relaxed text-muted-foreground">{intro}</p>
          )}
          <p className="mt-4 font-mono text-[0.72rem] tracking-tight text-muted-foreground">
            Last updated {UPDATED}
          </p>
          {companion && (
            <p className="mt-2 text-sm text-muted-foreground">
              Prefer plain language?{" "}
              <Link
                to={companion.to}
                className="text-foreground underline decoration-foreground/25 underline-offset-2 hover:decoration-foreground"
              >
                {companion.label}
              </Link>
            </p>
          )}
        </Container>
      </section>

      <section className="pb-[calc(var(--mkt-section-y)*0.9)] pt-[calc(var(--mkt-section-y)*0.35)]">
        <Container className="max-w-[46rem]">
          {sections.map((s) => (
            <Reveal key={s.heading} className="border-t border-foreground/[0.08] py-7 first:border-t-0">
              <h2 className="font-display text-[clamp(1.25rem,2.4vw,1.65rem)] font-semibold tracking-[-0.02em] text-foreground">
                {s.heading}
              </h2>
              <div className="mt-3 max-w-[64ch] space-y-3.5 text-[0.98rem] leading-relaxed text-muted-foreground">
                {s.body.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </Reveal>
          ))}
        </Container>
      </section>
    </>
  );
}

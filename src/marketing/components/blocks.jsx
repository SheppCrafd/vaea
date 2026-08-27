import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Container, Eyebrow, Reveal, CtaRow } from "./ui";

// Larger recurring page blocks.

// Alternating claim + real-component demo. `flip` puts the demo on the
// left. `tone="dark"` drops the block onto a near-black stage for register
// contrast.
export function ShowBlock({ id, eyebrow, title, children, visual, flip, tone, cta }) {
  const dark = tone === "dark";
  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-24 py-[calc(var(--mkt-section-y)*0.85)]",
        dark && "bg-primary text-primary-foreground",
      )}
    >
      <Container>
        <div className={cn("grid items-center gap-8 md:grid-cols-2 md:gap-14", flip && "md:[&>*:first-child]:order-2")}>
          <Reveal>
            {eyebrow && (
              <Eyebrow className={cn("mb-3", dark && "text-primary-foreground/60")}>{eyebrow}</Eyebrow>
            )}
            <h2
              className={cn(
                "text-balance font-display text-[clamp(1.75rem,3.4vw,2.7rem)] font-semibold leading-[1.06] tracking-[-0.03em]",
                dark ? "text-primary-foreground" : "text-foreground",
              )}
            >
              {title}
            </h2>
            <div
              className={cn(
                "mt-4 space-y-3.5 text-[1.02rem] leading-relaxed",
                dark ? "text-primary-foreground/75" : "text-muted-foreground",
              )}
            >
              {children}
            </div>
            {cta && (
              <Link
                to={cta.to}
                className={cn(
                  "group mt-6 inline-flex items-center gap-1.5 text-sm font-medium",
                  dark ? "text-primary-foreground" : "text-foreground",
                )}
              >
                {cta.label}
                <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
              </Link>
            )}
          </Reveal>
          <Reveal delay={70} className="min-w-0">
            {visual}
          </Reveal>
        </div>
      </Container>
    </section>
  );
}

// A moving mono ticker — the page's ambient motion, and a register break.
export function Marquee({ items }) {
  const row = [...items, ...items];
  return (
    <div className="mkt-marquee-mask overflow-hidden border-y border-foreground/[0.07] bg-card/30 py-3.5">
      <div className="mkt-marquee">
        {row.map((t, i) => (
          <span key={i} className="font-mono text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground">
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

// Honest, checkable signals in place of a customer logo wall.
export function ProofStrip({ items }) {
  return (
    <div className="border-y border-foreground/[0.07] bg-card/30">
      <Container className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2.5 py-4">
        {items.map((it) => (
          <span key={it} className="font-mono text-[0.73rem] tracking-tight text-muted-foreground">
            {it}
          </span>
        ))}
      </Container>
    </div>
  );
}

// Short, disagreeable line — the thing this is against. Centered interlude.
export function Manifesto({ children }) {
  return (
    <section className="py-[calc(var(--mkt-section-y)*0.7)]">
      <Container>
        <Reveal className="mx-auto max-w-[40rem] text-center">
          <p className="text-balance font-display text-[clamp(1.5rem,3vw,2.15rem)] font-medium leading-[1.22] tracking-[-0.02em] text-foreground">
            {children}
          </p>
        </Reveal>
      </Container>
    </section>
  );
}

// Real <details> — keyboard-operable, and backs FAQ structured data.
export function Faq({ items, className }) {
  return (
    <div className={cn("divide-y divide-foreground/[0.08] border-y border-foreground/[0.08]", className)}>
      {items.map((qa) => (
        <details key={qa.q} className="group py-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[1rem] font-medium text-foreground [&::-webkit-details-marker]:hidden">
            {qa.q}
            <span aria-hidden="true" className="shrink-0 text-muted-foreground transition-transform group-open:rotate-45">
              +
            </span>
          </summary>
          <div className="mt-3 max-w-[54ch] text-[0.96rem] leading-relaxed text-muted-foreground">{qa.a}</div>
        </details>
      ))}
    </div>
  );
}

// Full-bleed closing band — biggest type on the page, both actions once more.
export function ClosingCta({ title, note }) {
  return (
    <section className="mt-[var(--mkt-section-y)] bg-primary py-[clamp(3.5rem,8vw,6rem)] text-primary-foreground">
      <Container>
        <Reveal className="mx-auto max-w-[40rem] text-center">
          <h2 className="text-balance font-display text-[clamp(2.1rem,5.5vw,3.7rem)] font-semibold leading-[1.02] tracking-[-0.035em]">
            {title}
          </h2>
          <div className="mt-7 flex flex-col items-center gap-3.5">
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                to="/signup"
                className="mkt-lift inline-flex items-center rounded-full bg-primary-foreground px-6 py-3 text-sm font-medium text-primary"
              >
                Get started free
              </Link>
              <Link
                to="/app"
                className="mkt-lift inline-flex items-center rounded-full border border-primary-foreground/25 px-6 py-3 text-sm font-medium text-primary-foreground hover:border-primary-foreground/50"
              >
                Open it now
              </Link>
            </div>
            {note && <p className="font-mono text-[0.72rem] tracking-tight text-primary-foreground/70">{note}</p>}
          </div>
        </Reveal>
      </Container>
    </section>
  );
}

export { CtaRow };

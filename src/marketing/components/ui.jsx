import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useReveal } from "../useReveal";

// Shared marketing primitives. Everything here is presentational and
// SSR-safe (no window/document at module or render time).

export function Container({ className, children }) {
  return <div className={cn("mx-auto w-full max-w-[1140px] px-6 sm:px-8", className)}>{children}</div>;
}

// Mono utility label. Names the *mode* or feature, never decoration.
export function Eyebrow({ children, className }) {
  return (
    <p
      className={cn(
        "font-mono text-[0.72rem] font-medium uppercase tracking-[0.18em] text-muted-foreground",
        className,
      )}
    >
      {children}
    </p>
  );
}

// Reveal-on-scroll wrapper. Renders pre-reveal state in static HTML; the
// hook flips data-shown once it scrolls in (or immediately for reduced
// motion). See marketing.css .mkt-reveal.
export function Reveal({ as: Tag = "div", delay = 0, className, children, ...rest }) {
  const [ref, shown] = useReveal();
  return (
    <Tag
      ref={ref}
      data-shown={shown}
      style={delay ? { "--reveal-delay": `${delay}ms` } : undefined}
      className={cn("mkt-reveal", className)}
      {...rest}
    >
      {children}
    </Tag>
  );
}

// A titled section: mono eyebrow + <h2> + optional lede, all revealing
// together. `id` doubles as the scroll anchor for in-page nav.
export function Section({ id, eyebrow, title, lede, className, headingClassName, children }) {
  return (
    <section id={id} className={cn("scroll-mt-24 py-[calc(var(--mkt-section-y)*0.75)]", className)}>
      <Container>
        {(eyebrow || title || lede) && (
          <Reveal className="max-w-[46rem]">
            {eyebrow && <Eyebrow className="mb-4">{eyebrow}</Eyebrow>}
            {title && (
              <h2
                className={cn(
                  "text-balance font-display text-[clamp(1.9rem,3.6vw,2.9rem)] font-semibold leading-[1.06] tracking-[-0.03em] text-foreground",
                  headingClassName,
                )}
              >
                {title}
              </h2>
            )}
            {lede && (
              <p className="mt-5 text-pretty text-[1.05rem] leading-relaxed text-muted-foreground">{lede}</p>
            )}
          </Reveal>
        )}
        {children}
      </Container>
    </section>
  );
}

// One primary action per screen + a quiet secondary. The primary carries
// the only CTA glow on the page (the signal color).
export function CtaRow({ className, primaryLabel = "Start your board", primaryTo = "/signup", secondaryLabel = "Open the board", secondaryTo = "/app", note }) {
  return (
    <div className={cn("flex flex-col items-start gap-4", className)}>
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to={primaryTo}
          className="mkt-lift inline-flex items-center rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-[0_12px_30px_-12px_rgb(var(--signal-rgb)/0.55)] hover:shadow-[0_16px_38px_-12px_rgb(var(--signal-rgb)/0.7)]"
        >
          {primaryLabel}
        </Link>
        {secondaryLabel && (
          <Link
            to={secondaryTo}
            className="mkt-lift inline-flex items-center rounded-full border border-foreground/12 bg-card/60 px-6 py-3 text-sm font-medium text-foreground backdrop-blur hover:border-foreground/25"
          >
            {secondaryLabel}
          </Link>
        )}
      </div>
      {note && <p className="font-mono text-[0.72rem] tracking-tight text-muted-foreground">{note}</p>}
    </div>
  );
}

// Recessed sub-surface for things nested inside a card (the app's own
// inset-hairline language).
export function Panel({ className, children }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-foreground/[0.06] bg-card/70 p-6 shadow-[0_1px_3px_0_hsl(200_30%_12%/0.08),0_10px_30px_-16px_hsl(200_30%_12%/0.18)] backdrop-blur",
        className,
      )}
    >
      {children}
    </div>
  );
}

// A hairline between sections — 1px at low opacity, not a box.
export function Rule({ className }) {
  return <div className={cn("mx-auto h-px max-w-[1140px] bg-foreground/[0.07]", className)} />;
}

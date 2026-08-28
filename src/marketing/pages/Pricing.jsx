import { Container, Eyebrow, CtaRow, Reveal } from "../components/ui";
import { Faq, ClosingCta } from "../components/blocks";

const INCLUDED = [
  "The whole board — areas, products, projects, tasks, stakeholders, notes",
  "The assistant, with the built-in model",
  "Bring your own AI account, or run a model on your own computer",
  "One calendar view and one inbox across connected accounts",
  "The notes map and the free-draw canvas",
  "Import from a spreadsheet, export back to one anytime",
  "Sync across devices, if you turn it on",
];

const PRICING_FAQ = [
  {
    q: "Are there paid plans?",
    a: "No. There are no tiers and nothing is locked behind an upgrade. If that ever changes, this page will say so.",
  },
  {
    q: "What does it cost if I use my own AI account?",
    a: "You pay your AI provider directly for what you use — the same as using their app. Vaea adds nothing on top. Running a model on your own computer costs nothing extra.",
  },
  {
    q: "Is there a free trial? Do I need a card?",
    a: "There is no separate trial — the full product is free. No card is required. The board works before you sign in; signing in enables the built-in assistant.",
  },
  {
    q: "Can I keep using it if the built-in assistant goes away?",
    a: "Yes. You can point the assistant at your own AI account or a model on your own computer, and the board and everything else keeps working either way.",
  },
];

export default function Pricing() {
  return (
    <>
      <section className="pt-12 sm:pt-16">
        <Container>
          <div className="max-w-[44rem]">
            <Eyebrow className="mb-4">pricing</Eyebrow>
            <h1 className="text-balance font-display text-[clamp(2.6rem,7vw,4.8rem)] font-semibold leading-[1.0] tracking-[-0.04em] text-foreground">
              Vaea is free.
            </h1>
            <p className="mt-6 max-w-[38rem] text-[1.08rem] leading-relaxed text-muted-foreground">
              No paid plans. No seats. Nothing held back behind an upgrade. The only thing you can
              spend money on is your own AI provider, if you choose to connect one — and that bill
              goes to them, not here.
            </p>
            <div className="mt-8">
              <CtaRow note="Free · no card · your information stays on your computer" />
            </div>
          </div>
        </Container>
      </section>

      <section className="py-[calc(var(--mkt-section-y)*0.85)]">
        <Container>
          <Reveal className="mx-auto max-w-[34rem] rounded-2xl border border-foreground/[0.08] bg-card/60 p-8 shadow-[0_1px_3px_0_hsl(200_30%_12%/0.08),0_24px_56px_-30px_hsl(200_30%_12%/0.28)] backdrop-blur">
            <p className="font-mono text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground">
              one plan
            </p>
            <p className="mt-3 font-display text-[clamp(3rem,10vw,4.5rem)] font-semibold leading-none tracking-[-0.04em] text-foreground">
              $0
              <span className="ml-2 align-middle font-mono text-sm font-normal tracking-tight text-muted-foreground">
                / forever
              </span>
            </p>
            <ul className="mt-7 space-y-2.5">
              {INCLUDED.map((it) => (
                <li key={it} className="flex gap-2.5 text-[0.95rem] leading-snug text-foreground">
                  <span aria-hidden="true" className="mt-0.5 shrink-0 text-[rgb(var(--signal-rgb))]">
                    ✓
                  </span>
                  {it}
                </li>
              ))}
            </ul>
          </Reveal>
        </Container>
      </section>

      <section className="py-[calc(var(--mkt-section-y)*0.75)]">
        <Container>
          <Reveal className="mx-auto max-w-[42rem]">
            <h2 className="font-display text-[clamp(1.7rem,3.4vw,2.5rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-foreground">
              Common questions about pricing
            </h2>
            <div className="mt-7">
              <Faq items={PRICING_FAQ} />
            </div>
          </Reveal>
        </Container>
      </section>

      <ClosingCta title="Open the board — free, in full." note="Free · no card · your information stays on your device" />
    </>
  );
}

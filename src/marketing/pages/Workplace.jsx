import { Container, Eyebrow, Section, CtaRow, Reveal } from "../components/ui";
import { ShowBlock, Faq, Marquee, ClosingCta } from "../components/blocks";
import { CalendarDemo, VmailDemo } from "../components/visuals";
import { WORKPLACE_FAQ } from "../seo";

export default function Workplace() {
  return (
    <>
      <section className="pt-12 sm:pt-16">
        <Container>
          <div className="max-w-[50rem]">
            <Eyebrow className="mb-4">Vaea Workplace</Eyebrow>
            <h1 className="text-balance font-display text-[clamp(2.5rem,6.4vw,4.6rem)] font-semibold leading-[1.01] tracking-[-0.039em] text-foreground">
              Your calendar and email, in the same place as the work
            </h1>
            <p className="mt-6 max-w-[40rem] text-[1.08rem] leading-relaxed text-muted-foreground">
              Vaea Workplace pulls your Google and Microsoft calendars into one agenda and your email
              into one inbox — next to the board they relate to, and handled by the same Vaea Chat.
            </p>
            <div className="mt-7">
              <CtaRow note="Connect an account when you're ready — the board works without it." />
            </div>
          </div>
          <Reveal delay={90} className="mt-12">
            <CalendarDemo />
          </Reveal>
        </Container>
      </section>

      <ShowBlock
        eyebrow="one agenda"
        title="Every calendar, and your due dates, in one view"
        visual={<CalendarDemo />}
      >
        <p>
          Connect a Google or Microsoft account — or both — and every calendar lands in a single
          agenda, alongside the due dates from your own projects. One place to see what the day
          actually holds.
        </p>
        <p>
          Vaea Chat can add an event or move one, always showing you the change before it happens.
        </p>
      </ShowBlock>

      <ShowBlock
        flip
        tone="dark"
        eyebrow="one inbox"
        title="Gmail and Outlook, read and written in one client"
        visual={<VmailDemo onDark />}
      >
        <p>
          Your mail from both accounts comes into one place — read, search, and write across them
          without switching tabs.
        </p>
        <p>
          Ask Vaea Chat to draft a reply, file a message, or turn a long thread into tasks on your
          board. It shows you first, every time.
        </p>
      </ShowBlock>

      <Section
        eyebrow="not ready yet"
        title="Meetings — the surface is here, the connector isn't yet"
      >
        <Reveal className="mt-5 max-w-[46rem] space-y-3.5 text-[1.02rem] leading-relaxed text-muted-foreground">
          <p>
            There's a place for meeting notes to land, but the transcript connector it needs isn't
            available yet.
          </p>
          <p>
            The app says that plainly where you'd expect it to work, rather than looking finished and
            failing quietly.
          </p>
        </Reveal>
      </Section>

      <Marquee items={["one agenda", "one inbox", "Google and Microsoft", "drafted on approval", "next to the board"]} />

      <Section id="faq" eyebrow="fair questions" title="How Vaea Workplace connects">
        <Reveal className="mt-8">
          <Faq items={WORKPLACE_FAQ} />
        </Reveal>
      </Section>

      <ClosingCta
        title="Bring the day into one view."
        note="Your accounts, connected one at a time"
        image="/img/marketing/workplace-closing.jpg"
      />
    </>
  );
}

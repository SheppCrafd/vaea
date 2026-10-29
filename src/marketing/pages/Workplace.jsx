import { Container, Eyebrow, Section, CtaRow, Reveal, Float } from "../components/ui";
import { ShowBlock, Faq, Marquee, ClosingCta } from "../components/blocks";
import { CalendarDemo, VmailDemo } from "../components/visuals";
import { StoryRegion, StoryIntro, Elsewhere } from "../components/story";
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
            <Float lead shadow>
              <CalendarDemo />
            </Float>
          </Reveal>
        </Container>
      </section>

      <StoryRegion>
      <StoryIntro time="1:00 PM">
        Juan's afternoon belongs to other people: Dana's design review now, Priya's quote waiting, and
        a 1:1 with Lee tomorrow.
      </StoryIntro>

      <ShowBlock
        time="1:05 PM"
        story="Juan's calendars and his project due dates sit in one agenda. The review has started, and API v2 is due at 4."
        title="Every calendar, and your due dates, in one view"
        visual={<CalendarDemo />}
      >
        <p>
          Connect a Google or Microsoft account — or both — and every calendar lands in a single
          agenda, alongside the due dates from your own projects. One place to see what the day
          actually holds.
        </p>
        <p>
          Vaea Chat can add an event or move one, and asks before it deletes one.
        </p>
      </ShowBlock>

      <ShowBlock
        flip
        tone="dark"
        time="2:30 PM"
        story="Priya's revised quote lands, right above Marta's note asking for it."
        title="Gmail and Outlook, read and written in one client"
        visual={<VmailDemo onDark />}
      >
        <p>
          Your mail from both accounts comes into one place — read, search, and write across them
          without switching tabs.
        </p>
        <p>
          Ask Vaea Chat to draft a reply, file a message, or turn a long thread into tasks on your
          board. Sending always waits for your yes.
        </p>
      </ShowBlock>

      <Section time="3:15 PM" title="Meeting notes become tasks" lede="After the review, Dana's notes become tasks on Juan's board.">
        <Reveal className="mt-5 max-w-[46rem] space-y-3.5 text-[1.02rem] leading-relaxed text-muted-foreground">
          <p>
            Paste your notes into Vaea Chat with{" "}
            <code className="font-mono text-[0.9em]">/parse-notes</code>. It pulls out the tasks,
            decisions, and follow-ups, and adds them to your board.
          </p>
          <p>Vaea doesn't record or transcribe meetings itself — bring the notes from wherever you keep them.</p>
        </Reveal>
      </Section>

      <Elsewhere current="/workplace" />
      </StoryRegion>

      <Marquee items={["one agenda", "one inbox", "Google and Microsoft", "sent on your yes", "next to the board"]} />

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

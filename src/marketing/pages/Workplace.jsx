import { Container, Eyebrow, Section, CtaRow, Reveal, Float } from "../components/ui";
import { ShowBlock, Faq, Marquee, ClosingCta } from "../components/blocks";
import { CalendarDemo, VmailDemo } from "../components/visuals";
import { StoryRegion, StoryIntro, Elsewhere } from "../components/story";
import { ANY_CALENDAR_AVAILABLE, ANY_MAIL_AVAILABLE } from "@/lib/connectorAvailability";
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
              <CtaRow
                note={
                  ANY_CALENDAR_AVAILABLE
                    ? "Connect an account when you're ready — the board works without it."
                    : "Google and Microsoft connections are coming soon. The board works without them."
                }
              />
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
      <StoryIntro time="12:30 PM">
        After lunch, Bob's day belongs to other people: Dana's design review at 1:00, his 1:1 with Lee
        at 2:00, and Marta's budget review at 3:30.
      </StoryIntro>

      <ShowBlock
        time="12:35 PM"
        story="Bob's calendars and his project due dates sit in one agenda: three meetings this afternoon, and API v2 due today."
        title="Every calendar, and your due dates, in one view"
        soon={ANY_CALENDAR_AVAILABLE ? undefined : "Google and Microsoft calendar connections are coming soon. Your project due dates already show in the agenda."}
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

      <Section time="1:45 PM" title="Meeting notes become tasks" lede="The design review settles four things for the launch. Bob pastes Dana's notes into Vaea Chat, and each one becomes a task on Harbor 2.0 launch.">
        <Reveal className="mt-5 max-w-[46rem] space-y-3.5 text-[1.02rem] leading-relaxed text-muted-foreground">
          <p>
            Paste your notes into Vaea Chat with{" "}
            <code className="font-mono text-[0.9em]">/parse-notes</code>. It pulls out the tasks,
            decisions, and follow-ups, and adds them to your board.
          </p>
          <p>
            Vaea doesn't record or transcribe meetings itself. Paste the notes from wherever you keep
            them, or connect Granola and Vaea Chat reads them from there.
          </p>
        </Reveal>
      </Section>

      <Section time="1:55 PM" title="Ready for a 1:1 in a minute" lede="Before Lee's 1:1, Bob picks Lee on the board, and every project and task Lee is on lights up. Then he asks Vaea Chat to summarize Auth rework, blocker first.">
        <Reveal className="mt-5 max-w-[46rem] space-y-3.5 text-[1.02rem] leading-relaxed text-muted-foreground">
          <p>
            <code className="font-mono text-[0.9em]">/summarize</code> gives you where a project
            stands in a few lines: what's done, what's stuck, and the questions still open.
          </p>
        </Reveal>
      </Section>

      <ShowBlock
        flip
        tone="dark"
        time="2:35 PM"
        story="Priya's revised quote lands at 2:30. Bob asks Vaea Chat to forward it to Marta for sign-off, and it waits for his yes before sending."
        title="Gmail and Outlook, read and written in one client"
        soon={ANY_MAIL_AVAILABLE ? undefined : "Gmail and Outlook connections are coming soon."}
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

      <Section
        time="3:15 PM"
        title="Vaea Calendar finds time for the work"
        lede="Bob owes the leadership team a launch brief before tomorrow's 2:00 kickoff. He gives the task 90 minutes, and Vaea Calendar blocks the first free slot: tomorrow at 10:00."
        soon={ANY_CALENDAR_AVAILABLE ? undefined : "Auto-scheduling needs a Google or Microsoft calendar connection, which is coming soon."}
      >
        <Reveal className="mt-5 max-w-[46rem] space-y-3.5 text-[1.02rem] leading-relaxed text-muted-foreground">
          <p>
            Turn on auto-scheduling in Settings and give a task a duration. Vaea Calendar finds the
            first free slot in your working hours and books it. It's off by default, so your calendar
            only changes when you ask.
          </p>
        </Reveal>
      </Section>

      <Section time="3:25 PM" title="The numbers for Marta, as a spreadsheet" lede="Before the 3:30 budget review, Bob asks Vaea Chat for his projects in a spreadsheet. It saves every project on his board to a file Marta can open in Excel or Google Sheets.">
        <Reveal className="mt-5 max-w-[46rem] space-y-3.5 text-[1.02rem] leading-relaxed text-muted-foreground">
          <p>
            Projects, tasks, people or notes: ask for any of them and Vaea Chat saves the full list as
            a CSV file. Archived and deleted items stay out.
          </p>
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

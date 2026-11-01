import { Container, Eyebrow, Section, CtaRow, Reveal, Float } from "../components/ui";
import { ShowBlock, Faq, Marquee, ClosingCta } from "../components/blocks";
import ParallaxBackdrop from "../components/ParallaxBackdrop";
import { ChatDemo, LocalModeTerminal, ClaudeCodeTerminal } from "../components/visuals";
import { StoryRegion, StoryIntro, Elsewhere } from "../components/story";
import { ASSISTANT_FAQ, ASSISTANT_STEPS } from "../seo";

const CAN = [
  "Research a question online, with sources",
  "Read a file you've attached",
  "Compare two options and recommend one",
  "Summarize a project or a long thread",
  "Draft an email from one sentence",
  "Check your whole board for things that slipped",
  "Pull anything into a spreadsheet",
  "Read and add to your linked notes",
];

export default function VaeaChat() {
  return (
    <>
      <section className="pt-12 sm:pt-16">
        <Container>
          <div className="max-w-[50rem]">
            <Eyebrow className="mb-4">Vaea Chat</Eyebrow>
            <h1 className="text-balance font-display text-[clamp(2.5rem,6.4vw,4.6rem)] font-semibold leading-[1.01] tracking-[-0.039em] text-foreground">
              It makes the change. Anything final waits for your yes.
            </h1>
            <p className="mt-6 max-w-[40rem] text-[1.08rem] leading-relaxed text-muted-foreground">
              Vaea Chat isn't a chat box stuck onto an app. It works on the exact board you're looking
              at — adding, updating, and finishing things — and lists every step it takes. Anything that
              removes something or sends a message stops for your yes first.
            </p>
            <div className="mt-7">
              <CtaRow primaryLabel="Sign up to use Vaea Chat" note="Signing in turns on Vaea Chat — the board works without it." />
            </div>
          </div>
          <Reveal delay={90} className="mt-12">
            <Float lead shadow>
              <ChatDemo hero />
            </Float>
          </Reveal>
        </Container>
      </section>

      <StoryRegion>
      <StoryIntro time="10:30 AM">
        Priya from Lumen Studio calls at 11:30 about the launch quote. Bob has an hour, and he hands
        the prep to Vaea Chat.
      </StoryIntro>

      <ParallaxBackdrop src="/img/marketing/vaeachat-band.jpg" strength={132} scrim={0.88} position="50% 50%">
        <Section time="10:35 AM" title="Five steps, with a stop before anything final" lede="What happens between each of Bob's requests and his yes.">
          <Reveal className="mt-8">
            <ol className="divide-y divide-foreground/[0.08] border-y border-foreground/[0.08]">
              {ASSISTANT_STEPS.map(([t, d], i) => (
                <li key={i} className="grid gap-2.5 py-4 sm:grid-cols-[auto_1fr] sm:gap-6">
                  <span className="font-mono text-[0.8rem] text-muted-foreground sm:pt-0.5">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <p className="text-[1rem] font-medium text-foreground">{t}</p>
                    <p className="mt-1 max-w-[58ch] text-[0.95rem] leading-relaxed text-muted-foreground">{d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Reveal>
        </Section>
      </ParallaxBackdrop>

      <ShowBlock
        time="10:45 AM"
        story="Bob attaches Lumen's first quote and asks Vaea Chat to compare it with what launch campaigns like Harbor 2.0 usually cost, with sources."
        title="It can reach past your task list"
        visual={
          <ul className="divide-y divide-foreground/[0.08] border-y border-foreground/[0.08]">
            {CAN.map((t, i) => (
              <li key={i} className="py-3 text-[0.95rem] text-foreground">
                {t}
              </li>
            ))}
          </ul>
        }
      >
        <p>
          Vaea Chat can pull in things that aren't on your board — a fact from the web, what's inside
          a file or behind a link — and use them in the same answer.
        </p>
        <p>
          Ask it to check your board and it flags what's overdue, what has no owner, and where you have near-duplicates. Then it makes the fixes, stopping for your yes before it removes anything.
        </p>
      </ShowBlock>

      <ShowBlock
        flip
        tone="dark"
        time="11:10 AM"
        story="Before the call, Harborline's security lead asks where those conversations go. Bob has three answers."
        title="Run it however you're comfortable"
        visual={<LocalModeTerminal />}
      >
        <p>
          The built-in model works the moment you sign in. Prefer your own AI account? Connect it and
          Vaea Chat talks straight to it from your browser.
        </p>
        <p>
          Or keep everything in-house: point it at a model running on your own computer. Then no part
          of the conversation leaves the machine.
        </p>
      </ShowBlock>

      <ShowBlock
        time="11:20 AM"
        story="Lee, Harborline's engineering lead, sets up the in-house version on his own machine."
        title="For developers: answer Vaea Chat with Claude Code"
        visual={<ClaudeCodeTerminal />}
        cta={{ to: "/privacy", label: "Local Mode, step by step" }}
      >
        <p>
          Clone the repository, run Vaea on localhost, and turn on Local Mode. Vaea Chat then writes
          each question to a folder on your machine instead of calling out to any service.
        </p>
        <p>
          Point Claude Code at that folder in your Vaea working copy and it answers as the model —
          with its own tools. Run <code className="font-mono text-[0.9em]">/local-relay</code> to
          take one pending message, or <code className="font-mono text-[0.9em]">/l</code> for the same
          thing with less to type when you're relaying all day.
        </p>
      </ShowBlock>

      <Section time="12:00 PM" title="What was agreed goes straight onto the board" lede="Priya agreed to cut the print run and send a revised quote by 2:30. Bob says so in one sentence, and Vaea Chat adds the follow-up to Vendor review and a sign-off task for Marta.">
        <Reveal className="mt-5 max-w-[46rem] space-y-3.5 text-[1.02rem] leading-relaxed text-muted-foreground">
          <p>
            Tell Vaea Chat what changed the way you'd tell a colleague. It finds the project, adds the
            tasks and notes, and lists each step it took.
          </p>
        </Reveal>
      </Section>

      <Elsewhere current="/vaea-chat" />
      </StoryRegion>

      <Marquee items={["you ask", "it makes the change", "it lists every step", "removals wait for you", "a checkpoint before big changes"]} />

      <Section id="faq" eyebrow="fair questions" title="What it sends, and what it can't do">
        <Reveal className="mt-8">
          <Faq items={ASSISTANT_FAQ} />
        </Reveal>
      </Section>

      <ClosingCta title="Tell Vaea Chat what changed. It updates your board." note="Your own account or your own computer, if you'd rather" />
    </>
  );
}

import { Container, Eyebrow, Section, CtaRow, Reveal } from "../components/ui";
import { ShowBlock, Faq, Marquee, ClosingCta } from "../components/blocks";
import { ChatDemo, LocalModeTerminal } from "../components/visuals";

const STEPS = [
  ["You ask", "Type it the way you'd say it — “move everything that's stuck waiting on the vendor to the top and flag it for this week.”"],
  ["It looks at your board", "Your current board is sent along so it can see what's actually there. Just for that one question — nothing is kept."],
  ["It shows you the plan", "You get a short list of exactly what it would change. Nothing has changed yet."],
  ["You approve", "It makes the changes. Anything that removes something asks again, and a backup is saved before big changes."],
  ["You can undo", "Say “undo” to take back the last change, or restore a backup."],
];

const CAN = [
  "Look something up online while answering",
  "Read a file you've attached",
  "Open a link to see what's there",
  "Check your whole board for things that slipped",
  "Pull anything into a spreadsheet",
  "Read and add to your linked notes",
];

const FAQ = [
  {
    q: "What gets sent, and where?",
    a: "When you ask something, a copy of your current board goes to the AI service for that one question so it can understand what you mean. Nothing is saved on a server afterward. The app tells you this right in the chat window.",
  },
  {
    q: "Can I use my own AI account?",
    a: "Yes. Connect an account from a major AI provider and the assistant talks to it directly from your browser. Or run a model on your own computer, with nothing sent out at all.",
  },
  {
    q: "Could it do something I didn't want?",
    a: "It can't act on its own. Every change is shown to you first and waits for your yes. Removing things asks a second time, and a backup is saved before anything large — so a mistake is easy to walk back.",
  },
  {
    q: "Does it watch how I work?",
    a: "Only if you turn that on. By default, reopening the chat can show a plain summary of what changed while you were away — nothing about how you work. A separate switch lets it keep notes on your habits; leave it off and it can't.",
  },
];

export default function Assistant() {
  return (
    <>
      <section className="pt-12 sm:pt-16">
        <Container>
          <div className="max-w-[50rem]">
            <Eyebrow className="mb-4">the assistant</Eyebrow>
            <h1 className="text-balance font-display text-[clamp(2.5rem,6.4vw,4.6rem)] font-semibold leading-[1.01] tracking-[-0.039em] text-foreground">
              It makes the change. You get to see it first.
            </h1>
            <p className="mt-6 max-w-[40rem] text-[1.08rem] leading-relaxed text-muted-foreground">
              Not a chat box stuck onto an app. It works on the exact board you're looking at —
              adding, updating, and finishing things — and shows you every step before it runs.
            </p>
            <div className="mt-7">
              <CtaRow primaryLabel="Get started free" note="Signing in turns on the assistant. The board works without it." />
            </div>
          </div>
          <Reveal delay={90} className="mt-12">
            <ChatDemo />
          </Reveal>
        </Container>
      </section>

      <Section eyebrow="how a change happens" title="Five steps — and you control the two that matter">
        <Reveal className="mt-8">
          <ol className="divide-y divide-foreground/[0.08] border-y border-foreground/[0.08]">
            {STEPS.map(([t, d], i) => (
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

      <ShowBlock
        flip
        tone="dark"
        eyebrow="built in · your account · your computer"
        title="Run it however you're comfortable"
        visual={<LocalModeTerminal />}
      >
        <p>
          The built-in option works the moment you sign in. Prefer your own AI account? Connect it and
          the assistant talks straight to it from your browser.
        </p>
        <p>
          Or keep everything in-house: point it at a model running on your own computer. Then no part
          of the conversation leaves the machine.
        </p>
      </ShowBlock>

      <ShowBlock
        eyebrow="more than the board"
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
          It can pull in things that aren't on your board — a fact from the web, what's inside a file
          or behind a link — and use them in the same answer.
        </p>
        <p>
          Ask it to check your board and it will flag what's overdue, what has no owner, and where
          you've got near-duplicates — then offer the fixes as a plan you approve.
        </p>
      </ShowBlock>

      <Marquee items={["you ask", "it shows the plan", "you approve", "it makes the change", "you can undo"]} />

      <Section id="faq" eyebrow="the fair questions" title="What it sends, and what it can't do">
        <Reveal className="mt-8">
          <Faq items={FAQ} />
        </Reveal>
      </Section>

      <ClosingCta title="Tell it what changed. Approve the plan." note="Free · your own account or your own computer, if you'd rather" />
    </>
  );
}

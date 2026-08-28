import { Link } from "react-router-dom";
import { Container, Eyebrow, Section, CtaRow, Reveal } from "../components/ui";
import { ShowBlock, ProofStrip, Manifesto, Marquee, Faq, ClosingCta } from "../components/blocks";
import BoardDemo from "../components/BoardDemo";
import { ChatDemo, VmailDemo, StorageTerminal } from "../components/visuals";
import { HOME_FAQ } from "../seo";

export default function Home() {
  return (
    <>
      {/* HERO — left-aligned, the real board carries the first screen */}
      <section className="pt-12 sm:pt-16">
        <Container>
          <div className="max-w-[54rem]">
            <Eyebrow className="mkt-hero-rise mb-4">one board · an assistant that acts on it · nothing leaves your computer</Eyebrow>
            {/* Not animated in — it's the LCP element; it must be final on
                first paint. The lighter elements around it carry the entrance. */}
            <h1 className="text-balance font-display text-[clamp(2.9rem,8vw,5.8rem)] font-semibold leading-[1.0] tracking-[-0.04em] text-foreground">
              Say what's on your plate. It sorts it onto the board.
            </h1>
            <p className="mkt-hero-rise mt-6 max-w-[42rem] text-pretty text-[1.12rem] leading-relaxed text-muted-foreground [--rise-delay:120ms]">
              Vaea is one board for everything you're juggling — every project tucked under the part of
              your life it belongs to. Most assistants just hand you another to-do list. This one makes
              the change on the board itself, and shows you first.
            </p>
            <div className="mkt-hero-rise mt-8 [--rise-delay:180ms]">
              <CtaRow note="Free · no card · your information stays on your computer" />
            </div>
          </div>

          <Reveal delay={100} className="mkt-hero-rise mt-12 [--rise-delay:240ms]">
            <BoardDemo hero />
          </Reveal>
        </Container>
      </section>

      <ProofStrip
        items={["Code is public", "Works with no internet", "No sign-up needed to try the board", "Free — nothing held back"]}
      />

      <Manifesto>
        A tool for your own work shouldn't need a company's server. Every project stays in plain files
        on your computer — and the assistant can run there too, with nothing sent out.
      </Manifesto>

      {/* SHOW A — flagship, dark stage */}
      <ShowBlock
        id="assistant"
        tone="dark"
        eyebrow="it shows you first · you say yes"
        title="An assistant that does the change, not one that describes it"
        visual={<ChatDemo onDark />}
        cta={{ to: "/assistant", label: "See how the assistant works" }}
      >
        <p>
          Say “set up a Q3 launch project under Marketing with three tasks,” and it reads your board,
          then lays out the exact steps it would take. You read them and approve — or don't.
        </p>
        <p>
          It works on the same board you're looking at: adding and updating projects and tasks, noting
          risks, flagging what to focus on this week, pulling everything into a spreadsheet. Say
          “undo” to take back the last step.
        </p>
      </ShowBlock>

      {/* SHOW B — the board */}
      <ShowBlock
        id="board"
        flip
        eyebrow="everything tucked inside something bigger"
        title="One board that shows where each thing sits"
        visual={<BoardDemo />}
        cta={{ to: "/product", label: "Take the full tour" }}
      >
        <p>
          Group your work by the part of life it belongs to — Work, Home, a side project. Inside each,
          keep your projects; inside those, your tasks. Every project shows, at a glance, how many
          tasks are waiting, in progress, and done, and which ones matter most right now.
        </p>
        <p>
          A short list on the side pulls up your top three for today and what you're focused on this
          week. Pick a person and every card and row they're attached to lights up.
        </p>
      </ShowBlock>

      {/* SHOW C — device / trust */}
      <ShowBlock
        id="yours"
        eyebrow="the starting point, not a setting to find"
        title="Your information stays on your computer"
        visual={<StorageTerminal />}
        cta={{ to: "/privacy", label: "Exactly what leaves, and when" }}
      >
        <p>
          Every project and task is saved to plain files on your own machine — a folder you pick.
          There's no company database holding your work.
        </p>
        <p>
          If you'd rather sync it across devices, you can switch that on — and switch it back off.
          You can also run the assistant entirely on your own computer, with nothing sent out at all.
        </p>
      </ShowBlock>

      {/* SHOW D — connected tools */}
      <ShowBlock
        id="connected"
        flip
        eyebrow="once you connect them"
        title="Your calendar and email, handled by the same assistant"
        visual={<VmailDemo />}
        cta={{ to: "/product", label: "Everything it connects to" }}
      >
        <p>
          Link your Google or Microsoft account and Vaea brings your calendars into one view and your
          email into one place.
        </p>
        <p>
          Then the assistant can help there too — draft a reply, add an event, turn a long thread into
          tasks — always showing you first.
        </p>
      </ShowBlock>

      <Marquee
        items={[
          "your work, one board",
          "it shows you before it acts",
          "your information stays with you",
          "works offline",
          "free, nothing held back",
        ]}
      />

      <Section id="faq" eyebrow="fair questions" title="The things people ask first">
        <Reveal className="mt-8">
          <Faq items={HOME_FAQ} />
        </Reveal>
      </Section>

      <Section eyebrow="who's behind it" title="Built and maintained by one person">
        <Reveal className="mt-6 max-w-[46rem] space-y-3.5 text-[1.02rem] leading-relaxed text-muted-foreground">
          <p>The code is public.</p>
          <p>
            <Link
              to="/about"
              className="font-medium text-foreground underline decoration-foreground/25 underline-offset-2 hover:decoration-foreground"
            >
              Who makes Vaea, and how to reach them →
            </Link>
          </p>
        </Reveal>
      </Section>

      <ClosingCta title="Put it all on one board." note="Free · no card · your information stays on your computer" />
    </>
  );
}

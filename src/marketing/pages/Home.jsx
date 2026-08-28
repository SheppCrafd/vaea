import { Link } from "react-router-dom";
import { Container, Eyebrow, Section, CtaRow, Reveal } from "../components/ui";
import { ShowBlock, ProofStrip, Manifesto, Marquee, Faq, ClosingCta } from "../components/blocks";
import BoardDemo from "../components/BoardDemo";
import { ChatDemo, VmailDemo, StorageTerminal, ClaudeCodeTerminal } from "../components/visuals";
import { HOME_FAQ } from "../seo";

export default function Home() {
  return (
    <>
      {/* HERO — left-aligned, the real board carries the first screen */}
      <section className="pt-12 sm:pt-16">
        <Container>
          <div className="max-w-[54rem]">
            <Eyebrow className="mkt-hero-rise mb-4">one board · Vaea Chat acts on it · nothing leaves your computer</Eyebrow>
            {/* Not animated in — it's the LCP element; it must be final on
                first paint. The lighter elements around it carry the entrance. */}
            <h1 className="text-balance font-display text-[clamp(2.9rem,8vw,5.8rem)] font-semibold leading-[1.0] tracking-[-0.04em] text-foreground">
              Say what's on your plate. It sorts it onto the board.
            </h1>
            <p className="mkt-hero-rise mt-6 max-w-[42rem] text-pretty text-[1.12rem] leading-relaxed text-muted-foreground [--rise-delay:120ms]">
              Vaea is one board for everything you're juggling — every project tucked under the part of
              your life it belongs to. Most assistants just hand you another to-do list. Vaea Chat
              makes the change on the board itself, and shows you first.
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
        items={["Source is public", "Works with no internet", "No sign-up needed to try the board", "Free — every feature included"]}
      />

      <Manifesto>
        A tool for your own work shouldn't need a company's server. Every project stays in plain files
        on your computer — and Vaea Chat can run there too, with nothing sent out.
      </Manifesto>

      {/* SHOW A — flagship, dark stage */}
      <ShowBlock
        id="vaea-chat"
        tone="dark"
        eyebrow="it shows you first · you say yes"
        title="Vaea Chat does the change, it doesn't just describe it"
        visual={<ChatDemo onDark />}
        cta={{ to: "/vaea-chat", label: "See how Vaea Chat works" }}
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

      {/* SHOW C — Workplace + Brain fold in */}
      <ShowBlock
        id="connected"
        eyebrow="once you connect them"
        title="Your calendar, email, and notes — under the same Vaea Chat"
        visual={<VmailDemo />}
        cta={{ to: "/workplace", label: "See Vaea Workplace" }}
      >
        <p>
          <strong className="font-medium text-foreground">Vaea Workplace</strong> brings your Google
          and Microsoft calendars into one agenda and your email into one inbox. Vaea Chat can draft a
          reply, add an event, or turn a long thread into tasks — showing you first.
        </p>
        <p>
          <strong className="font-medium text-foreground">Vaea Brain</strong> connects a personal
          notes vault kept in your own account, so Vaea Chat can read it for context and write to it
          when you ask. <Link to="/brain" className="underline decoration-foreground/25 underline-offset-2 hover:decoration-foreground">More on Vaea Brain →</Link>
        </p>
      </ShowBlock>

      {/* SHOW D — device / trust */}
      <ShowBlock
        id="yours"
        flip
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
          You can also run Vaea Chat entirely on your own computer, with nothing sent out at all.
        </p>
      </ShowBlock>

      {/* SHOW E — self-hosting, the private-company path */}
      <ShowBlock
        id="self-hosting"
        eyebrow="the way private companies run it"
        title="Clone it, run it on localhost, keep every request in-house"
        visual={<ClaudeCodeTerminal />}
        cta={{ to: "/self-hosting", label: "The self-hosting walkthrough" }}
      >
        <p>
          The source is public and the hosted version runs the same code. Copy the repository down,
          start Vaea on your own machine, and turn on Local Mode.
        </p>
        <p>
          Then point Claude Code at it from inside your working copy and it answers Vaea Chat as the
          model — <code className="font-mono text-[0.9em]">/local-relay</code> for one message,{" "}
          <code className="font-mono text-[0.9em]">/l</code> when it's all day. No request leaves your
          network.
        </p>
      </ShowBlock>

      <Marquee
        items={[
          "your work, one board",
          "it shows you before it acts",
          "your information stays with you",
          "works offline",
          "free, every feature included",
        ]}
      />

      <Section id="faq" eyebrow="fair questions" title="The things people ask first">
        <Reveal className="mt-8">
          <Faq items={HOME_FAQ} />
        </Reveal>
      </Section>

      <Section eyebrow="who's behind it" title="Built and maintained by one person">
        <Reveal className="mt-6 max-w-[46rem] space-y-3.5 text-[1.02rem] leading-relaxed text-muted-foreground">
          <p>
            Vaea is developed and supported by a single maintainer, and the full source is public.
          </p>
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

import { Container, Eyebrow, Section, CtaRow, Reveal } from "../components/ui";
import { ShowBlock, Faq, Marquee, ClosingCta } from "../components/blocks";
import ParallaxBackdrop from "../components/ParallaxBackdrop";
import { ClaudeCodeTerminal, LocalModeTerminal } from "../components/visuals";
import TerminalBlock from "@/components/settings/TerminalBlock";
import { SELFHOSTING_FAQ } from "../seo";

const STEPS = [
  ["Clone the repository", "The full source is public, and the hosted version runs this same code. Copy it down and you have the whole app."],
  ["Run it on localhost", "Install and start it with two commands. Vaea now runs from your own machine, in your browser, with your project files on disk."],
  ["Turn on Local Mode", "In Settings → AI Model, switch Vaea Chat to Local Mode and point it at a folder. From now on it writes each question to that folder instead of calling any service."],
  ["Answer it with Claude Code", "Run Claude Code inside your working copy, pointed at that same folder. It picks up each pending message, answers as the model using its own tools, and writes the reply back."],
  ["Keep it quick", "Run /local-relay to take one pending message. /l does the same thing with a shorter name, for when you're relaying all day."],
];

export default function SelfHosting() {
  return (
    <>
      <ParallaxBackdrop
        as="section"
        src="/img/marketing/selfhosting-hero.jpg"
        eager
        strength={108}
        scrim={0.8}
        position="50% 32%"
        className="pt-12 pb-[calc(var(--mkt-section-y)*0.5)] sm:pt-16"
      >
        <Container>
          <div className="max-w-[52rem]">
            <Eyebrow className="mb-4">self-hosting</Eyebrow>
            <h1 className="text-balance font-display text-[clamp(2.5rem,6.4vw,4.6rem)] font-semibold leading-[1.01] tracking-[-0.039em] text-foreground">
              Run the whole thing on your own machine
            </h1>
            <p className="mt-6 max-w-[42rem] text-[1.08rem] leading-relaxed text-muted-foreground">
              This is how private companies use Vaea. Clone the repository, run it on localhost, turn
              on Local Mode, and answer Vaea Chat with Claude Code inside your own working copy — no
              request leaves your network.
            </p>
            <div className="mt-7">
              <CtaRow note="The source is public · the hosted version runs this same code" />
            </div>
          </div>
          <Reveal delay={90} className="mt-12">
            <ClaudeCodeTerminal />
          </Reveal>
        </Container>
      </ParallaxBackdrop>

      <Section eyebrow="the setup, end to end" title="Five steps to a copy that never calls out">
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
        eyebrow="what this buys you"
        title="Every request stays inside your network"
        visual={<LocalModeTerminal />}
      >
        <p>
          Project data is already in plain files on the machine. With Local Mode, the model call is
          local too — so a company that can't accept even a transient third-party exchange still gets
          a working Vaea Chat, not a feature it has to leave switched off.
        </p>
        <p>
          Claude Code answers from inside the checked-out repository with its own tools. Your use of
          that tool is between you and it; Vaea itself sends nothing.
        </p>
      </ShowBlock>

      <ShowBlock
        eyebrow="two commands, one of them shorter"
        title="/local-relay for one message, /l for all day"
        visual={
          <TerminalBlock
            title="claude"
            showPrompt
            code={[
              "/local-relay   # take the oldest pending message, answer it,",
              "               # then handle the next round if one comes",
              "",
              "/l             # same command, quicker to type",
            ].join("\n")}
          />
        }
        cta={{ to: "/vaea-chat", label: "More on Vaea Chat" }}
      >
        <p>
          <code className="font-mono text-[0.9em]">/local-relay</code> takes the oldest pending Vaea
          Chat message, answers it, and — if the answer staged a change — waits for the next round and
          handles that too.
        </p>
        <p>
          <code className="font-mono text-[0.9em]">/l</code> is the same command with a shorter
          name, for when you're relaying messages all day.
        </p>
      </ShowBlock>

      <Marquee items={["clone the repo", "run on localhost", "Local Mode on", "Claude Code as the model", "nothing leaves your network"]} />

      <Section id="faq" eyebrow="fair questions" title="What self-hosting does and doesn't involve">
        <Reveal className="mt-8">
          <Faq items={SELFHOSTING_FAQ} />
        </Reveal>
      </Section>

      <ClosingCta title="Keep it all on your own machine." note="The source is public · runs entirely on your machine" />
    </>
  );
}

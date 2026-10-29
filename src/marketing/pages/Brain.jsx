import { Container, Eyebrow, Section, CtaRow, Reveal, Float } from "../components/ui";
import { ShowBlock, Faq, Marquee, ClosingCta } from "../components/blocks";
import ParallaxBackdrop from "../components/ParallaxBackdrop";
import { MindMapDemo } from "../components/visuals";
import { StoryRegion, StoryIntro, Elsewhere } from "../components/story";
import { BRAIN_FAQ } from "../seo";

const USES = [
  "Log a decision the moment you make it",
  "Write up a working session before you close the tab",
  "File a reference you'll want again later",
  "Pull an old note in for context mid-answer",
  "Keep a running record Vaea Chat can search",
];

export default function Brain() {
  return (
    <>
      <ParallaxBackdrop
        as="section"
        src="/img/marketing/brain-hero.jpg"
        eager
        strength={108}
        scrim={0.78}
        position="50% 40%"
        className="pt-12 pb-[calc(var(--mkt-section-y)*0.55)] sm:pt-16"
      >
        <Container>
          <div className="max-w-[50rem]">
            <Eyebrow className="mb-4">Vaea Brain</Eyebrow>
            <h1 className="text-balance font-display text-[clamp(2.5rem,6.4vw,4.6rem)] font-semibold leading-[1.01] tracking-[-0.039em] text-foreground">
              Your own notes, in reach of Vaea Chat
            </h1>
            <p className="mt-6 max-w-[40rem] text-[1.08rem] leading-relaxed text-muted-foreground">
              Connect a personal notes vault you already keep in your own account. Vaea Chat reads it
              for context and writes to it when you ask — and none of it is stored on Vaea's servers.
              See how the notes link up as a map, or sketch a process on a free-draw canvas.
            </p>
            <div className="mt-7">
              <CtaRow note="Vaea Brain is optional — the board and Vaea Chat work without it." />
            </div>
          </div>
          <Reveal delay={90} className="mt-12">
            <Float lead tilt={0.6} shift={0.7} shadow interactive>
              <MindMapDemo interactive />
            </Float>
          </Reveal>
        </Container>
      </ParallaxBackdrop>

      <StoryRegion>
      <StoryIntro time="6:10 PM">
        Before he logs off, Juan writes down why the launch moved to Nov 14, so nobody has to ask again
        next week.
      </StoryIntro>

      <ShowBlock
        time="6:15 PM"
        story="He asks Vaea Chat to write it up. The note lands in his own notes, linked to the two projects the new date changes."
        title="A vault Vaea connects to, not one it holds"
        visual={<MindMapDemo />}
        cta={{ to: "/privacy", label: "Exactly what leaves, and when" }}
      >
        <p>
          Vaea Brain is a link to notes you keep yourself. Vaea reads and writes them directly, in
          your account — there's no copy sitting on a Vaea server, and you can disconnect it whenever
          you want without losing anything.
        </p>
        <p>
          It's the same kind of connection a coding assistant gets to a folder of notes, brought into
          the app instead of living in a separate tool.
        </p>
      </ShowBlock>

      <ShowBlock
        flip
        tone="dark"
        time="6:30 PM"
        story="The decision isn't a task, so it doesn't belong on the board. It belongs with the rest of what Juan has worked out."
        title="A place for the things that aren't tasks"
        visual={
          <ul className="divide-y divide-white/10 border-y border-white/10">
            {USES.map((t, i) => (
              <li key={i} className="py-3 text-[0.95rem] text-primary-foreground/90">
                {t}
              </li>
            ))}
          </ul>
        }
      >
        <p>
          A task list holds what's left to do. Vaea Brain holds what you've worked out — the reasons
          behind a call, the shape of a problem, the reference you had to dig for once already.
        </p>
        <p>
          Ask Vaea Chat to "write this up" and it saves the note to your vault. Each write is a commit
          in your own repository, so every earlier version stays in its history.
        </p>
      </ShowBlock>

      <Elsewhere current="/brain" />
      </StoryRegion>

      <Marquee items={["your account, not ours", "read for context", "written on approval", "see it as a map", "disconnect anytime"]} />

      <Section id="faq" eyebrow="fair questions" title="How Vaea Brain handles your notes">
        <Reveal className="mt-8">
          <Faq items={BRAIN_FAQ} />
        </Reveal>
      </Section>

      <ClosingCta title="Give Vaea Chat something to remember." note="Your notes stay in your own account" />
    </>
  );
}

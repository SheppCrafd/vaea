import { Container, Eyebrow, Section, CtaRow, Reveal } from "../components/ui";
import { ShowBlock, Faq, Marquee, ClosingCta } from "../components/blocks";
import { MindMapDemo, StorageTerminal } from "../components/visuals";
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
      <section className="pt-12 sm:pt-16">
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
              <CtaRow note="Free · Vaea Brain is optional — the board and Vaea Chat work without it." />
            </div>
          </div>
          <Reveal delay={90} className="mt-12">
            <MindMapDemo interactive />
          </Reveal>
        </Container>
      </section>

      <ShowBlock
        eyebrow="it stays in your account"
        title="A vault Vaea connects to, not one it holds"
        visual={<StorageTerminal />}
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
        eyebrow="what you'd use it for"
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
          Every write is shown to you first, the same as a change to your board. Ask Vaea Chat to
          "write this up" and you read the note before it's saved.
        </p>
      </ShowBlock>

      <Marquee items={["your account, not ours", "read for context", "written on approval", "see it as a map", "disconnect anytime"]} />

      <Section id="faq" eyebrow="fair questions" title="How Vaea Brain handles your notes">
        <Reveal className="mt-8">
          <Faq items={BRAIN_FAQ} />
        </Reveal>
      </Section>

      <ClosingCta title="Give Vaea Chat something to remember." note="Free · your notes stay in your own account" />
    </>
  );
}

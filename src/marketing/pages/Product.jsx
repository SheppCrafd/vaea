import { Container, Eyebrow, CtaRow, Reveal } from "../components/ui";
import { ShowBlock, Marquee, ClosingCta } from "../components/blocks";
import BoardDemo from "../components/BoardDemo";
import { ChatDemo, CalendarDemo, MindMapDemo, StorageTerminal } from "../components/visuals";

const SECTIONS = [
  ["board", "The board"],
  ["assistant", "The assistant"],
  ["calendar", "Calendar & email"],
  ["map", "Notes map"],
  ["yours", "Your files"],
];

function SubNav() {
  return (
    <div className="sticky top-16 z-30 hidden border-b border-foreground/[0.07] bg-background/80 backdrop-blur-xl md:block">
      <Container className="flex gap-6 overflow-x-auto py-3">
        {SECTIONS.map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className="whitespace-nowrap text-[0.82rem] text-muted-foreground transition-colors hover:text-foreground"
          >
            {label}
          </a>
        ))}
      </Container>
    </div>
  );
}

export default function Product() {
  return (
    <>
      <section className="pt-12 sm:pt-14">
        <Container>
          <div className="max-w-[48rem]">
            <Eyebrow className="mb-4">a look at every part</Eyebrow>
            <h1 className="text-balance font-display text-[clamp(2.4rem,5.8vw,4rem)] font-semibold leading-[1.02] tracking-[-0.037em] text-foreground">
              One board, an assistant that helps run it, and the tools it plugs into
            </h1>
            <p className="mt-5 max-w-[40rem] text-[1.05rem] leading-relaxed text-muted-foreground">
              Start with the board and the assistant. Connect your calendar, email and notes when
              you're ready, and the same assistant helps with those too.
            </p>
            <div className="mt-7">
              <CtaRow note="Free · the board works before you even sign in" />
            </div>
          </div>
          <Reveal delay={90} className="mt-10">
            <BoardDemo hero />
          </Reveal>
        </Container>
      </section>

      <SubNav />

      <ShowBlock
        id="board"
        eyebrow="everything in its place"
        title="A board you can read at a glance"
        visual={<BoardDemo />}
      >
        <p>
          Group your work by the part of life it belongs to. Inside each group are your projects;
          inside those, your tasks. Projects can sit under a bigger thing they serve, or stand on
          their own.
        </p>
        <p>
          Each project shows how many tasks are waiting, moving, and done, and marks the ones that
          matter most this week. Open one to see the full list, sort and filter it, and clear out
          what's finished in a click. Nothing is ever really deleted — old work stays searchable.
        </p>
      </ShowBlock>

      <ShowBlock
        id="assistant"
        flip
        tone="dark"
        eyebrow="ask · read the plan · approve"
        title="The assistant works on the same board you see"
        visual={<ChatDemo />}
        cta={{ to: "/assistant", label: "More on the assistant" }}
      >
        <p>
          A small window you can drag anywhere, and a full page. Ask for a change in plain words and
          it lays out the steps. You approve them, and it makes the change. Anything that removes
          something asks a second time, and it saves a backup before big changes.
        </p>
        <p>
          It can also look something up online, read a file you've attached, open a link to see
          what's there, and check your whole board for things that have slipped — overdue work,
          projects with no owner.
        </p>
      </ShowBlock>

      <ShowBlock
        id="calendar"
        eyebrow="one view, one inbox"
        title="Your calendar and email, brought together"
        visual={<CalendarDemo />}
      >
        <p>
          Connect a Google or Microsoft account and every calendar lands in one agenda, alongside
          your project due dates. Your email comes into one place too — read, search, and write,
          across both accounts.
        </p>
        <p>
          The assistant can send or file email, draft replies, and add events — always showing you
          first. (Meeting notes need a connection that isn't built yet; the app says so plainly
          rather than faking it.)
        </p>
      </ShowBlock>

      <ShowBlock
        id="map"
        flip
        eyebrow="how your notes connect"
        title="A map of your notes"
        visual={<MindMapDemo />}
      >
        <p>
          If you keep a set of linked notes, Vaea can show them as a map — each note a dot, each link
          a line — so you can see how ideas connect. There's also a free-draw canvas for sketching
          out how a process should run.
        </p>
        <p>
          The assistant can read and add to those notes, saving straight to your own files.
        </p>
      </ShowBlock>

      <ShowBlock
        id="yours"
        eyebrow="where it all lives"
        title="On your computer, in files you can open"
        visual={<StorageTerminal />}
        cta={{ to: "/privacy", label: "Where your information lives" }}
      >
        <p>
          Your board is saved as plain files in a folder you choose. Want it on more than one device?
          Turn on sync — and turn it back off whenever, without losing anything.
        </p>
        <p>
          The assistant can use the model built in, your own AI account, or a model running on your
          own computer with nothing sent out.
        </p>
      </ShowBlock>

      <Marquee
        items={["one board", "one assistant", "one calendar", "one inbox", "your files, your computer", "free"]}
      />

      <ClosingCta title="Open the board and move something." note="Free · no card · yours, on your computer" />
    </>
  );
}

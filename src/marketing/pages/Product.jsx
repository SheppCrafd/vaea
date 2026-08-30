import { Container, Eyebrow, CtaRow, Reveal } from "../components/ui";
import { ShowBlock, Marquee, ClosingCta } from "../components/blocks";
import ParallaxBackdrop from "../components/ParallaxBackdrop";
import BoardDemo from "../components/BoardDemo";
import { ChatDemo, CalendarDemo, MindMapDemo, StorageTerminal } from "../components/visuals";

const SECTIONS = [
  ["board", "The board"],
  ["vaea-chat", "Vaea Chat"],
  ["workplace", "Vaea Workplace"],
  ["brain", "Vaea Brain"],
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
            <h1 className="text-balance font-display text-[clamp(2.5rem,6vw,4.2rem)] font-semibold leading-[1.02] tracking-[-0.037em] text-foreground">
              One board, one Vaea Chat, everything in one place
            </h1>
            <p className="mt-5 max-w-[40rem] text-[1.05rem] leading-relaxed text-muted-foreground">
              Not five apps and a browser full of tabs. The board and Vaea Chat to start; Vaea
              Workplace and Vaea Brain fold in when you're ready — the same Vaea Chat across all of it.
            </p>
            <div className="mt-7">
              <CtaRow note="The board works before you even sign in" />
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
        id="vaea-chat"
        flip
        tone="dark"
        eyebrow="ask · read the plan · approve"
        title="Vaea Chat works on the same board you see"
        visual={<ChatDemo onDark />}
        cta={{ to: "/vaea-chat", label: "More on Vaea Chat" }}
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
        id="workplace"
        eyebrow="one view, one inbox"
        title="Vaea Workplace — your calendar and email, brought together"
        visual={<CalendarDemo />}
        cta={{ to: "/workplace", label: "More on Vaea Workplace" }}
      >
        <p>
          Connect a Google or Microsoft account and every calendar lands in one agenda, alongside
          your project due dates. Your email comes into one place too — read, search, and write,
          across both accounts.
        </p>
        <p>
          Vaea Chat can send or file email, draft replies, and add events — always showing you
          first. Meeting-notes capture needs a connection that isn't available yet; the app says so
          directly.
        </p>
      </ShowBlock>

      <ShowBlock
        id="brain"
        flip
        eyebrow="how your notes connect"
        title="Vaea Brain — your own notes, on tap"
        visual={<MindMapDemo />}
        cta={{ to: "/brain", label: "More on Vaea Brain" }}
      >
        <p>
          Connect a personal notes vault kept in your own account, and Vaea Chat can read it for
          context and add to it when you ask. If your notes link to each other, Vaea can show them as
          a map — each note a dot, each link a line. There's also a free-draw canvas for sketching out
          how a process should run.
        </p>
        <p>
          Every write is shown to you first, and saved straight to your own account — nothing is kept
          on a Vaea server.
        </p>
      </ShowBlock>

      <ParallaxBackdrop src="/img/marketing/product-band.jpg" strength={50} position="50% 50%">
        <ShowBlock
          id="yours"
          eyebrow="where it all lives"
          title="On your computer, in files you can open"
          visual={<StorageTerminal />}
          cta={{ to: "/self-hosting", label: "Run it all on your own machine" }}
        >
          <p>
            Your board is saved as plain files in a folder you choose. Want it on more than one device?
            Turn on sync — and turn it back off whenever, without losing anything.
          </p>
          <p>
            Vaea Chat can use the model built in, your own AI account, or a model running on your own
            computer with nothing sent out. Private companies go a step further and self-host the whole
            app.
          </p>
        </ShowBlock>
      </ParallaxBackdrop>

      <Marquee
        items={["one board", "one Vaea Chat", "one calendar", "one inbox", "your files, your computer"]}
      />

      <ClosingCta
        title="Open the board and move something."
        note="No card · yours, on your computer"
        image="/img/marketing/product-closing.jpg"
      />
    </>
  );
}

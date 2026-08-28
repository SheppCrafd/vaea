import { Link } from "react-router-dom";
import { Container, Eyebrow, Reveal } from "../components/ui";
import { ClosingCta } from "../components/blocks";
import { StorageTerminal } from "../components/visuals";
import { SITE_MODIFIED } from "../seo";

// One source for "last updated" — the same constant the footer and the
// structured data read, so the visible date can't drift. Parsed as local
// midnight so it doesn't slip a day in western time zones.
const UPDATED = new Date(`${SITE_MODIFIED}T00:00:00`).toLocaleDateString("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

const LEAVES = [
  [
    "You ask the assistant something",
    "A copy of your current board goes to the AI service so it can understand your question. Just for that one question — it isn't saved anywhere afterward. If you run the assistant on your own computer, even this stays local.",
  ],
  [
    "The assistant looks something up or opens a link or file",
    "That one lookup goes out for that one question, and the result is used in the answer. Same rule — nothing is kept.",
  ],
  [
    "You turn on sync across devices",
    "Your board is saved to an account instead of only on your computer, so you can open it elsewhere. It's off unless you switch it on, and you can switch it back — your information comes with you either way.",
  ],
  [
    "You sign in",
    "Signing in goes through a hosted login. Your past chats (not your board) are stored there so conversations are still around when you come back.",
  ],
  [
    "You connect a calendar, email, or notes",
    "The keys that let Vaea reach those live on your computer. Reading your notes passes through Vaea's server only for the moment a read happens; saving a note goes straight from your browser to where the notes are kept.",
  ],
];

function Block({ heading, children }) {
  return (
    <Reveal className="border-t border-foreground/[0.08] py-8 first:border-t-0">
      <h2 className="font-display text-[clamp(1.35rem,2.5vw,1.8rem)] font-semibold tracking-[-0.025em] text-foreground">
        {heading}
      </h2>
      <div className="mt-3.5 max-w-[64ch] space-y-3.5 text-[1rem] leading-relaxed text-muted-foreground">{children}</div>
    </Reveal>
  );
}

export default function Privacy() {
  return (
    <>
      <section className="pt-12 sm:pt-16">
        <Container>
          <div className="max-w-[46rem]">
            <Eyebrow className="mb-4">where your information lives</Eyebrow>
            <h1 className="text-balance font-display text-[clamp(2.3rem,5.4vw,3.7rem)] font-semibold leading-[1.03] tracking-[-0.034em] text-foreground">
              On your computer by default. Here's every time anything leaves it.
            </h1>
            <p className="mt-5 max-w-[54ch] text-[1.05rem] leading-relaxed text-muted-foreground">
              No badges, no fine print — just the list. You can check every line of it in the app or
              the public code. There's a{" "}
              <Link
                to="/privacy-policy"
                className="text-foreground underline decoration-foreground/25 underline-offset-2 hover:decoration-foreground"
              >
                formal privacy policy
              </Link>{" "}
              too, if you need the version in the usual shape.
            </p>
            <p className="mt-4 font-mono text-[0.72rem] tracking-tight text-muted-foreground">Last updated {UPDATED}</p>
          </div>
          <Reveal delay={90} className="mt-10 max-w-lg">
            <StorageTerminal />
          </Reveal>
        </Container>
      </section>

      <section className="pb-[calc(var(--mkt-section-y)*0.85)] pt-[calc(var(--mkt-section-y)*0.35)]">
        <Container className="max-w-[52rem]">
          <Block heading="What stays on your computer">
            <p>
              Every project, task, note, and person you add is written to ordinary files on your own
              machine — a folder you pick. There's no company database holding your work, so there's
              nothing on a server to lose, hand over, or leak.
            </p>
            <p>
              The assistant works on those same files. What you do by hand and what you ask it to do
              act on one set of information, not two.
            </p>
          </Block>

          <Reveal className="border-t border-foreground/[0.08] py-8">
            <h2 className="font-display text-[clamp(1.35rem,2.5vw,1.8rem)] font-semibold tracking-[-0.025em] text-foreground">
              Every time something does leave — the whole list
            </h2>
            <ul className="mt-6 divide-y divide-foreground/[0.08] border-y border-foreground/[0.08]">
              {LEAVES.map(([t, d]) => (
                <li key={t} className="py-4">
                  <p className="text-[0.98rem] font-medium text-foreground">{t}</p>
                  <p className="mt-1.5 max-w-[66ch] text-[0.95rem] leading-relaxed text-muted-foreground">{d}</p>
                </li>
              ))}
            </ul>
          </Reveal>

          <Block heading="Running with nothing leaving at all">
            <p>
              You can point the assistant at a model running on your own computer. Combined with
              keeping your board in local files, the whole thing then works with nothing sent out —
              no account, no internet needed.
            </p>
          </Block>

          <Block heading="What the hosted side is for">
            <p>
              A hosted service handles signing in, keeps your past chats (not your board), runs the
              built-in assistant, and — only if you choose sync — holds your board so it's there on
              your other devices. Each of those is either needed to sign in or something you turned on.
            </p>
          </Block>

          <Block heading="What you can do">
            <p>
              Pull anything into a spreadsheet at any time. Save your settings as a small file to move
              to another device. Switch sync on or off without losing anything. Delete your account
              from the settings screen, which clears the hosted side.
            </p>
          </Block>

          <Block heading="Being straight about the limits">
            <p>
              This is a tool for one person on one computer today — no shared team spaces, no roles,
              no admin screen. If your workplace needs a guarantee that nothing is ever synced, treat
              that switch as one to leave off and check, not assume.
            </p>
          </Block>
        </Container>
      </section>

      <ClosingCta title="Keep your work where you can see it." note="Free · on your computer · take it with you anytime" />
    </>
  );
}

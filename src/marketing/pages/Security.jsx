import { Container, Eyebrow, Section, Reveal } from "../components/ui";
import { ClosingCta } from "../components/blocks";
import ParallaxBackdrop from "../components/ParallaxBackdrop";
import { SITE_MODIFIED, MAKER } from "../seo";

const UPDATED = new Date(`${SITE_MODIFIED}T00:00:00`).toLocaleDateString("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

const CONTROLS = [
  [
    "Sign-in",
    "Handled by Base44's hosted login (Google, Microsoft, Apple, or email) — Vaea doesn't store or handle passwords itself.",
  ],
  [
    "Project data, by default",
    "Kept in files on your own device. There's no company database holding it, so there's nothing on a server to breach.",
  ],
  [
    "Project data, if you opt into sync",
    "Stored on Base44's hosted infrastructure, scoped to your account with row-level security — no other user's session can reach it.",
  ],
  [
    "Vaea Chat",
    "Sends the current board to the AI provider for one request, to answer that one message. Nothing is kept on Vaea's side afterward. A privacy note in the chat window says this every time.",
  ],
  [
    "Your own AI account (BYOK)",
    "Your API key is stored only on your device and used to talk to the provider directly from your browser — it never passes through Vaea's servers.",
  ],
  [
    "Local Mode",
    "Runs the whole chat exchange through a folder on your own machine, answered by a model you control. No request leaves your network.",
  ],
];

const LIMITATIONS = [
  [
    "No server means no server-side backup",
    "Device-local project data lives only on that device unless you turn on sync or export it yourself. Losing the device without a backup means losing the data — see the threat model for the full tradeoff.",
  ],
  [
    "Sign-in security is inherited, not custom-built",
    "Vaea uses Base44's hosted login rather than its own authentication system. Its strength — including whether multi-factor authentication is offered — depends on the identity provider you sign in with.",
  ],
  [
    "AI providers see what you send them",
    "Outside Local Mode, a chat message means your current board is visible to whichever AI provider answers it, for that one request. Vaea discloses this rather than hiding it — see the threat model for what's actually kept.",
  ],
  [
    "One maintainer",
    "There's no dedicated security team reviewing every change — one person builds and reviews this project's code. The source is public, so it's open to outside review too.",
  ],
];

export default function Security() {
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
          <div className="max-w-[46rem]">
            <Eyebrow className="mb-4">security</Eyebrow>
            <h1 className="text-balance font-display text-[clamp(2.3rem,5.4vw,3.7rem)] font-semibold leading-[1.03] tracking-[-0.034em] text-foreground">
              What protects your data, stated plainly.
            </h1>
            <p className="mt-5 max-w-[54ch] text-[1.05rem] leading-relaxed text-muted-foreground">
              The controls in place, what they don't cover, and how to report a problem. Nothing here
              is marketing language — every line can be checked against the public source.
            </p>
            <p className="mt-4 font-mono text-[0.72rem] tracking-tight text-muted-foreground">Last updated {UPDATED}</p>
          </div>
        </Container>
      </ParallaxBackdrop>

      <section className="pb-[calc(var(--mkt-section-y)*0.85)] pt-[calc(var(--mkt-section-y)*0.35)]">
        <Container>
          <div className="max-w-[52rem]">
            <Reveal className="border-t border-foreground/[0.08] py-8 first:border-t-0">
              <h2 className="font-display text-[clamp(1.35rem,2.5vw,1.8rem)] font-semibold tracking-[-0.025em] text-foreground">
                Controls in place
              </h2>
              <ul className="mt-6 divide-y divide-foreground/[0.08] border-y border-foreground/[0.08]">
                {CONTROLS.map(([t, d]) => (
                  <li key={t} className="py-4">
                    <p className="text-[0.98rem] font-medium text-foreground">{t}</p>
                    <p className="mt-1.5 max-w-[66ch] text-[0.95rem] leading-relaxed text-muted-foreground">{d}</p>
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal className="border-t border-foreground/[0.08] py-8">
              <h2 className="font-display text-[clamp(1.35rem,2.5vw,1.8rem)] font-semibold tracking-[-0.025em] text-foreground">
                Known limitations
              </h2>
              <p className="mt-3.5 max-w-[64ch] text-[1rem] leading-relaxed text-muted-foreground">
                No system is complete protection. These are the tradeoffs worth knowing before you
                trust Vaea with real work.
              </p>
              <ul className="mt-6 divide-y divide-foreground/[0.08] border-y border-foreground/[0.08]">
                {LIMITATIONS.map(([t, d]) => (
                  <li key={t} className="py-4">
                    <p className="text-[0.98rem] font-medium text-foreground">{t}</p>
                    <p className="mt-1.5 max-w-[66ch] text-[0.95rem] leading-relaxed text-muted-foreground">{d}</p>
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal className="border-t border-foreground/[0.08] py-8">
              <h2 className="font-display text-[clamp(1.35rem,2.5vw,1.8rem)] font-semibold tracking-[-0.025em] text-foreground">
                Report a problem
              </h2>
              <div className="mt-3.5 max-w-[64ch] space-y-3.5 text-[1rem] leading-relaxed text-muted-foreground">
                <p>
                  Found a security issue? Email{" "}
                  <a
                    href={`mailto:${MAKER.email}`}
                    className="text-foreground underline decoration-foreground/25 underline-offset-2 hover:decoration-foreground"
                  >
                    {MAKER.email}
                  </a>{" "}
                  with what you found and how to reproduce it. Expect a reply within a few days —
                  there's one maintainer, so response time is best-effort rather than a guaranteed
                  service level. Good-faith research against your own account and data won't be
                  treated as a violation of anything.
                </p>
                <p>
                  The full policy, scope, and safe-harbor terms are in{" "}
                  <a
                    href="https://github.com/SheppCrafd/vaea/blob/main/SECURITY.md"
                    target="_blank"
                    rel="noreferrer"
                    className="text-foreground underline decoration-foreground/25 underline-offset-2 hover:decoration-foreground"
                  >
                    SECURITY.md
                  </a>
                  , and a fuller technical breakdown — threats, impact, mitigations, residual risk —
                  is in{" "}
                  <a
                    href="https://github.com/SheppCrafd/vaea/blob/main/docs/threat-model.md"
                    target="_blank"
                    rel="noreferrer"
                    className="text-foreground underline decoration-foreground/25 underline-offset-2 hover:decoration-foreground"
                  >
                    the threat model
                  </a>
                  .
                </p>
              </div>
            </Reveal>
          </div>
        </Container>
      </section>

      <Section
        eyebrow="related"
        title="See where your data actually lives"
        lede="This page covers what protects it. /privacy covers where it lives, what leaves your computer and when, and how to run Vaea with nothing leaving at all."
      />

      <ClosingCta title="Put your portfolio on one board." note="No card required · your information stays on your computer" />
    </>
  );
}

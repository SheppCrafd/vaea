import { Github, Mail, ExternalLink } from "lucide-react";
import MarketingLayout, { MAINTAINER } from "./MarketingLayout";
import { Reveal, useDocumentMeta } from "./effects";
import { hairlineH, lightWash, glassTileLight, glowTop, eyebrowOnLight, displayL, focusRing } from "./theme";

const CONTACT_LINKS = [
  { icon: Mail, label: MAINTAINER.email, href: `mailto:${MAINTAINER.email}` },
  { icon: Github, label: "GitHub", href: MAINTAINER.github },
  { icon: ExternalLink, label: "Gravatar profile", href: MAINTAINER.gravatar },
];

export default function AboutPage() {
  useDocumentMeta("About | Vaea", "/about");

  return (
    <MarketingLayout>
      <section className={`relative ${lightWash}`}>
        <div aria-hidden="true" className={glowTop} />
        <div className="relative max-w-3xl mx-auto px-6 py-24 sm:py-32">
          <Reveal>
            <p className={eyebrowOnLight}>About</p>
            <h1 className={`${displayL} mt-3 mb-10`}>Who&apos;s behind this</h1>
          </Reveal>

          <Reveal delay={120} className={`rounded-3xl p-8 sm:p-10 ${glassTileLight}`}>
            <div className="flex items-center gap-5">
              <img
                src={MAINTAINER.avatar}
                alt={MAINTAINER.name}
                className="w-20 h-20 rounded-full border border-border shrink-0"
              />
              <div>
                <h2 className="font-heading text-xl font-semibold tracking-tight">{MAINTAINER.name}</h2>
                <p className="text-sm text-muted-foreground mt-1">{MAINTAINER.bio}</p>
              </div>
            </div>

            <div aria-hidden="true" className={`${hairlineH} my-7`} />

            <div className="grid sm:grid-cols-3 gap-4 text-sm">
              {CONTACT_LINKS.map(({ icon: Icon, label, href }) => (
                <a
                  key={label}
                  href={href}
                  target={href.startsWith("mailto:") ? undefined : "_blank"}
                  rel={href.startsWith("mailto:") ? undefined : "noopener noreferrer"}
                  className={`flex items-center gap-2 text-muted-foreground hover:text-foreground transition-all hover:-translate-y-0.5 rounded-sm ${focusRing}`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {label}
                </a>
              ))}
            </div>
          </Reveal>

          <Reveal delay={200}>
            <p className="mt-8 text-sm text-muted-foreground">
              Vaea is built and maintained solo. Questions, bugs, or feedback — email above, or open an issue on{" "}
              <a
                href="https://github.com/SheppCrafd/vaea"
                target="_blank"
                rel="noopener noreferrer"
                className={`text-foreground underline underline-offset-2 rounded-sm ${focusRing}`}
              >
                GitHub
              </a>.
            </p>
          </Reveal>
        </div>
      </section>
    </MarketingLayout>
  );
}

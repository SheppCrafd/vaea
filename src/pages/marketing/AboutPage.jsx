import { Github, Mail, ExternalLink } from "lucide-react";
import MarketingLayout, { MAINTAINER } from "./MarketingLayout";
import { hairlineH, lightWash, glassTileLight, eyebrowOnLight, displayL } from "./theme";

export default function AboutPage() {
  return (
    <MarketingLayout>
      <section className={`relative ${lightWash}`}>
        <div className="max-w-3xl mx-auto px-6 py-24 sm:py-32">
          <p className={eyebrowOnLight}>About</p>
          <h1 className={`${displayL} mt-3 mb-10`}>Who's behind this</h1>

          <div className={`rounded-3xl p-8 sm:p-10 ${glassTileLight}`}>
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
              <a
                href={`mailto:${MAINTAINER.email}`}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Mail className="w-4 h-4 shrink-0" />
                {MAINTAINER.email}
              </a>
              <a
                href={MAINTAINER.github}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Github className="w-4 h-4 shrink-0" />
                GitHub
              </a>
              <a
                href={MAINTAINER.gravatar}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="w-4 h-4 shrink-0" />
                Gravatar profile
              </a>
            </div>
          </div>

          <p className="mt-8 text-sm text-muted-foreground">
            Vaea is built and maintained solo. Questions, bugs, or feedback — email above, or open an issue on{" "}
            <a
              href="https://github.com/SheppCrafd/vaea"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground underline underline-offset-2"
            >
              GitHub
            </a>.
          </p>
        </div>
      </section>
    </MarketingLayout>
  );
}

import { useTheme } from "next-themes";
import MarketingLayout, { MAINTAINER } from "./MarketingLayout";
import GravatarCard from "./GravatarCard";
import { lightWash, glassTileLight, eyebrowOnLight, displayL } from "./theme";

export default function AboutPage() {
  const { resolvedTheme } = useTheme();

  return (
    <MarketingLayout>
      <section className={`relative ${lightWash}`}>
        <div className="max-w-3xl mx-auto px-6 py-24 sm:py-32">
          <p className={eyebrowOnLight}>About</p>
          <h1 className={`${displayL} mt-3 mb-10`}>Who's behind this</h1>

          <div className={`rounded-3xl p-3 sm:p-4 ${glassTileLight}`}>
            <GravatarCard
              username={MAINTAINER.gravatarUsername}
              name={MAINTAINER.name}
              dark={resolvedTheme === "dark"}
            />
          </div>

          <p className="mt-8 text-sm text-muted-foreground">
            Vaea is built and maintained solo. Questions, bugs, or feedback — email via the card above, or open an issue on{" "}
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

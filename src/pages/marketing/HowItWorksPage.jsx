import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import MarketingLayout from "./MarketingLayout";
import { Reveal, StageLight, Grain } from "./effects";
import { darkSectionBg, darkText, darkTopEdge, pillOnDark, eyebrowOnDark, displayXL, displayL, hairlineH, focusRing } from "./theme";

const STEPS = [
  {
    title: "Sign in (or skip it for now)",
    body: "Google, Microsoft, Apple, or email — whichever you'd rather use. It unlocks Vaea Chat and cloud storage; organizing, editing, and bringing in a spreadsheet all work without it.",
  },
  {
    title: "Pick where your stuff lives",
    body: "On Chrome or Edge, pick a folder on your own computer once and everything's saved there as real files you can open yourself. On another browser, you save and load a file by hand instead. Or sign in and save to the cloud instead, so it follows you to any device. Only that last option puts anything on someone else's server — chat history aside, which always does.",
  },
  {
    title: "Dump everything on Vaea Chat",
    body: "Just tell it everything that's piling up and it'll figure out how to lay it all out for you — chat with it for a minute first if you want to give it a name and personality. Already have it all in a messy spreadsheet instead? Hand that over and it'll build out the whole thing in one pass.",
  },
];

export default function HowItWorksPage() {
  useEffect(() => {
    document.title = "How it works | Vaea";
  }, []);

  return (
    <MarketingLayout>
      <section className={`relative overflow-hidden ${darkSectionBg} ${darkText} ${darkTopEdge}`}>
        <StageLight />
        <Grain />
        <div className="relative max-w-3xl mx-auto px-6 pt-24 sm:pt-32 pb-20 sm:pb-28 text-center">
          <Reveal>
            <p className={`${eyebrowOnDark} mb-4`}>How it works</p>
            <h1 className={displayXL}>
              From overwhelmed to organized in three steps.
            </h1>
          </Reveal>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-6 py-16 sm:py-20">
        {STEPS.map(({ title, body }, i) => (
          <Reveal key={title} delay={i * 100} className="py-8">
            {i > 0 && <div aria-hidden="true" className={`${hairlineH} -mt-8 mb-8`} />}
            <div className="flex gap-6 sm:gap-8">
            <span className="font-heading text-4xl sm:text-5xl font-semibold text-foreground/[0.09] select-none leading-none shrink-0 w-12 sm:w-16">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <h2 className="font-heading text-xl font-semibold tracking-tight">{title}</h2>
              <p className="mt-2 text-muted-foreground max-w-lg">{body}</p>
            </div>
            </div>
          </Reveal>
        ))}

        <div>
          <div aria-hidden="true" className={`${hairlineH} mb-8`} />
          <p className="text-muted-foreground max-w-lg">
            From there, it's just working — one search box jumps to or acts on anything, and
            whenever it piles up again, just tell Vaea Chat and let it handle the whole cleanup
            instead of you clicking through each change by hand.
          </p>
        </div>
      </div>

      <section className={`relative overflow-hidden ${darkSectionBg} ${darkText} ${darkTopEdge}`}>
        <StageLight />
        <Grain />
        <div className="relative max-w-3xl mx-auto px-6 py-24 sm:py-32 text-center">
          <Reveal>
            <h2 className={displayL}>
              Tell it what&apos;s piling up. It sorts it.
            </h2>
            <div className="mt-8">
              <Link to="/signup" className={pillOnDark}>
                Sign up free
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </MarketingLayout>
  );
}

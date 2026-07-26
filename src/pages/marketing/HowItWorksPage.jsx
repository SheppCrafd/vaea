import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import MarketingLayout from "./MarketingLayout";
import { Reveal, GlowOrb } from "./effects";
import { darkSectionBg, darkText, pillOnDark, eyebrowOnDark } from "./theme";

const STEPS = [
  {
    title: "Sign in",
    body: "Google, Microsoft, Apple, or email — whichever you'd rather use. It only unlocks Vaea Chat; organizing, editing, and bringing in a spreadsheet all work without it.",
  },
  {
    title: "Pick where your stuff lives",
    body: "On Chrome or Edge, pick a folder on your own computer once and everything's saved there as real files you can open yourself. On another browser, you save and load a file by hand instead. Either way, nothing sits on someone else's server except your chat history with Vaea.",
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
      <div className={`relative overflow-hidden ${darkSectionBg} ${darkText}`}>
        <GlowOrb className="w-[520px] h-[520px] -top-56 left-1/2 -translate-x-1/2" />
        <div className="relative max-w-3xl mx-auto px-6 pt-24 sm:pt-32 pb-20 sm:pb-28 text-center">
          <Reveal>
            <p className={`${eyebrowOnDark} mb-4`}>How it works</p>
            <h1 className="font-heading text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight leading-[1.08]">
              From overwhelmed to organized in three steps.
            </h1>
          </Reveal>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-16 sm:py-20">
        {STEPS.map(({ title, body }, i) => (
          <Reveal key={title} delay={i * 100} className={`flex gap-6 sm:gap-8 py-8 ${i > 0 ? "border-t border-border" : ""}`}>
            <span className="font-heading text-4xl sm:text-5xl font-semibold text-[#46BAD1]/25 select-none leading-none shrink-0 w-12 sm:w-16">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <h2 className="font-heading text-xl font-semibold tracking-tight">{title}</h2>
              <p className="mt-2 text-muted-foreground max-w-lg">{body}</p>
            </div>
          </Reveal>
        ))}

        <div className="pt-8 border-t border-border">
          <p className="text-muted-foreground max-w-lg">
            From there, it's just working — one search box jumps to or acts on anything, and
            whenever it piles up again, just tell Vaea Chat and let it handle the whole cleanup
            instead of you clicking through each change by hand.
          </p>
        </div>
      </div>

      <div className={`relative overflow-hidden ${darkSectionBg} ${darkText}`}>
        <GlowOrb className="w-[480px] h-[480px] -bottom-52 left-1/2 -translate-x-1/2" />
        <div className="relative max-w-3xl mx-auto px-6 py-24 sm:py-32 text-center">
          <Reveal>
            <h2 className="font-heading text-3xl sm:text-4xl font-semibold tracking-tight">
              Ready to get it off your plate?
            </h2>
            <div className="mt-8">
              <Link to="/login" className={pillOnDark}>
                Get started
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </Reveal>
        </div>
      </div>
    </MarketingLayout>
  );
}

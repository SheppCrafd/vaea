import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import MarketingLayout from "./MarketingLayout";
import { Reveal, StageLight, Grain, useDocumentMeta, usePageSchema } from "./effects";
import { darkSectionBg, darkText, darkTopEdge, pillOnDark, eyebrowOnDark, displayXL, displayL, hairlineH } from "./theme";

const STEPS = [
  {
    title: "Sign in (or skip it for now)",
    body: "Google, Microsoft, Apple, or email — whichever you'd rather use. It unlocks the built-in AI and cloud storage; organizing, editing, and bringing in a spreadsheet all work without it, and Local Mode (a way to use Vaea Chat where nothing leaves your device) runs chat without an account too.",
  },
  {
    title: "Pick where your stuff lives",
    body: "On Chrome or Edge, pick a folder on your own computer once and everything's saved there as real files you can open yourself. On another browser, you save and load a file by hand instead. Or sign in and save to the cloud instead, so it follows you to any device. Only that last option puts anything on someone else's server — chat history usually does too, except in Local Mode, which keeps that on your device as well.",
  },
  {
    title: "Dump everything on Vaea Chat",
    body: "Just tell it everything that's piling up and it'll figure out how to lay it all out for you — chat with it for a minute first if you want to give it a name and personality. Already have it all in a messy spreadsheet instead? Hand that over and it'll build out the whole thing in one pass.",
  },
];

const HOW_IT_WORKS_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How to get started with Vaea",
  "url": "https://vaea.base44.app/how-it-works",
  "description": "Get from overwhelmed to organized in three steps using Vaea, a free personal project and task manager with an AI assistant.",
  "step": [
    {
      "@type": "HowToStep",
      "position": "1",
      "name": "Sign in (or skip it for now)",
      "text": "Sign in with Google, Microsoft, Apple, or email — or skip it and use Vaea without an account. Signing in unlocks the built-in AI and cloud storage.",
    },
    {
      "@type": "HowToStep",
      "position": "2",
      "name": "Pick where your stuff lives",
      "text": "Choose a folder on your own device for local-first storage, or sign in and use cloud storage so your data follows you across devices.",
    },
    {
      "@type": "HowToStep",
      "position": "3",
      "name": "Dump everything on Vaea Chat",
      "text": "Tell Vaea Chat everything that's piling up. It figures out how to lay it all out for you — or hand it a messy spreadsheet and it builds the whole thing in one pass.",
    },
  ],
  "isPartOf": { "@type": "WebSite", "url": "https://vaea.base44.app/" },
};

export default function HowItWorksPage() {
  useDocumentMeta("How it works — set up in under a minute | Vaea", "/how-it-works");
  usePageSchema(HOW_IT_WORKS_SCHEMA);

  return (
    <MarketingLayout>
      <section className={`relative overflow-hidden ${darkSectionBg} ${darkText} ${darkTopEdge}`}>
        <StageLight />
        <Grain />
        <div className="relative max-w-3xl mx-auto px-6 pt-24 sm:pt-32 pb-16 sm:pb-20 text-center">
          <Reveal>
            <p className={`${eyebrowOnDark} mb-4`}>How it works</p>
            <h1 className={displayXL}>
              From overwhelmed to organized in three steps.
            </h1>
            <div className="mt-8">
              <Link to="/signup" className={pillOnDark}>
                Sign up free
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-6 py-12 sm:py-16">
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
          <p className="mt-4 text-muted-foreground max-w-lg">
            Running a freelance practice with a handful of clients? Set each client up as its
            own Product, with Projects underneath for each engagement — Vaea Chat can lay that
            whole structure out for you from a single message.
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

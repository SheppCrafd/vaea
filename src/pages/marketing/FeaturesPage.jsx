import { Link } from "react-router-dom";
import {
  Boxes, LayoutGrid, Command, FileSpreadsheet, Bot, Search, Fingerprint,
  Paperclip, ClipboardCheck, FolderCog, LockKeyhole, HardDrive, Cloud, ArrowRight,
  BookOpen, GitBranch, Wrench, Sparkles, ShieldOff,
} from "lucide-react";
import MarketingLayout from "./MarketingLayout";
import { Reveal, StageLight, Grain, useDocumentMeta, usePageSchema } from "./effects";
import { darkSectionBg, darkText, darkTopEdge, pillOnDark, linkOnDark, eyebrowOnDark, displayXL, displayL, hairlineH } from "./theme";

const GROUPS = [
  {
    title: "Vaea Chat",
    lede: "When you don't have the bandwidth to sort through it yourself, tell it and it actually does the sorting — not a chatbot that just describes what you should do.",
    items: [
      { icon: Bot, title: "It doesn't stop at one step", body: "Ask for something bigger than one change and it breaks it into the right pieces and actually does every one of them — not one reply and a shrug." },
      { icon: Fingerprint, title: "A name and a personality it keeps", body: "Set its name, role, and tone yourself in Settings, or just chat with it for a minute and let it work out who it should be." },
      { icon: Search, title: "Looks things up for you", body: "If a task needs an answer it doesn't already have, it'll search the web instead of guessing." },
      { icon: Paperclip, title: "Reads what you hand it", body: "Drop a file into the chat and it actually reads it before deciding what to do." },
      { icon: ClipboardCheck, title: "Points out what's gone stale", body: "It can look through everything you've got and flag what hasn't been touched in a while, before it turns into another pile." },
    ],
  },
  {
    title: "Vaea Brain",
    lede: "Optional: connect your own Obsidian notes and let the assistant read and write them too — decisions, things you've learned, a running daily log.",
    items: [
      { icon: BookOpen, title: "A personal notes vault, still yours", body: "Your Obsidian notes on your own GitHub account — write the way you already do, nothing new to learn." },
      { icon: Search, title: "Reads it for context, writes when you ask", body: "Ask what you decided last month and it goes and looks. Say \"/vault-log\" and it writes a real session summary as a saved note." },
      { icon: GitBranch, title: "Backed up on every change", body: "Every change is saved to your own GitHub account — recoverable from your own history, never something Vaea holds onto." },
      { icon: Wrench, title: "Keeps it tidy", body: "\"/vault-tidy\" audits your notes' [[wikilinks]] for broken links and orphaned notes, then proposes fixes as a normal confirmable plan." },
      { icon: Sparkles, title: "Keeps notes on itself, too", body: "Opt in, and roughly once a day it reviews its own replies and writes down what it'd do differently — a real line in Vaea Self.md, not a vague promise to improve." },
      { icon: LockKeyhole, title: "Never about you, unless you say so", body: "A second, separate opt-in — off by default — lets it also notice patterns in how you work. Without it, that's not just against the rules, it's not possible." },
    ],
  },
  {
    title: "Organize",
    lede: "Somewhere for every project and stray task to actually live, instead of scattered across five apps and your own memory.",
    items: [
      { icon: Boxes, title: "Everything nests inside something bigger", body: "A big area of your life or work, broken down into smaller pieces, broken down into the actual tasks — nothing just floating on its own with no home. Freelancers can use the same ladder as a practice → client → engagement → task hierarchy without inventing anything new." },
      { icon: LayoutGrid, title: "See as much or as little as you need", body: "Zoom out for a quick scan of everything at once, or zoom in when one thing needs your full attention." },
      { icon: FolderCog, title: "Click in without losing your place", body: "Open something bigger and what's inside it opens right there with it — no separate page to load, no hunting for your way back." },
    ],
  },
  {
    title: "Move faster",
    lede: "When you're already stretched thin, you shouldn't have to hunt through menus to get anything done — so you don't.",
    items: [
      { icon: Command, title: "One search box for everything", body: "Start typing and it finds — or does — whatever you're after, instead of you clicking through menu after menu to get there." },
      { icon: FileSpreadsheet, title: "Already have it all in a spreadsheet?", body: "Hand it over as-is. Vaea reads how it's all supposed to nest together and builds the whole thing out in one pass, instead of you typing it all in by hand." },
    ],
  },
  {
    title: "Your stuff, your device — or your account, your call",
    lede: "One less company holding your life hostage by default — everything happens on your own device unless you decide otherwise.",
    items: [
      { icon: HardDrive, title: "Real files, not something that just vanishes", body: "On Chrome or Edge, pick a folder on your own computer once, and everything's saved there as real files you can open yourself. On another browser, you save/load a file by hand instead." },
      { icon: Cloud, title: "Or let it follow you, if you'd rather", body: "Sign in and switch to cloud storage anytime — same data, synced to your account instead of one device. Switch back whenever; nothing's stuck where you first put it." },
      { icon: LockKeyhole, title: "Signing in unlocks the built-in AI — and cloud storage", body: "Everything else — organizing, editing, bringing in a spreadsheet, searching — works whether you're signed in or not." },
      { icon: ShieldOff, title: "Or run chat without an account at all — Local Mode", body: "Connect a folder and Vaea talks to your own model, or Claude Code itself, through plain files on your disk. No account key, no sign-in, and Vaea sends nothing on its own in this mode." },
    ],
  },
];

const FEATURES_PAGE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "Features | Vaea",
  "url": "https://vaea.base44.app/features",
  "description": "Full feature list for Vaea: AI chat that acts on your workspace, hierarchical project organization (Areas, Products, Projects, Tasks), local-first storage, bring-your-own-key AI, Local Mode, Obsidian vault integration, and more. Free, no tiers.",
  "isPartOf": { "@type": "WebSite", "url": "https://vaea.base44.app/" },
};

export default function FeaturesPage() {
  useDocumentMeta("Features | Vaea", "/features", FEATURES_PAGE_SCHEMA.description);
  usePageSchema(FEATURES_PAGE_SCHEMA);

  return (
    <MarketingLayout>
      <section className={`relative overflow-hidden ${darkSectionBg} ${darkText} ${darkTopEdge}`}>
        <StageLight />
        <Grain />
        <div className="relative max-w-3xl mx-auto px-6 pt-24 sm:pt-32 pb-16 sm:pb-20 text-center">
          <Reveal>
            <p className={`${eyebrowOnDark} mb-4`}>Features</p>
            <h1 className={displayXL}>
              Everything that's piling up, finally somewhere it can't get lost.
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
              No pricing plans to compare, no limit on how much you throw at it — this is a
              personal system built to catch everything, so none of it has to live in your head.
            </p>
            <div className="mt-8">
              <Link to="/signup" className={pillOnDark}>
                Sign up free
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-6 py-12 sm:py-16">
        {GROUPS.map((group, i) => (
          <Reveal key={group.title} as="div" className="py-10 sm:py-12">
            {i > 0 && <div aria-hidden="true" className={`${hairlineH} -mt-10 sm:-mt-12 mb-10 sm:mb-12`} />}
            <div className="sm:grid sm:grid-cols-[220px_1fr] sm:gap-10">
              <div className="mb-6 sm:mb-0">
                <h2 className="font-heading text-xl font-semibold tracking-tight">{group.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{group.lede}</p>
              </div>
              <div className="space-y-4">
                {group.items.map(({ icon: Icon, title, body }) => (
                  <div
                    key={title}
                    className="flex gap-4 p-4 -mx-4 rounded-xl transition-colors hover:bg-gradient-to-r hover:from-muted/50 hover:to-transparent"
                  >
                    <div className="shrink-0 w-9 h-9 rounded-lg bg-gradient-to-b from-card to-muted/60 shadow-[0_0_0_1px_hsl(var(--foreground)/0.05),0_1px_2px_0_hsl(200_30%_12%/0.06)] dark:shadow-[0_0_0_1px_hsl(var(--foreground)/0.08),0_0_10px_-2px_hsl(var(--foreground)/0.14)] flex items-center justify-center">
                      <Icon className="w-4 h-4 text-foreground" />
                    </div>
                    <div>
                      <h3 className="font-medium">{title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        ))}
      </div>

      <section className={`relative overflow-hidden ${darkSectionBg} ${darkText} ${darkTopEdge}`}>
        <StageLight />
        <Grain />
        <div className="relative max-w-3xl mx-auto px-6 py-24 sm:py-32 text-center">
          <Reveal>
            <h2 className={displayL}>
              See it come together
            </h2>
            <p className="mt-3 text-muted-foreground">Three steps from overwhelmed to organized.</p>
            <div className="mt-8 flex items-center justify-center gap-5 flex-wrap">
              <Link to="/how-it-works" className={pillOnDark}>
                How it works
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link to="/login" className={linkOnDark}>
                Or sign in directly
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </MarketingLayout>
  );
}

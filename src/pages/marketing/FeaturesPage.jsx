import { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Boxes, LayoutGrid, Command, FileSpreadsheet, Bot, Search, Fingerprint,
  Paperclip, ClipboardCheck, FolderCog, LockKeyhole, HardDrive, ArrowRight,
  BookOpen, GitBranch, Wrench,
} from "lucide-react";
import MarketingLayout from "./MarketingLayout";

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
    title: "Vaea Vault",
    lede: "Optional: connect your own Obsidian notes and let the assistant read and write them too — decisions, things you've learned, a running daily log.",
    items: [
      { icon: BookOpen, title: "A personal notes vault, still yours", body: "A git-backed Obsidian vault on your own GitHub account — write the way you already do, nothing new to learn." },
      { icon: Search, title: "Reads it for context, writes when you ask", body: "Ask what you decided last month and it goes and looks. Say \"/vault-log\" and it writes a real session summary as a commit." },
      { icon: GitBranch, title: "Backed up on every change", body: "Every write is a real git commit to your own repo — recoverable from GitHub's own history, never something Vaea holds onto." },
      { icon: Wrench, title: "Keeps it tidy", body: "\"/vault-tidy\" audits your notes' [[wikilinks]] for broken links and orphaned notes, then proposes fixes as a normal confirmable plan." },
    ],
  },
  {
    title: "Organize",
    lede: "Somewhere for every project and stray task to actually live, instead of scattered across five apps and your own memory.",
    items: [
      { icon: Boxes, title: "Everything nests inside something bigger", body: "A big area of your life or work, broken down into smaller pieces, broken down into the actual tasks — nothing just floating on its own with no home." },
      { icon: LayoutGrid, title: "See as much or as little as you need", body: "Zoom out for a quick scan of everything at once, or zoom in when one thing needs your full attention." },
      { icon: FolderCog, title: "Click in without losing your place", body: "Open something bigger and what's inside it opens right there with it — no separate page to load, no hunting for your way back." },
    ],
  },
  {
    title: "Move faster",
    lede: "When you're already stretched thin, hunting through menus is the last straw — so you never have to.",
    items: [
      { icon: Command, title: "One search box for everything", body: "Start typing and it finds — or does — whatever you're after, instead of you clicking through menu after menu to get there." },
      { icon: FileSpreadsheet, title: "Already have it all in a spreadsheet?", body: "Hand it over as-is. Vaea reads how it's all supposed to nest together and builds the whole thing out in one pass, instead of you typing it all in by hand." },
    ],
  },
  {
    title: "Your stuff, your device",
    lede: "One less account, one less company holding your life hostage — everything happens on your own device by default, not as an afterthought.",
    items: [
      { icon: HardDrive, title: "Real files, not something that just vanishes", body: "Pick a folder on your own computer once, and everything's saved there as real files you can open yourself — or save/load a file by hand if that's not an option for you." },
      { icon: LockKeyhole, title: "Signing in only unlocks Vaea Chat", body: "Everything else — organizing, editing, bringing in a spreadsheet, searching — works whether you're signed in or not." },
    ],
  },
];

export default function FeaturesPage() {
  useEffect(() => {
    document.title = "Features | Vaea";
  }, []);

  return (
    <MarketingLayout>
      <div className="max-w-4xl mx-auto px-6 pt-16 sm:pt-20 pb-8">
        <p className="font-terminal text-xs uppercase tracking-widest text-muted-foreground mb-4">Features</p>
        <h1 className="font-heading text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.1]">
          Everything that's piling up, finally somewhere it can't get lost.
        </h1>
        <p className="mt-5 text-lg text-muted-foreground max-w-xl">
          No pricing plans to compare, no limit on how much you throw at it — this is a
          personal system built to catch everything and then get out of your way.
        </p>
      </div>

      <div className="max-w-4xl mx-auto px-6 pb-16 sm:pb-24">
        {GROUPS.map((group, i) => (
          <div key={group.title} className={`py-10 sm:py-12 ${i > 0 ? "border-t border-border" : ""}`}>
            <div className="sm:grid sm:grid-cols-[220px_1fr] sm:gap-10">
              <div className="mb-6 sm:mb-0">
                <h2 className="font-heading text-xl font-semibold tracking-tight">{group.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{group.lede}</p>
              </div>
              <div className="space-y-6">
                {group.items.map(({ icon: Icon, title, body }) => (
                  <div key={title} className="flex gap-4">
                    <div className="shrink-0 w-9 h-9 rounded-lg border border-border bg-card flex items-center justify-center">
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
          </div>
        ))}
      </div>

      <div className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-16 sm:py-20 text-center">
          <h2 className="font-heading text-2xl sm:text-3xl font-semibold tracking-tight">
            See it come together
          </h2>
          <p className="mt-3 text-muted-foreground">Three steps from overwhelmed to organized.</p>
          <div className="mt-6 flex items-center justify-center gap-4 flex-wrap">
            <Link
              to="/how-it-works"
              className="inline-flex items-center gap-1.5 text-sm px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md transition-colors"
            >
              How it works
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Or sign in directly
            </Link>
          </div>
        </div>
      </div>
    </MarketingLayout>
  );
}

// Single source of truth for every marketing route's <head>. Imported both
// by the runtime <SeoHead> component (client-side nav) and by
// scripts/prerender.mjs (build-time static HTML) so the two can never drift.
// Plain JS on purpose — no JSX, no imports — so the prerender bundler picks
// it up with zero config.

export const SITE_URL = "https://vaea.base44.app";
export const SITE_NAME = "Vaea";
export const OG_IMAGE = `${SITE_URL}/og-image.png`;
// Public source repo — used as the Organization/Person `sameAs` so answer
// engines and Google can resolve the "Vaea" entity to the right thing (the
// name collides with unrelated places/words).
export const SITE_REPO = "https://github.com/SheppCrafd/vaea";
// Bump when page copy materially changes. Surfaced visibly in the footer and
// as `dateModified` in structured data (a freshness signal for search + AI).
export const SITE_MODIFIED = "2026-08-30";

// The person behind the project. Real, public identity (the GitHub + Gravatar
// are already public) — used for the /about card, the footer, and the
// Person/author structured data so the site isn't an anonymous page.
export const MAKER = {
  name: "SheppCrafd",
  role: "Maintainer",
  bio: "Builds mods, builds robots, builds modded robots.",
  avatar: "/maker-avatar.png",
  email: "mwallis31@outlook.com",
  github: "https://github.com/SheppCrafd",
  gravatar: "https://gravatar.com/sheppcrafd",
};

// Every indexable marketing route. `path` is the router path; `loc` is what
// lands in sitemap.xml. Keep this list and MarketingApp's <Route> list in
// step — prerender iterates this array.
export const ROUTES = [
  {
    path: "/",
    loc: "/",
    priority: "1.0",
    changefreq: "weekly",
    title: "Vaea — one calm board for everything you're carrying",
    description:
      "The calm place to organize every project you're juggling. An assistant does the sorting and shows you first, and your information stays on your own computer.",
  },
  {
    path: "/vaea-chat",
    loc: "/vaea-chat",
    priority: "0.9",
    changefreq: "monthly",
    title: "Vaea Chat — see every change before it happens | Vaea",
    description:
      "Ask in plain words. Vaea Chat reads your board, shows what it would change, and waits for your yes. Built-in model, your own AI account, or Claude Code on your own machine.",
  },
  {
    path: "/brain",
    loc: "/brain",
    priority: "0.7",
    changefreq: "monthly",
    title: "Vaea Brain — your own notes, read and written by Vaea Chat | Vaea",
    description:
      "Connect a personal notes vault kept in your own account. Vaea Chat reads and adds to it directly, see it as a map, and nothing is stored on Vaea's servers.",
  },
  {
    path: "/workplace",
    loc: "/workplace",
    priority: "0.7",
    changefreq: "monthly",
    title: "Vaea Workplace — one calendar, one inbox | Vaea",
    description:
      "Vaea Workplace brings your Google and Microsoft calendars into one agenda and your email into one place. Vaea Chat can draft, file, and schedule — showing you first.",
  },
  {
    path: "/privacy",
    loc: "/privacy",
    priority: "0.7",
    changefreq: "monthly",
    title: "Privacy — where your information lives, and Local Mode | Vaea",
    description:
      "Vaea keeps your projects and tasks on your own computer by default. Every time anything leaves it, what you can switch off, and how to run it with nothing leaving at all in Local Mode.",
  },
  {
    path: "/compare",
    loc: "/compare",
    priority: "0.7",
    changefreq: "monthly",
    title: "Vaea vs. the usual setup — an honest comparison | Vaea",
    description:
      "How Vaea compares to the common setup of a cloud task manager plus a separate AI: where Vaea fits, and where that setup is still the better call.",
  },
  {
    path: "/about",
    loc: "/about",
    priority: "0.6",
    changefreq: "yearly",
    title: "Who makes Vaea | Vaea",
    description:
      "Vaea is built and maintained by one person — SheppCrafd. What that means for the project, how to get in touch, and where the code lives.",
  },
  {
    path: "/privacy-policy",
    loc: "/privacy-policy",
    priority: "0.3",
    changefreq: "yearly",
    title: "Privacy Policy | Vaea",
    description:
      "The formal privacy policy for Vaea: what data exists, where it lives, the few things that touch a server, and your rights. Plain-language companion at /privacy.",
  },
  {
    path: "/terms",
    loc: "/terms",
    priority: "0.3",
    changefreq: "yearly",
    title: "Terms of Use | Vaea",
    description:
      "The terms for using Vaea — a one-person project provided as-is, with no warranty and no lock-in. Your work stays yours.",
  },
];

export function routeFor(pathname) {
  return ROUTES.find((r) => r.path === pathname);
}

// --- Shared page content that also has to appear in structured data -------
// Kept here so the visible copy and the JSON-LD can never drift (Google
// drops FAQ/HowTo markup that doesn't match what's on the page). The pages
// import these arrays and render them; jsonLdFor() below builds FAQPage /
// HowTo from the same source.

export const HOME_FAQ = [
  {
    q: "Who is this for?",
    a: "One person keeping track of a lot at once — several projects, a few clients, work and home in the same list. It's made for your own setup, not a shared team space.",
  },
  {
    q: "Does Vaea Chat actually change things, or just talk?",
    a: "It changes things. You ask in plain words, it shows you exactly what it's about to do, and nothing happens until you say yes. You can undo the last thing with one word.",
  },
  {
    q: "Where is my information kept?",
    a: "On your own computer, in ordinary files you can see. Nothing is stored on a server unless you specifically switch that on. You can move it or delete it whenever you want.",
  },
  {
    q: "Will it still be here next year?",
    a: "It's made and looked after by one person, and the code is public. There's no company that could fold and take it offline — it's a personal tool kept in daily use.",
  },
];

export const ASSISTANT_FAQ = [
  {
    q: "What gets sent, and where?",
    a: "When you ask something, a copy of your current board goes to the AI service for that one question so it can understand what you mean. Nothing is saved on a server afterward. The app tells you this right in the chat window.",
  },
  {
    q: "Can I use my own AI account?",
    a: "Yes. Connect an account from a major AI provider and Vaea Chat talks to it directly from your browser. Or run a model on your own computer, with nothing sent out at all.",
  },
  {
    q: "Could it do something I didn't want?",
    a: "It can't act on its own. Every change is shown to you first and waits for your yes. Removing things asks a second time, and a backup is saved before anything large — so a mistake is easy to walk back.",
  },
  {
    q: "Does it watch how I work?",
    a: "Only if you turn that on. By default, reopening the chat can show a plain summary of what changed while you were away — nothing about how you work. A separate switch lets it keep notes on your habits; leave it off and it can't.",
  },
];

// The five steps of a single Vaea Chat change — rendered on /vaea-chat as a
// visible ordered list. Deliberately NOT emitted as HowTo structured data:
// Google deprecated HowTo rich results in 2023, so the markup would only add
// weight with no upside.
export const ASSISTANT_STEPS = [
  ["You ask", "Type it the way you'd say it — “move everything that's stuck waiting on the vendor to the top and flag it for this week.”"],
  ["It looks at your board", "Your current board is sent along so it can see what's actually there. Just for that one question — nothing is kept."],
  ["It shows you the plan", "You get a short list of exactly what it would change. Nothing has changed yet."],
  ["You approve", "It makes the changes. Anything that removes something asks again, and a backup is saved before big changes."],
  ["You can undo", "Say “undo” to take back the last change, or restore a backup."],
];

export const BRAIN_FAQ = [
  {
    q: "Where are the notes kept?",
    a: "In your own account — a personal notes vault you already control. Vaea connects to it and reads and writes it directly. Nothing about the notes is stored on Vaea's servers.",
  },
  {
    q: "What can Vaea Chat do with them?",
    a: "Pull a note in for context while it answers, and add or update notes when you ask — logging a decision, writing up a session, filing a reference. Every write is shown to you first, the same as changes to your board.",
  },
  {
    q: "Do I have to use it?",
    a: "No. Vaea Brain is an optional connection. The board and Vaea Chat work fully without it.",
  },
];

export const WORKPLACE_FAQ = [
  {
    q: "Which accounts can I connect?",
    a: "Google and Microsoft, for both calendar and email. Connect one or both — every calendar lands in a single agenda alongside your project due dates, and your mail comes into one inbox.",
  },
  {
    q: "Can Vaea Chat act on my email and calendar?",
    a: "Yes — draft a reply, file a message, add an event, turn a long thread into tasks. As everywhere else, it shows you the change first and waits for your yes.",
  },
  {
    q: "What about meeting notes?",
    a: "The Meetings surface exists but the transcript connector it needs isn't available yet, and the app says so directly rather than pretending otherwise.",
  },
];

export const SELFHOSTING_FAQ = [
  {
    q: "What does self-hosting actually involve?",
    a: "Clone the public repository, run Vaea on localhost with a couple of commands, and turn on Local Mode in Settings. From then on Vaea Chat writes each question to a folder on your machine instead of calling any service.",
  },
  {
    q: "How does Claude Code answer Vaea Chat?",
    a: "Run Claude Code inside your Vaea working copy, pointed at the Local Mode folder. It picks up each pending message, answers as the model using its own tools, and writes the reply back where Vaea expects it. Run /local-relay for one message, or /l for the same thing when you want it quick.",
  },
  {
    q: "What leaves our network?",
    a: "Nothing from Vaea. Project data is already in files on the machine, and in this setup the model call is local too. Your own use of Claude Code is between you and that tool.",
  },
];

function faqPageLd(items) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((it) => ({
      "@type": "Question",
      name: it.q,
      acceptedAnswer: { "@type": "Answer", text: it.a },
    })),
  };
}


export function canonicalFor(pathname) {
  return pathname === "/" ? `${SITE_URL}/` : `${SITE_URL}${pathname}`;
}

// --- JSON-LD -------------------------------------------------------------

const PERSON = {
  "@type": "Person",
  "@id": `${SITE_URL}/#maker`,
  name: MAKER.name,
  description: MAKER.bio,
  image: `${SITE_URL}${MAKER.avatar}`,
  url: `${SITE_URL}/about`,
  sameAs: [MAKER.github, MAKER.gravatar],
};

export function organizationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#org`,
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/android-chrome-512x512.png`,
    founder: PERSON,
    sameAs: [SITE_REPO],
    description: "Vaea is a one-person project, with your information kept on your own computer by default.",
  };
}

export function websiteLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: SITE_NAME,
    url: SITE_URL,
    publisher: { "@id": `${SITE_URL}/#org` },
  };
}

export function softwareApplicationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "Project and task management",
    operatingSystem: "Web",
    url: SITE_URL,
    screenshot: OG_IMAGE,
    dateModified: SITE_MODIFIED,
    description:
      "One board for all your projects and tasks, grouped by the part of life they belong to, with Vaea Chat making changes after showing you first. Your information stays on your own computer by default, and the whole thing can be self-hosted.",
    author: { "@id": `${SITE_URL}/#maker` },
    publisher: { "@id": `${SITE_URL}/#org` },
    featureList: [
      "One board for projects and tasks, grouped by area of your life",
      "A short list of today's top three and this week's focus",
      "See the people attached to any project or task",
      "Vaea Chat adds and changes things after you approve",
      "Use the built-in model, your own AI account, or Claude Code on your own machine",
      "Vaea Workplace: one calendar view and one inbox across connected accounts",
      "Vaea Brain: your own notes vault, read and written by Vaea Chat",
      "Files kept on your computer, with optional sync you can turn off",
      "Self-host: clone the repo, run on localhost, keep every request on your network",
    ],
  };
}

function personLd() {
  return {
    "@context": "https://schema.org",
    ...PERSON,
    knowsAbout: ["local-first software", "project management tools", "AI assistants"],
    worksFor: { "@id": `${SITE_URL}/#org` },
  };
}

export function jsonLdFor(pathname) {
  const route = routeFor(pathname);
  if (pathname === "/") {
    return [organizationLd(), websiteLd(), softwareApplicationLd(), faqPageLd(HOME_FAQ)];
  }
  if (!route) return [];
  if (pathname === "/vaea-chat") {
    return [webPageLd(route, pathname), faqPageLd(ASSISTANT_FAQ)];
  }
  if (pathname === "/brain") {
    return [webPageLd(route, pathname), faqPageLd(BRAIN_FAQ)];
  }
  if (pathname === "/workplace") {
    return [webPageLd(route, pathname), faqPageLd(WORKPLACE_FAQ)];
  }
  if (pathname === "/privacy") {
    return [webPageLd(route, pathname), faqPageLd(SELFHOSTING_FAQ)];
  }
  if (pathname === "/about") {
    return [webPageLd(route, pathname), personLd()];
  }
  return [webPageLd(route, pathname)];
}

function webPageLd(route, pathname) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: route.title,
    description: route.description,
    url: canonicalFor(pathname),
    dateModified: SITE_MODIFIED,
    isPartOf: { "@id": `${SITE_URL}/#website` },
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
        { "@type": "ListItem", position: 2, name: route.title.split(" | ")[0].split(" — ")[0], item: canonicalFor(pathname) },
      ],
    },
  };
}

export function headTagsFor(pathname) {
  const route = routeFor(pathname) || {
    title: "Page not found | Vaea",
    description: "That page doesn't exist. Head back to the Vaea home page.",
  };
  const canonical = canonicalFor(pathname);
  const noindex = !routeFor(pathname);
  return {
    title: route.title,
    meta: [
      { name: "description", content: route.description },
      { name: "robots", content: noindex ? "noindex, follow" : "index, follow" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: SITE_NAME },
      { property: "og:title", content: route.title },
      { property: "og:description", content: route.description },
      { property: "og:url", content: canonical },
      { property: "og:image", content: OG_IMAGE },
      { property: "og:image:alt", content: "The Vaea board — projects grouped by the part of life they belong to" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: route.title },
      { name: "twitter:description", content: route.description },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    link: [{ rel: "canonical", href: canonical }],
    jsonLd: jsonLdFor(pathname),
  };
}

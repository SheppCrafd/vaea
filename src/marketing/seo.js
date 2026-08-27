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
export const SITE_MODIFIED = "2026-08-27";

// Every indexable marketing route. `path` is the router path; `loc` is what
// lands in sitemap.xml. Keep this list and MarketingApp's <Route> list in
// step — prerender iterates this array.
export const ROUTES = [
  {
    path: "/",
    loc: "/",
    priority: "1.0",
    changefreq: "weekly",
    title: "Vaea — all your projects on one board, run by an assistant",
    description:
      "All your projects in one place. Ask the built-in assistant to add or change things — it shows you first, and your info stays on your own computer.",
  },
  {
    path: "/product",
    loc: "/product",
    priority: "0.9",
    changefreq: "monthly",
    title: "What's in Vaea — board, assistant, calendar, email | Vaea",
    description:
      "A walk through everything in Vaea: the board, the assistant that works on it, one calendar and inbox, a map of your notes, and where your files are kept.",
  },
  {
    path: "/assistant",
    loc: "/assistant",
    priority: "0.9",
    changefreq: "monthly",
    title: "The Vaea assistant — see every change before it happens",
    description:
      "Ask in plain words. It reads your board, shows exactly what it would change, and waits for your yes. Built-in model, your own AI account, or one on your own computer.",
  },
  {
    path: "/privacy",
    loc: "/privacy",
    priority: "0.5",
    changefreq: "yearly",
    title: "Where your information lives — on your computer | Vaea",
    description:
      "Vaea keeps your projects and tasks on your own computer by default. This page lists every time anything leaves it, and what you can switch off.",
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
    q: "What does it cost?",
    a: "Nothing. There are no paid plans and nothing is locked behind an upgrade. If you connect your own AI account, you pay that provider directly — Vaea adds no charge.",
  },
  {
    q: "Does the assistant actually change things, or just talk?",
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
    a: "Yes. Connect an account from a major AI provider and the assistant talks to it directly from your browser. Or run a model on your own computer, with nothing sent out at all.",
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

// The five steps of a single assistant change — rendered on /assistant as a
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
  name: "the maker of Vaea",
  sameAs: ["https://github.com/SheppCrafd"],
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
    description: "Vaea is a one-person project, free, with your information kept on your own computer by default.",
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
      "One board for all your projects and tasks, grouped by the part of life they belong to, with an assistant that makes changes after showing you first. Your information stays on your own computer by default.",
    author: { "@id": `${SITE_URL}/#maker` },
    publisher: { "@id": `${SITE_URL}/#org` },
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD", availability: "https://schema.org/InStock" },
    featureList: [
      "One board for projects and tasks, grouped by area of your life",
      "A short list of today's top three and this week's focus",
      "See the people attached to any project or task",
      "An assistant that adds and changes things after you approve",
      "Use the built-in model, your own AI account, or a model on your own computer",
      "One calendar view and one inbox across connected accounts",
      "Files kept on your computer, with optional sync you can turn off",
    ],
  };
}

export function jsonLdFor(pathname) {
  const route = routeFor(pathname);
  if (pathname === "/") {
    return [organizationLd(), websiteLd(), softwareApplicationLd(), faqPageLd(HOME_FAQ)];
  }
  if (!route) return [];
  if (pathname === "/assistant") {
    return [webPageLd(route, pathname), faqPageLd(ASSISTANT_FAQ)];
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

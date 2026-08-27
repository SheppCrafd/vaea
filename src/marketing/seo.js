// Single source of truth for every marketing route's <head>. Imported both
// by the runtime <SeoHead> component (client-side nav) and by
// scripts/prerender.mjs (build-time static HTML) so the two can never drift.
// Plain JS on purpose — no JSX, no imports — so the prerender bundler picks
// it up with zero config.

export const SITE_URL = "https://vaea.base44.app";
export const SITE_NAME = "Vaea";
export const OG_IMAGE = `${SITE_URL}/og-image.png`;

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

export function canonicalFor(pathname) {
  return pathname === "/" ? `${SITE_URL}/` : `${SITE_URL}${pathname}`;
}

// --- JSON-LD -------------------------------------------------------------

const PERSON = { "@type": "Person", name: "the maker of Vaea", url: SITE_URL };

export function organizationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#org`,
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/android-chrome-512x512.png`,
    founder: PERSON,
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
    description:
      "One board for all your projects and tasks, grouped by the part of life they belong to, with an assistant that makes changes after showing you first. Your information stays on your own computer by default.",
    author: PERSON,
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
  if (pathname === "/") return [organizationLd(), websiteLd(), softwareApplicationLd()];
  if (!route) return [];
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: route.title,
      description: route.description,
      url: canonicalFor(pathname),
      isPartOf: { "@id": `${SITE_URL}/#website` },
      breadcrumb: {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: route.title.split(" | ")[0].split(" — ")[0], item: canonicalFor(pathname) },
        ],
      },
    },
  ];
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

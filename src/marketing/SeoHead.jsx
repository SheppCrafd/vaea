import { useEffect } from "react";
import { headTagsFor } from "./seo";

// Runtime <head> manager for client-side navigation between marketing
// routes — the SPA never reloads index.html, so title/description/canonical/
// OG/JSON-LD have to be swapped in JS on each route change. The build-time
// prerender (scripts/prerender.mjs) writes the same tags into the static
// HTML from the same source (seo.js), so first paint is already correct and
// this only matters once the visitor starts navigating.
//
// Every tag it manages carries data-managed="seo" so a route change can
// clear the previous route's tags without touching anything hand-written in
// index.html.
export default function Seo({ pathname }) {
  useEffect(() => {
    const { title, meta, link, jsonLd } = headTagsFor(pathname);
    document.title = title;

    const previous = document.head.querySelectorAll('[data-managed="seo"]');
    previous.forEach((el) => el.remove());

    const add = (tag, attrs) => {
      const el = document.createElement(tag);
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
      el.setAttribute("data-managed", "seo");
      document.head.appendChild(el);
    };

    meta.forEach((m) => add("meta", m));
    link.forEach((l) => add("link", l));
    if (jsonLd.length) {
      const el = document.createElement("script");
      el.type = "application/ld+json";
      el.textContent = JSON.stringify(jsonLd.length === 1 ? jsonLd[0] : jsonLd);
      el.setAttribute("data-managed", "seo");
      document.head.appendChild(el);
    }
  }, [pathname]);

  return null;
}

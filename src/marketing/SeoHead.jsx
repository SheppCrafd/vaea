import { useEffect } from "react";
import { headTagsFor } from "./seo";

// Runtime <head> manager for client-side navigation between marketing
// routes — the SPA never reloads index.html, so title/description/canonical/
// OG/JSON-LD have to be swapped in JS on each route change. The build-time
// prerender (scripts/prerender.mjs) writes the same tags into the static
// HTML from the same source (seo.js), so first paint is already correct and
// this only matters once the visitor starts navigating.
//
// It also matters on first load: Base44's hosting serves the home page's
// HTML for every path, so /workplace arrives with the home page's
// description, canonical and structured data. Tags are therefore replaced by
// what they are (the same name, property or rel, and every JSON-LD block),
// not only by the data-managed="seo" marker this component adds, which the
// prerendered HTML doesn't carry. Appending left two canonicals and the home
// page's description in place. Tags this component doesn't set (charset,
// viewport, theme-color, icons) are left alone.
export default function Seo({ pathname }) {
  useEffect(() => {
    const { title, meta, link, jsonLd } = headTagsFor(pathname);
    document.title = title;

    const stale = [
      '[data-managed="seo"]',
      'script[type="application/ld+json"]',
      ...meta.map((m) => (m.name ? `meta[name="${m.name}"]` : `meta[property="${m.property}"]`)),
      ...link.map((l) => `link[rel="${l.rel}"]`),
    ];
    document.head.querySelectorAll(stale.join(",")).forEach((el) => el.remove());

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

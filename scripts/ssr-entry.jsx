// Build-time only. esbuild bundles this (CSS stubbed, node_modules kept
// external) and scripts/prerender.mjs imports the result to turn each
// marketing route into static HTML.
import { renderToString } from "react-dom/server";
// react-router-dom v7 dropped its own `/server` subpath — StaticRouter now
// lives in the `react-router` package itself (react-router-dom v7 is a thin
// DOM wrapper around it).
import { StaticRouter } from "react-router";
import MarketingApp from "../src/marketing/MarketingApp.jsx";
import { ROUTES, headTagsFor } from "../src/marketing/seo.js";

export { ROUTES, headTagsFor };

export function renderRoute(pathname) {
  return renderToString(
    <StaticRouter location={pathname}>
      <MarketingApp />
    </StaticRouter>,
  );
}

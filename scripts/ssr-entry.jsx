// Build-time only. esbuild bundles this (CSS stubbed, node_modules kept
// external) and scripts/prerender.mjs imports the result to turn each
// marketing route into static HTML.
import { renderToString } from "react-dom/server";
// `/server.js` (not `/server`) so Node's strict ESM resolver finds it when
// this bundle keeps react-router-dom external.
import { StaticRouter } from "react-router-dom/server.js";
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

// Post-build prerender for the marketing routes. Runs automatically after
// `vite build` (package.json "postbuild"). For every route in
// src/marketing/seo.js it renders the real DOM to a string and injects it —
// plus that route's <title>/meta/canonical/OG/JSON-LD — into the built
// dist/index.html template, writing dist/<route>/index.html. Base44's
// static hosting then serves real HTML on first byte; the SPA hydrates over
// it and takes over client-side navigation.
//
// If this step fails, the build still produced a working SPA — the routes
// just fall back to index.html's default head. So a prerender failure is
// logged loudly but does not hard-fail the build.

import { build } from "esbuild";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve, join } from "node:path";
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DIST = join(ROOT, "dist");
const TEMPLATE = join(DIST, "index.html");

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function headToHtml({ title, meta, link, jsonLd }) {
  const lines = [`<title>${esc(title)}</title>`];
  for (const m of meta) {
    const key = m.name ? `name="${esc(m.name)}"` : `property="${esc(m.property)}"`;
    lines.push(`<meta ${key} content="${esc(m.content)}" />`);
  }
  for (const l of link) lines.push(`<link rel="${esc(l.rel)}" href="${esc(l.href)}" />`);
  if (jsonLd && jsonLd.length) {
    const payload = jsonLd.length === 1 ? jsonLd[0] : jsonLd;
    lines.push(
      `<script type="application/ld+json">${JSON.stringify(payload).replace(/</g, "\\u003c")}</script>`,
    );
  }
  return lines.join("\n    ");
}

function replaceRegion(html, name, replacement) {
  const re = new RegExp(`<!-- PRERENDER:${name}:START -->[\\s\\S]*?<!-- PRERENDER:${name}:END -->`);
  if (!re.test(html)) throw new Error(`template is missing the PRERENDER:${name} markers`);
  return html.replace(re, `<!-- PRERENDER:${name}:START -->\n    ${replacement}\n    <!-- PRERENDER:${name}:END -->`);
}

async function main() {
  if (!existsSync(TEMPLATE)) {
    console.error("[prerender] dist/index.html not found — run `vite build` first. Skipping.");
    return;
  }

  // Bundle the SSR entry to a temp ESM file: CSS stubbed, all node_modules
  // left external for node to resolve (avoids a second React copy).
  const outfile = join(ROOT, "node_modules", ".cache", "vaea-prerender", "ssr-entry.mjs");
  await mkdir(dirname(outfile), { recursive: true });
  await build({
    entryPoints: [join(__dirname, "ssr-entry.jsx")],
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node18",
    jsx: "automatic",
    packages: "external",
    loader: { ".css": "empty" },
    alias: { "@": join(ROOT, "src") },
    define: { "process.env.NODE_ENV": '"production"' },
    // Minimal browser-global shim: a few app modules (e.g. src/lib/utils.js's
    // `isIframe`) touch window at module scope. The marketing tree never uses
    // these values during render — this just stops the import from throwing
    // in Node. Real browser APIs are only called inside effects, which don't
    // run during renderToString.
    banner: {
      js: [
        "globalThis.window=globalThis.window||{};",
        "globalThis.self=globalThis.self||globalThis;",
        "globalThis.document=globalThis.document||{createElement:()=>({style:{},setAttribute(){}}),head:{appendChild(){}},documentElement:{classList:{add(){},remove(){}}}};",
        "window.location=window.location||{search:'',hash:'',href:'https://vaea.base44.app/',pathname:'/',origin:'https://vaea.base44.app'};",
        "window.localStorage=window.localStorage||{getItem:()=>null,setItem(){},removeItem(){}};",
        "window.matchMedia=window.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){}}));",
      ].join(""),
    },
    logLevel: "silent",
  });

  const { ROUTES, headTagsFor, renderRoute } = await import(pathToFileURL(outfile).href);
  const template = await readFile(TEMPLATE, "utf8");

  let ok = 0;
  for (const route of ROUTES) {
    try {
      const appHtml = renderRoute(route.path);
      const head = headToHtml(headTagsFor(route.path));
      let html = replaceRegion(template, "HEAD", head);
      html = replaceRegion(html, "BODY", `<div id="root">${appHtml}</div>`);

      const outDir = route.loc === "/" ? DIST : join(DIST, route.loc.replace(/^\/+/, ""));
      await mkdir(outDir, { recursive: true });
      await writeFile(join(outDir, "index.html"), html, "utf8");
      ok += 1;
      console.log(`[prerender] ${route.loc} → ${join(outDir, "index.html").replace(ROOT + "\\", "").replace(ROOT + "/", "")}`);
    } catch (err) {
      console.error(`[prerender] FAILED for ${route.loc}:`, err?.message || err);
    }
  }

  await rm(dirname(outfile), { recursive: true, force: true });
  console.log(`[prerender] wrote ${ok}/${ROUTES.length} routes`);

  // Emit sitemap.xml from the same ROUTES list so it can never drift from
  // what's actually prerendered. lastmod = build date.
  const today = new Date().toISOString().slice(0, 10);
  const SITE = "https://vaea.base44.app";
  const sitemap =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    ROUTES.map((r) => {
      const loc = r.loc === "/" ? `${SITE}/` : `${SITE}${r.loc}`;
      return (
        `  <url>\n` +
        `    <loc>${loc}</loc>\n` +
        `    <lastmod>${today}</lastmod>\n` +
        `    <changefreq>${r.changefreq}</changefreq>\n` +
        `    <priority>${r.priority}</priority>\n` +
        `  </url>`
      );
    }).join("\n") +
    `\n</urlset>\n`;
  await writeFile(join(DIST, "sitemap.xml"), sitemap, "utf8");
  console.log(`[prerender] wrote sitemap.xml (${ROUTES.length} urls, lastmod ${today})`);
}

main().catch((err) => {
  console.error("[prerender] unexpected error (build still valid, routes fall back to default head):", err);
});

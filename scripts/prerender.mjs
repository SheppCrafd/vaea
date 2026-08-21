#!/usr/bin/env node
// Build-time static prerendering for the public marketing routes.
//
// The SEO audit that prompted this found raw HTML for every route was just
// `<div id="root"></div>` — src/main.jsx does a plain client-only
// `createRoot(...).render()` with no server-rendering entry point, and a
// couple of the marketing routes (Login/SignUp) mount components that read
// AuthContext/the base44 SDK, which aren't safe to evaluate outside a real
// browser (network calls, localStorage, etc. at module scope). Rather than
// building a parallel Node-safe render path for every provider those pull
// in — the vite-plugin-ssg route — this script instead drives the real
// production build in a headless browser (Playwright, already a
// devDependency for qa-e2e) and snapshots each marketing route's fully
// rendered DOM back to a static index.html under dist/. Same output shape
// an SSG plugin would produce, without needing this app's non-trivial
// provider tree to be SSR-safe.
//
// Deliberately best-effort: if Playwright or its browser binary isn't
// available (e.g. a deploy pipeline that only installs prod dependencies
// and has never run `playwright install`), this logs a warning and exits 0
// rather than failing the build — losing prerendering for that run is a
// regression to catch and fix, not a reason to block a deploy. Wired in as
// package.json's "postbuild" script, which npm runs automatically after
// "build" (`vite build`) — see that file's comment.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const distDir = join(root, "dist");

// Routes that render outside AuthenticatedApp (see src/App.jsx) — real,
// crawlable marketing content. /app/* is deliberately excluded: it's
// auth-gated and has nothing for a crawler to index.
const ROUTES = ["/", "/features", "/chat", "/vault", "/workplace", "/how-it-works", "/about", "/login", "/signup", "/compare", "/privacy", "/terms"];

async function loadChromium() {
  try {
    const { chromium } = await import("@playwright/test");
    return chromium;
  } catch {
    return null;
  }
}

async function main() {
  if (!existsSync(distDir)) {
    console.warn("[prerender] dist/ not found — run `vite build` first. Skipping.");
    return;
  }

  const chromium = await loadChromium();
  if (!chromium) {
    console.warn("[prerender] @playwright/test isn't available — skipping prerendering (per-route <title>/canonical tags still apply client-side).");
    return;
  }

  let browser;
  try {
    browser = await chromium.launch();
  } catch (err) {
    console.warn(`[prerender] couldn't launch a browser (${err.message}) — skipping prerendering. Run \`npx playwright install chromium\` to enable it.`);
    return;
  }

  const server = await preview({ root, preview: { port: 0, strictPort: false } });
  const address = server.resolvedUrls?.local?.[0];
  if (!address) {
    console.warn("[prerender] preview server didn't report an address — skipping prerendering.");
    await browser.close();
    await new Promise((resolve) => server.httpServer.close(resolve));
    return;
  }

  try {
    const page = await browser.newPage();
    for (const route of ROUTES) {
      try {
        await page.goto(new URL(route, address).toString(), { waitUntil: "load" });
        // The page's own useDocumentMeta effect (title + canonical) and
        // first paint both run on mount, not before — wait for #root to
        // actually have rendered content rather than a specific selector
        // like <h1>, since not every marketing route has one (the login/
        // signup screens lead with a <p>, not a heading).
        await page.waitForFunction(
          () => (document.getElementById("root")?.childElementCount ?? 0) > 0,
          { timeout: 10000 }
        );
        await page.waitForTimeout(150);
        const html = await page.content();
        const outDir = route === "/" ? distDir : join(distDir, route.slice(1));
        mkdirSync(outDir, { recursive: true });
        writeFileSync(join(outDir, "index.html"), html, "utf8");
        console.log(`[prerender] wrote dist${route === "/" ? "" : route}/index.html`);
      } catch (err) {
        // One route's failure shouldn't cost the others — dist/ keeps the
        // client-only shell for this route, everything else still gets a
        // real prerendered snapshot.
        console.warn(`[prerender] ${route} failed (${err.message.split("\n")[0]}) — leaving dist/'s client-only build for that route.`);
      }
    }
  } catch (err) {
    console.warn(`[prerender] failed mid-run (${err.message}) — dist/ still has the client-only build for any route not yet written.`);
  } finally {
    await browser.close();
    await new Promise((resolve) => server.httpServer.close(resolve));
  }
}

main().catch((err) => {
  console.warn(`[prerender] unexpected failure (${err.message}) — dist/ still has the client-only build.`);
});

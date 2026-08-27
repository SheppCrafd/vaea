// Renders scripts/og-image-src.html to public/og-image.png (1200x630) with
// the Playwright Chromium already installed for this project's tests.
// Run manually after changing the source:  node scripts/build-og-image.mjs
import { chromium } from "@playwright/test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = pathToFileURL(resolve(__dirname, "og-image-src.html")).href;
const out = resolve(__dirname, "..", "public", "og-image.png");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.goto(src);
await page.waitForTimeout(200);
await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 1200, height: 630 } });
await browser.close();
console.log("wrote", out);

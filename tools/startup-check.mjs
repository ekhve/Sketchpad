/* How the apps behave on the first touch, measured headless. (D-100)

     PLAYWRIGHT=$(npm root -g)/playwright node tools/startup-check.mjs [waitMs]

   Opens each built app, waits (default 2.5 s, as a person looks at the screen first), touches a
   key once, and prints what the sound line says until it reads "Grand piano". The first touch
   must go straight to "running · Grand piano"; "preparing" means the note played through the
   stand-in. Not a gate (it needs a browser, see DONE.md, exceptions) and it cannot hear anything. */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require(process.env.PLAYWRIGHT || "playwright")); }
catch (e) { console.error("Playwright not found. Set PLAYWRIGHT=/path/to/playwright."); process.exit(2); }

const wait = Number(process.argv[2] ?? 2500);
const apps = [
  ["sketchpad", "build/sketchpad-app.html", (p) => p.locator('button:text-is("add")').first().locator("xpath=preceding::button[1]").click()],
  ["j6", "build/j6-app.html", (p) => p.click('button[aria-label^="J-6 key C:"]')],
];
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
let bad = 0;
for (const [name, file, touch] of apps) {
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(new URL(`../${file}`, import.meta.url).href);
  const line = async () => (await page.evaluate(() => (document.body.innerText.match(/(idle|running|suspended|error) · [^\n]*/) ?? ["?"])[0])).replace(/\s+/g, " ");
  await page.waitForTimeout(wait);
  const before = await line();
  const t0 = Date.now(); await touch(page);
  const seen = [];
  for (let i = 0; i < 40; i++) { const d = await line(); if (!seen.length || seen.at(-1)[1] !== d) seen.push([Date.now() - t0, d]); if (/started in \d+ ms$/.test(d)) break; await page.waitForTimeout(25); }
  const ok = !seen.some(([, d]) => /preparing|stand-in|error/.test(d)) && /started in \d+ ms$/.test(seen.at(-1)[1]) && !errors.length;
  if (!ok) bad++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}: before touch "${before}"; after: ${JSON.stringify(seen)}${errors.length ? " errors: " + errors : ""}`);
  await page.close();
}
await browser.close();
process.exit(bad ? 1 : 0);

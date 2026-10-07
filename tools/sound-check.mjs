/* Does anything come out? Measured headless, at the speakers' door. (D-102)

     PLAYWRIGHT=$(npm root -g)/playwright node tools/sound-check.mjs

   Taps every connection into the audio output of each built app, touches a key, and reads the
   loudest sample over the next second and a half, for the first touch and again for the second.
   Both must be audibly above silence. It catches "nothing sounds" before it reaches a phone.
   It cannot hear tone, timing or what iOS does with the hardware, and, like tools/smoke.mjs,
   it needs a browser, so it is not a gate (DONE.md, exceptions). */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require(process.env.PLAYWRIGHT || "playwright")); }
catch (e) { console.error("Playwright not found. Set PLAYWRIGHT=/path/to/playwright."); process.exit(2); }

const tap = () => {
  window.__peak = 0;
  const connect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dest, ...rest) {
    const out = connect.call(this, dest, ...rest);
    try {
      const ctx = this.context;
      if (dest === ctx.destination && !this.__tapped) {
        this.__tapped = true;
        const an = ctx.createAnalyser(); an.fftSize = 2048; connect.call(this, an);
        const buf = new Float32Array(an.fftSize);
        setInterval(() => { an.getFloatTimeDomainData(buf); let m = 0; for (const v of buf) m = Math.max(m, Math.abs(v)); if (m > window.__peak) window.__peak = m; }, 20);
      }
    } catch (e) {}
    return out;
  };
};
const apps = [
  ["sketchpad chord pad", "build/sketchpad-app.html", (p) => p.locator('button:text-is("add")').first().locator("xpath=preceding::button[1]").click()],
  ["sketchpad piano key", "build/sketchpad-app.html", (p) => p.locator('[data-midi="60"]').first().click()],
  ["j6 key", "build/j6-app.html", (p) => p.click('button[aria-label^="J-6 key C:"]')],
];
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
let bad = 0;
for (const [name, file, touch] of apps) {
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(tap);
  await page.goto(new URL(`../${file}`, import.meta.url).href);
  await page.waitForTimeout(1500);
  const peaks = [];
  for (let i = 0; i < 2; i++) { await page.evaluate(() => { window.__peak = 0; }); await touch(page); await page.waitForTimeout(1500); peaks.push(await page.evaluate(() => window.__peak)); }
  const ok = peaks.every((x) => x > 0.01) && !errors.length;
  if (!ok) bad++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}: first touch peak ${peaks[0].toFixed(3)}, second ${peaks[1].toFixed(3)}${errors.length ? " errors: " + errors : ""}`);
  await page.close();
}
await browser.close();
process.exit(bad ? 1 : 0);

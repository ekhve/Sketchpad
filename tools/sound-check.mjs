/* Does sound come out, the way it does on a phone? Measured headless. (D-102, D-103)

     PLAYWRIGHT=$(npm root -g)/playwright node tools/sound-check.mjs

   Each built app is opened in a browser whose audio is made to behave like a phone's (tools/lib/audio-probe.mjs):
   it starts suspended and honours resume() only inside an event that counts as a touch, under four readings of
   that rule. Real touch input is sent (touchStart, a pause, touchEnd), a tap is placed on the speakers' door,
   and the loudest sample is read. The cases are the ones that have failed on a real phone:
     - a piano key, first thing, quick tap and long press            (Sketchpad)
     - a piano key straight after load, with no pause                (Sketchpad)
     - a chord pad, then a piano key                                 (Sketchpad)
     - a pad, quickly after load                                     (J-6)
     - a piano key when no tap on it can start the audio             (Sketchpad: the sound banner must appear,
                                                                      and tapping it must make the keys sound)
   It cannot hear tone or timing, and it does not know which reading iOS applies, which is why it passes only
   if all four work. Needs a browser, so it is run by `check-done` when one is found (gate G15) and otherwise
   says so; see DONE.md. */
import { createRequire } from "node:module";
import { tap, strictAudio } from "./lib/audio-probe.mjs";
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require(process.env.PLAYWRIGHT || "playwright")); }
catch (e) { console.error("NO BROWSER: Playwright not found. Set PLAYWRIGHT=/path/to/playwright."); process.exit(3); }

const MODES = [
  ["release, pending kept", { counts: ["touchend", "pointerup", "click", "keydown"], pending: "retro" }],
  ["release, pending lost", { counts: ["touchend", "pointerup", "click", "keydown"], pending: "lost" }],
  ["click only, pending kept", { counts: ["click", "keydown"], pending: "retro" }],
  ["click only, pending lost", { counts: ["click", "keydown"], pending: "lost" }],
];
const url = (f) => new URL(`../${f}`, import.meta.url).href;
const SK = "build/sketchpad-app.html", J6 = "build/j6-app.html";
const key = (m = 60) => (p) => p.locator(`[data-midi="${m}"]`).first();
const pad = (p) => p.locator('button:text-is("add")').first().locator("xpath=preceding::button[1]");
const j6key = (p) => p.locator('button[aria-label^="J-6 key C:"]').first();

async function touch(page, cdp, locator, holdMs) {
  const box = await locator.boundingBox();
  const x = box.x + box.width / 2, y = box.y + Math.max(5, box.height - 15);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  await page.waitForTimeout(holdMs);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}
const peak = async (page, ms = 1700) => { await page.evaluate(() => { window.__peak = 0; }); await page.waitForTimeout(ms); return page.evaluate(() => window.__peak); };

/** Each case returns { ok, note }. `wait` is how long the page sits before the first touch. */
const ALWAYS = () => true;
const CASES0 = [
  ["piano key, quick tap", SK, 1500, async (page, cdp) => { await touch(page, cdp, key()(page), 30); const a = await peak(page); await touch(page, cdp, key(64)(page), 30); const b = await peak(page); return { ok: a > 0.01 && b > 0.01, note: `first ${a.toFixed(2)}, second ${b.toFixed(2)}` }; }],
  ["piano key, long press", SK, 1500, async (page, cdp) => { await touch(page, cdp, key()(page), 450); const a = await peak(page); return { ok: a > 0.01, note: `peak ${a.toFixed(2)}` }; }],
  ["piano key, straight after load", SK, 0, async (page, cdp) => { await touch(page, cdp, key()(page), 30); const a = await peak(page, 2500); return { ok: a > 0.01, note: `peak ${a.toFixed(2)}` }; }],
  ["chord pad, then a piano key", SK, 1500, async (page, cdp) => { await touch(page, cdp, pad(page), 30); const a = await peak(page); await touch(page, cdp, key()(page), 30); const b = await peak(page); return { ok: a > 0.01 && b > 0.01, note: `pad ${a.toFixed(2)}, key ${b.toFixed(2)}` }; }],
  ["a run up on a chord pad", SK, 1500, async (page, cdp) => { await page.click('button[aria-controls="sound-options"]'); await page.click('#sound-options button[aria-label="Up"]'); await page.click('button[aria-controls="sound-options"]'); await page.waitForTimeout(150); await touch(page, cdp, pad(page), 30); const a = await peak(page); return { ok: a > 0.01, note: `peak ${a.toFixed(2)}` }; }],
  ["the scale played down", SK, 1500, async (page, cdp) => { await page.locator('button:text-is("Scales")').last().click(); await touch(page, cdp, page.locator('[aria-label="how the notes are played"] button[aria-label="Down"]').first(), 30); const a = await peak(page, 2500); return { ok: a > 0.01, note: `peak ${a.toFixed(2)}` }; }],
  ["J-6 pad, straight after load", J6, 0, async (page, cdp) => { await touch(page, cdp, j6key(page), 30); const a = await peak(page, 2500); await touch(page, cdp, j6key(page), 30); const b = await peak(page); return { ok: a > 0.01 && b > 0.01, note: `first ${a.toFixed(2)}, second ${b.toFixed(2)}` }; }],
  ["no tap on a key can start it: banner", SK, 1500, (mode) => !mode.counts.includes("pointerup"), async (page, cdp) => {
    /* the piano's own touches are made to give no click, so only the banner can start the audio */
    await page.evaluate(() => { for (const t of ["touchend", "pointerup"]) document.querySelector("[data-midi]").closest("div[style*='touch-action']")?.addEventListener(t, (e) => e.preventDefault(), true); document.addEventListener("click", (e) => { if (e.target.closest("[data-midi]")) e.stopImmediatePropagation(); }, true); });
    await touch(page, cdp, key()(page), 30); const silent = await peak(page, 2200);   // the bar shows only after a good wait (D-106)
    const banner = await page.locator('button[aria-label="turn the sound on"]').count();
    if (banner) await touch(page, cdp, page.locator('button[aria-label="turn the sound on"]').first(), 30);
    await page.waitForTimeout(600);
    await touch(page, cdp, key(64)(page), 30); const after = await peak(page);
    return { ok: banner === 1 && after > 0.01, note: `before the banner ${silent.toFixed(2)}, banner ${banner ? "shown" : "NOT shown"}, after tapping it ${after.toFixed(2)}` };
  }],
];
/* a case may carry a predicate saying which readings of the rule it applies to */
const CASES = CASES0.map((c) => (typeof c[3] === "function" && c.length === 5 ? c : [c[0], c[1], c[2], ALWAYS, c[3]]));

const browser = await chromium.launch();
let bad = 0;
for (const [label, mode] of MODES) {
  const rows = await Promise.all(CASES.filter((c) => c[3](mode)).map(async ([name, file, wait, , run]) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, hasTouch: true, isMobile: true });
    const page = await ctx.newPage(); const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(`(${tap.toString()})(); (${strictAudio.toString()})(${JSON.stringify(mode)});`);
    let r;
    try {
      await page.goto(url(file)); await page.waitForTimeout(wait);
      r = await run(page, await ctx.newCDPSession(page));
      if (errors.length) r = { ok: false, note: `${r.note}; errors: ${errors}` };
    } catch (e) { r = { ok: false, note: `threw: ${e.message.split("\n")[0]}` }; }
    await ctx.close();
    return [name, r];
  }));
  console.log(`\n${label}`);
  for (const [name, r] of rows) { if (!r.ok) bad++; console.log(`  ${r.ok ? "ok  " : "FAIL"} ${name.padEnd(38)} ${r.note}`); }
}
await browser.close();
console.log(bad ? `\n${bad} failing` : "\nsound comes out in every case");
process.exit(bad ? 1 : 0);

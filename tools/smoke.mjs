/* A scripted headless run of a built app, written out as a transcript of what is on
   the screen. (D-096)

     node tools/smoke.mjs sketchpad [build/sketchpad-app.html] > before.txt
     node tools/smoke.mjs j6        [build/j6-app.html]        > after.txt
     diff before.txt after.txt

   It exists to prove that a change which should not alter behaviour, such as moving the
   theory out of the app into core/, did not: the same clicks give the same screens. It is
   not a test with expectations, and not a gate: it needs Playwright and a browser, which
   the project does not install (see DONE.md, exceptions). Point PLAYWRIGHT at an install:

     PLAYWRIGHT=$(npm root -g)/playwright node tools/smoke.mjs sketchpad

   Anything that varies run to run (audio status, timings) is masked, so two runs of the
   same build are identical. */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require(process.env.PLAYWRIGHT || "playwright")); }
catch (e) { console.error("Playwright not found. Set PLAYWRIGHT=/path/to/playwright (see the header of this file)."); process.exit(2); }

const [app = "sketchpad", given] = process.argv.slice(2);
const file = given ?? { sketchpad: "build/sketchpad-app.html", j6: "build/j6-app.html" }[app];
if (!file) { console.error("usage: node tools/smoke.mjs sketchpad|j6 [built.html]"); process.exit(2); }
const url = new URL(file, "file://" + process.cwd() + "/").href;

const out = [];
const errors = [];
const browser = await chromium.launch({ args: ["--disable-gpu", "--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
await page.goto(url);
await page.waitForSelector("button", { timeout: 20000 });

/* What varies from run to run: the audio engine's status line and its voice count. */
const MASK = [/^(running|suspended|idle|error)\b.*$/gim, /^\d+\/\d+$/gm, /^\d+\/·$/gm, /^\d+\/\d+ voices$/gm, /preparing .*…/g];
const text = async () => {
  let t = await page.evaluate(() => document.body.innerText);
  for (const m of MASK) t = t.replace(m, "·");
  return t.replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
};
const log = async (title) => { await page.waitForTimeout(120); out.push(`### ${title}\n${await text()}\n`); };
const step = async (title, fn) => {
  try { await fn(); }
  catch (e) { out.push(`### ${title}\nSTEP FAILED: ${String(e.message).split("\n")[0]}\n`); }
};
const click = (sel, nth = "first") => page.locator(sel)[nth]().click({ timeout: 4000 });

if (app === "sketchpad") {
  const TABS = ["Chords", "Find", "Scales", "Progression", "Bass", "Theory", "Sheet", "Learn", "How to use"];
  await log("opening screen");

  for (const level of ["Start", "Produce", "Study"]) {
    await step(`level ${level}`, async () => {
      await click(`button:text-is("${level}")`);
      await log(`level ${level}`);
      for (const tab of TABS) {
        if (!(await page.locator(`button:text-is("${tab}")`).count())) continue;
        await step(`${level} / ${tab}`, async () => { await click(`button:text-is("${tab}")`, "last"); await log(`${level} / ${tab}`); });
      }
    });
  }

  // other keys and modes, at the level that shows everything
  for (const [key, mode] of [["E♭", "minor"], ["F#", "major"], ["A", "minor"], ["B♭", "major"]]) {
    await step(`key ${key} ${mode}`, async () => {
      await click('button:text-is("Chords")', "last");
      await click(`button:text-is("${key}")`); await click(`button:text-is("${mode}")`);
      for (const tab of ["Chords", "Scales", "Theory", "Bass", "Sheet"])
        await step(`${key} ${mode} / ${tab}`, async () => { await click(`button:text-is("${tab}")`, "last"); await log(`${key} ${mode} / ${tab}`); });
    });
  }
  await step("back to C major", async () => { await click('button:text-is("Chords")', "last"); await click('button:text-is("C")'); await click('button:text-is("major")'); });

  // build a loop from the chord pads, then read everything that depends on it
  await step("build a loop", async () => {
    await click('button:text-is("Chords")', "last");
    for (let i = 0; i < 4; i++) await click('button:text-is("add")', "first");
    for (const tab of ["Progression", "Bass", "Sheet", "Theory", "Find"])
      await step(`loop / ${tab}`, async () => { await click(`button:text-is("${tab}")`, "last"); await log(`loop / ${tab}`); });
    await click('button:text-is("Sheet")', "last");
    await step("sheet with fingering", async () => { await page.getByLabel("Show suggested fingering").check({ timeout: 3000 }); await log("sheet with fingering"); });
  });

  await step("typed chord names", async () => {
    await click('button:text-is("Progression")', "last");
    const box = page.locator('input[type="text"], input:not([type])').first();
    for (const v of ["Am7 F#m7 Dm7 G7sus4", "Cmaj7 H7 Fm6/G#", "C-7 CΔ7 D7(4/9) Bb/D"]) { await box.fill(v); await log(`typed: ${v}`); }
    await box.fill("");
  });

  await step("find a chord from notes", async () => {
    await click('button:text-is("Find")', "last");
    for (const notes of [[60, 64, 67], [60, 63, 67, 70], [62, 65, 69, 72, 76], [60, 67]]) {
      for (const m of notes) await page.locator(`[data-midi="${m}"]`).first().click({ timeout: 3000 });
      await log(`find: ${notes.join(" ")}`);
      const clear = page.locator('button:text-is("clear")');
      if (await clear.count()) await clear.first().click();
    }
  });

  await step("lessons", async () => {
    await click('button:text-is("Learn")', "last");
    for (const title of ["Find the home note", "The major scale", "Your first chord", "The four-chord loop"]) {
      await step(`lesson ${title}`, async () => {
        await click(`text=${title}`); await log(`lesson: ${title}`);
        await click('button:text-is("Hint")'); await log(`lesson hint: ${title}`);
        for (const m of [62, 60, 61, 64]) { await page.locator(`[data-midi="${m}"]`).first().click({ timeout: 3000 }); await log(`lesson ${title}, played ${m}`); }
        await click('button:has-text("Lessons")');
      });
    }
  });

  await step("fingers", async () => {
    await click('button:text-is("Chords")', "last");
    for (const f of ["right", "left", "both", "off"]) { await click(`button:text-is("${f}")`); await log(`fingers ${f}`); }
  });
} else {
  // the J-6 Explorer: every set at two KEY values, then the screens built on top
  const pads = () => page.evaluate(() => [...document.querySelectorAll('button[aria-label^="J-6 key"]')].map((b) => b.getAttribute("aria-label")).join("\n"));
  const header = () => page.evaluate(() => document.querySelector("main > div")?.innerText.replace(/\s+/g, " ") ?? "");
  await log("opening screen");
  for (let n = 1; n <= 100; n++) {
    await step(`set ${n}`, async () => {
      await page.selectOption('select[aria-label="chord set"]', String(n));
      out.push(`### set ${n} KEY 0\n${await header()}\n${await pads()}\n`);
      for (let i = 0; i < 3; i++) await page.click('button[aria-label="KEY up"]', { timeout: 2000 });
      out.push(`### set ${n} KEY +3\n${await header()}\n${await pads()}\n`);
      for (let i = 0; i < 3; i++) await page.click('button[aria-label="KEY down"]', { timeout: 2000 });
    });
  }
  await step("misprinted keys", async () => {
    for (const [set, key] of [[18, "E"], [80, "C♯"], [3, "D♯"], [19, "F♯"], [14, "C"], [88, "C"]]) {
      await page.selectOption('select[aria-label="chord set"]', String(set));
      await page.click(`button[aria-label^="J-6 key ${key}:"]`); await log(`set ${set} key ${key}`);
    }
  });
  await step("record and play along", async () => {
    await page.selectOption('select[aria-label="chord set"]', "54");
    await page.click('button[aria-label="record every tap into the progression"]');
    for (const k of ["C", "C♯", "G", "D♯"]) await page.click(`button[aria-label^="J-6 key ${k}:"]`);
    await page.click('button[aria-label="record every tap into the progression"]');
    await log("progression kept");
    for (const s of ["C major", "C major pentatonic", "A minor pentatonic"]) { await page.locator(`button[aria-pressed]:has-text("${s}")`).first().click(); await log(`scale ${s}`); }
    await page.click('[aria-label="show the sheet"]'); await page.click('[aria-label="show suggested fingering"]'); await log("sheet");
    await page.evaluate(() => navigator.clipboard?.readText?.().catch(() => "")).catch(() => {});
  });
  await step("find", async () => {
    await page.click('button:text-is("Find")');
    const box = page.locator('input[aria-label="chord progression"]');
    for (const q of ["Dm7 G7 Cmaj7 Am7", "Am F C G", "Cmaj9 Fmaj7#11 Em7b5 A7alt", "C F# H7"]) { await box.fill(q); await log(`find: ${q}`); }
    await page.click('button:text-is("Exact")'); await log("find exact");
  });
}

await browser.close();
out.push(`### page errors\n${errors.length ? errors.join("\n") : "none"}\n`);
process.stdout.write(out.join("\n"));

/* The screen's layout, checked headless. (D-105)

     PLAYWRIGHT=$(npm root -g)/playwright node tools/layout-check.mjs

   Opens the built Sketchpad at phone width and checks what the owner asked the screen to be:
   no engine text on show (no "running · Grand piano", no "voices"), the sound options folded away
   until asked for and holding the four rows (sound, how a chord is played, reverb, echo), the octave
   and fingers together on a row above the piano, the legend under it, no sound/silence/test/reset buttons,
   nothing that moves the piano when the first note is played, and nothing wider than the screen, open or shut.
   It needs a browser, so `check-done` runs it as gate G16 and fails, with the reason, where there is none. */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require(process.env.PLAYWRIGHT || "playwright")); }
catch (e) { console.error("NO BROWSER: Playwright not found. Set PLAYWRIGHT=/path/to/playwright."); process.exit(3); }

const results = [];
const check = (name, ok, note = "") => { results.push(ok); console.log(`${ok ? "ok  " : "FAIL"} ${name}${note ? ` (${note})` : ""}`); };
const browser = await chromium.launch();
for (const width of [360, 375, 414]) {
  try {
  const page = await browser.newPage({ viewport: { width, height: 820 } });
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(new URL("../build/sketchpad-app.html", import.meta.url).href);
  await page.waitForTimeout(800);
  const text = () => page.evaluate(() => document.body.innerText);
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const toggle = page.locator('button[aria-controls="sound-options"]');
  const w = `${width}px`;

  check(`${w}: no engine text on the screen`, !/(idle|running|suspended) ·|\/24 voices|Salamander/.test(await text()));
  check(`${w}: the sound options are folded away at first`, (await toggle.getAttribute("aria-expanded")) === "false" && (await page.locator("#sound-options").count()) === 0);
  check(`${w}: nothing wider than the screen, shut`, (await overflow()) <= 0, `${await overflow()}px`);

  const octave = await page.locator('button[aria-label="Octave down"]').boundingBox();
  const key = await page.locator("[data-midi]").first().boundingBox();
  check(`${w}: the octave control is above the piano`, octave && key && octave.y + octave.height <= key.y, `octave bottom ${Math.round(octave.y + octave.height)}, keys top ${Math.round(key.y)}`);
  const fingers = await page.locator('button:text-is("both")').first().boundingBox();
  check(`${w}: fingers and octave are on one row above the piano`, fingers && octave && key && Math.abs(fingers.y - octave.y) < 30 && fingers.y + fingers.height <= key.y, `fingers y ${Math.round(fingers.y)}, octave y ${Math.round(octave.y)}`);
  const lastKey = await page.locator("[data-midi]").last().boundingBox();
  const legend = await page.locator("text=in your loop").first().boundingBox();
  check(`${w}: the legend is under the piano`, legend && lastKey && legend.y >= lastKey.y + lastKey.height - 2, `legend y ${Math.round(legend.y)}, keys bottom ${Math.round(lastKey.y + lastKey.height)}`);
  const gone = await page.evaluate(() => [...document.querySelectorAll("button")].map((b) => (b.innerText + " " + (b.getAttribute("aria-label") || "")).toLowerCase()).filter((t) => /silence|muted|turn sound|test sound|reset audio/.test(t)));
  check(`${w}: no sound/silence/test/reset buttons`, gone.length === 0, gone.join("|"));
  await page.locator("[data-midi]").nth(5).click(); await page.waitForTimeout(400);
  const after = await page.locator("[data-midi]").first().boundingBox();
  check(`${w}: playing the first note does not move the piano`, after && Math.abs(after.y - key.y) < 1 && (await page.locator('button[aria-label="turn the sound on"]').count()) === 0, `${Math.round(key.y)} -> ${Math.round(after.y)}`);

  await toggle.click(); await page.waitForTimeout(150);
  check(`${w}: opening shows the four rows`, (await toggle.getAttribute("aria-expanded")) === "true" && (await page.locator('#sound-options > [role="group"]').evaluateAll((g) => g.map((x) => x.getAttribute("aria-label")))).join() === "Sound,Played,Reverb,Echo");
  const names = await page.locator("#sound-options button").allInnerTexts();
  check(`${w}: every instrument, roll style, room and echo choice is offered`, ["Grand piano", "Rhodes", "Felt keys", "Warm pad", "Marimba", "Strings", "Vibraphone", "Together", "Roll", "Slow roll", "Up", "Down", "Up & down", "Random", "Dry", "Room", "Hall", "Cave", "Off", "Light", "Long"].every((n) => names.includes(n)) && !names.some((n) => /test sound|reset audio/.test(n)), names.join("|"));
  check(`${w}: the credit for the recordings is kept, inside the options`, /Salamander Grand Piano.*CC-BY/.test(await page.locator("#sound-options").innerText()));
  check(`${w}: nothing wider than the screen, open`, (await overflow()) <= 0, `${await overflow()}px`);

  const ways = page.locator('#sound-options [aria-label="how the notes are played"] button');
  check(`${w}: the seven ways to play are buttons with a picture each`, (await ways.count()) === 7 && (await ways.evaluateAll((bs) => bs.every((b) => b.querySelector("svg")))));
  await page.locator('#sound-options button:text-is("Rhodes")').click();
  check(`${w}: choosing is shown as pressed`, (await page.locator('#sound-options button:text-is("Rhodes")').getAttribute("aria-pressed")) === "true" && (await page.locator('#sound-options button:text-is("Grand piano")').getAttribute("aria-pressed")) === "false");
  await toggle.click(); await page.waitForTimeout(100);
  const shut = (await page.locator("#sound-options").count()) === 0;
  await toggle.click(); await page.waitForTimeout(100);
  check(`${w}: it folds away again, and the choice stays`, shut && (await page.locator('#sound-options button:text-is("Rhodes")').getAttribute("aria-pressed")) === "true");
  check(`${w}: no script errors`, errors.length === 0, errors.join("; "));
  await toggle.click(); await page.waitForTimeout(100);                       // fold the options again
  await page.locator('button:text-is("Scales")').last().click(); await page.waitForTimeout(200);
  const scaleWays = page.locator('[aria-label="how the notes are played"] button');
  check(`${w}: the Scales tab offers the four runs, with pictures`, (await scaleWays.count()) === 4 && (await scaleWays.evaluateAll((bs) => bs.map((b) => b.innerText.trim()).join() === "Up,Down,Up & down,Random" && bs.every((b) => b.querySelector("svg")))));
  await page.locator('[aria-label="how the notes are played"] button[aria-label="Down"]').click(); await page.waitForTimeout(200);
  await toggle.click(); await page.waitForTimeout(100);
  check(`${w}: choosing Down in the Scales tab chooses it in the Played row`, (await page.locator('#sound-options button[aria-label="Down"]').getAttribute("aria-pressed")) === "true");
  check(`${w}: nothing wider than the screen, in the Scales tab`, (await overflow()) <= 0, `${await overflow()}px`);
  await page.close();
  } catch (e) { check(`${width}px: the checks could run`, false, e.message.split("\n")[0]); }
}
await browser.close();
const bad = results.filter((x) => !x).length;
console.log(bad ? `\n${bad} failing` : "\nthe layout is as asked");
process.exit(bad ? 1 : 0);

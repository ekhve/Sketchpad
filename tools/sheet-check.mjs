/* The sheet, exported every way it can be. (D-112)

     PLAYWRIGHT=$(npm root -g)/playwright node tools/sheet-check.mjs

   The sheet has three options: note names on the keys, suggested fingering, and the scale over two octaves.
   For each of the eight combinations this builds a four-bar loop, sets the options on the Sheet tab, and checks
   what comes out both ways the sheet leaves the app:
     - on screen and "Copy as text": the diagrams carry names and fingers exactly when asked for, and the text
       says so (a scale over two octaves is labelled, fingers are listed);
     - as a PDF (the print dialogue, here page.pdf in print media): a real PDF of one page that holds the sheet and
       not the buttons, and, where pdftotext is installed, whose text has the note names exactly when asked for.
   It needs a browser, so `check-done` runs it as gate G18 and fails, with the reason, where there is none. */
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require(process.env.PLAYWRIGHT || "playwright")); }
catch (e) { console.error("NO BROWSER: Playwright not found. Set PLAYWRIGHT=/path/to/playwright."); process.exit(3); }

const results = [];
const check = (name, ok, note = "") => { results.push(ok); console.log(`${ok ? "ok  " : "FAIL"} ${name}${note ? ` (${note})` : ""}`); };
const hasPdftotext = (() => { try { execFileSync("pdftotext", ["-v"], { stdio: "ignore" }); return true; } catch { return false; } })();

const browser = await chromium.launch();
const dir = mkdtempSync(join(tmpdir(), "sheet-check-"));
let first = true;
const pdfWords = {};
for (const names of [false, true]) for (const fingers of [false, true]) for (const two of [false, true]) {
  const label = `names ${names ? "on" : "off"}, fingers ${fingers ? "on" : "off"}, ${two ? "two octaves" : "one octave"}`;
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] });
    const page = await context.newPage();
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(new URL("../build/sketchpad-app.html", import.meta.url).href);
    await page.waitForTimeout(600);
    await page.click('button:text-is("Produce")');
    for (let i = 0; i < 4; i++) await page.locator('button:text-is("add")').nth(i).click();
    await page.click('button:text-is("Sheet")');
    const box = (text) => page.getByLabel(text);
    for (const [text, want] of [["Show suggested fingering", fingers], ["Show note names on the keys", names], ["Show the scale over two octaves", two]]) {
      if ((await box(text).isChecked()) !== want) await box(text).click();
    }
    await page.waitForTimeout(150);

    /* on screen: names and fingers on the diagrams exactly when asked for */
    const dom = await page.evaluate(() => {
      const sheet = document.getElementById("sheet");
      const svgs = [...sheet.querySelectorAll("svg")];
      const scale = svgs[0];
      return {
        keyNames: sheet.querySelectorAll("[data-key-name]").length,
        scaleNames: scale.querySelectorAll("[data-key-name]").length,
        fingerMarks: sheet.querySelectorAll("svg circle").length,
        leftHand: sheet.querySelectorAll('svg[aria-label^="left hand"]').length,
        scaleWords: sheet.querySelector(".mb-4 .text-\\[11px\\]")?.innerText.trim().split(/\s+/).length ?? 0,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    const scaleCount = two ? 15 : 7;
    check(`${label}: note names are on the keys only when asked for`, names ? dom.keyNames === 4 * 3 + scaleCount && dom.scaleNames === scaleCount : dom.keyNames === 0, `${dom.keyNames} names, ${dom.scaleNames} on the scale`);
    check(`${label}: fingers are on the keys only when asked for`, fingers ? dom.fingerMarks >= 4 * 3 && dom.leftHand === 4 : dom.fingerMarks === 0 && dom.leftHand === 0, `${dom.fingerMarks} marks, ${dom.leftHand} left-hand`);
    check(`${label}: the scale runs over ${two ? "two octaves" : "one octave"}`, dom.scaleWords === scaleCount, `${dom.scaleWords} notes written under it`);
    check(`${label}: nothing wider than the screen`, dom.overflow <= 0, `${dom.overflow}px`);

    /* copy as text */
    await page.click('button:text-is("Copy as text")');
    await page.waitForTimeout(150);
    const text = await page.evaluate(() => navigator.clipboard.readText());
    check(`${label}: the copied text has the scale${two ? " marked two octaves" : ""}, the chords${fingers ? " and the fingers" : ""}`,
      text.includes(two ? "Scale (two octaves):" : "Scale:") && (!two ? !text.includes("two octaves") : true) && /1\.\s+C\b/.test(text) && (fingers ? /fingers \d/.test(text) : !/fingers/.test(text)), text.split("\n").slice(2, 4).join(" | "));

    /* the PDF */
    await page.emulateMedia({ media: "print" });
    const pdf = await page.pdf({ format: "A4", printBackground: true });
    const header = pdf.subarray(0, 5).toString();
    const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
    check(`${label}: the PDF is a real PDF of one page`, header === "%PDF-" && pdf.length > 5000 && pages === 1, `${pdf.length} bytes, ${pages} page(s)`);
    if (hasPdftotext) {
      const file = join(dir, "sheet.pdf"); writeFileSync(file, pdf);
      const words = execFileSync("pdftotext", ["-layout", file, "-"], { encoding: "utf8" });
      pdfWords[`${names}|${fingers}|${two}`] = words.split(/\s+/).filter(Boolean).length;
      check(`${label}: the PDF holds the sheet and not the buttons`, /1\.\s+C\b/.test(words) && !/Copy as text|Print, or save|Show suggested fingering/.test(words));
      if (first) { first = false; console.log("     (pdftotext is used to read the PDF's text)"); }
    } else if (first) { first = false; console.log("     (pdftotext is not installed: the PDF's text is not read here)"); }
    check(`${label}: no errors on the page`, errors.length === 0, errors[0]);
    await context.close();
  } catch (e) { check(`${label}: the check could run`, false, String(e.message).split("\n")[0]); }
}
if (hasPdftotext) for (const fingers of [false, true]) for (const two of [false, true]) {
  const off = pdfWords[`false|${fingers}|${two}`], on = pdfWords[`true|${fingers}|${two}`];
  check(`PDF, fingers ${fingers ? "on" : "off"}, ${two ? "two octaves" : "one octave"}: the note names are in the PDF's text only with them on`, on > off, `${off} words without, ${on} with`);
}
rmSync(dir, { recursive: true, force: true });
await browser.close();
const bad = results.filter((x) => !x).length;
console.log(bad ? `\n${bad} failing` : "\nthe sheet exports in every combination");
process.exit(bad ? 1 : 0);

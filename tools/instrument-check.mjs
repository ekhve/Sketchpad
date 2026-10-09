/* Do the instruments sound different from one another? Measured, not heard. (D-107)

     PLAYWRIGHT=$(npm root -g)/playwright node tools/instrument-check.mjs [--table]

   For each instrument: turn echo off and the room to dry, play C4, and record what comes out of the app: how
   quickly it speaks (attack), how long it takes to die away (decay), how much is left after a second (sustain),
   and how bright it is (the centre of its spectrum). Then every pair of instruments must differ in at least two
   of the four by a margin that an ear would notice (nearly twice as quick or slow to speak, a decay one and a half times
   as long, a third higher in brightness, a fifth more left after a second). This cannot say which sounds good,
   only that they are not the same sound. Needs a browser; `check-done` runs it as gate G17. */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require(process.env.PLAYWRIGHT || "playwright")); }
catch (e) { console.error("NO BROWSER: Playwright not found. Set PLAYWRIGHT=/path/to/playwright."); process.exit(3); }

const INSTRUMENTS = ["Grand piano", "Rhodes", "Felt keys", "Warm pad", "Marimba"];
const probe = () => {
  window.__rec = { t: [], rms: [], centroid: [], spread: [] };
  const connect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dest, ...rest) {
    const out = connect.call(this, dest, ...rest);
    try {
      const ctx = this.context;
      if (dest === ctx.destination && !this.__tapped && !(ctx instanceof OfflineAudioContext)) {
        this.__tapped = true;
        /* everything that reaches the speakers also reaches one analyser, made once per context */
        if (!ctx.__an) {
          const an = ctx.__an = ctx.createAnalyser(); an.fftSize = 4096; an.smoothingTimeConstant = 0;
          const td = new Float32Array(an.fftSize), fd = new Float32Array(an.frequencyBinCount);
          window.__tick = () => {
            an.getFloatTimeDomainData(td); an.getFloatFrequencyData(fd);
            let s = 0; for (let i = td.length - 1024; i < td.length; i++) s += td[i] * td[i];
            let num = 0, den = 0; const hz = ctx.sampleRate / an.fftSize;
            for (let i = 1; i < fd.length; i++) { const m = Math.pow(10, fd[i] / 20); num += i * hz * m; den += m; }
            const c = den > 0 ? num / den : 0; let v = 0;
            for (let i = 1; i < fd.length; i++) { const m = Math.pow(10, fd[i] / 20); v += m * (i * hz - c) ** 2; }
            window.__rec.t.push(performance.now()); window.__rec.rms.push(Math.sqrt(s / 1024)); window.__rec.centroid.push(c); window.__rec.spread.push(den > 0 ? Math.sqrt(v / den) : 0);
          };
        }
        connect.call(this, ctx.__an);
      }
    } catch (e) {}
    return out;
  };
};

/** The four numbers, from a recording of one note. */
export function features({ t, rms, centroid, spread }) {
  const peak = Math.max(...rms), pi = rms.indexOf(peak);
  if (!(peak > 0.002)) return { silent: true };
  const first = rms.findIndex((v) => v > 0.1 * peak);
  const t0 = t[first], tpeak = t[pi];
  const attack = Math.max(5, tpeak - t0);
  const fell = rms.findIndex((v, i) => i > pi && v < 0.25 * peak);
  const decay = ((fell < 0 ? t[t.length - 1] : t[fell]) - tpeak) / 1000;
  const at1 = rms.findIndex((_, i) => t[i] - tpeak >= 1000);
  const sustain = at1 < 0 ? 0 : rms[at1] / peak;
  const early = centroid.filter((_, i) => i >= first && t[i] - t0 < 300 && rms[i] > 0.2 * peak);
  const bright = early.reduce((a, b) => a + b, 0) / Math.max(1, early.length);
  const loud = spread.filter((_, i) => rms[i] >= 0.5 * peak);
  const wide = loud.reduce((a, b) => a + b, 0) / Math.max(1, loud.length);
  return { attack, decay, sustain, bright, wide, peak };
}
export const MARGINS = { attack: 0.8, decay: 0.6, bright: 0.4, sustain: 0.2 };
/** How the two differ, as the list of features that differ by a noticeable margin. */
export function differences(a, b) {
  const log2 = (x, y) => Math.abs(Math.log2(x / y));
  const out = [];
  if (log2(a.attack, b.attack) >= MARGINS.attack) out.push("attack");
  if (log2(a.decay, b.decay) >= MARGINS.decay) out.push("decay");
  if (log2(a.bright, b.bright) >= MARGINS.bright) out.push("brightness");
  if (Math.abs(a.sustain - b.sustain) >= MARGINS.sustain) out.push("sustain");
  return out;
}

if (import.meta.url === new URL(process.argv[1], "file:").href || process.argv[1]?.endsWith("instrument-check.mjs")) {
  const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  const measured = {};
  for (const name of INSTRUMENTS) {
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
    await page.addInitScript(`(${probe.toString()})()`);
    await page.goto(new URL("../build/sketchpad-app.html", import.meta.url).href);
    await page.waitForTimeout(1200);
    await page.click('button[aria-controls="sound-options"]');
    await page.click(`#sound-options button:text-is("${name}")`);
    for (const off of ["Dry", "Off"]) await page.click(`#sound-options button:text-is("${off}")`);
    await page.click("[data-midi=\"60\"]");                     // starts the audio and plays the first note
    await page.waitForTimeout(1500);
    await page.evaluate(() => { window.__rec = { t: [], rms: [], centroid: [], spread: [] }; });
    await page.evaluate(() => { window.__timer = setInterval(window.__tick, 15); });
    const box = await page.locator("[data-midi=\"60\"]").boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height - 20);
    await page.mouse.down();                                   // the key is held, so the note's own shape is heard
    await page.waitForTimeout(3000);
    await page.mouse.up();
    await page.waitForTimeout(300);
    const rec = await page.evaluate(() => { clearInterval(window.__timer); return window.__rec; });
    if (process.env.DEBUG) console.log(name, rec.t.length, Math.max(...rec.rms));
    measured[name] = features(rec);
    await page.close();
  }
  await browser.close();
  let bad = 0;
  for (const [n, f] of Object.entries(measured)) console.log(`${n.padEnd(12)} ${f.silent ? "SILENT" : `attack ${f.attack.toFixed(0)} ms · decay ${f.decay.toFixed(2)} s · after 1 s ${(f.sustain * 100).toFixed(0)}% · brightness ${f.bright.toFixed(0)} Hz · width ${f.wide.toFixed(0)} Hz · level ${f.peak.toFixed(3)}`}`);
  const names = Object.keys(measured);
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
    const a = measured[names[i]], b = measured[names[j]];
    const d = a.silent || b.silent ? [] : differences(a, b);
    const ok = d.length >= 2; if (!ok) bad++;
    console.log(`${ok ? "ok  " : "FAIL"} ${names[i]} vs ${names[j]}: ${d.join(", ") || "too alike"}`);
  }
  const levels = names.map((n) => measured[n].peak).sort((a, b) => a - b), median = levels[Math.floor(levels.length / 2)];
  for (const n of names) { const r = measured[n].peak / median, ok = r >= 0.5 && r <= 2; if (!ok) bad++; console.log(`${ok ? "ok  " : "FAIL"} ${n} is about as loud as the others (${(20 * Math.log10(r)).toFixed(1)} dB from the middle one)`); }
  const others = names.filter((n) => n !== "Warm pad").map((n) => measured[n].wide).sort((a, b) => a - b), padWide = measured["Warm pad"].wide;
  { const ok = padWide >= others[Math.floor(others.length / 2)] * 1.25; if (!ok) bad++; console.log(`${ok ? "ok  " : "FAIL"} the pad is fuller than the others (width ${padWide.toFixed(0)} Hz, others' middle ${others[Math.floor(others.length / 2)].toFixed(0)} Hz)`); }
  console.log(bad ? `\n${bad} failing` : "\nevery pair of instruments differs, they are about as loud, and the pad is full");
  process.exit(bad ? 1 : 0);
}

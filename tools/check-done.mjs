/* Definition of Done, measured rather than trusted.
 *
 *   node tools/check-done.mjs
 *
 * Runs every gate in DONE.md that a machine can judge and prints a verdict.
 * Exit code 0 means the automated gates pass; the manual and judgement gates
 * in DONE.md still have to be worked through by a person.
 */
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { checkCore } from "./core-check.mjs";

const results = [];
const gate = (id, name, ok, detail) => results.push({ id, name, ok, detail });
const read = (p) => (existsSync(p) ? readFileSync(p, "utf8") : null);

/* ---------- inputs ---------- */
const feature = read("sketchpad.feature");
const requirements = read("REQUIREMENTS.md");
const design = read("DESIGN.md");
const useCases = read("USE_CASES.md");
const app = read("sketchpad.jsx");
const done = read("DONE.md") ?? "";

if (!feature || !requirements || !design || !useCases || !app) {
  console.error("Run this from the repository root. Missing one of: sketchpad.feature, REQUIREMENTS.md, DESIGN.md, USE_CASES.md, sketchpad.jsx");
  process.exit(2);
}

/* ---------- the assets, loaded once ----------
   The theory used to be cut out of sketchpad.jsx and tested as a generated copy.
   It is now modules (core/, sketchpad/) that the tests and the apps import
   directly, so the tests cannot be checking anything but what ships. (D-096) */
const core = await checkCore(".");
const moduleSource = core.modules.map((m) => m.source).join("\n");
const appFiles = ["sketchpad.jsx", ...(existsSync("j6") ? ["j6/app.jsx", "j6/j6.mjs", "j6/progression.mjs", "j6/sheet.mjs", "j6/labels.mjs"] : [])].filter(existsSync);

/* ---------- G0: one copy of the theory ----------
   Nothing an asset exports may also be defined in an app: a second copy is
   the way two apps drift apart, and the way a fix in one misses the other. */
const duplicated = [];
for (const m of core.modules) for (const e of m.exports) {
  for (const f of appFiles) {
    if (new RegExp(`^\\s*(?:export\\s+)?(?:function|const|let|class)\\s+${e}\\b`, "m").test(readFileSync(f, "utf8"))) duplicated.push(`${e} (${m.id}) is also defined in ${f}`);
  }
}
gate("G0", "Each asset is defined once, and the apps import it", duplicated.length === 0,
  duplicated.length ? duplicated.slice(0, 3).join("; ") : `${core.modules.reduce((n, m) => n + m.exports.length, 0)} exports in ${core.modules.length} modules, none redefined in an app`);

/* ---------- G1: the suite passes ---------- */
let testOut = "";
try {
  testOut = execSync("node --test tests/*.test.mjs core/tests/*.test.mjs sketchpad/tests/*.test.mjs 2>&1", { encoding: "utf8" });
} catch (e) {
  testOut = e.stdout || "";
}
const pass = +(testOut.match(/^# pass (\d+)/m)?.[1] ?? 0);
const fail = +(testOut.match(/^# fail (\d+)/m)?.[1] ?? 1);
gate("G1", "Every automated check passes", fail === 0, `${pass} passing, ${fail} failing`);

/* ---------- G2: mutation score ---------- */
let mutOut = "";
try {
  mutOut = execSync("node tools/mutate.mjs 2>&1", { encoding: "utf8" });
} catch (e) {
  mutOut = e.stdout || "";
}
const [, killed, total] = mutOut.match(/(\d+)\/(\d+) mutants killed/) ?? [, 0, 0];
const stale = (mutOut.match(/^SKIP/gm) || []).length;
const score = total > 0 ? killed / total : 0;
gate("G2", "At least 90% of mutants killed", score >= 0.9 && total > 0, `${killed}/${total} killed (${Math.round(score * 100)}%)`);
gate("G3", "No stale mutants", stale === 0, stale ? `${stale} mutant(s) no longer match the code` : "all mutants live");

/* ---------- G4: requirements point at real scenarios ---------- */
const scenarioNames = [...feature.matchAll(/^\s*Scenario(?: Outline)?:\s*(.+)$/gm)].map((m) => m[1].trim());
/* The "Known gaps" table at the foot also starts its rows with R-nnn; it is a
   list of things deliberately not done and must not be read as requirements. */
const reqBody = requirements.split("## Known gaps")[0];
const reqRows = [...reqBody.matchAll(/^\|\s*(R-\d+)\s*\|(.+?)\|(.+?)\|\s*([AMI])\s*\|\s*(.+?)\s*\|$/gm)];
const broken = reqRows
  .map(([, id, , , mode, verifiedBy]) => ({ id, mode, verifiedBy: verifiedBy.trim() }))
  /* Inspection requirements are verified by reading, not by a scenario. */
  .filter((r) => r.mode !== "I" && !r.verifiedBy.startsWith("*(") && !scenarioNames.includes(r.verifiedBy));
gate("G4", "Every A/M requirement names a scenario that exists", broken.length === 0,
  broken.length ? broken.map((r) => `${r.id} → "${r.verifiedBy}"`).join("; ") : `${reqRows.length} requirements checked`);

/* ---------- G5: requirements are traced to a decision or use case ---------- */
const untraced = [...reqBody.matchAll(/^\|\s*(R-\d+)\s*\|[^|]+\|\s*([^|]*?)\s*\|/gm)]
  .filter(([, , source]) => !/D-\d+|UC-\d+|X-\d+|DESIGN/.test(source))
  .map(([, id]) => id);
gate("G5", "Every requirement traces to a decision or use case", untraced.length === 0,
  untraced.length ? untraced.join(", ") : `${reqRows.length} traced`);

/* ---------- G6: the assets load standalone ---------- */
let builds = false, buildDetail = "";
try {
  execSync("node -e \"Promise.all([import('./core/index.mjs'), import('./sketchpad/index.mjs')]).then(([c, s]) => { if (!c.planBar || !c.harmonize || !c.identifyChord || !s.LESSONS) process.exit(1); })\"", { encoding: "utf8" });
  builds = true;
  buildDetail = "core and sketchpad load in Node with their exports intact";
} catch (e) {
  buildDetail = "an asset module does not load";
}
gate("G6", "The assets load standalone", builds, buildDetail);

/* ---------- G7: the assets stay pure ----------
   C3 (below) says why per module; this is the same rule over the whole of the
   theory, with comments stripped: one comment reads "no Math.random anywhere
   in this file", which a naive check once flagged as a violation. */
const theoryBlock = moduleSource
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/.*$/gm, "");
const impurities = [
  ["Math.random", /Math\.random/],
  ["Date", /new Date|Date\.now/],
  ["React", /\buseState\b|\buseEffect\b|\bReact\./],
  ["Tone", /\bTone\./],
  ["DOM", /\bdocument\.|\bwindow\./],
].filter(([, re]) => re.test(theoryBlock)).map(([n]) => n);
gate("G7", "The asset modules have no impure dependency", impurities.length === 0,
  impurities.length ? `found: ${impurities.join(", ")}` : "pure");

/* ---------- G8: no literal colours outside the token set ---------- */
const afterTokens = app.slice(app.indexOf("const T = {"));
const tokenBlockEnd = afterTokens.indexOf("\n};");
const componentCode = afterTokens.slice(tokenBlockEnd);
const literals = [...componentCode.matchAll(/#[0-9A-Fa-f]{6}\b/g)].map((m) => m[0]);
/* Deliberately near-empty. Every colour a component uses should be a token;
   the allow-list exists only for values that are structural rather than
   palette choices. When this list grows, that is the smell, not the fix. */
const allowed = new Set([]);
/* The J-6 Explorer page keeps its extra roles in its own token block, J,
   which spreads Sketchpad's T; below that block the same rule holds. (D-087) */
const j6Page = read("j6/app.jsx") ?? "";
const j6Components = j6Page.includes("const J = {") ? j6Page.slice(j6Page.indexOf("const J = {")).split("\n};").slice(1).join("\n};") : j6Page;
const j6Literals = [...j6Components.matchAll(/#[0-9A-Fa-f]{6}\b/g)].map((m) => m[0]);
const strays = [...new Set([...literals, ...j6Literals])].filter((c) => !allowed.has(c));
gate("G8", "No stray colour literals in components", strays.length === 0,
  strays.length ? strays.join(", ") : `${literals.length + j6Literals.length} literals, all on the allow-list`);

/* ---------- G9: the change log was updated today ---------- */
const today = new Date().toISOString().slice(0, 10);
gate("G9", "The change log has an entry for today", design.includes(today),
  design.includes(today) ? `entry dated ${today}` : `no entry dated ${today}`);

/* ---------- G14: no requirement row is invisible to these gates ----------
   R-230a..e were written as real requirements and silently skipped, because
   every gate here matches R-<digits> and nothing else. A requirement the gates
   cannot see is a requirement nobody is checking. (D-071) */
const allReqRows = [...reqBody.matchAll(/^\|\s*(R-[^|\s]+)\s*\|/gm)].map((m) => m[1]);
const unseenReqs = allReqRows.filter((id) => !/^R-\d+$/.test(id));
gate("G14", "Every requirement row is one the gates can read", unseenReqs.length === 0,
  unseenReqs.length ? `not matched by the gates: ${unseenReqs.join(", ")}`
                    : `${allReqRows.length} rows, all readable`);

/* ---------- G10: documents cross-reference the same decision set ---------- */
const decisions = [...design.matchAll(/^### (D-\d+)/gm)].map((m) => m[1]);
const referenced = new Set([...(useCases + feature + requirements + done + moduleSource).matchAll(/(?<![A-Z])D-\d+/g)].map((m) => m[0]));
const orphanDecisions = decisions.filter((d) => !referenced.has(d));
gate("G10", "Every decision is referenced somewhere downstream", orphanDecisions.length === 0,
  orphanDecisions.length ? `never cited: ${orphanDecisions.join(", ")}` : `${decisions.length} decisions, all cited`);

/* ---------- G11: use cases keep up with the scenarios ----------
   Nine use cases were referenced by scenarios and requirements while being
   absent from USE_CASES.md, and three entries in its "next" list had already
   been built. Nothing was checking, so nothing complained. */
const ucInDoc = new Set([...useCases.matchAll(/UC-\d+/g)].map((m) => m[0]));
const ucUsed = new Set([...(feature + requirements).matchAll(/UC-\d+/g)].map((m) => m[0]));
const ucMissing = [...ucUsed].filter((u) => !ucInDoc.has(u)).sort();
gate("G11", "Every use case referenced is described in USE_CASES.md", ucMissing.length === 0,
  ucMissing.length ? `not described: ${ucMissing.join(", ")}` : `${ucUsed.size} use cases, all described`);

/* ---------- G12: no hook names something defined later ----------
   A dependency array is evaluated where it is written, so naming a `const`
   declared further down throws before anything renders — the app does not
   fail, it simply never appears. Cheap to check, impossible to see by eye. */
const callbackDefs = {};
for (const m of app.matchAll(/^\s*const (\w+) = useCallback/gm)) callbackDefs[m[1]] = m.index;
const tdz = [];
for (const m of app.matchAll(/^\s*const (\w+) = useCallback\([\s\S]*?\n  \}, \[([^\]]*)\]\);/gm)) {
  for (const dep of m[2].split(",").map((d) => d.trim()).filter(Boolean)) {
    if (callbackDefs[dep] !== undefined && callbackDefs[dep] > m.index) {
      tdz.push(`${m[1]} depends on ${dep}, which is defined below it`);
    }
  }
}
gate("G12", "No hook depends on something defined later", tdz.length === 0,
  tdz.length ? tdz.join("; ") : `${Object.keys(callbackDefs).length} callbacks checked`);

/* ---------- G13: every decision referenced actually exists ----------
   Nine decisions were cited in the change log, the code and the scenarios
   while having no section anywhere in DESIGN.md: an insert was anchored to a
   heading that did not match, and the guard against duplicates saw the
   change-log mention and skipped in silence. G10 checks that headed decisions
   are cited; this checks the reverse. */
const cited = new Set([...(app + moduleSource + feature + requirements + useCases + done).matchAll(/(?<![A-Z])D-\d{3}/g)].map((m) => m[0]));
const described = new Set([
  ...[...design.matchAll(/^### (D-\d{3})/gm)].map((m) => m[1]),
  ...[...design.matchAll(/^\|\s*(D-\d{3})\s*\|/gm)].map((m) => m[1]),
]);
const undescribed = [...cited].filter((id) => !described.has(id)).sort();
gate("G13", "Every decision referenced has a section or a row", undescribed.length === 0,
  undescribed.length ? `cited but never written: ${undescribed.join(", ")}` : `${cited.size} decisions, all described`);

/* ---------- C1–C4: the asset base, held to its own rules ----------
   core/DESIGN.md says what the rules are; tools/core-check.mjs holds them, and
   core/tests/architecture.test.mjs shows each check catching a planted fault. */
for (const r of core.results) gate(r.id, r.name, r.ok, r.ok ? r.detail : r.problems.slice(0, 3).join("; "));

/* ---------- G15: sound comes out, the way it does on a phone ----------
   Three first-note faults reached a real phone because nothing here could hear: the audio was built too
   early, a first request to start it was lost and blocked every later one, and piano keys asked to start
   it on a finger-down, which a phone does not count. tools/sound-check.mjs opens the built apps in a browser
   whose audio is made to behave like a phone's (suspended until a touch, under four readings of the rule),
   sends real touches and reads the loudest sample at the speakers. It needs Playwright and a browser; where
   there is none the gate fails and says why, because a gate that quietly skips is not one. (D-103) */
{
  let out = "", code = 0;
  try {
    execSync("node tools/build-app.mjs", { encoding: "utf8", stdio: "pipe" });
    const root = process.env.PLAYWRIGHT || (() => { try { return execSync("npm root -g", { encoding: "utf8" }).trim() + "/playwright"; } catch { return undefined; } })();
    out = execSync("node tools/sound-check.mjs 2>&1", { encoding: "utf8", env: { ...process.env, ...(root ? { PLAYWRIGHT: root } : {}) }, timeout: 300000 });
  } catch (e) { out = (e.stdout || "") + (e.stderr || ""); code = e.status ?? 1; }
  const cases = (out.match(/^\s+ok\s/gm) || []).length, failing = (out.match(/^\s+FAIL\s/gm) || []).length;
  gate("G15", "Sound comes out under a phone's rules", code === 0 && cases > 0,
    code === 3 ? "no browser here: run where Playwright is installed (PLAYWRIGHT=/path), or record an exception in DONE.md"
      : code === 0 ? `${cases} cases, four readings of the touch rule, all audible` : `${failing} failing: ${(out.match(/^\s+FAIL\s.*$/m) || [""])[0].trim().slice(0, 120)}`);
}

/* ---------- G16: the screen is laid out as asked ----------
   The owner's layout requests (no engine text, the sound options folded away, the octave control above the
   piano, nothing wider than a phone) are checked headless by tools/layout-check.mjs at three phone widths.
   Same rule as G15: it needs a browser, and fails with the reason where there is none. (D-105) */
{
  let out = "", code = 0;
  try {
    const root = process.env.PLAYWRIGHT || (() => { try { return execSync("npm root -g", { encoding: "utf8" }).trim() + "/playwright"; } catch { return undefined; } })();
    out = execSync("node tools/layout-check.mjs 2>&1", { encoding: "utf8", env: { ...process.env, ...(root ? { PLAYWRIGHT: root } : {}) }, timeout: 300000 });
  } catch (e) { out = (e.stdout || "") + (e.stderr || ""); code = e.status ?? 1; }
  const passed = (out.match(/^ok\s/gm) || []).length, failing = (out.match(/^FAIL\s/gm) || []).length;
  gate("G16", "The screen is laid out as asked", code === 0 && passed > 0,
    code === 3 ? "no browser here: run where Playwright is installed (PLAYWRIGHT=/path), or record an exception in DONE.md"
      : code === 0 ? `${passed} layout checks at three phone widths` : `${failing} failing: ${(out.match(/^FAIL\s.*$/m) || [""])[0].slice(0, 120)}`);
}

/* ---------- G17: the instruments sound different from one another ----------
   "Very similar", said the owner, and a measurement agreed: the five instruments differed by 14 dB in loudness
   and the pad was a thin sine. tools/instrument-check.mjs plays each and measures what comes out; every pair must
   differ in at least two features, they must be about as loud, and the pad must be the widest. Needs a browser,
   like G15 and G16. (D-107) */
{
  let out = "", code = 0;
  try {
    const root = process.env.PLAYWRIGHT || (() => { try { return execSync("npm root -g", { encoding: "utf8" }).trim() + "/playwright"; } catch { return undefined; } })();
    out = execSync("node tools/instrument-check.mjs 2>&1", { encoding: "utf8", env: { ...process.env, ...(root ? { PLAYWRIGHT: root } : {}) }, timeout: 300000 });
  } catch (e) { out = (e.stdout || "") + (e.stderr || ""); code = e.status ?? 1; }
  const passed = (out.match(/^ok\s/gm) || []).length, failing = (out.match(/^FAIL\s/gm) || []).length;
  gate("G17", "The instruments sound different from one another", code === 0 && passed > 0,
    code === 3 ? "no browser here: run where Playwright is installed (PLAYWRIGHT=/path), or record an exception in DONE.md"
      : code === 0 ? `${passed} comparisons: pairs, loudness, a fuller pad` : `${failing} failing: ${(out.match(/^FAIL\s.*$/m) || [""])[0].slice(0, 120)}`);
}

/* ---------- verdict ---------- */
const width = Math.max(...results.map((r) => r.name.length));
console.log("\nDEFINITION OF DONE — automated gates\n");
for (const r of results) {
  console.log(`  ${r.ok ? "PASS" : "FAIL"}  ${r.id.padEnd(4)} ${r.name.padEnd(width)}  ${r.detail}`);
}
const failed = results.filter((r) => !r.ok);
console.log(`\n  ${results.length - failed.length}/${results.length} automated gates pass`);
console.log(failed.length
  ? `\n  NOT DONE — ${failed.map((r) => r.id).join(", ")}\n`
  : "\n  Automated gates clear. The manual and judgement gates in DONE.md remain.\n");
process.exit(failed.length ? 1 : 0);

/* The core asset base's architecture and contracts — CR-ARCH-nn.
   The rules in core/DESIGN.md are held by program (tools/core-check.mjs), and each is shown to catch a breach:
   a check that has never been seen to fail is a belief, not a check. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkCore, loadModules } from "../../tools/core-check.mjs";
import * as core from "../index.mjs";
import * as sketchpad from "../../sketchpad/index.mjs";
import { harmonize } from "../harmony.mjs";
import { dictionaryFor, voicingsFor } from "../voicing.mjs";
import { PATTERNS, renderFigure, planBar } from "../figures.mjs";
import { scalePcs, customScaleFrom } from "../scales.mjs";
import { parseChordName } from "../symbols.mjs";
import { sheetData } from "../sheet.mjs";
import { stepFingering } from "../fingering.mjs";
import { CHORD_SETS } from "../chordsets.mjs";
import { buildLesson, practiceNote } from "../../sketchpad/lessons.mjs";

const here = await checkCore(".");
const gate = (id) => here.results.find((r) => r.id === id);
const tagged = (tag) => gate("C3").tagged.filter((p) => p.tag === tag).map((p) => p.msg);

/** The repository as the checks see it, copied so a fault can be planted without touching the real files. */
function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), "core-check-"));
  for (const f of ["core", "sketchpad", "j6"]) cpSync(f, join(dir, f), { recursive: true });
  for (const f of ["sketchpad.jsx", "DESIGN.md", "REQUIREMENTS.md", "USE_CASES.md"]) cpSync(f, join(dir, f));
  const edit = (file, fn) => writeFileSync(join(dir, file), fn(readFileSync(join(dir, file), "utf8")));
  return { dir, edit, done: () => rmSync(dir, { recursive: true, force: true }) };
}
async function planted(fault) { const s = sandbox(); try { fault(s); return await checkCore(s.dir); } finally { s.done(); } }
const problemsOf = (r, id) => r.results.find((x) => x.id === id);

test("CR-ARCH-01 the modules import each other without a cycle", async () => {
  assert.deepEqual(tagged("cycle"), []);
  const r = await planted((s) => s.edit("core/notes.mjs", (t) => t.replace(/\n\n/, '\n\nimport { SCALES } from "./scales.mjs";\n\n')));
  assert.ok(problemsOf(r, "C3").tagged.some((p) => p.tag === "cycle"), "a cycle is seen");
});

test("CR-ARCH-02 every module's header and document give the layer and dependencies its imports make", async () => {
  assert.deepEqual(tagged("layer"), []);
  const r = await planted((s) => s.edit("core/voicing.mjs", (t) => t.replace('import { pc, noteName } from "./notes.mjs";', 'import { pc, noteName } from "./notes.mjs";\nimport { SCALES } from "./scales.mjs";')));
  assert.ok(problemsOf(r, "C3").tagged.some((p) => p.tag === "layer" && /voicing/.test(p.msg)), "an import the header does not list is seen");
  const l = here.layers;
  for (const m of here.modules) for (const d of new Set(m.imports.map((i) => i.id))) assert.ok(l.get(d) < l.get(m.id), `${m.id} sits above ${d}`);
});

test("CR-ARCH-03 core never imports a product, and every import is one of our modules", async () => {
  assert.deepEqual(tagged("direction"), []);
  for (const m of here.modules.filter((x) => x.dir === "core")) assert.ok(m.imports.every((i) => i.id.startsWith("core/")), m.id);
  const r = await planted((s) => s.edit("core/scales.mjs", (t) => t.replace('import { pc } from "./notes.mjs";', 'import { pc } from "./notes.mjs";\nimport { LEVELS } from "../sketchpad/model.mjs";')));
  assert.ok(problemsOf(r, "C3").tagged.some((p) => p.tag === "direction"), "core importing a product is seen");
  const r2 = await planted((s) => s.edit("core/scales.mjs", (t) => t.replace('import { pc } from "./notes.mjs";', 'import { pc } from "./notes.mjs";\nimport { join } from "node:path";')));
  assert.ok(problemsOf(r2, "C3").tagged.some((p) => p.tag === "direction"), "a package import is seen");
});

test("CR-ARCH-04 every module is pure: no React, audio library, DOM, clock, randomness or network", async () => {
  assert.deepEqual(tagged("pure"), []);
  for (const [what, line] of [["randomness", "function _f() { return Math.random(); }"], ["a clock", "function _f() { return Date.now(); }"], ["the DOM", "function _f() { return document.title; }"], ["Tone", "function _f() { return Tone.now(); }"], ["the network", 'function _f() { return fetch("x"); }']]) {
    const r = await planted((s) => s.edit("core/notes.mjs", (t) => t + "\n" + line + "\n"));
    assert.ok(problemsOf(r, "C3").tagged.some((p) => p.tag === "pure" && p.msg.includes(what)), `${what} is seen`);
  }
  const quiet = await planted((s) => s.edit("core/notes.mjs", (t) => t + "\n/* Math.random() in a comment is fine */\n// Date.now() too\n"));
  assert.equal(problemsOf(quiet, "C3").tagged.filter((p) => p.tag === "pure").length, 0, "a comment is not a use");
});

test("CR-ARCH-05 every module is used by something, and its document says by what", async () => {
  assert.deepEqual(tagged("used"), []);
  for (const m of here.modules) assert.ok(here.used.get(m.id).size > 0, m.id);
  const r = await planted((s) => s.edit("core/MODULES.md", (t) => t.replace(/(## core\/melody[\s\S]*?\*\*Used by\*\* )([^\n]*)/, "$1sketchpad")));
  assert.ok(problemsOf(r, "C3").tagged.some((p) => p.tag === "used" && /melody/.test(p.msg)), "a consumer the document omits is seen");
});

test("CR-ARCH-06 every export of every module is described in its document, and nothing described is missing", async () => {
  assert.deepEqual(gate("C2").problems, []);
  const r = await planted((s) => s.edit("core/MODULES.md", (t) => t.replace(/^\| `pc` \|.*\n/m, "")));
  assert.ok(problemsOf(r, "C2").problems.some((p) => /exports pc/.test(p)), "an undocumented export is seen");
  const r2 = await planted((s) => s.edit("core/notes.mjs", (t) => t.replace("export {", "export { zzz, ").replace(/\n\n/, "\n\nconst zzz = 1;\n\n")));
  assert.ok(problemsOf(r2, "C2").problems.some((p) => /zzz/.test(p)), "a new export is seen");
  const r3 = await planted((s) => s.edit("core/index.mjs", (t) => t.replace('export * from "./melody.mjs";\n', "")));
  assert.ok(problemsOf(r3, "C2").problems.some((p) => /index.mjs does not re-export core\/melody/.test(p)), "a module missing from the index is seen");
});

test("CR-ARCH-07 every requirement has a test, and every test names a requirement", async () => {
  assert.deepEqual(gate("C1").problems, []);
  assert.ok(here.reqs.length >= 150 && here.tests.length >= here.reqs.length - 5);
  const r = await planted((s) => s.edit("core/REQUIREMENTS.md", (t) => t.replace(/^\| CR-NOTES-03 \|.*\n/m, "")));
  assert.ok(problemsOf(r, "C1").problems.some((p) => /CR-NOTES-03/.test(p) && /not a requirement/.test(p)), "a test with no requirement is seen");
  const r2 = await planted((s) => s.edit("core/tests/notes.test.mjs", (t) => t.replace('test("CR-NOTES-03', 'test("NOTES-03')));
  assert.ok(problemsOf(r2, "C1").problems.some((p) => /CR-NOTES-03 \(automated\) has no test/.test(p)), "a requirement with no test is seen");
});

test("CR-ARCH-08 every requirement traces to a source that exists, and every decision is used", async () => {
  assert.deepEqual(gate("C4").problems, []);
  const r = await planted((s) => s.edit("core/REQUIREMENTS.md", (t) => t.replace(/(^\| CR-NOTES-01 \|[^|]*\|)([^|]*)\|/m, "$1 D-9999 |")));
  assert.ok(problemsOf(r, "C4").problems.some((p) => /D-9999/.test(p)), "a source that does not exist is seen");
  const r2 = await planted((s) => s.edit("core/DESIGN.md", (t) => t + "\n### CD-099 — Nobody cites this\n"));
  assert.ok(problemsOf(r2, "C4").problems.some((p) => /CD-099/.test(p)), "a decision nobody uses is seen");
});

test("CR-ARCH-09 every module's section names its purpose and its behaviour, and the index re-exports every module", () => {
  for (const m of here.modules) { const d = here.docs.get(m.id); assert.ok(d.hasPurpose && d.hasBehaviour, m.id); }
  assert.deepEqual(Object.keys(core).sort(), here.modules.filter((m) => m.dir === "core").flatMap((m) => m.exports).sort(), "core/index exposes exactly the modules' exports");
  assert.deepEqual(Object.keys(sketchpad).sort(), here.modules.filter((m) => m.dir === "sketchpad").flatMap((m) => m.exports).sort());
});

/* ---- the contract: what every function promises to every app that uses it ---- */
const triads = harmonize(0, "major", 3), sevenths = harmonize(0, "major", 4);
const C = dictionaryFor(0)[0], Am7 = dictionaryFor(9).find((c) => c.sym === "m7"), G7 = dictionaryFor(7).find((c) => c.sym === "7");
const major = scalePcs(0, "major"), mine = customScaleFrom([60, 62, 63, 67, 68], "x");
const bassPattern = PATTERNS.find((p) => p.kind === "bass"), fig = renderFigure(bassPattern, C, G7, major, 1, 40);
const ctx = { tonic: 0, mode: "major", scaleId: "major" };
const parsed = parseChordName("Dm7"), sheet = sheetData({ tonic: 0, mode: "major", scaleId: "major", progression: triads });
const step = buildLesson(sketchpad.LESSONS[0].id, 0).steps[0], wrong = practiceNote(step.target, [], 61);
const run8 = [60, 62, 64, 65, 67, 69, 71, 72];
const CONTRACT = {
  "core/notes": { pc: [[61], [-1]], isWhite: [[60], [61]], noteName: [[61, "letters"], [61, "solfege"]], baseOf: [["solfege"]], leansFlat: [[5, "major"]], keyNames: [[3, "minor"]], spelling: [["letters", 3, "minor"]] },
  "core/scales": { scaleById: [["major"]], scalePcs: [[2, "dorian"]], fitScales: [[triads, 0]], keysContaining: [[[60, 64, 67]]], scalesContaining: [[[60, 63, 67, 70], 4]], customScaleFrom: [[[60, 62, 63, 67, 68], "x"]], customScalePcs: [[mine]], activeScalePcs: [[mine, 0, "major"], [null, 0, "major"]] },
  "core/chords": { chordLabel: [[0, "m7", "letters"]], inversions: [[C]], identifyChord: [[[60, 64, 67]], [[57, 60, 64, 67], "solfege"], [[48, 55, 58], "letters", { missing: true }]], customChordFrom: [[[60, 64, 67], "x"]] },
  "core/voicing": { voice: [[0, [0, 4, 7]]], stackAscending: [[[0, 4, 7, 11, 2], 0]], dictionaryFor: [[3, 36]], voicingsFor: [[C], [Am7]], voiceLeading: [[C, Am7]], arpeggio: [[[60, 64, 67], "updown"]], smoothestVoicing: [[C, Am7]] },
  "core/symbols": { nearestSuffix: [["maj7x"]], parseChordName: [["F#m7/C#"], ["Hmaj"]], parseChordNames: [["C | Am, F  G7"]], typedLabel: [[{ rootPc: 0, sym: "", bassPc: 4 }, "letters"]] },
  "core/styles": { scalesForStyle: [["soul", "major"]] },
  "core/harmony": { romanFor: [[0, 10, 6, ""]], harmonizeIntervals: [[0, [0, 2, 4, 5, 7, 9, 11], 4]], harmonize: [[0, "major", 3]], suggestScaleFor: [[{ notes: [58, 62, 65] }, ctx]], harmonizeSteps: [[0, "major", 1, 3]], suggestNextChords: [[triads, 0, "major"]], typedChord: [[parsed, 0, "major"]], harmonizeCustom: [[customScaleFrom([60, 62, 64, 65, 67, 69, 71], "x")]], chordsAtTension: [[0, "major", 3]] },
  "core/explain": { explainChord: [[triads[1], ctx]], explainProgression: [[triads, ctx]], describeChange: [[[60, 64, 67], [57, 60, 64]]] },
  "core/melody": { melodyRole: [[60, [0, 4, 7], major]], melodyGuide: [[C, major]], changedNotes: [[[60, 64], [60, 65]]] },
  "core/chordsets": { buildSet: [[CHORD_SETS[0], 2]], setsFor: [["major"]] },
  "core/figures": { rng: [[7]], patternsFor: [["bass", "funk"]], place: [[7, 40]], renderFigure: [[bassPattern, C, G7, major, 1, 40]], renderProgressionFigure: [[bassPattern, triads, major, 3, 40]], explainFigure: [[bassPattern, fig]], planBar: [[{ chordNotes: [60, 64], bassFigure: fig, riffFigure: [], sixteenth: 0.1, barSeconds: 1.6 }]], planIsClean: [[planBar({ bassFigure: fig, sixteenth: 0.1, barSeconds: 1.6 }), 1.6]] },
  "core/transport": { setTempo: [[200], [94.6]], beatSeconds: [[120]], beatAt: [[4, 2, { bars: 1, loop: true, click: true }]], chordSeconds: [[{ bpm: 90, bars: 2 }]], loopIndex: [[5, 3]], startCursor: [[10]], advance: [[{ nextBarAt: 10, barIndex: 0 }, 10, 1, 0.5]],
    createDriver: [] /* stateful: it holds a timer, so it is verified with a fake clock instead, CR-TRANSPORT-09 to 15 */ },
  "core/bass": { bassOptions: [[G7, major]], bassTransitions: [[C, G7, major]] },
  "core/playback": { voiceLifetime: [[1]], reapVoices: [[[{ until: 1 }, { until: 5 }], 2]], allocatable: [[20, 6]], barsToSchedule: [[{ nextBarAt: 0, barIndex: 0 }, 0, 2, 1]], barSecondsAt: [[90]], pickVoiceIndex: [[[3, 1, 2], 0]], rollStyleById: [["roll"]], rollOffsets: [[6, 0.11]] },
  "core/instruments": { sampleMidi: [["F#2"]], sampleAnchors: [[]], stretchAt: [[27]], worstStretch: [[]], instrumentById: [["rhodes"]], delaySettings: [["pad", true]], reverbSettings: [["hall"]], base64Payload: [["data:x;base64,QUJD"]], payloadBytes: [["data:x;base64,QUJD"]] },
  "core/keyboard": { keyRole: [[60, { chordNotes: [60, 64], chordRootMidi: 60 }]], keyMarker: [[60, { tonic: 0, scaleSet: major }]], heldAfterDown: [[[60], 64]], heldAfterUp: [[[60, 64], 64]], slideTo: [[{ 1: 60 }, 1, 62]], notesUnderFingers: [[{ 1: 60, 2: 64 }]], keyAtPosition: [[100, 150, 700, 200, 48, 1]] },
  "core/fingering": { effectiveFingerHand: [[null, "learn"]], handFingers: [[[60, 64, 67], "R"]], fitsHand: [[[60, 67], 12]], fingerChord: [[[60, 64, 67], { hand: "both", rootPc: 0 }]], fingerCrossings: [[[1, 2, 3, 1, 2], "R"]], scaleFingering: [[run8, "major", "R"]], stepFingering: [[{ target: { kind: "sequence" }, show: run8 }, "major", "R"]], litLessonFingers: [[stepFingering({ target: { kind: "sequence" }, show: run8 }, "major", "R"), { target: { kind: "sequence" } }, [60], [], null]] },
  "core/sheet": { diagramKeys: [[48, 2, [48, 52]]], diagramRange: [[[40, 80]]], sheetData: [[{ tonic: 0, mode: "major", scaleId: "major", progression: triads, fingering: true }]], sheetAsText: [[sheet]] },
  "sketchpad/model": { namingFor: [[{ accidentals: "key", tonic: 3, mode: "major" }], [{}]], activeChordFor: [[{ progression: triads, palette: sevenths }]], levelIndex: [["produce"]], featuresAt: [["study"]], has: [["start", "loop"]], tabsAt: [["produce"]] },
  "sketchpad/guide": { guideFor: [["chords"]], sentenceCount: [["One. Two."]] },
  "sketchpad/lessons": { buildLesson: [[sketchpad.LESSONS[0].id, 0]], lessonsFor: [[0]], nextKeyRound: [[0]], keyLandmark: [[1]], stepWords: [[3, "down"]], toneWord: [[7]], chordShape: [[[0, 4, 7]]], practiceNote: [[step.target, [], 60], [step.target, [], 61]], practiceFeedback: [[step, wrong], [step, practiceNote(step.target, [], 60)]], practiceHint: [[step, []]], skipWalk: [[[0, 4, 7], major, "letters"]], diagnoseSlip: [[step, wrong]], hintMethod: [[step, []]] },
};
const deepFreeze = (o) => { if (o && typeof o === "object" && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(deepFreeze); } return o; };
const clone = (x) => (x === undefined ? x : structuredClone(x));

test("CR-ARCH-10 every exported function is in the contract table, so a new function cannot arrive without its promises being checked", () => {
  const missing = [];
  for (const m of here.modules) {
    const ns = m.dir === "core" ? core : sketchpad;
    for (const e of m.exports) if (typeof ns[e] === "function" && !CONTRACT[m.id]?.[e]) missing.push(`${m.id}.${e}`);
  }
  assert.deepEqual(missing, []);
  for (const [id, fns] of Object.entries(CONTRACT)) for (const f of Object.keys(fns)) assert.equal(typeof (id.startsWith("core") ? core : sketchpad)[f], "function", `${id}.${f} is in the table but is not a function`);
});

test("CR-ARCH-11 every exported function gives the same answer for the same input, and never changes its arguments", () => {
  let calls = 0;
  for (const [id, fns] of Object.entries(CONTRACT)) for (const [name, argSets] of Object.entries(fns)) {
    const f = (id.startsWith("core") ? core : sketchpad)[name];
    for (const args of argSets) {
      const frozen = deepFreeze(clone(args));                                     // a write to a frozen argument throws in a module
      const answer = (x) => (typeof x === "function" ? Array.from({ length: 5 }, x) : x);       // a generator is compared by what it yields
      const first = answer(f(...frozen)), second = answer(f(...clone(args)));
      assert.deepEqual(first, second, `${id}.${name} gave two answers`);
      assert.doesNotMatch(JSON.stringify(first) ?? "", /null.*NaN|NaN/, `${id}.${name} returned a NaN`);
      calls++;
    }
  }
  assert.ok(calls >= 100, `${calls} calls checked`);
});

test("CR-ARCH-12 the answers are plain data, so an app on any platform, or a file, can carry them", () => {
  for (const [id, fns] of Object.entries(CONTRACT)) for (const [name, argSets] of Object.entries(fns)) {
    const f = (id.startsWith("core") ? core : sketchpad)[name];
    for (const args of argSets) {
      const out = f(...clone(args));
      if (typeof out === "function") { assert.equal(name, "rng", `${id}.${name} returned a function: only the seeded generator may`); continue; }
      const text = JSON.stringify(out);
      if (out !== undefined) assert.deepEqual(JSON.parse(text), JSON.parse(JSON.stringify(JSON.parse(text))), `${id}.${name} survives a round trip`);
      assert.doesNotMatch(String(text), /NaN/, `${id}.${name}`);
    }
  }
});

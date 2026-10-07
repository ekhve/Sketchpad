/* core/sheet — unit tests, one per requirement in core/REQUIREMENTS.md (CR-SHEET-nn). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { diagramKeys, diagramRange, sheetData, sheetAsText } from "../sheet.mjs";
import { harmonize } from "../harmony.mjs";
import { customScaleFrom } from "../scales.mjs";
import { isWhite, pc } from "../notes.mjs";

const prog = [0, 5, 3, 4].map((i) => harmonize(0, "major", 3)[i]);
const base = { tonic: 0, mode: "major", scaleId: "major", progression: prog };

test("CR-SHEET-01 diagramKeys lays out a small keyboard in units of its width: every white key one equal slice, every black key between its neighbours", () => {
  for (const [start, oct] of [[48, 1], [48, 2], [36, 3]]) {
    const d = diagramKeys(start, oct);
    const nWhite = 7 * oct + 1;
    assert.equal(d.whites.length, nWhite); assert.equal(d.blacks.length, 5 * oct);
    d.whites.forEach((k, i) => { assert.ok(Math.abs(k.x - i / nWhite) < 1e-12 && Math.abs(k.w - 1 / nWhite) < 1e-12); assert.ok(isWhite(k.midi)); });
    assert.ok(Math.abs(d.whites.at(-1).x + d.whites.at(-1).w - 1) < 1e-12, "they fill the width");
    for (const b of d.blacks) { assert.ok(!isWhite(b.midi)); const left = d.whites.find((w) => w.midi === b.midi - 1), right = d.whites.find((w) => w.midi === b.midi + 1); assert.ok(b.x > left.x && b.x + b.w < right.x + right.w); assert.ok(Math.abs(b.w - d.whites[0].w * 0.62) < 1e-12); }
  }
});

test("CR-SHEET-02 diagramKeys marks the notes asked for and no others", () => {
  const d = diagramKeys(48, 2, [48, 52, 55, 61]);
  assert.deepEqual([...d.whites, ...d.blacks].filter((k) => k.on).map((k) => k.midi).sort((a, b) => a - b), [48, 52, 55, 61]);
  assert.ok(diagramKeys(48, 1).whites.every((k) => !k.on));
});

test("CR-SHEET-03 diagramRange snaps to whole octaves from the lowest note's octave, holds every note, and never shrinks below the minimum", () => {
  assert.deepEqual(diagramRange([]), { startMidi: 48, octaves: 2 });
  assert.deepEqual(diagramRange([60, 64, 67]), { startMidi: 60, octaves: 2 });
  assert.deepEqual(diagramRange([48, 76]), { startMidi: 48, octaves: 3 });
  assert.deepEqual(diagramRange([59, 61]), { startMidi: 48, octaves: 2 });
  assert.deepEqual(diagramRange([60], 1), { startMidi: 60, octaves: 1 });
  for (const notes of [[40, 41], [47, 83], [24, 96], [60, 72]]) { const r = diagramRange(notes); assert.equal(r.startMidi % 12, 0); assert.ok(r.startMidi <= Math.min(...notes) && r.startMidi + r.octaves * 12 >= Math.max(...notes), String(notes)); }
});

test("CR-SHEET-04 the sheet's header names the key, the tempo, the scale and the number of bars", () => {
  const s = sheetData({ ...base, bpm: 90 });
  assert.equal(s.title, "C major"); assert.deepEqual(s.meta, ["90 bpm", "C Major", "4 bars"]);
  assert.equal(sheetData({ ...base }).meta[0], "88 bpm", "88 by default");
  assert.equal(sheetData({ ...base, progression: [prog[0]] }).meta[2], "1 bar");
  assert.equal(sheetData({ ...base, tonic: 2, scaleId: "dorian", mode: "minor" }).title, "D minor");
  assert.equal(sheetData({ ...base, tonic: 2, scaleId: "dorian", mode: "minor" }).meta[1], "D Dorian");
  assert.equal(sheetData({ ...base, system: "solfege" }).title, "Do major");
  assert.equal(sheetData({ ...base, progression: [] }).meta[2], "0 bars");
});

test("CR-SHEET-05 the sheet carries the scale as notes in one octave from the tonic, ascending, with their names", () => {
  const s = sheetData(base).scale;
  assert.deepEqual(s.names, ["C", "D", "E", "F", "G", "A", "B"]); assert.equal(s.start, 48);
  assert.ok(s.notes.every((n, i) => i === 0 || n > s.notes[i - 1]));
  assert.deepEqual(s.notes.map(pc).sort((a, b) => a - b), [0, 2, 4, 5, 7, 9, 11]);
  const g = sheetData({ ...base, tonic: 7 }).scale; assert.ok(g.notes[0] >= 48 + 7 - 12 && g.notes.at(-1) <= 48 + 7 + 12);
  const mine = customScaleFrom([60, 62, 63, 67, 68], "Five");
  const m = sheetData({ ...base, customScale: mine }); assert.equal(m.scale.name, "Five"); assert.deepEqual(m.meta[1], "Five"); assert.equal(m.scale.names.length, 5);
});

test("CR-SHEET-06 each bar of the sheet gives the chord's name, notes, their names and its numeral, in order from bar one", () => {
  const s = sheetData(base);
  assert.deepEqual(s.chords.map((c) => [c.bar, c.label, c.roman]), [[1, "C", "I"], [2, "Am", "vi"], [3, "F", "IV"], [4, "G", "V"]]);
  s.chords.forEach((c, i) => { assert.deepEqual(c.notes, prog[i].notes); assert.equal(c.names.length, c.notes.length); });
  assert.deepEqual(s.chords[0].names, ["C", "E", "G"]);
  assert.equal(sheetData({ ...base, progression: [{ rootPc: 0, sym: "", notes: [60, 64, 67] }] }).chords[0].roman, "", "a chord with no numeral has none");
  assert.deepEqual(s.range, diagramRange(prog.flatMap((c) => c.notes)));
});

test("CR-SHEET-07 each bar has a bass: the figure's notes if there is one, else the chord's lowest note two octaves down", () => {
  const plain = sheetData(base).bass;
  assert.deepEqual(plain.map((b) => b.notes), prog.map((c) => [c.notes[0] - 24])); assert.deepEqual(plain[0].names, ["C"]);
  const fig = [[{ midi: 36 }, { midi: 43 }], [{ midi: 33 }], [{ midi: 29 }], [{ midi: 31 }]];
  const withFig = sheetData({ ...base, bassFigure: fig }).bass;
  assert.deepEqual(withFig.map((b) => b.notes), [[36, 43], [33], [29], [31]]); assert.deepEqual(withFig[0].names, ["C", "G"]);
});

test("CR-SHEET-08 fingering is added only when asked for: right-hand fingers on each chord, and a left little finger on a single bass note", () => {
  const off = sheetData(base);
  assert.ok(off.chords.every((c) => c.fingers.length === 0) && off.bass.every((b) => b.finger === null));
  const on = sheetData({ ...base, fingering: true });
  assert.deepEqual(on.chords[0].fingers.map((k) => k.finger), [1, 3, 5]); assert.ok(on.bass.every((b) => b.finger === 5));
  const riff = sheetData({ ...base, fingering: true, bassFigure: [[{ midi: 36 }, { midi: 43 }], [{ midi: 33 }], [{ midi: 29 }], [{ midi: 31 }]] });
  assert.equal(riff.bass[0].finger, null, "a bass riff's fingering is out of scope"); assert.equal(riff.bass[1].finger, 5);
  const wide = sheetData({ ...base, fingering: true, progression: [{ rootPc: 0, sym: "", notes: [36, 43, 52, 55, 59] }] });
  assert.ok(wide.chords[0].fingers.some((k) => k.hand === "L"), "a chord too wide for one hand is split");
  assert.ok(sheetData({ ...base, fingering: true, reach: 24, progression: [{ rootPc: 0, sym: "", notes: [36, 43, 52, 55, 59] }] }).chords[0].fingers.every((k) => k.hand === "R"));
});

test("CR-SHEET-09 sheetAsText prints the same sheet as plain text: a header, the scale, and a line for every bar", () => {
  const text = sheetAsText(sheetData({ ...base, bpm: 90 }));
  const lines = text.split("\n");
  assert.equal(lines[0], "C major  ·  90 bpm  ·  C Major  ·  4 bars"); assert.equal(lines[2], "Scale: C D E F G A B");
  assert.equal(lines.length, 8); assert.equal(lines.filter((l) => /^\d\. /.test(l)).length, 4);
  assert.match(lines[4], /^1\. C\s+C E G\s+bass: C$/); assert.match(lines[5], /^2\. Am\s+A C E\s+bass: A$/);
  assert.match(sheetAsText(sheetData({ ...base, fingering: true })).split("\n")[4], /bass: C \(L5\)  fingers 1-3-5$/);
  assert.doesNotMatch(text, /fingers|\(L/);
  assert.equal(sheetAsText(sheetData({ ...base, progression: [] })).split("\n").length, 4, "header, scale and no bars");
});

test("CR-SHEET-10 the sheet is a pure function of what it is given", () => {
  const frozen = JSON.parse(JSON.stringify(base)); Object.freeze(frozen); Object.freeze(frozen.progression);
  assert.deepEqual(sheetData(frozen), sheetData(frozen)); assert.deepEqual(sheetAsText(sheetData(frozen)), sheetAsText(sheetData(frozen)));
});

/* core/harmony — unit tests, one per requirement in core/REQUIREMENTS.md (CR-HARMONY-nn). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { romanFor, harmonizeIntervals, harmonize, suggestScaleFor, harmonizeSteps, suggestNextChords, typedChord, harmonizeCustom, TENSION_LEVELS, BORROWED, chordsAtTension } from "../harmony.mjs";
import { SCALES, scalePcs, customScaleFrom } from "../scales.mjs";
import { parseChordName } from "../symbols.mjs";
import { DICTIONARY } from "../chords.mjs";
import { pc } from "../notes.mjs";

const SEVEN = SCALES.filter((s) => s.iv.length === 7);
const deepFreeze = (o) => { Object.values(o).forEach((v) => typeof v === "object" && v && deepFreeze(v)); return Object.freeze(o); };

test("CR-HARMONY-01 harmonize builds a chord on each of a seven-note scale's notes, from the scale's own notes, in every key", () => {
  for (const s of SEVEN) for (let t = 0; t < 12; t++) for (const size of [3, 4, 5]) {
    const chords = harmonize(t, s.id, size);
    assert.equal(chords.length, 7);
    const own = scalePcs(t, s.id);
    chords.forEach((c, i) => {
      assert.equal(c.rootPc, own[i]); assert.equal(c.degreeIndex, i);
      assert.equal(c.notes.length, size);
      assert.ok(c.notes.every((n) => own.includes(pc(n))), `${s.id} ${t} degree ${i}: only the scale's notes`);
      assert.ok(c.notes.every((n, k) => k === 0 || n > c.notes[k - 1]), "ascending, so a 9th stays above the 7th");
      assert.equal(c.notes[0], 48 + c.rootPc, "built in the default octave");
      assert.equal(c.id, `${s.id}-${i}-${size}`);
    });
  }
  assert.deepEqual(harmonize(0, "major", 3).map((c) => c.sym), ["", "m", "m", "", "", "m", "dim"]);
  assert.deepEqual(harmonize(0, "major", 4).map((c) => c.sym), ["maj7", "m7", "m7", "maj7", "7", "m7", "m7♭5"]);
  assert.equal(harmonize(0, "major", 3, 60)[0].notes[0], 60, "or in the octave asked for");
  assert.equal(harmonize(0, "major", 3, 60)[0].base, 60);
});

test("CR-HARMONY-02 a scale with other than seven notes has no diatonic chords", () => {
  assert.deepEqual(harmonize(0, "minor-pentatonic", 3), []);
  assert.deepEqual(harmonize(0, "blues", 4), []);
  assert.deepEqual(harmonizeIntervals(0, null, 3), []);
  assert.deepEqual(harmonizeIntervals(0, [0, 2, 4], 3), []);
});

test("CR-HARMONY-03 romanFor writes a chord's place in the key: case for quality, ♭ or ♯ for a shifted degree, ° and + for the odd ones", () => {
  assert.deepEqual(harmonize(0, "major", 3).map((c) => c.roman), ["I", "ii", "iii", "IV", "V", "vi", "vii°"]);
  assert.deepEqual(harmonize(9, "natural-minor", 3).map((c) => c.roman), ["i", "ii°", "♭III", "iv", "v", "♭VI", "♭VII"], "degrees are measured against the major scale, so a minor key shows its flats");
  assert.equal(romanFor(0, 0, 0, "maj7"), "I", "maj7 is a major chord, not minor");
  assert.equal(romanFor(0, 0, 0, "m7"), "i");
  assert.equal(romanFor(0, 3, 2, ""), "♭III");
  assert.equal(romanFor(0, 6, 3, ""), "♯IV");
  assert.equal(romanFor(0, 8, 5, ""), "♭VI");
  assert.equal(romanFor(0, 11, 6, "dim7"), "vii°");
  assert.equal(romanFor(0, 4, 2, "aug"), "III+");
  for (let t = 0; t < 12; t++) assert.deepEqual(harmonize(t, "major", 3).map((c) => c.roman), harmonize(0, "major", 3).map((c) => c.roman), "the numerals do not depend on the key");
});

test("CR-HARMONY-04 harmonizeCustom harmonises a scale of your own, and only if it has seven notes", () => {
  const seven = customScaleFrom([60, 62, 63, 65, 67, 68, 70], "Mine");      // C natural minor
  const mine = harmonizeCustom(seven, 3);
  assert.deepEqual(mine.map((c) => [c.rootPc, c.sym]), harmonize(0, "natural-minor", 3).map((c) => [c.rootPc, c.sym]));
  assert.equal(mine[0].id, `${seven.id}-0-3`);
  assert.equal(harmonizeCustom(seven, 4, 60)[0].notes[0], 60);
  assert.deepEqual(harmonizeCustom(customScaleFrom([60, 62, 64, 67, 69], "p")), []);
});

test("CR-HARMONY-05 suggestScaleFor names the scale a chord with notes outside the key comes from, and nothing for a chord already in it", () => {
  const inKey = harmonize(0, "major", 3)[0];
  assert.equal(suggestScaleFor(inKey, { tonic: 0, mode: "major" }), null);
  const bVII = { notes: [58, 62, 65] };                                         // B♭ D F over C major
  const r = suggestScaleFor(bVII, { tonic: 0, mode: "major" });
  assert.equal(r.scale.id, "mixolydian"); assert.deepEqual(r.outside, [10]);
  assert.match(r.why, /^Those notes aren't in your scale, but they are all in mixolydian\./);
  assert.equal(suggestScaleFor({ notes: [61, 63, 66] }, { tonic: 0, mode: "major" }), null, "no seven-note scale of the mode holds it: no claim");
  for (let t = 0; t < 12; t++) assert.equal(suggestScaleFor({ notes: [58 + t, 62 + t, 65 + t] }, { tonic: t, mode: "major" }).scale.id, "mixolydian", `key ${t}`);
});

test("CR-HARMONY-06 harmonizeSteps builds a chord one skipped note at a time and ends by naming it", () => {
  const steps = harmonizeSteps(0, "major", 1, 3);
  assert.equal(steps.length, 4);
  assert.deepEqual(steps.map((s) => s.pcs), [[2], [2, 5], [2, 5, 9], [2, 5, 9]]);
  assert.deepEqual(steps.map((s) => s.added), [2, 5, 9, null]);
  assert.equal(steps[0].text, "Start on D."); assert.equal(steps[1].text, "Skip E, take F."); assert.equal(steps[2].text, "Skip G, take A.");
  assert.match(steps[3].text, /^That's Dm — every other note of the scale, starting from D\.$/);
  assert.equal(harmonizeSteps(0, "major", 0, 5).length, 6);
  assert.match(harmonizeSteps(0, "major", 0, 3, "solfege")[0].text, /^Start on Do\.$/);
  assert.deepEqual(harmonizeSteps(0, "blues", 0), [], "only seven-note scales");
});

test("CR-HARMONY-07 suggestNextChords offers somewhere to start from nothing, and four ranked chords otherwise, never repeating the last", () => {
  const start = suggestNextChords([], 0, "major");
  assert.deepEqual(start.map((s) => s.chord.roman), ["I", "ii", "iii", "IV"]); assert.ok(start.every((s) => s.why === "Somewhere to start."));
  const pal = harmonize(0, "major", 3);
  for (const last of pal) {
    const next = suggestNextChords([last], 0, "major");
    assert.equal(next.length, 4);
    assert.ok(next.every((n) => n.chord.rootPc !== last.rootPc && n.why));
    assert.ok(next.every((n, i) => i === 0 || n.score <= next[i - 1].score), "best first");
  }
  assert.equal(suggestNextChords([pal[0]], 0, "major")[0].chord.roman, "IV", "from I, a fourth up is the strongest move");
  assert.match(suggestNextChords([pal[0]], 0, "major")[0].why, /fourth up/);
  const closing = suggestNextChords([pal[0], pal[3], pal[4]], 0, "major");
  assert.ok(closing.some((n) => /Back home/.test(n.why)), "after three chords, home closes the loop");
});

test("CR-HARMONY-08 typedChord turns a typed name into a chord the app can play, number and explain, in the key", () => {
  const c = typedChord(parseChordName("Dm7"), 0, "major");
  assert.deepEqual(c.notes, [50, 53, 57, 60]); assert.equal(c.roman, "ii"); assert.equal(c.degreeIndex, 1); assert.equal(c.typed, true);
  assert.equal(c.id, "typed-2-m7-r"); assert.equal(c.base, 48);
  assert.equal(typedChord(parseChordName("Bb"), 0, "major").roman, "♭VII");
  assert.equal(typedChord(parseChordName("Db"), 0, "major").roman, "♭II", "a flattened degree takes the next degree up's numeral");
  assert.equal(typedChord(parseChordName("F#"), 0, "major").roman, "♭V");
  for (const d of DICTIONARY) assert.deepEqual(typedChord(parseChordName("C" + d.q), 0, "major").notes, d.iv.map((i) => 48 + i), d.q);
});

test("CR-HARMONY-09 a typed slash bass is the nearest note of that name below the chord, and the chord keeps all its notes", () => {
  const c = typedChord(parseChordName("C/E"), 0, "major");
  assert.deepEqual(c.notes, [40, 48, 52, 55]); assert.equal(c.bassPc, 4); assert.equal(c.id, "typed-0--4");
  for (let b = 0; b < 12; b++) {
    const r = typedChord(parseChordName("C/" + ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"][b]), 0, "major");
    if (b === 0) { assert.equal(r.notes.length, 3, "a bass equal to the root adds nothing"); continue; }
    assert.equal(pc(r.notes[0]), b); assert.ok(r.notes[0] < 48 && r.notes[0] >= 48 - 12, `bass ${b} is within an octave below`);
    assert.deepEqual(r.notes.slice(1), [48, 52, 55]);
  }
});

test("CR-HARMONY-10 tension runs from the plain chords of the key to chromatic colour, and each step adds to the one before", () => {
  assert.deepEqual(TENSION_LEVELS.map((l) => l.level), [0, 1, 2, 3]);
  assert.ok(TENSION_LEVELS.every((l) => l.name && l.note));
  for (const mode of ["major", "minor"]) for (let t = 0; t < 12; t++) {
    const lv = [0, 1, 2, 3].map((l) => chordsAtTension(t, mode, l));
    assert.equal(lv[0].length, 7); assert.ok(lv[0].every((c) => c.notes.length === 3 && !c.extra), "plain triads");
    assert.equal(lv[1].length, 7); assert.ok(lv[1].every((c) => c.notes.length === 4 && !c.extra), "sevenths");
    assert.ok(lv[2].length > 7 && lv[2].length <= lv[3].length, "borrowed chords appear at level 2, more at 3");
    assert.equal(lv[3].length, 7 + BORROWED[mode].length);
    assert.ok(lv[2].filter((c) => c.extra).every((c) => c.why && BORROWED[mode].some((b) => b.from <= 2 && pc(t + b.offset) === c.rootPc)));
  }
  assert.equal(chordsAtTension(0, "major", 2).filter((c) => c.extra).length, 2, "only the borrowed chords allowed at level 2");
});

test("CR-HARMONY-11 the chord builders leave their inputs alone and answer the same each time", () => {
  const prog = deepFreeze(harmonize(0, "major", 3));
  assert.deepEqual(suggestNextChords(prog, 0, "major"), suggestNextChords(prog, 0, "major"));
  assert.deepEqual(suggestScaleFor(prog[0], deepFreeze({ tonic: 0, mode: "major" })), null);
  assert.deepEqual(typedChord(deepFreeze(parseChordName("Am")), 0, "major"), typedChord(parseChordName("Am"), 0, "major"));
});

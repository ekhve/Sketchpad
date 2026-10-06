// The J-6 Explorer engine (j6/j6.mjs). Test names match the scenario names in sketchpad.feature exactly.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as j from "../j6/j6.mjs";

const names = (r) => r.rows.map((w) => `${j.nameOf(w.want)}:${w.kind}:${w.keys.join("/")}`);
const at = (set, key, t = 0) => j.chordAt(set, j.KEYS.indexOf(key), t);

test("Every chord in sets 29, 47 and 54 is spelled by its J-6 voicing", () => {
  for (const n of [29, 47, 54]) assert.deepEqual(j.validateSet(n), [], `set ${n}`);
});

test("A set whose published voicings contradict their labels is flagged and never recommended", () => {
  const bad = j.validateSet(59);
  assert.equal(bad.length, 12);
  assert.ok(bad.find((r) => r.key === "C#").problems.includes("root not sounded"));
  assert.ok(j.search("Cmaj9 Dm9", { sets: [59] }).length === 0);
});

test("A 4-voice voicing with a missing tone still counts as its chord", () => {
  // set 29, key B: G7 printed as G4 B3 F3 G2 — no D
  assert.deepEqual(j.validateKey("G7", "G4 B3 F3 G2"), []);
  // but a stray note is caught
  assert.deepEqual(j.validateKey("G7", "G4 B3 F3 G#2").length > 0, true);
});

test("Pressing D# on set 54 shows Fmaj7 with the J-6 voicing F3 A3 C4 E4", () => {
  const c = at(54, "D#");
  assert.equal(j.nameOf(c.chord), "Fmaj7");
  assert.equal(c.label, "FM7");
  assert.deepEqual(c.midi, [53, 57, 60, 64]);
});

test("Keys C, C#, G, D# on set 54 read as Imaj7 iii7 vi7 IVmaj7 in C major", () => {
  const prog = ["C", "C#", "G", "D#"].map((k) => at(54, k).chord);
  const [best] = j.likelyKeys(prog);
  assert.equal(best.tonic, 0);
  assert.equal(best.inKey, 4);
  assert.deepEqual(prog.map((c) => j.romanOf(c, 0)), ["Imaj7", "iii7", "vi7", "IVmaj7"]);
});

test("J-6 chords are spelled the way their key writes them", () => {
  const played = (t) => ["C", "C#", "G", "D#"].map((k) => at(54, k, t).chord);
  const prog = played(2);
  const [best] = j.likelyKeys(prog);
  assert.equal(best.tonic, 2);
  assert.deepEqual(prog.map((c) => j.nameInKey(c, best.tonic)), ["Dmaj7", "F#m7", "Bm7", "Gmaj7"]);
  assert.equal(j.nameOf(prog[1]), "G♭m7", "without a key the black keys are flats, which is why the key matters");
  for (let t = -6; t <= 5; t++) {
    const p = played(t);
    const names = p.map((c) => j.nameInKey(c, j.likelyKeys(p)[0].tonic)).join(" ");
    assert.ok(!(names.includes("#") && names.includes("♭")), `KEY ${t}: ${names}`);
  }
});

test("Roman numerals follow the key, not the letter C", () => {
  // the same shapes a fourth up, in F major
  const prog = ["Fmaj7", "Am7", "Dm7", "B♭maj7", "C7"].map(j.parseChord);
  assert.equal(j.likelyKeys(prog)[0].tonic, 5);
  assert.deepEqual(prog.map((c) => j.romanOf(c, 5)), ["Imaj7", "iii7", "vi7", "IVmaj7", "V7"]);
});

test("KEY transpose moves every chord and its voicing by the same amount", () => {
  for (const t of [-6, -3, 2, 5]) {
    for (let k = 0; k < 12; k++) {
      const a = j.chordAt(47, k, 0), b = j.chordAt(47, k, t);
      assert.equal(b.chord.root, (a.chord.root + t + 12) % 12);
      assert.deepEqual(b.midi, a.midi.map((m) => m + t));
    }
  }
});

test("Dm7 G7 Cmaj7 Am7 finds set 47 at KEY −3 with four exact matches", () => {
  const [best] = j.search("Dm7 G7 Cmaj7 Am7", { sets: [29, 47, 54] });
  assert.equal(best.set, 47);
  assert.equal(best.transpose, -3);
  assert.equal(best.score, 1);
  assert.deepEqual(names(best), ["Dm7:exact:D#/F#", "G7:exact:A", "Cmaj7:exact:C#/E", "Am7:exact:C"]);
  // set 54 plays Cmaj7 exactly at KEY 0 (C), +2 (A♯), −3 (D♯) and −5 (F): the nearest to 0 wins
  const [one] = j.search("Cmaj7", { sets: [54] });
  assert.equal(one.transpose, 0);
  const [far] = j.search("Dmaj7", { sets: [54] });
  assert.equal(far.transpose, -1, "KEY −1 on D♯ beats KEY +2 on C, −3 on F and +4 on A♯");
});

test("Musical search counts an inversion and a missing seventh as near matches", () => {
  const r = j.search("Dm7 G7 Cmaj7 Am7", { sets: [29], transpose: false })[0];
  assert.deepEqual(names(r), ["Dm7:exact:E", "G7:exact:B", "Cmaj7:inversion:F", "Am7:close:A"]);
  assert.equal(r.score, 0.875);
});

test("A chord with the wrong third is never a musical match", () => {
  assert.equal(j.matchScore(j.parseChord("G7"), j.parseChord("Gm7"), "musical").kind, "none");
  assert.equal(j.matchScore(j.parseChord("Am7"), j.parseChord("A"), "musical").kind, "none");
});

test("Exact search without transpose ranks set 54 first at 75%", () => {
  const r = j.search("Dm7 G7 Cmaj7 Am7", { sets: [29, 47, 54], mode: "exact", transpose: false });
  assert.deepEqual(r.map((x) => [x.set, x.score]), [[54, 0.75], [29, 0.5], [47, 0.25]]);
});

test("Chord symbols are read the way musicians type them", () => {
  for (const [s, want] of [["Cmaj7", "Cmaj7"], ["CM7", "Cmaj7"], ["Bbmaj7", "B♭maj7"], ["A#M7", "B♭maj7"],
    ["CM7/E", "Cmaj7/E"], ["C-7", "Cm7"]]) {
    assert.equal(j.nameOf(j.parseChord(s)), want, s);
  }
  assert.throws(() => j.parseChord("H7"));
  assert.throws(() => j.parseChord("Cfoo"));
});

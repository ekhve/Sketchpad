/* core/scales — unit tests, one per requirement in core/REQUIREMENTS.md (CR-SCALES-nn). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { SCALES, scaleById, scalePcs, fitScales, keysContaining, scalesContaining, customScaleFrom, customScalePcs, activeScalePcs } from "../scales.mjs";
import { pc } from "../notes.mjs";

const set = (xs) => [...new Set(xs)].sort((a, b) => a - b);
const midiOf = (...pcs) => pcs.map((p, i) => 48 + p + (i % 2) * 12);   // spread over two octaves

test("CR-SCALES-01 the catalogue holds ten scales, each with ascending intervals from 0 inside one octave", () => {
  assert.equal(SCALES.length, 10);
  assert.equal(new Set(SCALES.map((s) => s.id)).size, 10, "ids are unique");
  for (const s of SCALES) {
    assert.equal(s.iv[0], 0, `${s.id} starts on the tonic`);
    assert.ok(s.iv.every((x, i) => Number.isInteger(x) && x >= 0 && x < 12 && (i === 0 || x > s.iv[i - 1])), `${s.id}: ${s.iv}`);
    assert.ok(["major", "minor"].includes(s.mode), `${s.id} is a major or a minor scale`);
    assert.ok(s.name && s.mood && s.tags.length > 0, `${s.id} says what it is called, how it feels and what it suits`);
  }
  assert.deepEqual(SCALES.find((s) => s.id === "major").iv, [0, 2, 4, 5, 7, 9, 11]);
  assert.deepEqual(SCALES.find((s) => s.id === "natural-minor").iv, [0, 2, 3, 5, 7, 8, 10]);
});

test("CR-SCALES-02 scaleById finds a scale by its id and returns nothing for an unknown one", () => {
  for (const s of SCALES) assert.equal(scaleById(s.id), s);
  assert.equal(scaleById("no-such-scale"), undefined);
  assert.equal(scaleById(undefined), undefined);
});

test("CR-SCALES-03 scalePcs is the scale's intervals from the tonic, as pitch classes, for every tonic", () => {
  for (const s of SCALES) for (let t = -12; t < 24; t++) {
    const got = scalePcs(t, s.id);
    assert.deepEqual(got, s.iv.map((i) => pc(t + i)), `${s.id} from ${t}`);
    assert.ok(got.every((p) => p >= 0 && p <= 11));
    assert.equal(got[0], pc(t), "starts on the tonic");
  }
  assert.deepEqual(scalePcs(0, "major"), [0, 2, 4, 5, 7, 9, 11]);
  assert.deepEqual(scalePcs(9, "natural-minor"), [9, 11, 0, 2, 4, 5, 7], "A minor has C major's notes");
});

test("CR-SCALES-04 fitScales ranks scales by the share of a progression's notes they hold, best first, at most five", () => {
  const chord = (...notes) => ({ notes });
  const cMajorLoop = [chord(60, 64, 67), chord(57, 60, 64), chord(53, 57, 60), chord(55, 59, 62)];   // C Am F G
  const fits = fitScales(cMajorLoop, 0);
  assert.ok(fits.length <= 5);
  assert.equal(fits[0].fit, 1, "C major holds every note of C Am F G");
  assert.ok(fits.every((f, i) => i === 0 || f.fit <= fits[i - 1].fit), "best first");
  for (const f of fits) {
    const notes = scalePcs(0, f.scale.id), used = set(cMajorLoop.flatMap((c) => c.notes.map(pc)));
    assert.equal(f.fit, used.filter((p) => notes.includes(p)).length / used.length, f.scale.id);
    assert.deepEqual(f.missing, used.filter((p) => !notes.includes(p)), `${f.scale.id} names what it misses`);
  }
  // an outside note lowers the fit and is named
  const withOutside = fitScales([...cMajorLoop, chord(61)], 0).find((f) => f.scale.id === "major");
  assert.ok(withOutside.fit < 1);
  assert.deepEqual(withOutside.missing, [1]);
  assert.deepEqual(fitScales([], 0), [], "nothing played, nothing to fit");
});

test("CR-SCALES-05 keysContaining returns every major or natural-minor key that holds all the notes, and no other", () => {
  for (const notes of [[60, 64, 67], [60, 61], [62], [60, 62, 64, 65, 67, 69, 71], [60, 63, 66, 69]]) {
    const pcs = set(notes.map(pc));
    const expected = [];
    for (let tonic = 0; tonic < 12; tonic++) for (const mode of ["minor", "major"]) {
      const held = scalePcs(tonic, mode === "minor" ? "natural-minor" : "major");
      if (pcs.every((p) => held.includes(p))) expected.push({ tonic, mode });
    }
    assert.deepEqual(keysContaining(notes), expected, `notes ${notes}`);
  }
  assert.deepEqual(keysContaining([]), []);
  assert.deepEqual(keysContaining([60, 61, 62, 63, 64, 65, 66, 67]).length, 0, "a chromatic run fits no key");
  assert.ok(keysContaining([60, 64, 67]).some((k) => k.tonic === 0 && k.mode === "major"), "C E G is in C major");
});

test("CR-SCALES-06 scalesContaining returns scales, in any key, that hold all the notes, the tightest fit first", () => {
  const notes = [60, 63, 67, 70];                                   // C E♭ G B♭
  const pcs = set(notes.map(pc));
  const all = scalesContaining(notes, 1000);
  assert.ok(all.length > 0);
  for (const r of all) {
    const held = scalePcs(r.tonic, r.scale.id);
    assert.ok(pcs.every((p) => held.includes(p)), `${r.scale.id} from ${r.tonic}`);
    assert.equal(r.extra, held.length - pcs.length, "extra is the notes it adds");
  }
  assert.ok(all.every((r, i) => i === 0 || r.extra > all[i - 1].extra || (r.extra === all[i - 1].extra && r.scale.iv.length >= all[i - 1].scale.iv.length)), "ranked by how few notes it adds");
  // complete: no scale that holds the notes is left out
  let count = 0;
  for (let t = 0; t < 12; t++) for (const s of SCALES) if (pcs.every((p) => scalePcs(t, s.id).includes(p))) count++;
  assert.equal(all.length, count);
  assert.equal(scalesContaining(notes).length, Math.min(6, count), "six by default");
  assert.equal(scalesContaining(notes, 2).length, 2, "or as many as asked for");
  assert.deepEqual(scalesContaining([]), []);
});

test("CR-SCALES-07 customScaleFrom makes a scale of your own from five to eight different notes, and nothing otherwise", () => {
  const five = [60, 62, 64, 67, 69];                                // C D E G A
  const s = customScaleFrom(five, "  Mine  ");
  assert.deepEqual(s.iv, [0, 2, 4, 7, 9]);
  assert.equal(s.tonicPc, 0, "the lowest note is the tonic");
  assert.equal(s.name, "Mine", "the name is trimmed");
  assert.equal(s.mode, "custom"); assert.equal(s.mine, true); assert.deepEqual(s.tags, ["custom"]);
  assert.equal(customScaleFrom(five).name, "My scale", "unnamed scales get a name");
  assert.equal(customScaleFrom(five, "x", 9).tonicPc, 9, "or the tonic you give");
  assert.deepEqual(customScaleFrom(five, "x", 9).iv, [0, 3, 5, 7, 10], "intervals are from that tonic: A C D E G");
  assert.equal(customScaleFrom([60, 62, 64, 67], "x"), null, "four notes are not a scale");
  assert.equal(customScaleFrom([60, 62, 64, 65, 67, 69, 70, 71, 61], "x"), null, "nine are too many");
  assert.equal(customScaleFrom([60, 72, 62, 64, 67, 69], "x").iv.length, 5, "an octave doubled is one note");
  assert.equal(customScaleFrom(five).id, customScaleFrom(five.map((m) => m + 3)).id, "the id names the shape, not the key");
  assert.deepEqual(five, [60, 62, 64, 67, 69], "the input is left as it was");
});

test("CR-SCALES-08 a scale of your own answers the same questions as a built-in one", () => {
  const mine = customScaleFrom([62, 64, 65, 67, 69, 70, 72], "D minor-ish");        // D E F G A B♭ C: D natural minor
  assert.deepEqual(customScalePcs(mine), scalePcs(2, "natural-minor"));
  assert.deepEqual(activeScalePcs(mine, 5, "major"), customScalePcs(mine), "a scale of your own wins over the id");
  for (const s of SCALES) assert.deepEqual(activeScalePcs(null, 4, s.id), scalePcs(4, s.id), "otherwise the built-in scale");
  assert.deepEqual(activeScalePcs(undefined, 0, "major"), scalePcs(0, "major"));
});

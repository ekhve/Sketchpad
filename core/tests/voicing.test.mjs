/* core/voicing — unit tests, one per requirement in core/REQUIREMENTS.md (CR-VOICING-nn). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_BASE, voice, stackAscending, dictionaryFor, voicingsFor, voiceLeading, arpeggio, smoothestVoicing } from "../voicing.mjs";
import { DICTIONARY } from "../chords.mjs";
import { pc } from "../notes.mjs";

const chordOf = (rootPc, sym, base = DEFAULT_BASE) => dictionaryFor(rootPc, base).find((c) => c.sym === sym);
const deepFreeze = (o) => { Object.values(o).forEach((v) => typeof v === "object" && v && deepFreeze(v)); return Object.freeze(o); };

test("CR-VOICING-01 voice places intervals above a root in the octave given, middle C's octave by default", () => {
  assert.equal(DEFAULT_BASE, 48);
  assert.deepEqual(voice(0, [0, 4, 7]), [48, 52, 55]);
  assert.deepEqual(voice(7, [0, 4, 7], 60), [67, 71, 74]);
  for (let r = 0; r < 12; r++) assert.equal(voice(r, [0], 24)[0], 24 + r);
  assert.deepEqual(voice(0, []), []);
});

test("CR-VOICING-02 stackAscending puts each tone above the one before, so a 9th stays above the 7th", () => {
  assert.deepEqual(stackAscending([0, 4, 7, 11, 2], 0), [0, 4, 7, 11, 14]);
  assert.deepEqual(stackAscending([2, 5, 9, 0, 4], 2), [0, 3, 7, 10, 14]);
  for (let r = 0; r < 12; r++) {
    const out = stackAscending([r, r + 4, r + 7, r + 11, r + 14, r + 17, r + 21].map(pc), r);
    assert.ok(out.every((x, i) => i === 0 || x > out[i - 1]), `root ${r}: ${out}`);
    assert.equal(out[0], 0);
  }
});

test("CR-VOICING-03 dictionaryFor lists every dictionary chord on a root, with its notes in the octave given", () => {
  for (const root of [0, 5, 11]) for (const base of [36, 48, 60]) {
    const all = dictionaryFor(root, base);
    assert.equal(all.length, DICTIONARY.length);
    all.forEach((c, i) => {
      const d = DICTIONARY[i];
      assert.equal(c.sym, d.q); assert.equal(c.rootPc, root); assert.equal(c.base, base); assert.equal(c.full, d.full); assert.equal(c.plain, d.plain);
      assert.deepEqual(c.notes, d.iv.map((x) => base + root + x));
      assert.equal(c.id, `dict-${root}-${d.q}`, "an id stable across calls");
    });
  }
  assert.equal(chordOf(0, "").formula, "1 – 3 – 5");
  assert.equal(chordOf(0, "m7").formula, "1 – ♭3 – 5 – ♭7");
  assert.equal(chordOf(0, "7♭9").formula, "1 – 3 – 5 – ♭7 – ♭9");
  assert.deepEqual(dictionaryFor(0), dictionaryFor(0, DEFAULT_BASE), "the default octave is C3");
});

test("CR-VOICING-04 voicingsFor offers close first, then only the arrangements the chord is big enough for", () => {
  const ids = (c) => voicingsFor(c).map((v) => v.id);
  assert.deepEqual(ids(chordOf(0, "")), ["close", "open", "spread"], "a triad");
  assert.deepEqual(ids(chordOf(0, "7")), ["close", "open", "spread", "rootless", "shell"], "four notes");
  assert.deepEqual(ids({ rootPc: 0, sym: "?", base: 48, notes: [48, 52] }), ["close"], "two notes have one arrangement");
  assert.deepEqual(ids(chordOf(0, "m11")), ["close", "signature", "open", "spread", "rootless", "shell"], "a signature spacing only where the dictionary knows one");
  for (const d of DICTIONARY) for (const v of voicingsFor(chordOf(2, d.q))) {
    assert.ok(v.name && v.why, `${d.q} ${v.id} explains itself`);
    assert.ok(v.notes.length >= 2 && v.notes.length <= 8, `${d.q} ${v.id}: at most eight notes`);
    assert.ok(v.notes.every((n, i) => i === 0 || n >= v.notes[i - 1]), `${d.q} ${v.id} ascends`);
  }
});

test("CR-VOICING-05 every arrangement is the chord itself, in the way it claims — only rootless and shell may leave notes out", () => {
  for (const d of DICTIONARY) for (const root of [0, 4, 9]) {
    const chord = chordOf(root, d.q);
    const close = voicingsFor(chord)[0].notes;
    const pcsOf = (ns) => [...new Set(ns.map(pc))].sort((a, b) => a - b);
    const out = Object.fromEntries(voicingsFor(chord).map((v) => [v.id, v.notes]));
    assert.deepEqual(close, chord.notes.slice(0, 8), "close is the chord as the dictionary has it");
    for (const id of ["open", "spread"]) if (out[id]) assert.deepEqual(pcsOf(out[id]), pcsOf(close), `${d.q} ${id} keeps every note`);
    if (out.spread) assert.equal(out.spread[0], close[0] - 12, "spread drops the root an octave");
    if (out.rootless) assert.deepEqual(out.rootless, close.slice(1));
    if (out.shell) assert.deepEqual(out.shell, [close[0], close[1], close[3]]);
  }
  assert.deepEqual(voicingsFor(chordOf(0, "")).find((v) => v.id === "open").notes, [40, 48, 55], "open drops the middle note of a triad");
});

test("CR-VOICING-06 the arrangements come from the chord's own octave and close position, never from the one it is wearing", () => {
  for (const base of [24, 36, 48, 60]) {
    const chord = chordOf(5, "maj7", base);
    const fresh = voicingsFor(chord);
    const worn = voicingsFor({ ...chord, notes: fresh.find((v) => v.id === "spread").notes });
    assert.deepEqual(worn, fresh, `base ${base}: choosing a voicing does not change the list`);
  }
  const noBase = voicingsFor({ rootPc: 0, sym: "", notes: [60, 64, 67] });
  assert.deepEqual(noBase[0].notes, [60, 64, 67], "with no octave given, the lowest note's octave");
  const mine = voicingsFor({ rootPc: 0, sym: "no-such", base: 48, notes: [55, 48, 52] });
  assert.deepEqual(mine[0].notes, [48, 52, 55], "a chord of your own is arranged from its own sorted notes");
});

test("CR-VOICING-07 voiceLeading says which notes stay, which move and how far, and how smooth the change is", () => {
  const c = chordOf(0, ""), am = chordOf(9, "m"), f = chordOf(5, ""), g = chordOf(7, "");
  const ca = voiceLeading(c, am);
  assert.deepEqual(ca.common, [0, 4]); assert.equal(ca.smoothness, "very smooth");
  assert.deepEqual(ca.moves, [{ from: 7, to: 9, semitones: 2 }]); assert.equal(ca.distance, 2);
  assert.match(ca.why, /^C and E stay where they are\. Only 1 note moves\.$/);
  const cf = voiceLeading(c, f);
  assert.deepEqual(cf.common, [0]); assert.equal(cf.smoothness, "smooth");
  const fg = voiceLeading(f, g);
  assert.deepEqual(fg.common, []); assert.equal(fg.smoothness, "a real move"); assert.equal(fg.distance, 6);
  const cfs = voiceLeading(c, chordOf(6, "dim"));
  assert.ok(cfs.moves.length > 0);
  const far = voiceLeading(chordOf(0, ""), chordOf(6, ""));
  assert.equal(far.common.length, 0); assert.equal(far.smoothness, "a real move"); assert.match(far.why, /^Nothing is held over/);
  assert.equal(voiceLeading(c, c).distance, 0, "no change, no distance");
  assert.equal(voiceLeading(c, am, "solfege").why.startsWith("Do and Mi"), true, "in the naming system asked for");
  // every note leaving is paired with one arriving, or with nothing; none is counted twice
  for (const [x, y] of [[c, g], [am, f], [g, chordOf(2, "m7")]]) {
    const v = voiceLeading(x, y);
    const arrivals = v.moves.map((m) => m.to).filter((t) => t !== null);
    assert.equal(new Set(arrivals).size, arrivals.length);
    assert.ok(v.moves.every((m) => m.semitones === null || (m.semitones >= 0 && m.semitones <= 6)));
  }
});

test("CR-VOICING-08 arpeggio plays the notes one at a time, upward, downward, or up and back without repeating the ends", () => {
  assert.deepEqual(arpeggio([67, 60, 64]), [60, 64, 67]);
  assert.deepEqual(arpeggio([67, 60, 64], "down"), [67, 64, 60]);
  assert.deepEqual(arpeggio([60, 64, 67, 72], "updown"), [60, 64, 67, 72, 67, 64]);
  assert.deepEqual(arpeggio([60, 64, 67], "unknown"), [60, 64, 67]);
  assert.deepEqual(arpeggio([]), []);
  const input = deepFreeze([64, 60]);
  assert.deepEqual(arpeggio(input, "updown"), [60, 64], "the input is left as it was");
});

test("CR-VOICING-09 smoothestVoicing picks the arrangement of the next chord that sits nearest the last one, and says why", () => {
  const c = chordOf(0, ""), am = chordOf(9, "m"), g = chordOf(7, "");
  const r = smoothestVoicing(c, am);
  const all = voicingsFor(am);
  assert.equal(r.alternatives.length, all.length - 1);
  assert.ok([r, ...r.alternatives].every((v, i, a) => i === 0 || v.distance >= a[i - 1].distance), "best first");
  assert.deepEqual([r, ...r.alternatives].map((v) => v.id).sort(), all.map((v) => v.id).sort(), "every arrangement is ranked");
  assert.match(r.why, new RegExp(`^Of the ${all.length} ways to play it, this one moves least — C and E stay where they are\\.$`));
  assert.match(smoothestVoicing(c, chordOf(6, "")).why, /travel least\.$/);
  assert.match(smoothestVoicing(c, g, "solfege").why, /Sol|travel/);
});

test("CR-VOICING-10 no function changes its inputs, and each gives the same answer for the same input", () => {
  const a = deepFreeze(chordOf(0, "maj7")), b = deepFreeze(chordOf(5, "7"));
  for (const f of [() => voicingsFor(a), () => voiceLeading(a, b), () => smoothestVoicing(a, b), () => arpeggio(a.notes, "updown"), () => dictionaryFor(3, 36)])
    assert.deepEqual(f(), f());
});

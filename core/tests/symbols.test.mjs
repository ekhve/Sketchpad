/* core/symbols — unit tests, one per requirement in core/REQUIREMENTS.md (CR-SYMBOLS-nn). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { CHORD_ALIASES, nearestSuffix, parseChordName, parseChordNames, TYPING_CHIPS, typedLabel } from "../symbols.mjs";
import { DICTIONARY, chordLabel } from "../chords.mjs";
import { NAMES, SOLFEGE, pc } from "../notes.mjs";

test("CR-SYMBOLS-01 every chord in the dictionary can be typed as its own symbol, on every root, in letters and in Do-Re-Mi", () => {
  for (const d of DICTIONARY) for (let r = 0; r < 12; r++) {
    for (const [system, names] of [["letters", NAMES], ["solfege", SOLFEGE]]) {
      const text = names[r] + d.q;
      const got = parseChordName(text, system);
      assert.equal(got.ok, true, `${text} (${system}) reads`);
      assert.equal(got.rootPc, r, text); assert.equal(got.sym, d.q, text); assert.equal(got.full, d.full); assert.equal(got.bassPc, null);
    }
  }
});

test("CR-SYMBOLS-02 the spellings charts use are read as the dictionary chord they mean", () => {
  const read = (t) => parseChordName(t);
  for (const [alias, q] of Object.entries(CHORD_ALIASES)) {
    assert.ok(DICTIONARY.some((d) => d.q === q), `alias ${alias} points at a chord the dictionary has (${q})`);
    if (alias === "#5") continue;                       // shadowed by a sharp root, see below
    assert.equal(read("C" + alias).sym, q, `C${alias}`);
  }
  // known limit, recorded in core/DESIGN.md: "C#5" reads as C♯ with an unknown "5", so the "#5" alias cannot be reached
  assert.equal(read("C#5").ok, false);
  assert.equal(read("Cmin7").sym, "m7"); assert.equal(read("CΔ7").sym, "maj7"); assert.equal(read("Bø").sym, "m7♭5");
  assert.equal(read("C7♭9").sym, "7♭9"); assert.equal(read("Cm7b5").sym, "m7♭5", "b for ♭");
  assert.equal(read("Fmaj7#11").sym, "maj7♯11", "# for ♯");
  assert.equal(read("C(add9)").sym, "add9", "brackets are dropped");
  assert.equal(read("C").sym, "");
});

test("CR-SYMBOLS-03 the root may be written in either case, with a sharp or flat in either of its two forms", () => {
  assert.equal(parseChordName("f#m").rootPc, 6); assert.equal(parseChordName("F♯m").rootPc, 6);
  assert.equal(parseChordName("Bbmaj7").rootPc, 10); assert.equal(parseChordName("B♭maj7").rootPc, 10);
  assert.equal(parseChordName("Cb").rootPc, 11, "C♭ is B");
  assert.equal(parseChordName("B#").rootPc, 0, "B♯ is C");
  assert.equal(parseChordName("Mim7", "solfege").rootPc, 4); assert.equal(parseChordName("sol#", "solfege").rootPc, 8);
  assert.equal(parseChordName("Sol", "solfege").rootPc, 7, "Sol, not So + l");
  assert.equal(parseChordName("Ti", "solfege").rootPc, 11);
});

test("CR-SYMBOLS-04 a slash names the bass, and a slash that is not a bass stays part of the symbol", () => {
  const got = parseChordName("C/E");
  assert.equal(got.ok, true); assert.equal(got.rootPc, 0); assert.equal(got.bassPc, 4);
  assert.equal(parseChordName("Am7/G").bassPc, 7); assert.equal(parseChordName("D/F#").bassPc, 6);
  assert.equal(parseChordName("Do/Mi", "solfege").bassPc, 4);
  assert.equal(parseChordName("C6/9").sym, "6/9", "6/9 is a chord, not a bass");
  assert.equal(parseChordName("C6/9").bassPc, null);
  assert.equal(parseChordName("C/Q").ok, false);
});

test("CR-SYMBOLS-05 text that is not a chord is refused with a reason that says why, never guessed", () => {
  const bad = parseChordName("Hmaj7");
  assert.equal(bad.ok, false); assert.equal(bad.text, "Hmaj7");
  assert.match(bad.reason, /doesn't start with a note name \(A to G\)/);
  assert.match(parseChordName("Xyz", "solfege").reason, /Do, Re, Mi, Fa, Sol, La, Si/);
  const unknown = parseChordName("Cm7b9x");
  assert.equal(unknown.ok, false); assert.match(unknown.reason, /isn't a chord type I know/);
  assert.equal(parseChordName("").ok, false);
  assert.equal(parseChordName("   ").ok, false);
  assert.equal(parseChordName("  Am  ").text, "Am", "surrounding space is dropped");
});

test("CR-SYMBOLS-06 a refusal offers the nearest chord type but never applies it", () => {
  const r = parseChordName("Cmaj7x");
  assert.equal(r.ok, false); assert.match(r.reason, /Did you mean Cmaj7/);
  assert.equal(r.sym, undefined, "offered, not applied");
  assert.equal(nearestSuffix("maj7x"), "maj7");
  assert.equal(nearestSuffix("zzz"), null, "nothing close, nothing offered");
  assert.match(parseChordName("Dozz", "solfege").reason, /isn't a chord type I know/);
  assert.match(parseChordName("Bbxq").reason, /^"xq" isn't a chord type I know\.$/, "no suggestion when none is near");
});

test("CR-SYMBOLS-07 a line from a chart is split on spaces, commas and bar lines, ignoring dashes, and keeps each chord's verdict", () => {
  const got = parseChordNames("Bm7 | F#m7, Fmaj7 - Q  /  Em");
  assert.deepEqual(got.map((c) => c.text), ["Bm7", "F#m7", "Fmaj7", "Q", "Em"]);
  assert.deepEqual(got.map((c) => c.ok), [true, true, true, false, true]);
  assert.deepEqual(parseChordNames(""), []);
  assert.deepEqual(parseChordNames(" , | "), []);
  assert.deepEqual(parseChordNames("Do Mi", "solfege").map((c) => c.rootPc), [0, 4]);
});

test("CR-SYMBOLS-08 typedLabel writes a typed chord as the app writes it, with its slash bass only when it differs from the root", () => {
  assert.equal(typedLabel({ rootPc: 0, sym: "maj7", bassPc: null }, "letters"), "Cmaj7");
  assert.equal(typedLabel({ rootPc: 0, sym: "", bassPc: 4 }, "letters"), "C/E");
  assert.equal(typedLabel({ rootPc: 0, sym: "", bassPc: 0 }, "letters"), "C", "a bass equal to the root says nothing");
  assert.equal(typedLabel({ rootPc: 0, sym: "" }, "letters"), "C", "no bass given");
  assert.equal(typedLabel({ rootPc: 4, sym: "m", bassPc: 7 }, "solfege"), "Mim/Sol");
  for (let r = 0; r < 12; r++) assert.equal(typedLabel({ rootPc: r, sym: "m7", bassPc: null }, "letters"), chordLabel(r, "m7", "letters"));
});

test("CR-SYMBOLS-09 a symbol typed, labelled and typed again is the same chord", () => {
  for (const d of DICTIONARY) for (const r of [0, 3, 6, 9]) for (const bass of [null, pc(r + 7)]) {
    const first = parseChordName(typedLabel({ rootPc: r, sym: d.q, bassPc: bass }, "letters"));
    assert.equal(first.ok, true);
    assert.deepEqual([first.rootPc, first.sym, first.bassPc], [r, d.q, bass], `${d.q} on ${r}/${bass}`);
  }
});

test("CR-SYMBOLS-10 the typing chips offer the characters a phone keyboard makes awkward", () => {
  assert.ok(TYPING_CHIPS.length >= 8);
  for (const [label, inserted] of TYPING_CHIPS) assert.ok(label && typeof inserted === "string");
  const inserts = TYPING_CHIPS.map((c) => c[1]);
  for (const ch of ["#", "b", "/", " "]) assert.ok(inserts.includes(ch), `chip for ${JSON.stringify(ch)}`);
  assert.equal(TYPING_CHIPS.find((c) => c[0] === "♭")[1], "b", "the flat sign types an ASCII b, which the reader accepts");
});

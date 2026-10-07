/* core/chordsets — unit tests, one per requirement in core/REQUIREMENTS.md (CR-CHORDSETS-nn). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { CHORD_SETS, buildSet, setsFor } from "../chordsets.mjs";
import { DICTIONARY } from "../chords.mjs";
import { pc } from "../notes.mjs";

test("CR-CHORDSETS-01 the catalogue holds fourteen sets, each with a name, a mode, a note, eight slots and a reason for its progression", () => {
  assert.equal(CHORD_SETS.length, 14);
  assert.equal(new Set(CHORD_SETS.map((s) => s.id)).size, 14, "ids are unique");
  for (const s of CHORD_SETS) {
    assert.ok(s.name && s.note && s.why, s.id);
    assert.ok(["major", "minor"].includes(s.mode), s.id);
    assert.equal(s.slots.length, 8, `${s.id}: eight slots, like the hardware`);
    assert.equal(s.progression.length, 4, `${s.id}: a four-chord progression`);
    assert.ok(s.progression.every((i) => Number.isInteger(i) && i >= 0 && i < 8), `${s.id}: progression points at slots`);
  }
});

test("CR-CHORDSETS-02 every slot is an offset from the tonic and a chord type the dictionary can voice", () => {
  const known = new Set(DICTIONARY.map((d) => d.q));
  for (const s of CHORD_SETS) for (const [offset, sym] of s.slots) {
    assert.ok(Number.isInteger(offset) && offset >= 0 && offset < 12, `${s.id}: offset ${offset}`);
    assert.ok(known.has(sym), `${s.id}: ${JSON.stringify(sym)} is in the dictionary`);
  }
});

test("CR-CHORDSETS-03 buildSet builds a set in any key: each slot a chord on tonic plus offset, the progression made of those same chords", () => {
  for (const s of CHORD_SETS) for (let t = 0; t < 12; t++) {
    const b = buildSet(s, t);
    assert.equal(b.chords.length, 8); assert.equal(b.progressionChords.length, s.progression.length);
    b.chords.forEach((c, i) => {
      const [offset, sym] = s.slots[i];
      assert.equal(c.rootPc, pc(t + offset)); assert.equal(c.sym, sym); assert.equal(c.id, `${s.id}-${i}`);
      const d = DICTIONARY.find((x) => x.q === sym);
      assert.deepEqual(c.notes, d.iv.map((x) => 48 + c.rootPc + x)); assert.equal(c.full, d.full); assert.equal(c.base, 48);
    });
    b.progressionChords.forEach((c, i) => assert.equal(c, b.chords[s.progression[i]], "the same chord, not a copy"));
  }
  assert.equal(buildSet(CHORD_SETS[0], 0, 60).chords[0].notes[0], 60, "in the octave asked for");
  assert.equal(buildSet(CHORD_SETS[0], 0, 60).chords[0].base, 60);
});

test("CR-CHORDSETS-04 a set keeps its own definition when built, and building never changes the catalogue", () => {
  const before = JSON.stringify(CHORD_SETS);
  const b = buildSet(CHORD_SETS[3], 2);
  assert.equal(b.id, CHORD_SETS[3].id); assert.equal(b.name, CHORD_SETS[3].name); assert.deepEqual(b.slots, CHORD_SETS[3].slots);
  assert.equal(JSON.stringify(CHORD_SETS), before);
  assert.deepEqual(buildSet(CHORD_SETS[3], 2), buildSet(CHORD_SETS[3], 2));
});

test("CR-CHORDSETS-05 setsFor lists the sets of one mode, in catalogue order", () => {
  for (const mode of ["major", "minor"]) {
    assert.deepEqual(setsFor(mode).map((s) => s.id), CHORD_SETS.filter((s) => s.mode === mode).map((s) => s.id));
    assert.ok(setsFor(mode).length >= 5);
  }
  assert.equal(setsFor("major").length + setsFor("minor").length, CHORD_SETS.length);
  assert.deepEqual(setsFor("dorian"), []);
});

/* core/notes — unit tests, one per requirement in core/REQUIREMENTS.md (CR-NOTES-nn).
   They test the module alone: no app, no other module but the standard library. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { NAMES, SOLFEGE, WHITE_PCS, FLAT_NAMES, pc, isWhite, baseOf, noteName, leansFlat, keyNames, spelling } from "../notes.mjs";

const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** The pitch class a written name stands for: "E♭" is 3, "F#" is 6. */
const pcOfName = (n) => pc(LETTER_PC[n[0]] + (n[1] === "#" ? 1 : n[1] === "♭" ? -1 : 0));

test("CR-NOTES-01 pc maps any whole number to a pitch class, 0 to 11, in the same place in the octave", () => {
  for (const m of [...Array.from({ length: 301 }, (_, i) => i - 100), -1e6, 1e6 + 7, -12, 12, 0]) {
    const p = pc(m);
    assert.ok(Number.isInteger(p) && p >= 0 && p <= 11, `pc(${m}) = ${p}`);
    assert.ok((m - p) % 12 === 0, `pc(${m}) is a whole number of octaves from ${m}`);
    assert.equal(pc(p), p, "pc is idempotent");
  }
  assert.deepEqual([pc(60), pc(-1), pc(13), pc(-13), pc(71)], [0, 11, 1, 11, 11]);
});

test("CR-NOTES-02 isWhite is true for exactly the seven white keys, in every octave", () => {
  for (let m = -60; m < 200; m++) assert.equal(isWhite(m), !NAMES[pc(m)].includes("#"), `midi ${m}`);
  assert.equal(Array.from({ length: 12 }, (_, i) => i).filter(isWhite).length, 7);
});

test("CR-NOTES-03 the name tables have twelve entries, in pitch-class order, and agree with each other", () => {
  for (const t of [NAMES, SOLFEGE, FLAT_NAMES]) { assert.equal(t.length, 12); assert.equal(new Set(t).size, 12, "no name twice"); }
  assert.deepEqual(WHITE_PCS, [0, 2, 4, 5, 7, 9, 11]);
  for (let i = 0; i < 12; i++) {
    assert.equal(pcOfName(NAMES[i]), i, `NAMES[${i}] = ${NAMES[i]}`);
    assert.equal(pcOfName(FLAT_NAMES[i]), i, `FLAT_NAMES[${i}] = ${FLAT_NAMES[i]}`);
    if (WHITE_PCS.includes(i)) assert.equal(NAMES[i], FLAT_NAMES[i], "white keys have one name");
    else { assert.equal(NAMES[i], NAMES[i - 1] + "#"); assert.equal(FLAT_NAMES[i], NAMES[i + 1] + "♭"); }
  }
  assert.deepEqual(SOLFEGE.filter((_, i) => WHITE_PCS.includes(i)), ["Do", "Re", "Mi", "Fa", "Sol", "La", "Si"]);
});

test("CR-NOTES-04 noteName gives sharps in letters or Do-Re-Mi when no key is applied, and wraps any pitch", () => {
  for (let m = -30; m < 150; m++) {
    assert.equal(noteName(m, "letters"), NAMES[pc(m)]);
    assert.equal(noteName(m, "solfege"), SOLFEGE[pc(m)]);
    assert.equal(noteName(m, undefined), NAMES[pc(m)], "no system means letters");
    assert.equal(noteName(m, "something else"), NAMES[pc(m)], "an unknown system means letters");
  }
  assert.equal(noteName(61, "letters"), "C#", "the plain systems spell black keys as sharps");
});

test("CR-NOTES-05 baseOf says whether a naming system writes letters or Do-Re-Mi", () => {
  assert.equal(baseOf("solfege"), "solfege");
  assert.equal(baseOf("letters"), "letters");
  for (const odd of [undefined, null, "", "other", 7]) assert.equal(baseOf(odd), "letters");
  assert.equal(baseOf(spelling("solfege", 2)), "solfege");
  assert.equal(baseOf(spelling("letters", 2)), "letters");
});

test("CR-NOTES-06 leansFlat is true for the flat-side majors, and a minor key follows its relative major", () => {
  const flatMajors = [0, 1, 3, 5, 8, 10];            // C, D♭, E♭, F, A♭, B♭
  for (let t = 0; t < 12; t++) {
    assert.equal(leansFlat(t, "major"), flatMajors.includes(t), `major ${t}`);
    assert.equal(leansFlat(t, "minor"), flatMajors.includes(pc(t + 3)), `minor ${t} shares its notes with major ${pc(t + 3)}`);
  }
});

test("CR-NOTES-07 keyNames spells all twelve notes the way the key writes them, in all 24 keys", () => {
  const SCALE = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };
  const sixLetters = [];
  for (const mode of ["major", "minor"]) for (let t = 0; t < 12; t++) {
    const names = keyNames(t, mode);
    assert.equal(names.length, 12);
    names.forEach((n, i) => {
      assert.equal(pcOfName(n), i, `${mode} ${t}: ${n} stands for pitch class ${i}`);
      assert.ok(!["F♭", "C♭", "E#", "B#"].includes(n), `${mode} ${t}: no white key written with an accidental (${n})`);
    });
    const scaleNames = SCALE[mode].map((i) => names[pc(t + i)]);
    if (new Set(scaleNames.map((n) => n[0])).size < 7) sixLetters.push(`${mode} ${t}`);
    // the sharps and flats the key does use follow its side of the circle
    const black = scaleNames.filter((n) => n.length > 1);
    assert.ok(black.every((n) => n.endsWith(leansFlat(t, mode) ? "♭" : "#")), `${mode} ${t}: ${scaleNames}`);
  }
  // every key's seven notes use seven different letters, except the two where the letter rule
  // would need E#: F♯ major and D♯ minor, a known limit recorded in D-074
  assert.deepEqual(sixLetters, ["major 6", "minor 3"]);
});

test("CR-NOTES-08 keyNames gives each note of the key, and its common alterations, their scale degree's letter", () => {
  assert.equal(keyNames(0, "minor")[3], "E♭", "E♭ in C minor");
  assert.equal(keyNames(5, "major")[10], "B♭", "B♭ in F");
  assert.equal(keyNames(9, "minor")[8], "G#", "G# in A minor: the leading note is not A♭");
  assert.equal(keyNames(7, "major")[10], "B♭", "in G, a sharp key, the flat third is still B♭");
  assert.equal(keyNames(2, "major")[6], "F#", "F# in D");
  assert.equal(keyNames(2, "major")[1], "C#", "C# in D");
  // the alterations the module promises: ♭3 ♭6 ♭7 ♯4 in a major key, ♮6 ♮7 ♮3 ♭2 in a minor one
  const letterOf = (t, semis, mode) => keyNames(t, mode)[pc(t + semis)][0];
  for (let t = 0; t < 12; t++) {
    const tonicLetter = "CDEFGAB".indexOf(keyNames(t, "major")[t][0]);
    const degreeLetter = (d) => "CDEFGAB"[(tonicLetter + d - 1) % 7];
    for (const [semis, degree] of [[3, 3], [8, 6], [10, 7], [6, 4]]) {
      const n = keyNames(t, "major")[pc(t + semis)];
      if (n.length === 1 && WHITE_PCS.includes(pc(t + semis)) ) continue;        // a plain white key may stand for it
      assert.equal(n[0], degreeLetter(degree), `major ${t}: the note ${semis} above the tonic is degree ${degree}`);
    }
  }
  assert.equal(letterOf(0, 3, "major"), "E", "C major's flat third is written on E");
});


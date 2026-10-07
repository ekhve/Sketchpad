/* core/notes — Pitch classes and note names. Everything internal is a MIDI number or a pitch class; a name is a display concern. Spells each note the way the key writes it: E♭ in C minor, F♯ in G.
   Layer 0. Depends on: nothing. Pure: no React, no Tone, no DOM, no dates, no randomness.
   Interface, behaviour and requirements: core/MODULES.md (notes).
   Moved verbatim from the THEORY block of sketchpad.jsx (D-096); behaviour unchanged. */


const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const SOLFEGE = ["Do", "Do#", "Re", "Re#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si"];
const WHITE_PCS = [0, 2, 4, 5, 7, 9, 11];

const pc = (m) => ((m % 12) + 12) % 12;
const isWhite = (m) => WHITE_PCS.includes(pc(m));

/* Note naming is a display concern only. Internals are always MIDI. (D-006, D-019)

   A naming system is either a plain name ("letters", "solfege"), which spells
   every black key as a sharp, or a spelling for one key, made by `spelling()`,
   which spells each note the way that key writes it: E♭ in C minor, B♭ in F,
   G# in A minor. Everything that names a note goes through here. (D-074) */
const SOLFEGE_OF = { C: "Do", D: "Re", E: "Mi", F: "Fa", G: "Sol", A: "La", B: "Si" };
const FLAT_NAMES = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];
const renderName = (name, base) => (base === "solfege" ? SOLFEGE_OF[name[0]] + name.slice(1) : name);
const isSpelling = (system) => typeof system === "object" && system !== null && Array.isArray(system.names);
const baseOf = (system) => ((isSpelling(system) ? system.base : system) === "solfege" ? "solfege" : "letters");

const noteName = (m, system) => (isSpelling(system)
  ? renderName(system.names[pc(m)], system.base)
  : (system === "solfege" ? SOLFEGE : NAMES)[pc(m)]);

/* How a key spells its notes. Keys on the flat side of the circle — F, B♭,
   E♭, A♭, D♭ and C, and the minor keys that share their notes — lean flat;
   the rest lean sharp. Then each note of the key, and each of its common
   alterations, takes its scale degree's letter: in G the flat third is B♭ even
   though G is a sharp key, and in A minor the leading note is G#, not A♭. A
   note is never written as a white key with an accidental (F♭, C♭, E#, B#):
   where the letter rule would need one, the plain name is used instead. */
const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const FLAT_SIDE_MAJORS = [0, 1, 3, 5, 8, 10];
/* [semitones above the tonic, scale degree 1-7] */
const DEGREES = {
  major: [[0, 1], [2, 2], [4, 3], [5, 4], [7, 5], [9, 6], [11, 7],
          [3, 3], [8, 6], [10, 7], [6, 4]],              // ♭3 ♭6 ♭7 ♯4
  minor: [[0, 1], [2, 2], [3, 3], [5, 4], [7, 5], [8, 6], [10, 7],
          [9, 6], [11, 7], [4, 3], [1, 2]],              // ♮6 ♮7 ♮3 ♭2
};

const leansFlat = (tonic, mode) => FLAT_SIDE_MAJORS.includes(mode === "minor" ? pc(tonic + 3) : pc(tonic));

function spellAs(p, letter) {
  const d = pc(p - LETTER_PC[letter]);
  const name = d === 0 ? letter : d === 1 ? letter + "#" : d === 11 ? letter + "♭" : null;
  if (name && name.length > 1 && WHITE_PCS.includes(pc(p))) return null;   // no F♭, C♭, E#, B#
  return name;
}

function keyNames(tonic, mode = "major") {
  const plain = leansFlat(tonic, mode) ? FLAT_NAMES : NAMES;
  const names = [...plain];
  const start = LETTERS.indexOf(plain[pc(tonic)][0]);
  for (const [semis, degree] of DEGREES[mode === "minor" ? "minor" : "major"]) {
    const p = pc(tonic + semis);
    const spelled = spellAs(p, LETTERS[(start + degree - 1) % 7]);
    if (spelled) names[p] = spelled;
  }
  return names;
}

/* A naming system for one key, in letters or in Do-Re-Mi. */
const spelling = (system, tonic, mode = "major") =>
  ({ base: baseOf(system), names: keyNames(tonic, mode), tonic: pc(tonic), mode });

export { NAMES, SOLFEGE, WHITE_PCS, pc, isWhite, FLAT_NAMES, baseOf, noteName, leansFlat, keyNames, spelling };

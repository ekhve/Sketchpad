import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import * as Tone from "tone";

/* THEORY:START — this block is extracted verbatim into theory.mjs for testing.
   Keep it pure: no React, no Tone, no DOM, no randomness, no dates. (DESIGN §4, §6)
   ========================================================================== */

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
const chordLabel = (rootPc, sym, system) => noteName(rootPc, system) + sym;

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

const SCALES = [
  { id: "natural-minor", name: "Natural minor", iv: [0, 2, 3, 5, 7, 8, 10], mode: "minor",
    mood: "Dark, emotional, familiar", tags: ["hip-hop", "dark", "cinematic"] },
  { id: "minor-pentatonic", name: "Minor pentatonic", iv: [0, 3, 5, 7, 10], mode: "minor",
    mood: "Simple, strong, hard to get wrong", tags: ["hip-hop", "west coast", "melody"] },
  { id: "dorian", name: "Dorian", iv: [0, 2, 3, 5, 7, 9, 10], mode: "minor",
    mood: "Minor but brighter, groovy", tags: ["funk", "soul", "house"] },
  { id: "harmonic-minor", name: "Harmonic minor", iv: [0, 2, 3, 5, 7, 8, 11], mode: "minor",
    mood: "Dramatic, tense, pulls hard home", tags: ["cinematic", "dark"] },
  { id: "phrygian", name: "Phrygian", iv: [0, 1, 3, 5, 7, 8, 10], mode: "minor",
    mood: "Dark, tense, exotic", tags: ["dark", "trap"] },
  { id: "blues", name: "Blues", iv: [0, 3, 5, 6, 7, 10], mode: "minor",
    mood: "Raw and expressive", tags: ["blues", "funk", "soul"] },
  { id: "major", name: "Major", iv: [0, 2, 4, 5, 7, 9, 11], mode: "major",
    mood: "Bright, open, resolved", tags: ["pop", "gospel"] },
  { id: "major-pentatonic", name: "Major pentatonic", iv: [0, 2, 4, 7, 9], mode: "major",
    mood: "Sweet and uncluttered", tags: ["pop", "soul", "melody"] },
  { id: "mixolydian", name: "Mixolydian", iv: [0, 2, 4, 5, 7, 9, 10], mode: "major",
    mood: "Major with a bluesy edge", tags: ["funk", "soul", "rock"] },
  { id: "lydian", name: "Lydian", iv: [0, 2, 4, 6, 7, 9, 11], mode: "major",
    mood: "Floating, filmic, dreamy", tags: ["cinematic", "neo-soul"] },
];

const scaleById = (id) => SCALES.find((s) => s.id === id);
const scalePcs = (tonic, id) => scaleById(id).iv.map((i) => pc(tonic + i));

const QUALITIES = {
  "0,4,7": { sym: "", full: "major" },
  "0,3,7": { sym: "m", full: "minor" },
  "0,3,6": { sym: "dim", full: "diminished" },
  "0,4,8": { sym: "aug", full: "augmented" },
  "0,4,7,11": { sym: "maj7", full: "major 7th" },
  "0,3,7,10": { sym: "m7", full: "minor 7th" },
  "0,4,7,10": { sym: "7", full: "dominant 7th" },
  "0,3,6,10": { sym: "m7♭5", full: "half-diminished" },
  "0,3,6,9": { sym: "dim7", full: "diminished 7th" },
  "0,3,7,11": { sym: "mMaj7", full: "minor-major 7th" },
  "0,4,8,11": { sym: "maj7♯5", full: "augmented major 7th" },
  "0,2,4,7,11": { sym: "maj9", full: "major 9th" },
  "0,2,3,7,10": { sym: "m9", full: "minor 9th" },
  "0,2,4,7,10": { sym: "9", full: "dominant 9th" },
  "0,1,3,6,10": { sym: "m7♭5♭9", full: "half-diminished flat 9" },
  "0,1,3,7,10": { sym: "m7♭9", full: "minor 7th flat 9" },
  "0,2,7": { sym: "sus2", full: "suspended 2nd" },   // was "0,2,5,7", which is sus4(9) below: the key clashed and sus2 vanished (D-074)
  "0,5,7": { sym: "sus4", full: "suspended 4th" },
  "0,4,7,9": { sym: "6", full: "major 6th" },
  "0,3,7,9": { sym: "m6", full: "minor 6th" },
  "0,2,4,7,9": { sym: "6/9", full: "six-nine" },
  "0,2,4,7": { sym: "add9", full: "added 9th" },
  "0,2,3,7": { sym: "m(add9)", full: "minor added 9th" },
  "0,2,3,5,7,10": { sym: "m11", full: "minor 11th" },
  "0,2,4,7,9,11": { sym: "maj13", full: "major 13th" },
  "0,2,4,7,9,10": { sym: "13", full: "dominant 13th" },
  "0,2,3,7,9,10": { sym: "m13", full: "minor 13th" },
  "0,2,4,6,7,11": { sym: "maj7♯11", full: "major 7 sharp 11" },
  "0,1,4,7,10": { sym: "7♭9", full: "dominant flat 9" },
  "0,3,4,7,10": { sym: "7♯9", full: "dominant sharp 9" },
  "0,2,5,7": { sym: "sus4(9)", full: "suspended with 9th" },
  "0,4,6,7,11": { sym: "maj7♯11", full: "major 7 sharp 11" },          // D-077: the dictionary's voicing, which has no 9th
  "0,5,7,10": { sym: "7sus4", full: "dominant 7th, suspended" },          // D-077: G7sus4, everywhere in soul and funk
  "0,2,5,7,10": { sym: "9sus4", full: "dominant 9th, suspended" },        // D-077: D9sus4, written D7(4/9) or D7sus4(9)
};

const MAJOR_REF = [0, 2, 4, 5, 7, 9, 11];
const NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII"];

function romanFor(tonic, rootPc, degreeIndex, sym) {
  const offset = pc(rootPc - tonic);
  let base = NUMERALS[degreeIndex];
  const acc = offset < MAJOR_REF[degreeIndex] ? "♭" : offset > MAJOR_REF[degreeIndex] ? "♯" : "";
  /* "maj7" starts with an m too: minor means m not followed by aj (D-077). */
  if (/^m(?!aj)/.test(sym) || sym.startsWith("dim")) base = base.toLowerCase();
  return acc + base + (sym.startsWith("dim") ? "°" : sym === "aug" ? "+" : "");
}

/* Chords are built in whichever octave the keyboard is showing. They used to
   be pinned to C3 regardless, so shifting the keyboard moved the picture and
   left the sound where it was. (D-007, D-060) */
const DEFAULT_BASE = 48;

function voice(rootPc, intervals, base = DEFAULT_BASE) {
  const root = base + rootPc;
  return intervals.map((i) => root + i);
}

/* Stack scale tones upward instead of folding them into one octave. A ninth
   has to sit above the seventh; reduced to a pitch class it becomes a second
   and the chord turns to mud. (D-035) */
function stackAscending(tones, rootPc) {
  let last = -1;
  return tones.map((t) => {
    let i = pc(t - rootPc);
    while (i <= last) i += 12;
    last = i;
    return i;
  });
}

/* The diatonic chords of any seven-note interval set. Split out from
   `harmonize` so a scale the user invented can be harmonised too. (D-048) */
function harmonizeIntervals(tonic, iv, size, idPrefix = "custom", base = DEFAULT_BASE) {
  if (!iv || iv.length !== 7) return [];
  const notes = iv.map((i) => pc(tonic + i));
  const idx = size === 5 ? [0, 2, 4, 6, 8] : size === 4 ? [0, 2, 4, 6] : [0, 2, 4];
  return notes.map((rootPc, i) => {
    const tones = idx.map((k) => notes[(i + k) % 7]);
    const intervals = tones.map((t) => pc(t - rootPc)).sort((a, b) => a - b);
    const q = QUALITIES[intervals.join(",")] || { sym: "?", full: "unusual" };
    return {
      id: `${idPrefix}-${i}-${size}`,
      rootPc, sym: q.sym, full: q.full,
      degreeIndex: i,
      roman: romanFor(tonic, rootPc, i, q.sym),
      notes: voice(rootPc, stackAscending(tones, rootPc), base),
      base,
    };
  });
}

/* The diatonic chords of a named scale. (UC-05) */
function harmonize(tonic, scaleId, size, base = DEFAULT_BASE) {
  return harmonizeIntervals(tonic, scaleById(scaleId).iv, size, scaleId, base);
}

/* Written as phrases, not sentences, so an explanation can add the shared-note
   clause without becoming a paragraph. The two-sentence cap in D-011 was being
   broken by two thirds of all explanations before this. (D-051) */
const MINOR_ROLES = [
  "Home, dark and settled",
  "Unstable, and wanting to move",
  "A bright lift, the relative major",
  "Soft and moody, easy to move to",
  "Tense, and pulling back home",
  "Warm and open, a producer favourite",
  "Big and anthemic, setting up a return",
];
const MAJOR_ROLES = [
  "Home, stable and bright",
  "Gentle motion away from home",
  "Wistful, bright with a sad edge",
  "Open and lifting",
  "A strong pull back home",
  "The sad one — same notes, darker mood",
  "Unstable, and rarely used alone",
];

/* Why does this chord work here? (D-011, D-025, UC-14)

   Two different questions get confused if you only track one scale:
     - Is this chord in the KEY? A harmonic question. Judged against the
       parent scale (natural minor or major), never against the user's
       current melodic palette.
     - Is every chord tone in the PALETTE the user picked for melodies?
       A separate, softer question. Minor pentatonic is a subset of the key,
       so a perfectly diatonic chord will contain notes it doesn't have —
       and calling that "outside the scale" is simply wrong. */
function explainChord(chord, ctx, system = "letters") {
  const parentId = ctx.mode === "minor" ? "natural-minor" : "major";
  const keyNotes = scalePcs(ctx.tonic, parentId);
  const paletteNotes = scalePcs(ctx.tonic, ctx.scaleId);
  const chordPcs = chord.notes.map(pc);

  const outside = chordPcs.filter((p) => !keyNotes.includes(p));
  const outsidePalette = chordPcs.filter((p) => !paletteNotes.includes(p) && !outside.includes(p));

  const nm = (p) => noteName(p, system);
  const label = chordLabel(chord.rootPc, chord.sym, system);
  const tonicTriad = [0, ctx.mode === "minor" ? 3 : 4, 7].map((i) => pc(ctx.tonic + i));
  const shared = chordPcs.filter((p) => tonicTriad.includes(p));
  const roles = ctx.mode === "minor" ? MINOR_ROLES : MAJOR_ROLES;
  const paletteName = scaleById(ctx.scaleId).name.toLowerCase();

  if (outside.length) {
    return {
      head: `${label} — outside the key`,
      plain: `${outside.map(nm).join(" and ")} ${outside.length > 1 ? "are" : "is"} not in ${nm(ctx.tonic)} ${ctx.mode}. That clash is usually the point — it creates a pull back home.`,
      formal: `Non-diatonic: ${outside.map(nm).join(", ")}. Borrowed or chromatic colour.`,
      outside, outsidePalette,
    };
  }

  const base = (roles[chord.degreeIndex] || "chord") + (shared.length
    ? `, sharing ${shared.map(nm).join(" and ")} with home so it slides in smoothly.`
    : ", with nothing in common with home, so it feels like a real move.");

  const paletteNote = outsidePalette.length
    ? ` ${outsidePalette.map(nm).join(" and ")} ${outsidePalette.length > 1 ? "are" : "is"} outside the ${paletteName} you picked, but the chord is still fully in key.`
    : "";

  return {
    head: `${label} — ${chord.full}`,
    plain: base + paletteNote,
    formal: `${chord.roman} in ${nm(ctx.tonic)} ${ctx.mode}. Notes: ${chord.notes.map((m) => nm(pc(m))).join(" ")}.`,
    outside, outsidePalette,
  };
}

/* Which scales contain everything the progression uses? (UC-21) */
function fitScales(progression, tonic) {
  const used = [...new Set(progression.flatMap((c) => c.notes.map(pc)))];
  if (!used.length) return [];
  return SCALES.map((s) => {
    const notes = scalePcs(tonic, s.id);
    const covered = used.filter((p) => notes.includes(p));
    return { scale: s, fit: covered.length / used.length, missing: used.filter((p) => !notes.includes(p)) };
  }).sort((a, b) => b.fit - a.fit || a.scale.iv.length - b.scale.iv.length).slice(0, 5);
}

/* ============================================================================
   RHYTHM AND FIGURES — basslines and riffs. (D-022, D-023, UC-29)

   Two ingredients, deliberately separated:
     PATTERN — authored rhythm and intent. Says "root on 1, chord tone on the
               and-of-2, approach the next chord at the end". Says nothing
               about pitch, so one pattern works over every chord in every key.
     RULES   — resolve each intent to an actual note using the current chord,
               the next chord, and the active scale.

   Authored rhythm is what makes a figure sound like a genre; generated pitch
   is what makes it fit the user's harmony. Doing both by rule sounds generic;
   doing both by hand doesn't transpose. (D-023)
   ========================================================================== */

const STEPS_PER_BAR = 16;                     // sixteenth notes

/* Seeded so "suggest again" is reproducible and testable. Pure: same seed in,
   same figure out — no Math.random anywhere in this file. */
function rng(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PATTERNS = [
  /* --- bass --- */
  { id: "bass-anchor", name: "Anchored", kind: "bass", styles: ["hip-hop", "cinematic"],
    note: "Root on the downbeat and nothing clever, letting the drums breathe.",
    steps: [{ p: 0, d: 6, r: "root" }, { p: 8, d: 6, r: "root" }] },

  { id: "bass-octave", name: "Octave push", kind: "bass", styles: ["house", "funk"],
    note: "Root and its octave alternating — the engine of four-to-the-floor.",
    steps: [{ p: 0, d: 2, r: "root" }, { p: 4, d: 2, r: "octave" },
            { p: 8, d: 2, r: "root" }, { p: 12, d: 2, r: "octave" }] },

  { id: "bass-walk", name: "Walk to the next chord", kind: "bass", styles: ["soul", "west coast"],
    note: "Sits on the root, then steps up to meet the next chord.",
    steps: [{ p: 0, d: 4, r: "root" }, { p: 6, d: 2, r: "fifth" },
            { p: 10, d: 2, r: "chordTone" }, { p: 14, d: 2, r: "approach" }] },

  { id: "bass-sixteenths", name: "Syncopated", kind: "bass", styles: ["funk", "soul"],
    note: "Sixteenth-note push and pull, leaving holes on purpose.",
    steps: [{ p: 0, d: 1, r: "root" }, { p: 3, d: 1, r: "root" },
            { p: 6, d: 2, r: "fifth" }, { p: 10, d: 1, r: "root" },
            { p: 11, d: 1, r: "octave" }, { p: 14, d: 2, r: "approach" }] },

  { id: "bass-hold", name: "Held root", kind: "bass", styles: ["cinematic", "west coast"],
    note: "One note per chord, all bar, so everything else gets room.",
    steps: [{ p: 0, d: 16, r: "root" }] },

  /* --- melody --- */
  { id: "bass-dub", name: "Dub drop", kind: "bass", styles: ["house", "hip-hop"],
    note: "Nothing on the downbeat, because the space is the hook.",
    steps: [{ p: 2, d: 4, r: "root" }, { p: 10, d: 4, r: "fifth" }] },

  { id: "bass-eighths", name: "Rolling eighths", kind: "bass", styles: ["funk", "cinematic"],
    note: "Steady eighths that never stop, driving everything above them.",
    steps: [{ p: 0, d: 2, r: "root" }, { p: 2, d: 2, r: "root" },
            { p: 4, d: 2, r: "fifth" }, { p: 6, d: 2, r: "root" },
            { p: 8, d: 2, r: "root" }, { p: 10, d: 2, r: "octave" },
            { p: 12, d: 2, r: "fifth" }, { p: 14, d: 2, r: "approach" }] },

  { id: "bass-pushed", name: "Pushed", kind: "bass", styles: ["soul", "west coast"],
    note: "Lands just before the beat, making the whole loop lean forward.",
    steps: [{ p: 0, d: 3, r: "root" }, { p: 7, d: 2, r: "chordTone" },
            { p: 11, d: 2, r: "fifth" }, { p: 15, d: 1, r: "approach" }] },

  { id: "riff-hook", name: "Pentatonic hook", kind: "melody", styles: ["hip-hop", "west coast"],
    note: "A short repeating shape with chord tones on the strong beats.",
    steps: [{ p: 0, d: 2, r: "chordTone" }, { p: 2, d: 2, r: "step" },
            { p: 6, d: 2, r: "chordTone" }, { p: 10, d: 2, r: "step" },
            { p: 12, d: 4, r: "chordTone" }] },

  { id: "riff-sparse", name: "Sparse and late", kind: "melody", styles: ["soul", "cinematic"],
    note: "Enters after the beat, because space is most of the sound.",
    steps: [{ p: 2, d: 4, r: "top" }, { p: 8, d: 2, r: "step" }, { p: 11, d: 5, r: "chordTone" }] },

  { id: "riff-stabs", name: "Stabs", kind: "melody", styles: ["funk", "house"],
    note: "Percussive and off the grid, with rhythm doing the work.",
    steps: [{ p: 0, d: 1, r: "top" }, { p: 3, d: 1, r: "chordTone" },
            { p: 7, d: 1, r: "top" }, { p: 10, d: 1, r: "chordTone" }, { p: 11, d: 1, r: "step" }] },

  { id: "riff-rise", name: "Rising line", kind: "melody", styles: ["cinematic", "house"],
    note: "Climbs through the scale into the next chord.",
    steps: [{ p: 0, d: 2, r: "root" }, { p: 4, d: 2, r: "stepUp" },
            { p: 8, d: 2, r: "stepUp" }, { p: 12, d: 4, r: "approach" }] },

  { id: "riff-call", name: "Call and answer", kind: "melody", styles: ["soul", "hip-hop"],
    note: "A short phrase, a gap, then a reply a little lower.",
    steps: [{ p: 0, d: 2, r: "top" }, { p: 2, d: 2, r: "step" },
            { p: 8, d: 2, r: "chordTone" }, { p: 10, d: 4, r: "stepDown" }] },

  { id: "riff-motif", name: "Two-note motif", kind: "melody", styles: ["cinematic", "west coast"],
    note: "Two notes repeated, so that you remember them.",
    steps: [{ p: 0, d: 3, r: "chordTone" }, { p: 4, d: 3, r: "step" },
            { p: 8, d: 3, r: "chordTone" }, { p: 12, d: 3, r: "step" }] },

  { id: "riff-arp", name: "Arpeggio up", kind: "melody", styles: ["house", "cinematic"],
    note: "The chord one note at a time, climbing, never surprising.",
    steps: [{ p: 0, d: 2, r: "root" }, { p: 2, d: 2, r: "third" },
            { p: 4, d: 2, r: "fifth" }, { p: 6, d: 2, r: "top" },
            { p: 8, d: 2, r: "fifth" }, { p: 10, d: 2, r: "third" }] },

  { id: "riff-tumble", name: "Tumbling", kind: "melody", styles: ["funk", "hip-hop"],
    note: "Falls quickly through the scale and catches on a chord tone.",
    steps: [{ p: 0, d: 1, r: "top" }, { p: 1, d: 1, r: "stepDown" },
            { p: 2, d: 1, r: "stepDown" }, { p: 3, d: 1, r: "stepDown" },
            { p: 6, d: 2, r: "chordTone" }, { p: 12, d: 4, r: "chordTone" }] },

  { id: "riff-fall", name: "Falling line", kind: "melody", styles: ["soul", "west coast"],
    note: "Drops from the top of the chord down through the scale.",
    steps: [{ p: 0, d: 2, r: "top" }, { p: 4, d: 2, r: "stepDown" },
            { p: 8, d: 2, r: "stepDown" }, { p: 12, d: 4, r: "chordTone" }] },
];

const STYLES = ["hip-hop", "soul", "funk", "house", "west coast", "cinematic"];
const patternsFor = (kind, style) => PATTERNS.filter((p) => p.kind === kind && p.styles.includes(style));

/* Nearest midi with this pitch class to a reference note. Keeps figures from
   leaping an octave between consecutive notes. */
function place(pitchClass, near) {
  const base = near - (((near % 12) - pitchClass + 12) % 12);
  return Math.abs(base - near) <= Math.abs(base + 12 - near) ? base : base + 12;
}

/* Resolve one pattern over one chord. Pure. (UC-29) */
function renderFigure(pattern, chord, nextChord, scaleSet, seed, center) {
  const r = rng(seed);
  const rootPc = chord.rootPc;
  const intervals = chord.notes.map((m) => pc(m - chord.notes[0]));
  const has = (i) => intervals.includes(i);
  const third = has(3) ? 3 : has(4) ? 4 : null;
  const fifth = has(7) ? 7 : has(6) ? 6 : has(8) ? 8 : null;
  const out = [];
  let prev = null;

  for (const s of pattern.steps) {
    let midi = null;
    const ref = prev ?? center;

    switch (s.r) {
      case "root":
        midi = place(rootPc, center);
        break;
      case "octave":
        midi = place(rootPc, center) + 12;
        break;
      case "fifth":
        midi = fifth === null ? place(rootPc, ref) : place(pc(rootPc + fifth), ref);
        break;
      case "third":
        midi = third === null ? place(rootPc, ref) : place(pc(rootPc + third), ref);
        break;
      case "top":
        midi = place(pc(rootPc + intervals[intervals.length - 1]), ref);
        break;
      case "chordTone": {
        const i = intervals[Math.floor(r() * intervals.length)];
        midi = place(pc(rootPc + i), ref);
        break;
      }
      case "step":
      case "stepUp":
      case "stepDown": {
        /* move to an adjacent scale note; direction is the pattern's choice
           when it declares one, otherwise the seed decides */
        const up = s.r === "stepUp" ? true : s.r === "stepDown" ? false : r() < 0.5;
        const sorted = [...scaleSet].sort((a, b) => a - b);
        const here = prev === null ? place(rootPc, center) : prev;
        let cand = null;
        for (let k = 1; k <= 12 && cand === null; k++) {
          const test = here + (up ? k : -k);
          if (sorted.includes(pc(test))) cand = test;
        }
        midi = cand ?? here;
        break;
      }
      case "approach": {
        /* lean into the next chord: a semitone below its root, or the nearest
           scale note above it. This is the one place a note may leave the scale. */
        const target = nextChord ? nextChord.rootPc : rootPc;
        const t = place(target, ref);
        midi = r() < 0.6 ? t - 1 : t + 1;
        break;
      }
      default:
        continue;
    }
    if (midi === null) continue;
    out.push({ midi, pos: s.p, dur: s.d, role: s.r });
    prev = midi;
  }
  return out;
}

/* A figure for every chord in the progression. (UC-29) */
function renderProgressionFigure(pattern, progression, scaleSet, seed, center) {
  return progression.map((chord, i) =>
    renderFigure(pattern, chord, progression[(i + 1) % progression.length], scaleSet, seed + i * 7919, center)
  );
}

/* Explain a figure in plain language. (D-011) */
function explainFigure(pattern, figure, system = "letters") {
  const strong = figure.filter((n) => n.pos % 4 === 0);
  const approaches = figure.filter((n) => n.role === "approach");
  const bits = [pattern.note];
  if (strong.length) bits.push(`Lands on ${strong.map((n) => noteName(n.midi, system)).join(", ")} on the strong beats.`);
  if (approaches.length) bits.push("The last note leans into the next chord from a semitone away — that pull is what makes the change feel intended.");
  return bits.join(" ");
}

/* Fill channel: what the key is doing harmonically right now. (D-016, D-033)

   Matched on the ACTUAL note, not the pitch class. A chord is a voicing — a
   specific set of notes in a specific register (D-007) — and lighting every
   octave of every chord tone threw that away, filled the keyboard, and showed
   the user something they could not play back. The marker channel below stays
   pitch-class based, because a scale really is a palette rather than a voicing. */
function keyRole(midi, { chordNotes = [], chordRootMidi = -1, loopNotes = [], sounding = [], bass = [] }) {
  if (sounding.includes(midi)) return "sounding";
  if (bass.includes(midi)) return "bass";
  if (midi === chordRootMidi) return "chordRoot";
  if (chordNotes.includes(midi)) return "chordTone";
  if (loopNotes.includes(midi)) return "inLoop";
  return "plain";
}

/* Marker channel: what the active scale contains. (D-016) */
function keyMarker(midi, { tonic, scaleSet = [] }) {
  const p = pc(midi);
  if (p === tonic) return "home";
  if (scaleSet.includes(p)) return "scale";
  return null;
}


/* ============================================================================
   BAR SCHEDULING — pure, so the bug class that caused it can be tested. (D-031)

   Every event carries a start time and a duration in SECONDS, and no two events
   on the same voice may overlap. The previous version built duration strings
   like "4*16n" and handed them to the audio library's text parser, which is
   both fragile and free to produce a note longer than the gap before the next
   one — which is exactly how notes piled up until the synth ran out of voices.
   ========================================================================== */

const VOICES = ["chord", "bass", "riff"];

/* Chords sit under the melody rather than competing with it, so the mix is a
   property of the plan and can be checked like anything else. (D-034) */
const VELOCITY = { chord: 0.5, bass: 0.85, riff: 0.8 };

function planBar({ chordNotes = [], bassFigure = [], riffFigure = [],
                   sixteenth, barSeconds, gap = 0.05 }) {
  const events = [];

  if (chordNotes.length) {
    events.push({ voice: "chord", notes: [...chordNotes], at: 0,
                  dur: Math.max(0.1, barSeconds * 0.5 - gap), vel: VELOCITY.chord });
  }

  for (const [voice, figure] of [["bass", bassFigure], ["riff", riffFigure]]) {
    const sorted = [...figure].sort((a, b) => a.pos - b.pos);
    sorted.forEach((n, i) => {
      const at = n.pos * sixteenth;
      const nextAt = i + 1 < sorted.length ? sorted[i + 1].pos * sixteenth : barSeconds;
      /* never longer than the room available before the next note on this voice */
      const dur = Math.max(0.05, Math.min(n.dur * sixteenth, nextAt - at - gap));
      events.push({ voice, notes: [n.midi], at, dur, role: n.role, vel: VELOCITY[voice] });
    });
  }
  return events.sort((a, b) => a.at - b.at);
}

/* True when no voice is ever asked to hold two notes at once, and nothing
   spills past the end of the bar. (R-118) */
function planIsClean(events, barSeconds) {
  for (const voice of VOICES) {
    const v = events.filter((e) => e.voice === voice).sort((a, b) => a.at - b.at);
    for (let i = 0; i < v.length; i++) {
      if (v[i].dur <= 0) return false;
      if (v[i].at < 0 || v[i].at >= barSeconds) return false;
      if (i + 1 < v.length && v[i].at + v[i].dur > v[i + 1].at + 1e-9) return false;
    }
  }
  return true;
}


/* ============================================================================
   CHORD DICTIONARY, BASS ROLES, TRANSITIONS, INVERSIONS, CHORD SETS
   Everything the Chords, Bass and Theory tabs need. All pure. (D-035)
   ========================================================================== */

const DEGREE_NAMES = { 0:"1", 1:"♭2", 2:"2", 3:"♭3", 4:"3", 5:"4", 6:"♭5", 7:"5",
                       8:"♯5", 9:"6", 10:"♭7", 11:"7", 14:"9", 17:"11", 21:"13" };

/* The dictionary, in the order a learner meets them. */
const DICTIONARY = [
  { q: "",       full: "major",            iv: [0,4,7],        plain: "Bright and settled. The default happy sound." },
  { q: "m",      full: "minor",            iv: [0,3,7],        plain: "Darker. One note lower than major — the third." },
  { q: "dim",    full: "diminished",       iv: [0,3,6],        plain: "Unstable and tense. Wants to move somewhere." },
  { q: "aug",    full: "augmented",        iv: [0,4,8],        plain: "Unsettled, floating. Neither happy nor sad." },
  { q: "sus4",   full: "suspended 4th",    iv: [0,5,7],        plain: "No third, so no mood. Hangs, waiting to resolve." },
  { q: "sus2",   full: "suspended 2nd",    iv: [0,2,7],        plain: "Open and airy. Also has no third." },
  { q: "6",      full: "major 6th",        iv: [0,4,7,9],      plain: "Sweet and vintage. Major with a soft edge." },
  { q: "m6",     full: "minor 6th",        iv: [0,3,7,9],      plain: "Minor with a lift. Common in soul." },
  { q: "maj7",   full: "major 7th",        iv: [0,4,7,11],     plain: "Warm and dreamy. The neo-soul chord." },
  { q: "m7",     full: "minor 7th",        iv: [0,3,7,10],     plain: "Smooth and relaxed. Everywhere in house and R&B." },
  { q: "7",      full: "dominant 7th",     iv: [0,4,7,10],     plain: "Bluesy and restless. Pulls hard to the next chord." },
  { q: "m7♭5",   full: "half-diminished",  iv: [0,3,6,10],     plain: "Tense but usable. Often leads into a dominant." },
  { q: "maj9",   full: "major 9th",        iv: [0,4,7,11,14],  plain: "Lush. A major 7th with one more colour on top." },
  { q: "m9",     full: "minor 9th",        iv: [0,3,7,10,14],  plain: "Rich and moody. The sound of neo-soul keys." },
  { q: "9",      full: "dominant 9th",     iv: [0,4,7,10,14],  plain: "Funk in one chord. Dominant with extra bite.",
    voicing: [0,10,16,26] },
  { q: "add9",   full: "added 9th",         iv: [0,4,7,14],     plain: "Major with one bright note on top. No seventh, so it stays open.",
    voicing: [0,7,14,16] },
  { q: "m(add9)", full: "minor added 9th",  iv: [0,3,7,14],     plain: "Minor with the same lift. Wistful rather than sad.",
    voicing: [0,7,14,15] },
  { q: "6/9",    full: "six-nine",          iv: [0,4,7,9,14],   plain: "Neither resolved nor restless. The sound of a film fading out.",
    voicing: [0,4,9,14] },
  { q: "m11",    full: "minor 11th",        iv: [0,3,7,10,14,17], plain: "Stacked in fourths rather than thirds. Wide, modern, and hard to place.",
    voicing: [0,5,10,15,19] },
  { q: "maj13",  full: "major 13th",        iv: [0,4,7,11,14,21], plain: "The lushest chord here. Sounds like an ending that never arrives.",
    voicing: [0,11,16,21] },
  { q: "13",     full: "dominant 13th",     iv: [0,4,7,10,14,21], plain: "Dominant, but generous with it. Soul and gospel live here.",
    voicing: [0,10,16,21] },
  { q: "m13",    full: "minor 13th",        iv: [0,3,7,10,14,21], plain: "Dark underneath, bright on top. Very hard to get tired of.",
    voicing: [0,10,15,21] },
  { q: "maj7♯11", full: "major 7 sharp 11", iv: [0,4,7,11,18],  plain: "Floating and slightly strange. Lydian in a single chord.",
    voicing: [0,11,14,18] },
  { q: "7♭9",    full: "dominant flat 9",   iv: [0,4,7,10,13],  plain: "Tense and cinematic. Pulls somewhere dark.",
    voicing: [0,10,16,25] },
  { q: "7♯9",    full: "dominant sharp 9",  iv: [0,4,7,10,15],  plain: "Major and minor at once. Famously crunchy.",
    voicing: [0,10,16,27] },
  { q: "sus4(9)", full: "suspended with 9th", iv: [0,5,7,14],   plain: "No third at all, so it hangs. Sounds like a question.",
    voicing: [0,5,10,14] },
  { q: "dim7",   full: "diminished 7th",    iv: [0,3,6,9],      plain: "Every note three keys from the next, so it can lead almost anywhere." },
  { q: "mMaj7",  full: "minor-major 7th",   iv: [0,3,7,11],     plain: "Minor with a major seventh. The spy-film chord." },
  { q: "7sus4",  full: "dominant 7th, suspended", iv: [0,5,7,10], plain: "A dominant that hasn't decided yet. The fourth wants to drop to the third." },
  { q: "9sus4",  full: "dominant 9th, suspended", iv: [0,5,7,10,14], plain: "A dominant with the tension taken out. Soft and open: 70s soul and jazz-funk.",
    voicing: [0,10,14,17] },
];

function dictionaryFor(rootPc, base = DEFAULT_BASE) {
  return DICTIONARY.map((d) => ({
    id: `dict-${rootPc}-${d.q}`,
    rootPc, sym: d.q, full: d.full, plain: d.plain,
    formula: d.iv.map((i) => DEGREE_NAMES[i] ?? String(i)).join(" – "),
    notes: voice(rootPc, d.iv, base),
    base,
  }));
}

/* Inversions: lift the lowest note an octave until the root is back on top. */
function inversions(chord) {
  const names = ["Root position", "1st inversion", "2nd inversion", "3rd inversion", "4th inversion"];
  const out = [];
  let notes = [...chord.notes].sort((a, b) => a - b);
  for (let i = 0; i < Math.min(chord.notes.length, 4); i++) {
    out.push({
      name: names[i],
      notes: [...notes],
      bass: notes[0],
      why: i === 0
        ? "The root is lowest. The most settled version."
        : `${DEGREE_NAMES[pc(notes[0] - chord.rootPc)] ?? "?"} is in the bass. Same chord, different weight.`,
    });
    notes = [...notes.slice(1), notes[0] + 12];
  }
  return out;
}

/* What can the bass play under this chord, and how safe is each choice? */
const BASS_ROLES = {
  root:    { label: "Strongest", why: "The chord root — always safe" },
  fifth:   { label: "Stable",    why: "The fifth — solid but less obvious" },
  third:   { label: "Colour",    why: "The third — brings out the chord's mood" },
  seventh: { label: "Colour",    why: "The seventh — richer, leans forward" },
  passing: { label: "Passing",   why: "Scale note — good between chords" },
};

function bassOptions(chord, scaleSet) {
  const iv = chord.notes.map((m) => pc(m - chord.notes[0]));
  const out = [{ pc: chord.rootPc, role: "root", ...BASS_ROLES.root }];
  const add = (interval, role) => {
    if (interval === null) return;
    out.push({ pc: pc(chord.rootPc + interval), role, ...BASS_ROLES[role] });
  };
  add(iv.includes(7) ? 7 : iv.includes(6) ? 6 : iv.includes(8) ? 8 : null, "fifth");
  add(iv.includes(3) ? 3 : iv.includes(4) ? 4 : null, "third");
  add(iv.includes(10) ? 10 : iv.includes(11) ? 11 : null, "seventh");
  const taken = out.map((o) => o.pc);
  for (const p of scaleSet) {
    if (!taken.includes(p)) out.push({ pc: p, role: "passing", ...BASS_ROLES.passing });
  }
  return out;
}

const BASS_PARAGRAPH =
  "Your scale is the general set of notes you can use. The chord playing right now decides which of those sound strongest. " +
  "The root is safest, the fifth is stable, the third carries the mood, and anything else works best as a quick passing note that lands on a chord tone.";

/* Ways of getting from one chord to the next, in the bass. (UC-20) */
function bassTransitions(from, to, scaleSet) {
  const a = 36 + from.rootPc;
  const b = place(to.rootPc, a);
  const out = [];

  out.push({ name: "Direct", notes: [a, b],
             why: "Just land on it. Always works, never surprises anyone." });

  const sorted = [...scaleSet].sort((x, y) => x - y);
  const walk = [a];
  let cur = a;
  const up = b > a;
  let guard = 0;
  while (cur !== b && guard++ < 12) {
    let next = cur;
    for (let k = 1; k <= 12; k++) {
      const t = cur + (up ? k : -k);
      if (sorted.includes(pc(t))) { next = t; break; }
    }
    if (next === cur) break;
    cur = next;
    walk.push(cur);
    if ((up && cur >= b) || (!up && cur <= b)) break;
  }
  if (walk.length > 2) {
    out.push({ name: "Scale walk", notes: walk[walk.length - 1] === b ? walk : [...walk, b],
               why: "Step through the scale. Sounds inevitable rather than surprising." });
  }

  out.push({ name: "Fifth approach", notes: [a, place(pc(to.rootPc + 7), a), b],
             why: "Drop to the fifth of the next chord first. The strongest pull in music." });

  out.push({ name: "Chromatic", notes: [a, b - 1, b],
             why: "Slide in from a semitone below. Leaves the key for one beat, which is the point." });

  return out;
}

/* ---- chord sets: 8 slots plus a progression, authored in C and transposed.
   Structure borrowed from the J-6; the content is ours. (D-014) ---- */
const CHORD_SETS = [
  { id: "neo-soul", name: "Neo-soul keys", mode: "minor",
    note: "Extended minor chords with a maj7 lift. Slow, warm, harmonically rich.",
    slots: [[0,"m9"],[5,"m7"],[8,"maj7"],[10,"7"],[3,"maj9"],[7,"m7"],[2,"m7♭5"],[8,"maj9"]],
    progression: [0,2,4,3], why: "Home, then a warm lift, a bright step up, and a push back." },

  { id: "lofi", name: "Lo-fi loop", mode: "minor",
    note: "Four chords that go round forever without demanding attention.",
    slots: [[0,"m7"],[5,"m7"],[10,"maj7"],[3,"maj7"],[8,"maj7"],[7,"m7"],[0,"m9"],[5,"m9"]],
    progression: [0,3,1,2], why: "Never resolves hard, so the loop never asks you to stop." },

  { id: "house", name: "House stabs", mode: "minor",
    note: "Short minor sevenths built to be chopped and played on the offbeat.",
    slots: [[0,"m7"],[3,"maj7"],[5,"m7"],[7,"m7"],[10,"7"],[8,"maj7"],[0,"m9"],[5,"m9"]],
    progression: [0,2,1,4], why: "A rising line under a repeating groove." },

  { id: "motown", name: "Soul changes", mode: "major",
    note: "Bright, moving harmony with a strong pull home.",
    slots: [[0,"maj7"],[9,"m7"],[2,"m7"],[7,"7"],[5,"maj7"],[4,"m7"],[0,"6"],[7,"9"]],
    progression: [0,1,2,3], why: "The oldest working progression in popular music: home, sad, motion, return." },

  { id: "jazz", name: "ii – V – I", mode: "major",
    note: "The sentence jazz is built from. Everything else is a variation on it.",
    slots: [[2,"m7"],[7,"7"],[0,"maj7"],[9,"m7"],[4,"m7"],[5,"maj7"],[2,"m9"],[7,"9"]],
    progression: [0,1,2,2], why: "Tension, more tension, release — then sit on the release." },

  { id: "westcoast", name: "West coast", mode: "minor",
    note: "Sustained minor chords with a melodic bass underneath. Space, not density.",
    slots: [[0,"m9"],[0,"m7"],[10,"maj7"],[5,"m9"],[3,"maj9"],[8,"maj7"],[7,"m7"],[0,"sus4"]],
    progression: [0,2,3,1], why: "Barely moves. The bass and the melody do the travelling." },

  { id: "trap", name: "Dark loop", mode: "minor",
    note: "Two or three chords, mostly plain, with one tense one to lean on.",
    slots: [[0,"m"],[1,"maj7"],[8,"maj7"],[5,"m"],[0,"m9"],[3,"maj7"],[10,""],[7,"m"]],
    progression: [0,1,0,2], why: "The ♭II is borrowed from Phrygian — one foreign chord is what makes it dark." },

  { id: "gospel", name: "Gospel turns", mode: "major",
    note: "Chords that move a lot in a small space. Built to be played, not held.",
    slots: [[0,"maj7"],[2,"m7"],[4,"m7"],[5,"maj7"],[7,"7"],[9,"m9"],[10,"7"],[0,"6"]],
    progression: [0,2,1,4], why: "Down and back up, landing on a dominant that wants to go home." },

  { id: "bossa", name: "Bossa", mode: "major",
    note: "Sevenths and ninths that lean on each other. Sparse and even.",
    slots: [[0,"maj9"],[2,"m7"],[7,"9"],[9,"m9"],[5,"maj7"],[4,"m7"],[11,"m7♭5"],[7,"7"]],
    progression: [1,2,0,0], why: "Two chords of tension, then two bars to sit in the release." },

  { id: "boombap", name: "Boom bap", mode: "minor",
    note: "Sampled-sounding minor harmony. Warm, slightly out of tune with itself.",
    slots: [[0,"m7"],[3,"maj7"],[8,"maj9"],[5,"m7"],[10,"7"],[0,"m9"],[7,"m7"],[2,"m7♭5"]],
    progression: [0,2,4,0], why: "Away, up, a push, and straight back. Four bars that never get tired." },

  { id: "ambient", name: "Ambient major", mode: "major",
    note: "Slow, open and unhurried. Suspensions instead of resolutions.",
    slots: [[0,"maj9"],[5,"maj7"],[7,"sus4"],[9,"m9"],[2,"m7"],[0,"sus2"],[4,"m7"],[5,"maj9"]],
    progression: [0,1,3,2], why: "Nothing lands hard, so it can run for as long as you like." },

  { id: "storybook", name: "Storybook", mode: "major",
    note: "Wide, wandering major harmony. Lush extensions that never quite settle.",
    slots: [[0,"maj13"],[5,"maj7♯11"],[9,"m11"],[2,"m(add9)"],[7,"sus4(9)"],[4,"m13"],[10,"maj13"],[0,"6/9"]],
    progression: [0,1,2,4], why: "Two lush major chords, a wide minor, then a suspension that refuses to resolve." },

  { id: "quest", name: "Wandering minor", mode: "minor",
    note: "Minor elevenths and thirteenths, spaced wide. Room for a melody to travel over.",
    slots: [[0,"m11"],[8,"maj13"],[3,"maj7♯11"],[5,"m13"],[10,"6/9"],[7,"sus4(9)"],[0,"m(add9)"],[1,"maj7"]],
    progression: [0,1,3,2], why: "Home, a warm lift, a wide minor and a floating major — it travels and comes back." },

  { id: "cinematic", name: "Cinematic minor", mode: "minor",
    note: "Open, slow, unresolved. Room for something to happen over it.",
    slots: [[0,"m"],[8,"maj7"],[3,"maj7"],[10,""],[5,"m"],[7,"m"],[0,"sus4"],[5,"m9"]],
    progression: [0,1,3,2], why: "Falls away from home and only half comes back." },
];

function buildSet(setDef, tonicPc, base = DEFAULT_BASE) {
  const chords = setDef.slots.map(([offset, sym], i) => {
    const rootPc = pc(tonicPc + offset);
    const entry = DICTIONARY.find((d) => d.q === sym);
    const iv = entry ? entry.iv : [0, 4, 7];
    return { id: `${setDef.id}-${i}`, rootPc, sym, full: entry?.full ?? "chord",
             notes: voice(rootPc, iv, base), base, degreeIndex: 0, roman: "" };
  });
  return { ...setDef, chords, progressionChords: setDef.progression.map((i) => chords[i]) };
}

const setsFor = (mode) => CHORD_SETS.filter((s) => s.mode === mode);

/* Describe a progression: the shape, and what moves between each pair. (UC-14) */
function explainProgression(prog, ctx, system = "letters") {
  if (prog.length < 2) return null;
  const nm = (p) => noteName(p, system);
  const moves = [];
  for (let i = 0; i < prog.length; i++) {
    const a = prog[i], b = prog[(i + 1) % prog.length];
    const shared = a.notes.map(pc).filter((p) => b.notes.map(pc).includes(p));
    const step = Math.min(pc(b.rootPc - a.rootPc), pc(a.rootPc - b.rootPc));
    moves.push({
      from: chordLabel(a.rootPc, a.sym, system),
      to: chordLabel(b.rootPc, b.sym, system),
      shared: shared.map(nm),
      why: shared.length >= 2
        ? `Shares ${shared.map(nm).join(" and ")} — barely moves, so it sounds smooth.`
        : shared.length === 1
        ? `Only ${nm(shared[0])} stays. A clear change without a jolt.`
        : step <= 2
        ? "Nothing in common, but the roots are close. Sounds like a sidestep."
        : "Nothing in common. A real move — use it where you want a lift.",
    });
  }
  const homeAtEnds = prog[0].rootPc === ctx.tonic;
  return {
    summary: homeAtEnds
      ? "Starts at home, travels, and comes back. The most reliable shape there is."
      : "Doesn't start at home, so the loop feels like it's already in motion.",
    moves,
  };
}


/* ============================================================================
   VOICE BUDGET — pure. (D-038)

   The app went permanently silent after about thirty notes. That number is the
   polyphony limit, so voices were being allocated and never returned. The pool
   that leaked them belongs to the audio library, where no test here can reach
   it, so the pool is gone: one voice is created per note and destroyed when
   that note is finished. What remains is a budget, and a budget is arithmetic.
   ========================================================================== */

const MAX_VOICES = 24;

/* When can this voice be thrown away? Once it has finished sounding, plus a
   margin so the tail is never cut. */
function voiceLifetime(seconds, release = 0.4, margin = 0.25) {
  return Math.max(0.1, seconds) + release + margin;
}

/* Split live voices into those still needed and those safe to destroy. */
function reapVoices(voices, now) {
  const keep = [], expired = [];
  for (const v of voices) (v.until <= now ? expired : keep).push(v);
  return { keep, expired };
}

/* How many of these notes can be started without exceeding the budget?
   Dropping a note is bad; going silent forever is worse. */
function allocatable(liveCount, requested, max = MAX_VOICES) {
  return Math.max(0, Math.min(requested, max - liveCount));
}


/* Which chord should the Bass and Theory tabs describe? (D-039)

   They used to require an explicitly selected chord, so a user who built a
   loop with the "add" button — never tapping a chord pad — found those tabs
   empty and no explanation of why. Fall back to something sensible instead:
   what is playing, then what they built, then the home chord. */
function activeChordFor({ selected = null, playingIndex = -1, progression = [], palette = [] }) {
  if (selected) return selected;
  if (playingIndex >= 0 && progression[playingIndex]) return progression[playingIndex];
  if (progression.length) return progression[0];
  return palette[0] ?? null;
}



/* ============================================================================
   BUILT-IN PIANO — the recordings travel with the app. (D-069)

   Fetching samples from another site failed wherever that site is not on the
   page's allow-list, which is silence for a first-time user. Thirteen notes are
   embedded instead, every six semitones from C1 to C7: mono, 22 kHz, 2.7
   seconds, about 11 kB each. Tone fills in the gaps between them.

   There were seven, C2 to C5, and the keyboard played two octaves above the
   highest one. Those notes were the C5 recording at four times speed, which is
   thin and plinky rather than a piano. (D-071)

   Salamander Grand Piano V3 by Alexander Holm, used under CC-BY 3.0. The
   recordings were shortened, mixed to mono, resampled and re-encoded to embed
   them; CC-BY asks that such changes be declared, so the credit says so.
   ========================================================================== */

const PIANO_CREDIT =
  "Salamander Grand Piano by Alexander Holm, CC-BY 3.0 " +
  "(creativecommons.org/licenses/by/3.0) \u2014 shortened and re-encoded";

const PIANO_SAMPLES = {
  "C1": "data:audio/mpeg;base64,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",
  "F#1": "data:audio/mpeg;base64,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",
  "C2": "data:audio/mpeg;base64,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6awzXEbEuhezIwxTjFINpeZ2qCoMDF/VC2gQSvQsFTgVCYowGSWVsxVmU6k4//NAxOcWMWJsGMvKtP+IFYaHgyqElGvib3dfSxFIkhfqTJSULxQdQ8yMJm5hBwtkdf94tEJzog8gsBGVdjgrdASlJ4IgjAEWQEIkmezbskYgUB1xhi/nXsNNKrH/EMVmqHRK02Njk83/80LE6RbhZmQYw8sk4tNyTHBiZdpgRMtSqMU8MU1NL4NWxGIdUSXE2KDqHv+DqpyrUHqlVX43msfIiCdPvg4doVpARgHYsppL8CRNUDqlWZFGso0b2sbagOibyKzVUlA0MRFZuz+rjdb/80DE6RbxZlwQxkp8ovTDLkwowHfdUEtB5UQGWNOuUKYSrY5m8KtdJrO+ggz5lhTEs6iVKSKvMeHRZNOAdafFSI0BNILLAIFDxyCHKwtJ858CEEaUQlkQqzoMuEiBWKCEB4JWyTRmUP/zQsToGHFaWBDWELShKfswmVkcKEFJ0rLIho2nDanHqrP7BBfujVqgYeWjjeYWvzeDEzW8o6gnk2kkpSP2YGv+RYkEDiiZebwP8RmIPx2ldkDytdKASAWQurTSNF5PIQnShw6lNKnljP/zQMTiFLkiXBDDyyTF3TmAUzpQpVeHmkwJ89M0sqrvE+MNPWv6ge2pf8O/Q0KpHS1FCm4DihAcAkdd1lQjwM0xMcDpSBZiTG3AIQhwRdoaSrCpRKDU7vDKib5ZMmgkRIplmVE3B11Y//NAxOoYcRpICNZMfFjYL0vNfA4dYis788jEguymdRFYCtxO2NSRs013qFSxAXJCM9p0Flum2IkCMrNxoyWAOKOmIUFD6TATIynFFRTB2bIJMlhgiKLis9lBKcVugDVhqrq8HKPQpaX/80LE4xSZIlAIxkR+fEYCmQaS6IQqODhpVkxS4/TjQ03zYEL51GlDisx4mgyrv+EhhdeTZTEsi2srcEzoxIkyi1cuKFQGXms68wKBKoAZNKRwc9q05HLCoGJJFQ/IRkwZ5dicTDXd22T/80DE7BcBAjwA1g60adFoytFeIYJMpg6MoY1htLexhnFyYi0qAoutlEWXPzTe/Aa4iRCQayNJYsoKkFA5dlEJiaAUsqKAG3AXwNcDaJSszPHmmNC90GmSMGyj75InP+jsmcypTaAYAf/zQsTrGDkiLADOESTWfV6GbmAY4NCxOIEBFcA/JFZ3uKfx7iYkCFqElOg6aWtuvy9ghkNFgL/RTEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQMTmFpkCIADOCrRVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NCxOYWeQHoAM4eWFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV",
  "F#2": "data:audio/mpeg;base64,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",
  "C3": "data:audio/mpeg;base64,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",
  "F#3": "data:audio/mpeg;base64,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Z4jssChuIhseD4xFkejI4kMEY1FYWce4MXfmq4I+xLcKxIqEOVeVEpmof910//NAxOMT8X5ICM6iblt737fSe5diAjgkmFmPCEqcz1dldnm6wEcSXfqFJIPmCuSvrb/USb7fRRpdGiwlCHEMEFCImgxZaIpuwgNI1LI1NT3H9RhqUaLAMIxWau0wgAyadlmd8hMqzH//80LE7hlJ0jAA3k6cBmCtW/9n17fYJM+1WzEahkL7pbW68MVf3OhB5I8xNtEUOapZSNHy6W+tupusmGlNnqUMOGlpbtYHSKHpW/jPzNVpCiLcZUcuXL+lnZeCkaFzkrGAAMPameQokZP/80DE5BWpfjgA3mKY5hDSVVvVXxN6uAPSuftbUAQJfXqzxvmwKA35zygb6zNuTH6/+ou6dnqVMmETCQBAZTDIUVg1FDaAoloQ4FiE6xk8wVXrMwKMAnAFCa0GkryGcPbulgJ7a33Env/zQsToGKGCLADeJOyi3+DMa+F2ABDFLvsWAGSGibsmRHmoemz53xjkU8mTbURx7r+/kS21aMkqAQUTBj8AoBIR0eEa7CUFTPkYaKpZK0pg1rfqFz6yDWLhy/OiMwpjebDiLz5d/BuTmf/zQMThFNGCNADb2uzfylEi5ngAS2oXIlEzCRjdb6kSy/c8FUKXNG0w/+NBtrMyzr+/WUNX9dUiFk0QIBpWlQngGPswYea6jBwZEX0IAk74udGGoGSOK/WpUtIysB/PPhUHQGa617hr//NAxOgWyX4oAN5klHcfuN2v7wlZlEsnjcphoZiprP5ujz93gVJzzcwAITcTiQ/CqvX/oP9/pyISGAgSEIQqstUiD5NIkyjLokIDZU+JUDjhzlgD6vKVAkCodtQEQxLZSnWKHKHb3M3/80LE5xaJgiQA3lqYKVvcP+3If3MBfTfbpKoCfFQdnHUjuRVfQfjFNF1DpRSy6W/9beZZX7qqN0VWtCLnGPhOJ+G7gZJh5BNejrxAE6aw8BjcqoSQKaYnRVcBAdCHs5bjqh0Lr8yTReX/80DE6Bb5fhgA3lSYvazcGi5uTJPp4UEPO2A2jJmiaBGn9zA/31GYgqatcwP8hxW9/brJ11n9FQqQDjnDRRUeR+Y2lYa7wiQN8i6xM2rzSCOVpM9VJXpe5b0UHECMhEiFLZdUATpziv/zQsTnFmGCEADeJJSmdobEo+vF2vD1FSOGOT0kojxTHTN/a2awd/KwNMBUebqUPUqIm/JB1UxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQMTpFxl9/ADGoFxVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NCxOcWITHQAMvQ0FVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV",
  "C4": "data:audio/mpeg;base64,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",
  "F#4": "data:audio/mpeg;base64,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",
  "C5": "data:audio/mpeg;base64,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gGlrZ5XK6bL8t42pSqsaTUHNora4pF/kwDcDf9cjRkP/0F//g0//QO/6H/u///NAxOYQYVI0FtFmpF/zqJhjm7eNStCbWMY4e1SezekZDWQTWkjLFzPkqLFyF3wFJ2ooCzCQuPm/44AJAUOxoAJhum/krpLWr+QGAYGz/kGIKg33ZQWSADhR4K6CC9n0HDzo/+ockFj/80LE/xniAggC32hyIav/0DMMVJ/+tAjkurV989+mN0be+mRVVp/9ehUOBMUCoghNEAJNBa8EWIW4TYSUMOCqI8jMag/BIBLAzFiR0Vup3UbDAAIR8ifef/rURoTgBlSRZfpVWRGuQI//80DE5xDBUjw21ASyt/4rgWkmif6+YifTPwTO/t38l/d/+5bdEWYvQlG/mu8E95hSYhOmIErFo4DxuO67y1QUHjkh2KMORBRb8OUk3q7e1XiCiIGerkENmf7OTBJAizEKefo+iNUURP/zQsT/GRGOBATXKDR/9YrAnd//qK7/nfy33TrMW30f/s/q9nStTEFNRTMuMTAwcsAsnlMkbE/4tTW49KLskYyIAsaPvRhAJKZuhGy+g7XUWRPoGpZD2h/rMgCGCGK1f+iK3/0C8C8////zQMT2F4FSBATXZnCW/lP538qn89MLav3aNI36/+1qTEFNRTMuMTAwqqqqqqqqqqqqqqqqqqqqqqqqqqpCAGstAXBgnKfPuak3Ex/xp0pM9Kry8ANE9/2mIZW/+pH/9aX/9v/6v/9///NAxPMVMVYIBNcoNP09zc9dZhr/Zzu5S577laaVMTVMQU1FMy4xMDB2wBTTd1V0MoGv2IekNFDcAAUHPa2zRxFKx+4YpLdjv/lmjqaSQNOs2v/1nCbDOACEuLb/SH0PaX/qGqJi3/3/80LE8BMpUgwG5RqoRM//rOu/d+W/vVK5L/6ivvq/apVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVAdSwKwphKZQPZ5rvKtNAKexueQl6jtram9SQkAA5J1L/oinBgpJv/GA3/6gX/9A8/5X/80DE4g9aAixWXlpi/t/R/vvsv1umSp14BZEv1P+kNACcAxc4AReJEKOSmM4+zPX9R+RpAxca1agMsOjrDSwkMIEA6624P/GItJG+UwN+AG1BpRb3bu4y3eO8I+zgxSkJYKJjE3bwtP/zQsT2FJGJ+AbG4By0c1QXCOEs3+gVAqAoPNRUfW48SEUYO/6oSJmf/7/0f/RVTEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQMTpETlSABbUSrJVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NCxP8aSYmoFN5OsFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV",
  "F#5": "data:audio/mpeg;base64,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Go50/n7kaP6yYDkT7//1PYOsKg///qMitr///KDf+S/9VSTDBDWR4qMMaj+f5YY81Vrwyw48XA3TCxZPZTQw8BVdOLTUuXP5//jbtWZSvoLGgOEQwpkvotV/LoO9Kr/96xiA//NAxEEXGopYHMcarBQod3/+pEBpGH//fGoUf//XTNNX//5E/+d/8ipCpDxTepzL5l8/Td5ar0tPLZc1wnuB0wBIgwngUhBZssBUNy7g3nCHGbG40AM7OAakDjNDdBO+rrzApAWAf///80LEPxeS6lASz2ikqRIcG9q///Dsr//1PWKwMT//9ZV///5HH///9RX/+moKcwDxQSKjfiv3w80dsBCDUQuOn45QOB2CE+aO36lIpGxGgJ2CiSLGqTfv2qcOnf/77YfmAcIoquj//UL/80DEPBMK5mQyXuaGpq///JQtf//////OP///z9UCFJjyseK9FJ9Jj3+1O1JtR4K3aSGBg/wWyIgqMkISR5Nm9ZihQHLAwC8ZM0TV/f6mBs43/+6zgf0WXf//47F//97i8Pf//qfV///zQsRKFDLmWBjHKKD/nH///1ltIjKMzUpUsLS71hvmscsazMTPAFCMFjo9KtwMPlLY1LbWPfrWpFEyARAzROv//rLANpn//9pkOkQEX2//Wwj9D//vjcPf+9f//+JlCExj19NzRLj97v/zQMRVEqHmWBjHIqT9r856zbom+A8IKtMDHc3ZwAAE1AnBhqrlt/nHWfIgBhgRJbfb/UPsJQMf/90JGAiCaL//9YzC//++L4tf//rNP//+g3///PINg6Z1FtrvppzVzWfcO0kbYYcY//NCxGUUauZMEM8mpGJHCApHMrGYOATpzF2pnr9TOojQH3IeRL//yUAAOaP//2GsGC0u//+Mv//71jcPf//0f//+YHv//84eCEjw5b3F1IIncauH4Y4V4gsswYbIYHgScCk0JCuogO48//NAxG8TguZQEM8mpG7P9Z1Vlg21CiJBfs//WAPjdv/9akhcy///rIZ///LDf//qf///lhv//84nU7dlDwvfJJ7HetY5XZqUrSMqEyAzBwTzmgzgcNqfS9Y1O2uK+mkiiOoCDAN+J1X/80LEfBM65lAQx2Kg/v+agMJSo///rKrf//UOv//+WD///9///+cb///OFtVJhAK+xcKml3O75+Xb0WYKeIhtiGCUYcZ35g8JKGuVEZVjpvUZLpmgGWgOQX29Jq+jqKQVMl//9Y9v////80DEixOS5kgAz2ikjc//98fi3//+t///+cPf//6jZQIEki9Y06qW9epMJXjhjSRuGEvz4OEoQSfzyfYMMgtLxk8om6mafqQRScWaAleG0pIq2RT2+omwJFDX//1FkhXb//4+f//fF//zQsSXE6LmRADPJqREL//+s01///qLX/iT/7kuIpUWwSpeanpZq9hnluUQGkoY8qjZhEAR1AaYOHBLJoELor+CHrMUJgQcADoKPLjtqWr7dEBhZ/R//ueEADT//8dX//vcXRC///0f///zQMSkFbKOQATPKKb/qLX///LSALqqheMLhVtz03LN5Xq1WAlDTPoM8gwrGI6TOcw/AAWAGJQLLrPfrM0mkWAwCwCwpFJu7f8uABHD3//rGoGrTy9//8cn//3xWB6///n///+olv////NCxKgU6uZAAM9mpPOFWgJBI1NVpyaLTNurfvb5akDfANUBWmAEObeyxgoFsKcGNTNzbt1JOgw+ADXQFghfQ+/+x8DGiS23//l4KCz///2HV//74uiF///v///ygWv//84uIEErjLQb//NAxLAVouY8AM9opFdu/ynq/vLtSncAHD6fQUMD4uMHBE+AOjp9SlzIuhYWClKzfb9VR0AiIv//5KiAnt//lH//+Shb///t///zh7/yNSMcYSdRGgfKplrn4aryRfYWYw4DBY9maij/80LEtBSy5jwAzyikH6zYGnbXO/sySY+QSYj7Ml/RqUrusfQFSpe//6lmAgqh3//ykr//vj8Qv//9v//+o9///rPqJkqtGmKDwzA2E1Tdx5jlKX2MSQhJgghnXEcCg6qZ3Y1jl/W6zqn/80DEvRHajkgI2OLAZqfBE0KXLTt71fxqgE6W3//aG9H///yN//98bhC///q///9R7///OoU+ocHDwg2IxjmNnmL1/dNbzrRuBAhkEGioXjDcTQ+jMqodb12SpmyJiM8CCkK2Lpxfq//zQsTQE5rmQADHKKRP0TMjgNElKif//UUQsULvb//Gef//vUKYMX//+////lr///WWlRCgCAC4dNIpEN+Y9u9bs8y1nUiaOEULdnbuSF8gLaDt+o4ukWgAhA6BbZ//7JgdwFb//qWKEP/zQMTdE6rmPADHJqQbtKie//+Q3//3qESJf//+////nv/u/9hSogo2EU1gcxRYzgEIDuK+7PYI3TyCmuR1fQoLMUBMOFU9oGxImqSdWXWcuf//+VJZtRJfJgFAiQxIMXUl//Y6TIHk//NCxOkV0uY0ANcopA4wUmf/9zwpICUMhWrf/t3DLyX//ewZMKl///Pf//9Q3n/8RyPBQAKAxhNwZoxndtUxvV8/cRHGsMyA2+DJkwWr+sxQWxXAxTDQz3//QSBFM2//6zAO+DUBmkzn//NAxO0UGpJArsbmFpv/0A1ad///LB///////89/9//YHRAHKwBQLehhoQFAItClbLnCiUzRUD7SCq+jxzkFEQ2B7ceF29LZ52f6zM2RLorgGCmASBEFSX1qS/k0LSBvjhobf/7JksD/80LE9xj6jiQA1yisWYkQTWp//8PWV//3sGQb///o////QUf//5Um/31AYkXOkwBQacY2As5GSM0Mgtw7Z5Jqem3DwcAHAhR+Zz0l7ARMl5FV/UZPQGeABdANOC6gn0EKzf1GJSA0qMj/80DE7xQCkkjWfmaik3/V9EXwNjZl3//xBq///x+G////f///mZa///zpz/0kFCABKhhCUAUBnEZDlD9efVqfGd4u8JWlhwMeYS2lOp0NtCcVpIiE4XFJdn6f/UsG3E//v6A6wsON0P/zQsT6GULmKAbdFNzb/9UaX//8jD///////1t///2//tUui+gpmc6ZrkogGHvCeJA6gPEtCWZDbx0mVr5ifmmNgEZB4wyCD5KxDCkpa20ttc6tTajRFIsD+CGOCiUiSPWkzL+ozIEAS//zQMTxF4riLAbOqKBTRP//VLoMEFR6v/+Jiv//uqNYhf//7f//8skt/4h/+OcYCUZABQBiSsCZyG3cO773lnfcbShK1QsdNx+WLAROpL7JdmnEwSSi5zZP2f/YzAeSN2//1GIvgtDM//NCxO0U415IVn6go5t//8bav//wT///////Vv//+//9H9GOcgwxUGogAoHETOPHoSzTTGpwLqRYy6np6R/1hDpfBTwURR9S5mHAcz93InUr4IJ9Ziqw54GALgoqQN/oVfUkOYBnE5IJ//NAxPUYAo4oJM8opKH/+gNcBocV2Utv/8Rom3//x9Fv//+////LJa///5b/qeoDjjAhHj4CDvLhJskKHJkTGgwGvjK9Zf7KbeAdBhRchOMJQXAcJCRRlAAqcyCevW01et0TEcoChIH/80LE8BUjTkRW1QTfs8NFL1N/yLga0cSbP//pDpAaKFXU3/9hOav//ywf///X///5ZLX/ib/8BTMDDvDRUMQIxCJhptJa+1nWdFKbkRXkZoaBjph4un6J8YuAqQTixaza5b1ayUDFQcb/80DE9xny5iQmzyikHle7/6yZAvkqv//1jUD9UF7//1DIL///Sf//+3///Onv/u/+hQIMEUTILZJkQ9B0FXtbppfhYkbBAfmcYxgFUGPvOKhhN90Jmtd0z9SFVEB9Qt5JP1q1fmCADf/zQsTqF7qOJATXaKb9P/tV1sWwUkW2//63FxoP//9b///2///5ZPf+Q/7agko2bY0L8zIsFBWKKByuUya1KYemIDUwBoc4UYacmEpWn6b+GL4Gl4E63kjdJTpoeeW5AyRApFHLHUj//v/zQMTnFSKSLATXJqRHD+BqhR5L1dL61CWgFCCq23/64ggt///lE///+pP///kqaf//5xMgBEDABnwUja0v6Gc5XAMp7hezqR1P4QHS4Jg4CpykLwYOJfqHYtRX+IL9sxUCaEM2VW9///NCxO0Vmo4oBM8mpvygDc9X//rKAlFDv//Yc9n//+t///7///863///f//rb9Ri9JMCDPQEhTduLnvo/kfoLdLWi89OwMqU9TDhGMQpw+jyzEIiLgtKcmNWcmfrRQWxoBBaCJ+SybdJ//NAxPIYguYcANdopH/zYAoR//9RsGnG7f//Fyf//1f//7f//867/3/1UN1KAMCA0wjTSbTravO09WURTdBOU7+Jjn0QBvSRPnOfQYPCLAHBjk3UzTbrM0lmo5wGIJAtCc2bo/+dAKL/80LE6xZDTjA212ikdv/f5RD1Ee3/9xl2///U3//9v//+d/9bv1nuGhc8mgCAFAd4NLq2AYxp8OU+Ess3pNXlDpp6GbGucwSDA58MsMHhLuQz85fwUv3dFAXwJwBcRA0F6rf6jwAQg9//80DE7hXCiigEzyim//LAs1Dv//jKf//qW3//////zv/3fkNSQ8SvAFATtMcKXshdMrMiEbgCejjl/ViSMpk2BkyBhuNB5KjIKKYMAlEZ+Yes9WrnCwtIvDZAu4GYIsedv/5sBriW2//zQMTyFmKKKAbPKKT//NwcJNv//ik///6z3//9///+df///U3/9vbSeaEYYiAKgHCiUCOsSd155BAd6pXlUxblrbA9kDYmBkObcxRgQIpDO7NTNbdukaIpFgQlATTEBUkVf/1EeA4Y//NCxPMWAoosFs9opN//8jRZH//8dH//9bf//////Ov/5H9XkTFFM2MA2MSjAaquNYN34lA1WlY7In4a2DABz04ClGCRdHSEymHQMJXqWP/KKekw7z/rxmk7KnDMFiFDifFKF9BND/1G//NAxPcX80okBtdmpAL4DCLxyEf/+sdAWZMD+//64ka///1Hv//7f//8sn//SgLgDko3IMqIxSW15JNbtU9y7MLbC1FpEQnP8k4oJbFXzkNrma/WdSYjS2BgAwIqRIpN//MiPAw4Yz//80LE8hUqjiwmzyik//lIWN///x9f9Tv//8n/c6Tv9mkyPMyD6hHWIDwTV8FSmKI5OixirKpa5UtrPqgKOi85kTDYozv5lDEgDQcATEWXQ7a5rH//Gfo6V/WZBYnhIRhjTJav/sZkUA3/80DE+RiqjhwA12is0VFsdv/9Q6w25NDb/9NxCF///zh7//+////On//R/9bq6j0nzQgyh8gLQhZLAb308otPLLqKB2OC5I1oYAl4YcxqFAYBgDsYfWau4X5gTRfQK4rwGVxBSIOM4v/zQsTxFJGOMAbHKKRoJ1Jf1GoyQB34ix5/1/3JkFgBr//6kxHSX//5w9//////86f/9FUJDzGBIgETBz69VjvBBMj5HI3HpXEFKzcSUIMGkU+vNjEYBVsf+kt4Zpt1FAxSKQs0DIrwLP/zQMT6GRKOHALPaK7Uhx5//7kVAaoF3//5QHLb//6As3//+cPf//////Wf/8V/+tUCA3g5jTraEkVRtOyitHep32syibUeKrZZkwSB04iAUMFVLqKz16/xXpmp5y8OWAtlAsbHk6r///NCxPAXyo4cANdopPUYkcAEvLy///jlP//63FzK///OHv//////rP/+n/VrcWKqDxkwhD0BKiy/tXorI87k7W7WjIGAi7QBMj1ZEaCnJIsYpI/rOqRPE+BYoPeWnb/+o6Dajf//h3////NAxOwWEo4kBM8opPUAf//6N//////9X/v/pVCiyn2mBScYSeNJUSHwLQYvG6AAAOEb016NjDC4pKX7rz7+MTImkMMSFDme+gCQO8TkzF3WduiVzYumovAIJgAY1DKk8il/9TjUAwD/80LE7hZajiQEz2im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",
  "C6": "data:audio/mpeg;base64,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f////6jyEInNBwAyAYYEJxQ2ou94yQOWKh32lJIjoAKDYAL/80DEthJxylwYyagwvRHSSHoJzI3kldzIt2oGY8iAIIRqBi8CE2vq0f3/RaoqiCS////8Z1P////nT///FTJPAlJlvyrBfs3AtGkHlUWd2SoLQIeBICAYtQRKlBbdN5zNLooqR00jQf/zQsTHE6q2WBDBqiQ4ggFYBwoIKcRSRMk637//l4aB59H1P//51////+d/////nzK/I1zPeM7tW9qkxFZHZjr9SWxGOzHKfuUotTsdYwTdG4ImmrANa3v/w7zV6/JbPPqRnuNy/QQYt//zQMTUE4I+UBDRqjBAg/JpK0DI1dqClPrV7+fmITAEhKGv///1kUt////5ie////+s2gAkCJ8c4HEIwhYzjjnCIaGQXJzO5pUblwmw2ED5yA+xaP/0mWSadJJzToFsth+gDC0uG55P//NCxOETQrZYEMGqKH//98VgQebI//3/+xLt//QlhbXO0WMr//6OQVUOhPrM/NTXJIkl7Ow0iKSajjsORyU0tN2fs001eq1WfGrIfQSoYIM5/DHKgiN7O9Z9rmf37FBI8953l3hAGITM//NAxPAXsrZAAM8a7GOw7JI6ZLUtdbZln/1pUQ9IFZG7PdT7P6v/cahCu2/9Pr/8SjMPyFBx4iKnOELGhySxJ4LvY1PXu426mW5iktTczMiIuPktIJmsuq5flrvbUtpH9rTn/213dqr/80LE7BQZylmWeOgsx9qQjDwk63monZ0Uq/S7etuCkp6vV//+PhL//dVnr/6f//VqCxSSxMeiERgpA5+FOmty3sxAtLLLedNh2buZYSmQxICCo6EjA4MsOisu33ne8+W2mpRq1b5SUvL/80DE9xj5xjQAzybs7SStyXkL3mZwk29g/VCPojbv13AUDCpt/VPf/4fCg7/9Rj//FglGFASKkekEFTX7onIk249nSh2q9ZA2SIoAaDA9+UiyTnugb6KJMVoU3uzlQkQiFC2Bir2pdf/zQsTuFsHGQATXIOxQ7dadIMcPLf///9iaIT////q16m+3+3V89//dokIyDlFDPhzMGjDDCIlH45lPblccx3L7mFTDXKa3K+QOZAobFpNxsxX/1rtvDXMnVoNfzLm88aCYkw4Bi0RAt//zQMTvF0HGOADhW2gbTQrZXvv1n6whhS5h////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",
  "F#6": "data:audio/mpeg;base64,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iop1nmGiOJitLasc0ycts05eDz2J6Ymcj5+SBMYoEUNQEjQRUBnyLETJ83PpmqRvdi7dCmya9vV20xPAAREqJ2d+//0v/9MzPl82///RUbVwAupnCwolCol8VDxAPbCfUQk0//NAxGMT4eZsXHmoOP+ZpUxJ6koW4iCJeJ41AXQIMMAzZBDJU8Tx+YmaKKCmc1MJ231JXvTQDBwLGYb5ggv1/R////Hw3//////qL///+tUgIAOIYBdjFXunMiyJANZcQjB7dJIfA83/80LEbhVSilwQwmocBeo6AIbB9isLJAFXoOVJFiddKs0Sc11LpozdtKpv+icUBhYEERSpN1/W////sOWa///6lQDA/nsT8aS4TSHFWjsES+OuU6pcqdFzK22nkdGAalIexugJgYARhJT/80DEdBLR4lwSwao4IVKpjJlJrXUkhZvr/1NWIkAYFSk7oFt+3v+j//oqTFgf//////1n1UmmxMI3iRGZQ1EFME4nxJD4TzneJhFcQlNkUxFjUdQ5gdUCt5Aw2Exnj6lqqN5maNTmqv/zQsSDE9KKWBB6ajhJKn2V0P2D0wMIhQcbIF4ueYezf//91Gz///4sI0BxgSywJxYqqrlSOWyCHrt9xFNGz7QoWNEnCUJsV8AR9gBOcQkKak6jMwTdrbqV+t+r1UxLQJEEnFzBfotqW//zQMSPE7niUAjBqjgn2//9bj83//+igUX01Jp7ltlnnA7h0/IZ40rdZw9HykzJSPGRQMSGCugYOaIEs+IAFFzMwaam5pSUx41T/q/6MzDJwAimVkFHTb292///3Wwv3f//53///RUK//NCxJsSceJYEMGqOAREjojChV/SGjsT548xFMqUjlFtyma4lAHkVLEmRZQGDD6DwuOEOONloGRaVR6p9H/b/SY4CQBAwUFi6YUjVv////0VsPh///8QKhFsEVBCcGMRiwlW69vkV1QX//NAxK0T2d5UEMGqNHesbP/q3Vx73d3LtiC4/KoBjMKMKCwPNTmOVj3DCnzrNNboVIf/9FAviEAGzZOJpmBLv0fb///8s///8VoGRAQQUhdMPQOeUT8DazRPGORz1hVRU9C4SobHGXj/80LEuBLJ4lAIwipUmSdD8gMJNQDiYCIaMwz5QSqRbrof/9bzQV4AIvETZVv////9UpP//////6j9NW4iGHoQg5nyv0CKXNolxCDUlcj7jsmiCK2qNcZDnkGIqNgGoAAwl0gOVhIUARP/80DEyBNh4kwIxyZcMzaYE6W1GCfWZP9VD/WjLxKANHgiKcyX/z///1ecSPHv//////n///+lKZoyaIQYCRsAhb+2JRbxkE7QSrGzXvWvxwpqWM41ua+rKU2Z68ulWQKQIY8gkoGoFP/zQsTVEqqKTADCajj9bO3R0Zw4+7oppf//WiOUBqx47mrNvX1of//9Skxmzv//1Vv///0qMV0cCOEB96z9UdbPU7A/ce0t6rl+eVFIJVWpK/MPv0hMAUnnVoouAmOjGoJCEB5ibuZ3bf/zQMTmFjKOQADKajhBzE88wPU0UEEP/+dcMOAAiMTK5VbWh6///+tTjEP//////tzp7///TTqkDNjTNg0QC/ybMslcblFSarynHG9S5b7jc79LjVyx7bfRJqnjL1sAMN/o4oFIU81P//NCxOgWGd5AANdolIZ50sPnz7VH3RayPf/7GYygGrpw3dAt+n6X///UtxOzf/////r6zyopRDFjKMLeuJKJikllJT0tJudzpv3/2eZVaezcwzyswAqKNuw7biGGckd2AyhUql9jPt2J//NAxOsXKoY8AM9oXCzReYzZTKbX//Oi+A6qK56kVPf1f//9a3GZb//////56oKQXiJhaCg4rCxyGaCMQ5bynqtWW2f/v51Ku+4cuZ1bPvQ20lqTziGF3oJwBTl0J+xnnqBUUfzUZov/80LE6RZKijwA1yZc//+oUIAzSq0oG/Z////+uVhVNGdZo/6nddHtu3eiTQDiF+ASqghCAV4RK3EaSw7lFcg65nVt6z5yxWp917F3VVojXpt/3gVwYHmMTmARBOsztF3dZt0Vm3SIutT/80DE6xUiijwAzyZc/zn/omAd4KyJJBRYNvNup2///51MkbP//5D5aV73otq7qTGpx8EbdEklIFpyNssCSGJRl+5bVrWqbtTVmiq0NBZq65O+p1EpLK2mKkMCQSF19g1b8sot9qyQtv/zQsTxFfHeQAbg40BiVPLzzZD0v/UYFIAKQaPJot9Vu/3//9aiJv//////5w////qqExoDLQMSPVSeWpLj3IkSEfVUJ1JSlv6c5/Ke68A4uSgOeQEDBZRAbiglMZY1PJ+ij7abf//I8P/zQMT1GAHiNATPZly0NJdSVqkvQ+3//5DEP//9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",
  "C7": "data:audio/mpeg;base64,SUQzAwAAAAAAI1RTU0UAAAAPAAAATGF2ZjYwLjE2LjEwMAAAAAAAAAAAAAAA//NwwAAAAAAAAAAAAEluZm8AAAAPAAAAaAAAKykACQsNEBIVFxkcHiEjJigqLS8yNDc5Oz5ARUhKTE9RVFZYW11gYmVnaWxucXN2eHp9f4SGiYuOkJOVl5qcn6GjpqirrbCytLe5vL7DxcjKzc/S1NbZ297g4uXn6uzv8fP2+Pv9AAAAAExhdmM2MC4zMQAAAAAAAAAAAAAAACQCSwAAAAAAACspdMr/EgAAAAAAAAAAAAAAAAD/80DEABNRAdwBT0gBplTjfBTgCcABgOaiBthzsxKB6C4OEN+8pl/fDyJDBAMMTRz/mgYtGjRz3+aNG3SjFihhcVk+qIMUIh7xH/HD4bQBHPD4Bgfmf//0fwAVtdsFAotFolAoFAtFoP/zQsQNF5Iu0l+JiAAM+FGCT6x0UvwuT6g5ULBUWow3GQL5FHOrezCczAmx1onD5rQNMfAhOINJIpmQoUF+l/lomDQwRNztbdL/jnmRJtemZ/6//6TLQ/5flf/+3+RVjbbiRQss2wAWFv/zQMQKFhqq3l/MaANIxaU9q075Yt8yWl2KmsPWnGnmkTx84/W9FFTJUaC+tFQ7QdiUdhKj2Ni03Y2SWipJaaGrqRtdJ1dT0Ubpf9E1Hw2dX1+////2//+kf9EKbtdrjYt324DMwwWz//NCxAwXGrrSXnra3jWK+dowkr+7FdIR5FzaG+5miQO1qKSXG9XSNWrT/X/3ZIARZj3cJltNifY6dvPPxHUbW0x9nb/4a39RgO4HMShmpb9SX//////9SBMNtiVKNU5E42mJbvaAyRZl//NAxAsWYrbCXnmaegQ413omx/PXfpYLisXJ8+TcVIc7t/Ls7Gqrcnt6nGMD8fk41dE4eNUHvpTrXQZSnoqdazdSVFknrX9fUsfVrc8ivcnMn/9v////00zjc2UH2IgBzbuABubqg5P/80LEDBap7o2+ZhFAze0Dp8Hy8rifWKsDlz/cxha+4pdX7M3anbKYopx6Z/PHVWxAiO4QqRZiqPBp8HV067X109c6Tb7M03tPO3//8lAtAlTJ9ywyyv9f/6iMooAqzIgOaROur2osLNT/80DEDRchynw+wmhchaIlXgQmDq7GomdVLLtE4nOEDF5NSqiQL2onvnFg8cPkcZjKgIAgcYsKgokKRkhZTa0+gvUtezpLnk0zJSj7PT/62OCvFZkxUHmb///wFpo9XcBZb4wFgMlQIv/zQsQLFtHChZ5mV0Aev9jSt66yzsD0n1H3qZeXFKw5ect0zLNoK2vn2dztrLGFydVAxKZFVEyKBUP8EOdO7Ub3y3lWWcWvufL+3W3j5v/mv4kP4fbidzdf//zDpupxySxxjbUWgFvGZv/zQMQLFGHGtl55lHqJi32z12tTOJxzPPAVaczdgo2mIPMlUINNxon3r55lwCTwVEgLwrCcomsXpKlzUJkc4uqGmLOMPRTXVzOz/+cExP///8R5WiPagGtowRUsJv13vbcBGNFJpNJ3//NCxBQUYcp9mHmoXP8Y/hRJglPb+tl8FrL9YdqCCJkP5MkyBbKWmIibEDOETPFomtIyWfWas08kk6Sla1mDIuYnU1sl/9bDbJZ6G7+YSVr5p2PqAHJEJ4gyjB1TdRdbZKmUPqo1/k4x//NAxB4TWcKNmEyXQ2MI8zFVKvWZJF4A+ySRExWuPJow3n5UMTjzdqtWea2Uluc1RQZtJF0/Y////kURVU3JJJELdgQjhDxVbtrZAq9BY/XY659m6JlZZZbejQ3mKLy7AfGq+zIpeeb/80LEKxQZyqJYY1cnJoTRlAInazkIJn+WyWonD3stK9Pr4epNSYrOvm///miIAgQx1EqATrAjZLtHvWtUVChuN9RoXvrVdZ9orc3Q3utX8esG8DT2+IkOjPJzDOYaHF0qDfT29oQHjYT/80DENhQRxmQ4fpdAzmn3G9tS1bhKbdLZO+g5SWzLIr//m/5XDI0qK52E2CeNMmG6QdTNTq73XiyuMW0j6uroe2RY+8SXhNrbRuYoGYsLD69KWZiE2qSCImceWKjjgKhsXFXMLkF37P/zQsRAFEHKWBB+1UBOizzsw59GfVSVeb/4xA2Fly+BEUY4kRHabzuE0aGMdsWbu7P/3uKqXYYcsun29xMlWXWrVtRtVMrmpDhLxSASAgfwMKKQccJFESPP0jepZx0EjNXSbMzTqTfWyf/zQMRLFCHCWBDDKF37t/2GNrouwc5CF7HRgTDHkQW5ghUke1fZ7sskQ0sRst0uhjiC6RwFbcCcsEicmScLpcEfESKwG9WjicZokUD5E0U0XrOJMtJeyLIOtfm3qV//ywRj6DZB6S0K//NCxFUUAcZYEMJoXIw0GWRVaBIIi8hkt1JbTtY6j5JkZlItwbrC0TZygpY1CXTHAVzIQqNELOgbakIKpEPGRQHSSRdNCkgyixSnm3oLqbrRV0f//k2eLGHqHcC3PBYdtiITUaI/7nNu//NAxGETwcZQEMGoPLbfpjUB6kVZOwJyI2agQmGAk2faBVS+2xx4w5VA9Nikk14lJADrAF4CxUIxvQiNsc5ep+ZdaN7ed9v/UJr1YKEDwzALhN3USlGjLBBrLH08iwt6ju1Mxtr+WCr/80LEbRPZxkgIfpVA2j/DXWFU5Sdtsz97hsIXuhgeGqVCiUsLP7iUnFX/kedPjvmFn9ZFJphorKv/ZvX/4A48vSFJkPWwyhlleofNp1yG4wywta6j6E2sjM8d1nbttj4tSk8wUrkRquD/80DEeRO5xkQIfoVEKH46SKSHB1xlQ+EDTA5DeTpaNkWeYGOpU9ZtWr+/2//7k0eqNPASKUoRLXpRTcRds2C85KNpKzzYKIK0ZkPJM5FBEwIk07cRbEQuHxsjQEasWg1IT+ASCAWpwf/zQsSFE1HGQADDKlzzGpCoKLDuo4lUp0dPoqXT/9NvX9vjrNXU1T4fWCEAZEAvWW0dqH06MOXTQQyUNresiihiJYGUWOUJBQIAZC9aYIOKiEhxfIREcsckIQ4HIFDIkSLJrOG7qVqdJ//zQMSTFAnGPADKalxSaHd9f3859//kNdU6yIsqoXlYHGnYyq5mY7SuoNJHn3aaW1Ydq2Z6N+3sZmdGca7s6IkBwbisnKI7jh8UkMqBAWB4VInIliOaWCu6Zn1PpL6HZvf2+33+cdU///NCxJ0TUcZAAMpoXA1EdyTLNIk3Vs361+noKCrY5hlhjV3nhM50NJyku58wp7zx4uwyaehvCckW0otUMgzjyPqzSzpzDtZj4iTjRcG7kDLo+xTU3oW9v//M9CdKEkYCR/HZFXRGLzNv//NAxKsTUcZAAMvoXDkMhw+lznuWef+8MLvdzHae9c7QYwHjFoYjcqtUUugtTSdiEhv2Fvp9Co4KwbRJeAARQXAWj3Rleeb26m+3nP/7eopePBwkoYxDadaFDVeO28J+3am72eF3nMf/80LEuBQpwjgAztR8DKmm7V2pTRSzn9X5ivEmg34OnL07MMh7g5da0j43pe86VuRjmgdlnHA0ee2iqX30N6p7ez/9D/ji1QW2QFjQUcJtIgi9qUdzuWOwNUpe1fxwz+7dnMMrG7OPZ2r/80DEwxPxxjwAzs58ZUNNXi0bxpIa6l1Ry+Hq8cRvdhME74RQG0YABxhcXKar89LNq/X0+7/+/xUygL7QHhCvnKbvB8fs4U1os4uOe7/m5bD2aE7jA9J7eocOmIQPlkuOSogkKCBqGP/zQsTOFBnCOADGzn0OWRIsXSebfV7t+3t1f///M3ftS16bSnV2VfV0//0VTEFNRVVVVQI+mAF6zhrSPMjsy6gx6D4/yNb/5/tsV3VrVqRoKGPiE4ME8wJ1iGkFNBN4AFiGolXq1Nt//f/zQMTZE6nGOADWzny6vv//8xf/mX20s67lt7dH//yS+g7uIMfHxYZMLJigXtPs+ln52ei8GzNqCspdZzs73lOY15iGZqchmciUpeeBWjs5pHroGytq6SG09SQbPPisE1gZDTK2uIuA//NCxOUTGcJELsLoXAqTKM5EN9adzuK6s3E+gt5W9v/gIP7PH6tNQjFqczR60//9aD3EUy0aFQIy8ALQM6kNyPTUjkEJlb8xnOUSezlS4fMw/SSWkkdeWRyXxyIv7ATD4Q2z9QplEHw2//NAxO0SKcJEFsGmXPxAk807t0iFX7TfNmfFhcwGXZCR0LDujuUShpS9RT6n9W9W6N8d6kxBAj/wB/wIRYFasCvxXp9Mx5S2n+TnnQStGCwWQXBORj3u51JFL1lCKOIbuOBsDs/rdb//80LE/xsByiQE2gtg/b02klo9ST+zUGmGH8VpaG7df+tMQU1FMy4xMDCqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqr5PS2ASyaZ0i9rjt6nP+Uua0AIEmosgfStoTMAJSce7LOFpUj/80DE7xeRxiQA2oVgXfukq0bfmf2/9Iza3Je5X7P+um4Ixc00NNPJiUDIgprD+Niee3QNpucs/RzVSvzdFzdeetbj0B41LUuxjVeQzS7mLU0Y5MQNJqZ/KKVFp3mZAeMfiwItYBPwAP/zQsTpEYDuRBbBclwNxpGh9TUvbz+gZ6m+nz/v6hYx/5v//7rEr+n3aetMQU1FMy4xMDCqqqqqqqqqqqqqqqqqqqoEZZLACiS11H+pLxebJkIi/PNfzk6utnayykZk0CtmzG+otqbX+//zQMTbDaD+XDZ4Wj7o/+31bv+Q/6TCLLSpW4/vcjrvYaD2TmA0qYc6CkDsP/DExORBm1e3PUNJHocs4Y5z8SnpDNxiXwzzsRjEtZ3LIDa5EYEqQiWyrG1Ryeq9YEAS4oMGTunoiDYo//NCxP8ZgcYkBNpPYOrvkyrXTyurR8/ZUg8zWmoveqNpJfN9fqBE1v7//q2ftq/9v21MQU1FMy4xMDBVVVVVDlErrbQHIYztcuMxn1C1qaXUYP1MkG9vu5OAd6EwPVlpVn9bLPv+Z9bK//NAxN0OQP5YtsBkPgXdUhNs9YO8USy/rpU3f3a2JMJMQU1FMy4xMDCqqqqqqqqqqqqqqqqqAEO1gCRIhCM9Uyk1mcocnt5+q1/iuLiVXSJkZIlahQdNwEdotcdhUEVAz4OzNdZ9yP7/80LE/xspwhwC1s6csxFdn+e73IU1NXTbTr27v+/f+upMQU1FMy4xMDCqqqqqqqqqqqqqqqqqqgUCY5IAMYFAuTKyudMXcotUqq5e31fssjBZCrK6hBpqyjeTICqnnPHhN2fmJHS/+37/80DE4Q8o/lz2eFo+x3/uVUpAqtBAUFWM/X6qWVoJVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVUOg3SSAexV1aYGKCqBCJnf6hX6bFbUmUko1W/SckgTR9El6LaZanD1NP/zQsTpEVD+QB7SJly/78z9Qrsb36hdrtunt+1X9kqiOUxBAy7UFPw/yaiA9a7EKWalFe5S1l3XFY28b3rNq38t84vSBqQo5ejawrXGvfvvVWvmUOnOgJmHZX79v6v1P1v6//GfwVpfsf/zQMToEMjuTNZ5ZF41H0i+1aLGNvesYsuCUhqX8XNqWAF/nsKGZgPAOvLpwlWRVRvnTWdLoEmp2MUT/Xq9elxvUVPXdONWsMJNJsWVu8VUU423Xe+zKW9VtLOPxfgejdJQlrKNp+uN//NCxOAPMO5Q1nhaOnYYD2x9ILE87yNr60j9TJhYhlVN0I+X+3xcd062l00XrWp2o5b2aUke2Hzbhwi+2ZpOMGnogmghITI1s7Hy5CtQYqa6LUFOr+VbqibKn0wM3JgtiXi3lktpOXzQ//NAxP0WGcY0FsPKfEenlDQkoPkcQrAU4iyDIiJ+ZF+xk39v6z3t6///nfT6v2/V93b0r1fxNLVMQU1FMy4xMAi9JYAhxN4jiqJwGPCXOffl/oSifSPU1KIk6mzZyLAMs2k1qN6f9G7/80LE/x4hyhQEy8tg30/R5JKdWnX+KfYIBzyfyzBv8TIxGE3SoxlUGM4cRXVAneweL0DTrUuxpInYh3LCpe+ZlUCz0pkl6GpiIy+fZlTlQOl01Rz/nKu28gKIKflE+1wtqSGJm00Wddr/80DE4hVpwiwGwmg4U7w7DTHre5mr+6TlDcUvA2oGADozWp/6fSyyN+7p///bJxf4cUh4HgqVSlzYVp9M1jEmFqaMneuLi9LKY3vc1hsYkgFwlQJ1vPnpOrFuTKIn8nw0QDdNxHhWIf/zQsTfDukCUDZ4YjqGizIe3TRfp9H+s2/r/D37lfuyH0fdt+nZ+FqlTEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVQCZVBUVtoIkQvKMZ9llQ0eCz6e8/dZHY92NNVaFIHM8PLer/bUmvf/zQMT/GnlSFADWxShfv+qw0zsX+l9znXIRZQrR+2TVNTxOmcCMJmQiLAYLWBaUyymnW/icrcWeqVJi1qn7hP2sJJHqKZt1rG6ezQsjFjUMRu/MSx4m5wPeeSWvEgNhkKCzxEE6YsDV//NCxPAVIVYoDMroXFcNI/zx05maundLMIhjc/+iN7fhT///9//oIchBxjALAgJDRKd11V4pfuyBQbBBkkHD+uad1T71Fx0akK5SuZzh+SStqqQWLtVeyikXNA9O+tV6ItLyFwjy3CVP//NAxN4OUOJdnsBaOvX9QXUwvR+8sJUsKhpRiTU1C9t2HPRi/1v/8poX0fQz/rUTjYP8AKAi2ZYBjUdAm2qA1oWIsX1M4tESeriHri7zC5MeionlpZCXWXP4VbmfgJ6JpS3xK0OJy2z/80LE/xiBxhgA0wtgTvWn/7ff+zTdHq80qzuR/t/Yu1Uh/riYeCmICw9BhwUhKgVXbRJuGl/tvS14Ev08B3sK/bM3hL5LJK9rVakpIi90UYyLCcSX/lBt6SOvnE3v5bZc1lQ8aR6SuLj/80DE+RjhDhgC4nBUbKYVklnDbOvRyrk5wY+s9u7U3of8U9H+T//+z0fNqhNoY7QbwKBmhijCgkMsgcjsZ6yOrLcdhvv48l3/s9hW3/CxCP1iXIq2FCpGz5knxqXq9uidU6iLFuA+/P/zQMTwExD+LA7KHjjEhDoMenXi7ZD/Z/b/X4//+f6+/9lMQU1FMy4xMBd4D2gWBpahyFbjMQuWEKWBmBcfWY1+3KWeVKak6k/qyibldVq87CbGOOP/qk3M35pjRnzawpL/0F9f6NyL//NCxP4ZiVIUAttLYL+v7Dt9ZtLX/367KhXdL/jvqvYq8esamlgYXFBQjKwqJsviriOSeD2vuKrwzbOq0sROwXcXTdJdilivXN64P5QX8Ivqy7japS5K8K6Zjqlgk4+Kekk9i7MRcPnZ//NAxPMUOP4gDNPyXDl0Xqctjp6izwW/ZfqWrmrBv7bE+r/+5VVMQU1FMy4xMDBVVVVVVVUDHJAfhqDgGXXLCJqpKuOLShJW7h118cs9jq4uH26w6fLvuqnPv1Jvr+BIMg3Z7+VHb/v/80LE9RRI+iQM0nA4wFx3+z/e2vs2EP3ck7TlFr+7XapMQU1FMy4xMDCqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqoAbtiXJbaBUQVKr5Mz0MM6DqPZ7/z693rf0nMgVbz/80DE/xgI/hgC2/Jc9f/07//LftV0L9v9Tv+/+pFS6jLK83EAViBJkEDD6K5fRAW015Ur5Q6a/NVaaU28893sKXkzT2aSm7jLZTbkDPiYPqAaeB5/5Lje592StxEAcxUJ65ID4tRJCP/zQsTqEZj+MBbK8lyWjzLzqXdGSVO6PO/+zO9GdiNpnfTFZBX6f9n+rbX94utMQU1FMy4xMDCqqqqqqqqqqqqqqqqqqqqqqqpYQLNv8A/a6GfyGllI8Voik36N5Kv/UUt/20pgE5PC3//zQMTVDBDiYZ5gWjr6rqf6k536ft1VLf6KqMx/9391IIAaWH5isRDAbCAGYBBTIkPEerlIIyij8SmFMpkhS7c3Ws9hSW+n+2xXqQ/X6ICKnWFtHKdWGLu1T2qWggZYIj/YvSNzzyuy//NCxP8aQcYQAN6UfM0NBdTAdlJtJ8DxD0qj2oU76X6deizXTYlW6Q9H28eWdQpMQfGOtmxMjRMaYIjKWO5L4zQGAzRTmHdCZfOdT1M/+auElCbEHWfV4F2fffeRKwRBwHKXqS3osY8u//NAxNcMqOZIXsCaODTYvf/dv2/yH3f09WW/v+zpaxdMQU1FMy4xMDBVVVVVVVVVVVVVVVUGHIwcEAcdKC4VKo3yxCaSYphCIt4WEi654LX33jHwQCZgytRrJUyi+aERAnBqkb6i103/80LE/xpZAhAA4/Jc3vTOf+36vVz825fXrb1Mp7Bbt9Qwsc5gwMGCy9gq0i46bti47rHWvw9L5W5Oq+8K0flsvt3ssqlfGtjQymmlL0MXmZBdhufssRhMxVvX1xOMVQxh2sSvhywoCKP/80DE7xK5DiAC0Z5WijaiopWe2c/q1Xe78qU22qEfFsvb/28Ul3e57kf+jzdMQa4CwDSk6xJGiEqlExLJbM4JzJGaZTl9hBjosuGuvJY+yGzhrGsQxSCeff+bhywzM+kp+03Pkh0tk//zQsTqEbj+LBbKJHj0av/luhlVGr4z9fWnZdQqme/LDiHf1mpUA0sISwVBJvsojVBDjYYWHwktycmAlik4plGj5xU0QQ6K3CMjCgjMCjREquQV8i3YZzAqeB/AC4L7oyz3qx7aBUXD4P/zQMT/GfnGEADRxWAz4UOPmnBiSJvIvQ8KqkolGNZV/kOj/Rlexn/Te9VMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVRgAm334BTlCHoBRerssn7RM+9v19fq6bev5wlAA0KWd//NCxPATQPokBMJwXH/T9X7legx6kua+xn/t29P/wKPV4HyBULTDCUOBi1pbx82HWphvVrhoyWUCxCWWSwo9E1AZYnryrLMwGeDzc+ze/V+tD2NSK7rN5AqHc9bHfqQ/h9yT2eiygytQ//NAxP8ZUQYQAtJ0eLpNJFW4VR6HbGkH4uNGNjGng0Lh3nTKFCQugmZxi2ujRS17T/1G1Qc4DYuZCMCEDMMA/Xqkenu3jjqBOtdjIqmhOe4MmF2savWdyYjq0ZZZsQKQm8IOmMuPgw//80LE1wzQ5khewxQIvMBD1LeU720uuyLp4GiCRjW0M0PMq8Nol/r39/1euz9P//IqTEFNRTMuMTAwqqqqqqqqqqqqqqqqqqqqqgBnQIlf34HyqghtiNuj1jzmFmsOvv38/DLfd55xUAn/80DE/xuRBhQC2nJ2uJ0/+/9/7fu1/0f/1b+2794yPjKbU2Z1CN0SGwEDlvEIooShFuAlA5G2KJU8tmWG452pVL5FSWoMmJHQ441Jfbd2eet5I4ve46PxGPQiMy680t2HkFQc0ciV8//zQsTrFdkCFADadJTwMY3l1GyVMbkWo623B63OcSIYtCMlO5Gnen17I2hN153r7rRvZndYtC8AKWxZi1P3aVVWOH1MQU1FMy4xMGARKXUCciIcYVWZZSoACsUc7VX7T3/1RWW/tW1bMf/zQMTWDHDmSZ7AVniIOSe/v/lv+r7P/69f/bXp5j/aJMh+tGBcO+kQ4tC4aKqJ0OwNhiPMDi9znK2rrtKOws17G6VccVDXRSaY17T24QLRfZfpFwqxr147jDYP6FCrWC5V6zg8L3pz//NCxP8fan4IANrLYD8hjMeQFFPPlPrLEnVcq3tQt5pJJhRnnqpJAPmO4LBJIwacOUs2YKg2+ldwmXwm7YtXManc70dpq1bczfjWW7Fbt2mxU7pql23a1Yo88pfj2HKFr5uQDQtBY2ON//NAxNUMOOJAPsCaPEvd9bF+xO5WSFHU5Sq+2jm1itCl0f5LbWFNVJncjGHptlNVTEFNRTMuMTAwVVVVVVVVVVVVVVVVVQUAS23UAGAXYt5WM8AiZIRqAr/N3/Us7ZJ+repbIgqDrf//80LE/xgw8hgMyzBcjneRDr9fq7l1f6Kegj/VFXdP/kUhuO5tywQBM0uJBRc9ViTrpwXTrdW5KrLYLlDjCO3GHiaizJthtbepTBtEqjPzlW1Q5UkC8u2sdKfgYlCGa4xdrf9wSG3Le4L/80DE+hlpdhQE0cVgZQrIvueAzLuxo1LqGOyFC06TFAzkfuFbS7O6xt32NRG1IHEMCKIBQUDIHJrpgwugWIxASkqCoE+ZBh0EbviyqPa9ivjKVUWb1Jdant3JFbqzuE3HoytM/0G/q//zQsTZDXDiQN54Wjg9e3HreO7rLrcEr0xQyx+hVC0tFM1f9Hyu1if/XRFpy9RhNLDhZUxBTQibjAGUWnQxcNfjDKZuVeR4sQKXU3c+X9cp1/HMBk+40m2tJFVE1I0FYXXDaj3u9HS7qf/zQMT/GbD6EALScowf5lHTpr73Ktf6iXUmt2e/cxw5TEEJSD4g05IEhhQGkNBbzMwsQxJGSJMG2lFrh4nu5qcVje9VSWc6C4dkwYlWIMwn8auUPKPEp6T41e/Ujm9fgBr4uL+SkHqD//NCxPMYYQoQAtJyVKpG3psf6ytHci9eVUR36En1+xWRTEFNRTMuMTAwVVVVVQXvw0kUWmBxMFEHudOTOFMV9ykIIHG42jgkvUOTi1qsUyXfTb3rQmYF0W0DFPPqZu9Jq+uzEBJqjcUU//NAxOoRcOosFsIiXD7V8evSqySRzNn90S17WM7VKS8Bq4ObSLWgwaOkFZnQeF3XkgYEojvqn1+HUO9Wl3saltv8hs004lGVY6HNuv+7HNWbzcQhEtyrWvuz61Sf4dQ2dfWg4xbPNNr/80LE/RaA/hgM0nB44cxy1XAYbPHxVNb0UwpWVM36q6vVW5UFr4OyPFswVOCAArZHNU9FJ6VioLBLZ1WL0xWl1jBzc8eJc0TpwVMte3C+o747AjtL535Xt2pRC0WMYmu7i+ofXYOllkr/80DE8hOA/iQU0OJwEHUoQFWuUhtzDwniJjBZbakSCjH7JJVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVAUu1oCQ6JiWq0Zihry3Pta2KrsOZc/r7X13qU4pnq//Rx/2vu//zQsT/F5D+HBTTMFyxbKN6yL3ULoFETlS6PXV0/96XqStQc87GmBphAQFgBS9MpfKi0Tpn1dqU0MJOFDp1Q+z1hSzrjhySLMCIaTZY1qSO52w6cC6gARhkvf5m6HtMnlcVslGo0LFERf/zQMT8FtD6IBTSHnj+51T6e8fFtD7d7Xal5qIryewUyFhpVg8ECQiBAIvmJA4DgNCFuvzGZl70scKRsxgGY7MoJspp+tu5iWFBqENetDDqKJblAg58VwDwyQQY/loGDn7AwHCL7GPZ//NCxNwOMOI8HtBaeP20qZaKU0StN5qfal3almqtfowYZAw7MhtMQU1FMy4xMDBVVVVVBK+DjDwYUQkr/U0U3lVNILlR/8bUhoQkc4ZEPwuHVKDFC3Jvp0UFG02CrKyjLQNfXltJ7/vQ//NAxP8XcQIYDNoelNHe/J/1DVRZXse0Ui7a1qqT/6UhtsGcwPgk0MNQzFAUdAnhC4C5NC1uFL6diTaFyNHAkmONk5he+warMUOEzlCGbjy7FIGM5DjT9nVFTIiU1pXIvlQaA8NzLlP/80LE/BeA/hQE4aSUhUPExwGcc1PS9AwuyL0RijlWhTxV/FyK/YdMvWKMlHuQhC2LpkFqIf+WGtmYWBTBTcHAT8qHKOq/tQKuFyX22BsfjlLJrcqbxHHwljiTbU5/P2EZ7Z+hi8++AGj/80DE7RIxAiQU0OKUyzK5bEwOrJT7zw1KCDk2XMLdOSJoxb7aPq/p90/5uYo6e6oTSG2Ed7wgLBoSqya8Pu60+H9v2RIJGE9QVlEXNE99y+6lvLHqxJ+5we7Uj7Vk3ZUTPp2rBIBX7v/zQsT/G5j6DALacJTVot1LtXq//Y7ftS1Ireg987udGf6kVRGUDQmYGkkhhSsjul4pWmgrU/MvUlYwDSMkEI2RWya5kEJqbiTrnNUYTB0OQElsea01yrvhNTFGEsiuUDPy7cFBYUIsKv/zQMTsFdDyFALZsJR5os8UNnxdDblKayaXQo8jQ6tyjKK0UNeq193oWmr6s+KCCpVMQU1FMy4xMDBVVVVVVVVVB+SQFRYy1Zb/PTQ6gKdvVZxzjlfdZ96W05kBlT4nZlLoBYsrf3/S//NCxO8TiOYcDMmweNn6E+1P6dX1qpR8a2zbq7EN/6KVTEFNRTMuMTAL43AaYhG0OGFQNl7B5A19zJREoiIGoYkZmrPqflJ2SsTSxzdmam1qi2TgPM0GS9e6RcUkmTU20m5kIsQ33CrH//NAxPwaEP4QAtpeeJOqHHqu3rikiu3WIVe/92ZQTSph7wUcUWEUsFRcz0HLUGDAKOrREaYIL6Op4jE3QkMXUJg8RxLdq824G8RILUxxRd5tutNt2FayZFemVioGpgLwOlRDjeQ081j/80LE3g6g4jAWwJp4/pNSSqftnmjmixcWNrBNTTyXG5ZTLQIKbYusYkTwjYSDhAVCCBRxEIi8VthMnjfkigLlmw+P48/j1cmGAr5CGRqp1u1m0A0URZFwzy3uXRp3vejG6eSLtklHqjb/80DE9xSY4iQWyNpwrNzMwAupVdHlTPL3OrY1P6fd/ZFtq9n9PTr0f/vRrRgNVkP6fNGMLcEwcZColNRf+RSxhYmgOhbCqahC6nn31jcLuKJu7xIycQImaJ5485cUdLB8WoA8ZeTLk//zQsT/HvlSBALb5FxJaHMLhp8JKdHtYTad1C5XrExTraid1FUINJoMye41zADCRLYMcIkj26t08jTosxwqBA6YAAiwqwBlKdmLeP+saEy2MSDE7W4+1kUKIS8vmZNripn536w9WvTVdf/zQMTfEbECFArJpGwNNRTZA3PYtfmSKkgj2Ih0XLxX++KKVvbs13a0+7+z/V/21aH7Ucx5pOEMK50Bq3IaiFiolghHCgjXxdWsOTpt9nmDSYWbJimp0GOqQSRPqmBidJABnWoVmTVk//NCxPMZ6P4IBNJmcEqIAYNrAaEWvtVCdvVXL1wGeofU3b5/taTPNeMr2dV7eioIq8KZY1XAz4QAgMODA8TehN6B7UPi2AQSAIAxo0YJg7SK2vGdcxoa6KbM6Q0AI8KvUhfDbADFELT9//NAxOcUiP4IANmejDfh/ptLHnopUsjZGvA3a5lYXmETarWzTve2hCEqB++DwxMEiggBUFnOjj/wG2N+uQ0GDJFamrm3ZR/Nw/jr9wyca1z61UgkzEUPy2bUfaxCG3Jyx1Al1Ys1UjH/80LE7xaA+gQCymRscyPcdQ6n6m5HVn3pRMS23I/9YSpMQU0Cv8P2YOoNBpAoPIDV0NJfdn780rmg+QpUlWTDIyjF/5mrlsJR87z/5mm8fNAftVOAyvuvn1zh9yQiXdX1uKsZJ0UpBkP/80DE8RWY4gwU0NpwTY+w65RGnYWsehWSt3dEXOjhNUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVUoMktzBbwxhRDEAbbj6pLlm1L2jt88suk/NmvfakiBXSn1wnu+zSja1ClJStyu1P/zQsT1FGD+DBTaGniKdwFXl2703pXNOaMUD4LJ0fa9NKMDiWAwQMAyygSkRGNYJWJQH6JMYS8nl9kbFPHkhQ4c7PeHJSDakGLWBRSqKj2sjVF7JiBvLjMZoMrUOFjNYoRMFBpdwiDIxP/zQMT8FejmCBTSHnigiqBxZpWPBYsFkzSiKIrfYJlsQWmFUaa7Fovi+nm/vas6typMDMgSETMwIGhcYZDyVyMLjQEwSclbBYhjgSOsqTCpxl/fP18js4GfK9fGl721i+ZgQIgPrdqo//NAxOYQcOIYPsBUeKvf+xX/8W9n7FaG67bvkdf0Ppo+syzMA1MDEsZDxgoJqhYCOBUwQApY6kilFLR09y7Rxq19FlIJ6xetX/q/9vV3cE387lLS93b7VrbxrUbRh4N8pq2e/vYZd/H/80LE/xsI/egA3h4E/hPaMJ8R5qJSNNhPufy0yYc1LPNg3wrTyda78PJVr8J8T/ryZ/fgxOVMQU1FMy4xMDCqqqqqqgvjaAiKPtoEhJPvIw2KuTLb/KamyyJooVk5fLizCr/V6q4PH0f/80DE7RIg4fAM4Z6U/y37aZLZfysjG//5b/ZJVf/rdSGsxhBQnPDJnYoZAUoJEOK8E22VvI2VkuUM1KGHbIwStEGHG3h1mkcra3m46NSarYMkd4ziEiQgtRhGsy2WQKlipYRCUid6Tv/zQsT/HENN1ADgRZX9ae4leSPUkSTPhr2PyvO0ZWSPHa9vw0FZZUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQMTcDejh4BbIUJRVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NCxP8YYPGEAtmesFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV",
};

/* How far a note has to be pitch-shifted to be played at all. The recordings
   are anchors; everything else is one of them sped up or slowed down. Two
   numbers decide whether that still sounds like a piano: the gap between
   anchors, and whether the keyboard ever asks for a note outside them.

   The second one is the part that went wrong. The old test measured gaps
   between the samples and never compared the span to the range the keyboard
   actually plays, so a two-octave stretch at the top passed unnoticed. Both are
   arithmetic, so both are now checked against PIANO_RANGE. (D-071, R-230) */

const PIANO_RANGE = { lowest: 24, highest: 96 };
const KEYBOARD_OCTAVES = 4;
const HIGHEST_START_MIDI = PIANO_RANGE.highest - KEYBOARD_OCTAVES * 12;

const SAMPLE_STEPS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function sampleMidi(name) {
  const m = /^([A-G])(#?)(-?\d+)$/.exec(String(name));
  if (!m) return NaN;
  return SAMPLE_STEPS[m[1]] + (m[2] ? 1 : 0) + (Number(m[3]) + 1) * 12;
}

function sampleAnchors(samples = PIANO_SAMPLES) {
  return Object.keys(samples).map(sampleMidi).sort((a, b) => a - b);
}

/* Semitones between this note and the nearest recording. Zero means the note
   has its own. */
function stretchAt(midi, anchors = sampleAnchors()) {
  let worst = Infinity;
  for (const a of anchors) worst = Math.min(worst, Math.abs(midi - a));
  return worst;
}

/* The worst stretch anywhere the keyboard can reach. */
function worstStretch(anchors = sampleAnchors(),
                      lo = PIANO_RANGE.lowest, hi = PIANO_RANGE.highest) {
  let worst = 0;
  for (let m = lo; m <= hi; m++) worst = Math.max(worst, stretchAt(m, anchors));
  return worst;
}

/* ============================================================================
   INSTRUMENTS, DELAY, VOICINGS — data and arithmetic. (D-040, D-041, D-042)
   ========================================================================== */

/* Each preset is data: the audio layer builds from it and holds no opinions.
   `release` feeds the voice budget, so a long tail is accounted for rather
   than cut off or leaked. (D-038, D-040) */
const INSTRUMENTS = [
  /* Recorded piano. Everything else here is synthesis, and synthesis is why
     the app sounded like a toy. (D-062) */
  /* Kept, but no longer the default: the recordings are fetched from another
     site and some environments block that outright, which is silence where a
     first-time user expects a piano. (D-067) */
  { id: "grand", name: "Grand piano", kind: "sampler",
    note: "Real recordings, built into the app. No download, works offline.",
    volume: -6, release: 1.2, delay: false, fallback: "felt",
    samples: { baseUrl: "", urls: PIANO_SAMPLES },
    credit: PIANO_CREDIT,
    options: { release: 1.2 } },

  /* A Rhodes is a struck tine: the bell is the attack only, and the body that
     follows is nearly a sine. The first attempt kept the bell ringing for the
     whole note, which is exactly why it sounded like a marimba. (D-062) */
  { id: "rhodes", name: "Rhodes", kind: "fm",
    note: "Struck tine with a bell in the attack. Soul and R&B.",
    volume: -10, release: 1.1, delay: true,
    options: {
      harmonicity: 2.01, modulationIndex: 5.5,
      oscillator: { type: "sine" },
      envelope: { attack: 0.003, decay: 3.2, sustain: 0.06, release: 1.1 },
      modulation: { type: "sine" },
      modulationEnvelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.1 },
    } },

  { id: "felt", name: "Felt keys", kind: "am",
    note: "Soft and close, with the hammers muted. Quiet writing sound.",
    volume: -13, release: 1.0, delay: false,
    options: {
      harmonicity: 1.5,
      oscillator: { type: "triangle" },
      envelope: { attack: 0.01, decay: 2.4, sustain: 0.04, release: 1.0 },
      modulation: { type: "sine" },
      modulationEnvelope: { attack: 0.02, decay: 0.4, sustain: 0, release: 0.4 },
    } },

  { id: "pad", name: "Warm pad", kind: "am",
    note: "Sustains while you look at the keyboard. Chords over anything.",
    volume: -18, release: 1.4, delay: true,
    options: {
      harmonicity: 2,
      oscillator: { type: "sine" },
      envelope: { attack: 0.35, decay: 0.4, sustain: 0.7, release: 1.4 },
      modulation: { type: "square" },
      modulationEnvelope: { attack: 0.5, decay: 0.2, sustain: 0.6, release: 1.0 },
    } },

  { id: "pluck", name: "Marimba", kind: "fm",
    note: "Short and wooden. Cuts through a busy beat.",
    volume: -10, release: 0.3, delay: false,
    options: {
      harmonicity: 4, modulationIndex: 3,
      oscillator: { type: "sine" },
      envelope: { attack: 0.002, decay: 0.8, sustain: 0, release: 0.3 },
      modulation: { type: "sine" },
      modulationEnvelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.1 },
    } },
];

const instrumentById = (id) => INSTRUMENTS.find((i) => i.id === id) ?? INSTRUMENTS[0];

/* Echo and reverb, each a short list of settings rather than a rack of knobs.
   The first version had one basic echo and nothing else, which is most of why
   everything sounded dry and small. (D-041, D-061) */
function delaySettings(instrumentId, on) {
  if (!on) return { wet: 0, feedback: 0, time: 0.25 };
  const inst = instrumentById(instrumentId);
  return inst.id === "pad"
    ? { wet: 0.30, feedback: 0.40, time: 0.42 }
    : { wet: 0.22, feedback: 0.30, time: 0.28 };
}

const SPACES = [
  { id: "dry",   name: "Dry",   decay: 0.3, wet: 0,    note: "No room at all. Every note stops where it stops." },
  { id: "room",  name: "Room",  decay: 1.1, wet: 0.20, note: "A small space. Takes the hard edge off without blurring anything." },
  { id: "hall",  name: "Hall",  decay: 3.2, wet: 0.34, note: "Wide and slow. Chords bloom into each other." },
  { id: "cave",  name: "Cave",  decay: 6.5, wet: 0.44, note: "Enormous. One chord is an arrangement." },
];

function reverbSettings(spaceId) {
  const s = SPACES.find((x) => x.id === spaceId) ?? SPACES[0];
  return { decay: s.decay, wet: s.wet };
}

/* ---- voicings: the J-6 lesson, applied. (D-042, UC-35) ----
   The same chord arranged differently. Close is what the app has always
   played; the rest are what make a chord sound like a record rather than an
   exercise. Some deliberately drop notes — that is the point of them. */
function voicingsFor(chord) {
  /* Arrangements are derived from the chord's CLOSE position, never from
     whatever arrangement it is currently wearing. Choosing one used to rewrite
     the chord's notes, so the next list was built from the previous choice and
     every option collapsed towards the others. (D-065) */
  const entry = DICTIONARY.find((d) => d.q === chord.sym);
  /* The octave comes from the chord itself. Inferring it from the lowest note
     meant a spread voicing, whose root sits an octave down, re-derived the
     whole chord an octave lower the next time it was asked. (D-065) */
  const base = chord.base ?? Math.floor(Math.min(...chord.notes) / 12) * 12;
  const notes = entry
    ? voice(chord.rootPc, entry.iv, base)
    : [...chord.notes].sort((a, b) => a - b);
  const out = [{ id: "close", name: "Close", notes,
                 why: "Every note as tightly packed as possible. Clear, and a little plain." }];

  /* Extended chords depend on their spacing far more than on their notes: a
     minor 11th stacked in thirds is mud, and in fourths it is the sound people
     mean by the name. Where the dictionary knows the spacing, offer it. (D-059) */
  if (entry?.voicing) {
    out.push({ id: "signature", name: "Signature", notes: voice(chord.rootPc, entry.voicing, base),
               why: "The spacing this chord is usually played with. Wider, and it stops sounding like a stack." });
  }

  if (notes.length >= 3) {
    /* Drop-2 for small chords. For five notes and up, drop-2-and-4: dropping a
       single note out of a six-note stack leaves the rest just as crowded,
       which is why the big extended chords all sounded alike. (D-065) */
    const dropped = [...notes];
    dropped[dropped.length - 2] -= 12;
    if (notes.length >= 5) dropped[dropped.length - 4] -= 12;
    out.push({ id: "open", name: "Open", notes: [...dropped].sort((a, b) => a - b),
               why: notes.length >= 5
                 ? "Two inner notes dropped an octave. The gaps are what stop a big chord turning to mud."
                 : "One inner note dropped an octave. More air between the notes." });
  }

  if (notes.length >= 3) {
    out.push({ id: "spread", name: "Spread", notes: [notes[0] - 12, ...notes.slice(1)],
               why: "Root well below the rest. Sounds big, and leaves room for a bassline." });
  }

  if (notes.length >= 4) {
    out.push({ id: "rootless", name: "Rootless", notes: notes.slice(1),
               why: "No root at all — the bass covers it. The chord floats." });
    out.push({ id: "shell", name: "Shell", notes: [notes[0], notes[1], notes[3]],
               why: "Root, third and seventh only. The fifth adds nothing here." });
  }

  return out.map((v) => ({ ...v, notes: v.notes.slice(0, 8) }));
}


/* ============================================================================
   LOOP SCHEDULING — our own, because the library transport kept failing
   quietly and I could not test it. Pure arithmetic. (D-043)
   ========================================================================== */

/* Which bars fall inside the lookahead window, and where does the cursor end
   up? A scheduler is a question about time, and time is arithmetic. */
function barsToSchedule({ nextBarAt, barIndex }, now, lookahead, barSeconds) {
  const bars = [];
  let at = nextBarAt, i = barIndex, guard = 0;
  while (at < now + lookahead && guard++ < 32) {
    bars.push({ at: Math.max(at, now), index: i });
    at += barSeconds;
    i += 1;
  }
  return { bars, state: { nextBarAt: at, barIndex: i } };
}

const barSecondsAt = (bpm, beats = 4) => (60 / bpm) * beats;

/* ============================================================================
   TEACHING: compatibility, harmonisation, voice leading, what comes next
   (D-044)
   ========================================================================== */

/* A chord with notes outside the key is not a mistake — it belongs to a scale
   the user has not chosen yet. Name that scale. (UC-37) */
function suggestScaleFor(chord, ctx) {
  const chordPcs = [...new Set(chord.notes.map(pc))];
  const parentId = ctx.mode === "minor" ? "natural-minor" : "major";
  const outside = chordPcs.filter((p) => !scalePcs(ctx.tonic, parentId).includes(p));
  if (!outside.length) return null;

  const fits = SCALES
    .filter((s) => s.mode === ctx.mode && s.id !== parentId && s.iv.length >= 7)
    .map((s) => ({ scale: s, missing: chordPcs.filter((p) => !scalePcs(ctx.tonic, s.id).includes(p)) }))
    .filter((f) => f.missing.length === 0);

  if (!fits.length) return null;
  return {
    scale: fits[0].scale,
    outside,
    why: `Those notes aren't in your scale, but they are all in ${fits[0].scale.name.toLowerCase()}. That's where this chord comes from.`,
  };
}

/* Building one chord out of the scale, a step at a time, for the piano to
   follow. (UC-38) */
function harmonizeSteps(tonic, scaleId, degreeIndex, size = 3, system = "letters") {
  const notes = scalePcs(tonic, scaleId);
  if (notes.length !== 7) return [];
  const idx = size === 5 ? [0, 2, 4, 6, 8] : size === 4 ? [0, 2, 4, 6] : [0, 2, 4];
  const steps = [];
  const taken = [];
  for (let k = 0; k < idx.length; k++) {
    const p = notes[(degreeIndex + idx[k]) % 7];
    taken.push(p);
    const skipped = k === 0 ? null : notes[(degreeIndex + idx[k] - 1) % 7];
    steps.push({
      pcs: [...taken],
      added: p,
      skipped,
      text: k === 0
        ? `Start on ${noteName(p, system)}.`
        : `Skip ${noteName(skipped, system)}, take ${noteName(p, system)}.`,
    });
  }
  const chord = harmonize(tonic, scaleId, size)[degreeIndex];
  steps.push({
    pcs: [...taken], added: null, skipped: null,
    text: `That's ${chordLabel(chord.rootPc, chord.sym, system)} — every other note of the scale, starting from ${noteName(notes[degreeIndex], system)}.`,
  });
  return steps;
}

/* Which notes stay put between two chords, and which have to move. (UC-39) */
function voiceLeading(from, to, system = "letters") {
  const a = [...new Set(from.notes.map(pc))];
  const b = [...new Set(to.notes.map(pc))];
  const common = a.filter((p) => b.includes(p));
  const leaving = a.filter((p) => !b.includes(p));
  const arriving = b.filter((p) => !a.includes(p));

  /* pair each departing note with its nearest arrival */
  const moves = [];
  const unclaimed = [...arriving];
  for (const p of leaving) {
    let best = null, bestDist = 99;
    for (const q of unclaimed) {
      const d = Math.min(pc(q - p), pc(p - q));
      if (d < bestDist) { bestDist = d; best = q; }
    }
    if (best !== null) {
      unclaimed.splice(unclaimed.indexOf(best), 1);
      moves.push({ from: p, to: best, semitones: bestDist });
    } else {
      moves.push({ from: p, to: null, semitones: null });
    }
  }
  for (const q of unclaimed) moves.push({ from: null, to: q, semitones: null });

  const distance = moves.reduce((n, m) => n + (m.semitones ?? 2), 0);
  return {
    common, moves, distance,
    smoothness: common.length >= 2 ? "very smooth" : common.length === 1 ? "smooth" : "a real move",
    why: common.length
      ? `${common.map((p) => noteName(p, system)).join(" and ")} stay${common.length === 1 ? "s" : ""} where ${common.length === 1 ? "it is" : "they are"}. Only ${moves.filter((m) => m.from !== null).length} note${moves.filter((m) => m.from !== null).length === 1 ? "" : "s"} moves.`
      : "Nothing is held over — every note moves. Use it where you want a lift.",
  };
}

/* What could come next? Ranked by how the harmony actually behaves. (UC-40) */
function suggestNextChords(prog, tonic, mode, size = 3) {
  const palette = harmonize(tonic, mode === "minor" ? "natural-minor" : "major", size);
  if (!prog.length) return palette.slice(0, 4).map((c) => ({ chord: c, why: "Somewhere to start." }));

  const last = prog[prog.length - 1];
  const home = palette[0];
  const usedRoots = prog.map((c) => c.rootPc);

  const scored = palette
    .filter((c) => c.rootPc !== last.rootPc)
    .map((c) => {
      const vl = voiceLeading(last, c);
      let score = vl.common.length * 2;
      let why = "";
      const interval = pc(c.rootPc - last.rootPc);

      if (interval === 5) { score += 3; why = "Its root is a fourth up — the strongest move in music."; }
      else if (interval === 7) { score += 2; why = "A fifth up. Sounds like it's going somewhere."; }
      else if (vl.common.length >= 2) { why = "Shares two notes with the chord before it, so it slides in."; }
      else if (interval === 2 || interval === 10) { why = "A step away. Sounds like motion rather than a jump."; }
      else why = "A bigger jump. Good where you want the ear to notice.";

      if (c.rootPc === home.rootPc && prog.length >= 3) { score += 2; why = "Back home. Closes the loop."; }
      if (!usedRoots.includes(c.rootPc)) score += 1;

      return { chord: c, why, score, common: vl.common.length };
    })
    .sort((x, y) => y.score - x.score);

  return scored.slice(0, 4);
}


/* ============================================================================
   REVERSE SEARCH — notes in, names out. (D-047, UC-42)

   The piano stops being only a display and becomes an input device: choose
   notes, and the app says what they are. Ambiguity is the interesting part —
   E G# B C# really is both C#m7/E and E6 — so every reading is returned,
   ranked, rather than one being picked and the rest hidden.
   ========================================================================== */

const INTERVAL_NAMES = {
  1: "minor 2nd", 2: "major 2nd", 3: "minor 3rd", 4: "major 3rd", 5: "perfect 4th",
  6: "tritone", 7: "perfect 5th", 8: "minor 6th", 9: "major 6th",
  10: "minor 7th", 11: "major 7th", 0: "octave",
};

/* Every interval signature we can name, from both tables. */
const SIGNATURES = (() => {
  const map = {};
  for (const [k, v] of Object.entries(QUALITIES)) map[k] = { ...v, rank: 3 };
  for (const d of DICTIONARY) {
    const key = [...new Set(d.iv.map((i) => pc(i)))].sort((a, b) => a - b).join(",");
    if (!map[key]) map[key] = { sym: d.q, full: d.full, rank: 2 };
  }
  return map;
})();

function identifyChord(midis, system = "letters") {
  const sorted = [...new Set(midis)].sort((a, b) => a - b);
  if (sorted.length < 2) return [];
  const pcs = [...new Set(sorted.map(pc))];
  const bass = pc(sorted[0]);

  if (pcs.length === 2) {
    /* measured upward from the lowest note played, not by the smaller of the
       two inversions — C up to G is a fifth, whatever G down to C is. */
    const top = pc(sorted[sorted.length - 1]);
    const up = pc(top - bass);
    return [{
      label: `${noteName(bass, system)} + ${noteName(top, system)}`,
      full: INTERVAL_NAMES[up] ?? "interval", rootPc: bass, sym: "", notes: sorted, bass,
      score: 1, why: "Two notes are an interval, not yet a chord. Add a third to give it a mood.",
    }];
  }

  const out = [];
  for (const root of pcs) {
    const sig = pcs.map((p) => pc(p - root)).sort((a, b) => a - b).join(",");
    const q = SIGNATURES[sig];
    if (!q) continue;
    const inverted = root !== bass;
    out.push({
      rootPc: root, sym: q.sym, full: q.full, notes: sorted, bass,
      label: chordLabel(root, q.sym, system) + (inverted ? `/${noteName(bass, system)}` : ""),
      score: q.rank + (inverted ? 0 : 2),
      why: inverted
        ? `Same notes, with ${noteName(bass, system)} at the bottom instead of ${noteName(root, system)}.`
        : "The lowest note is the root, so this is the most likely reading.",
    });
  }
  return out.sort((a, b) => b.score - a.score);
}

/* Which keys contain all of these notes? */
function keysContaining(midis) {
  const pcs = [...new Set(midis.map(pc))];
  if (!pcs.length) return [];
  const out = [];
  for (let tonic = 0; tonic < 12; tonic++) {
    for (const mode of ["minor", "major"]) {
      const notes = scalePcs(tonic, mode === "minor" ? "natural-minor" : "major");
      if (pcs.every((p) => notes.includes(p))) out.push({ tonic, mode });
    }
  }
  return out;
}

/* Which scales, in any key, contain all of them? Ranked by how few notes they
   add — the tightest fit says the most. */
function scalesContaining(midis, limit = 6) {
  const pcs = [...new Set(midis.map(pc))];
  if (!pcs.length) return [];
  const out = [];
  for (let tonic = 0; tonic < 12; tonic++) {
    for (const s of SCALES) {
      const notes = scalePcs(tonic, s.id);
      if (pcs.every((p) => notes.includes(p))) {
        out.push({ tonic, scale: s, extra: notes.length - pcs.length });
      }
    }
  }
  return out.sort((a, b) => a.extra - b.extra || a.scale.iv.length - b.scale.iv.length).slice(0, limit);
}

/* Arpeggios: the same notes, one at a time. (UC-43) */
function arpeggio(notes, direction = "up") {
  const asc = [...notes].sort((a, b) => a - b);
  if (direction === "down") return [...asc].reverse();
  if (direction === "updown") return [...asc, ...asc.slice(0, -1).reverse().slice(0, -1)];
  return asc;
}

/* Of the ways to play the next chord, which moves the least? (UC-44) */
function smoothestVoicing(from, to, system = "letters") {
  const options = voicingsFor(to);
  const scored = options.map((v) => {
    const distance = v.notes.reduce((sum, n) => {
      const nearest = from.notes.reduce((best, f) => Math.min(best, Math.abs(f - n)), 99);
      return sum + nearest;
    }, 0) / v.notes.length;
    return { ...v, distance };
  }).sort((a, b) => a.distance - b.distance);

  const best = scored[0];
  const held = voiceLeading(from, to).common;
  return {
    ...best,
    why: held.length
      ? `Of the ${options.length} ways to play it, this one moves least — ${held.map((p) => noteName(p, system)).join(" and ")} stay where they are.`
      : `Of the ${options.length} ways to play it, this one asks the hands to travel least.`,
    alternatives: scored.slice(1),
  };
}


/* ============================================================================
   YOUR OWN CHORDS AND SCALES — a selection, named, that behaves like anything
   built in. (D-048, UC-45)
   ========================================================================== */

/* Ids are derived from the notes, not from a clock, so the same selection
   always produces the same object — and the theory layer stays pure. */
function customChordFrom(midis, name) {
  const notes = [...new Set(midis)].sort((a, b) => a - b);
  if (notes.length < 2) return null;
  const best = identifyChord(notes)[0] ?? null;
  return {
    id: `mine-c-${notes.join("_")}`,
    name: name?.trim() || best?.label || "Untitled",
    rootPc: best ? best.rootPc : pc(notes[0]),
    sym: best?.sym ?? "",
    full: best?.full ?? "voicing of your own",
    notes, degreeIndex: 0, roman: "", mine: true,
  };
}

/* Standard one-octave fingerings, ascending, tonic to tonic, for the major and
   natural minor scales: index = tonic pitch class. Each entry was checked
   against two published sources (piano-keyboard-guide.com and pianoscales.org,
   with piano.org and vitapiano.com where those two disagreed) on 2026-10-01.
   Where sources differ (B♭ major RH, G# minor) the more common one is used. */
const SCALE_FINGERING = {
  major: {
    0: { R: [1,2,3,1,2,3,4,5], L: [5,4,3,2,1,3,2,1] },   // C major
    1: { R: [2,3,1,2,3,4,1,2], L: [3,2,1,4,3,2,1,3] },   // Db major
    2: { R: [1,2,3,1,2,3,4,5], L: [5,4,3,2,1,3,2,1] },   // D major
    3: { R: [3,1,2,3,4,1,2,3], L: [3,2,1,4,3,2,1,3] },   // Eb major
    4: { R: [1,2,3,1,2,3,4,5], L: [5,4,3,2,1,3,2,1] },   // E major
    5: { R: [1,2,3,4,1,2,3,4], L: [5,4,3,2,1,3,2,1] },   // F major
    6: { R: [2,3,4,1,2,3,1,2], L: [4,3,2,1,3,2,1,4] },   // F# major
    7: { R: [1,2,3,1,2,3,4,5], L: [5,4,3,2,1,3,2,1] },   // G major
    8: { R: [3,4,1,2,3,1,2,3], L: [3,2,1,4,3,2,1,3] },   // Ab major
    9: { R: [1,2,3,1,2,3,4,5], L: [5,4,3,2,1,3,2,1] },   // A major
    10: { R: [4,1,2,3,1,2,3,4], L: [3,2,1,4,3,2,1,3] },   // Bb major
    11: { R: [1,2,3,1,2,3,4,5], L: [4,3,2,1,4,3,2,1] },   // B major
  },
  minor: {
    0: { R: [1,2,3,1,2,3,4,5], L: [5,4,3,2,1,3,2,1] },   // C minor
    1: { R: [3,4,1,2,3,1,2,3], L: [3,2,1,4,3,2,1,3] },   // C# minor
    2: { R: [1,2,3,1,2,3,4,5], L: [5,4,3,2,1,3,2,1] },   // D minor
    3: { R: [3,1,2,3,4,1,2,3], L: [2,1,4,3,2,1,3,2] },   // Eb minor
    4: { R: [1,2,3,1,2,3,4,5], L: [5,4,3,2,1,3,2,1] },   // E minor
    5: { R: [1,2,3,4,1,2,3,4], L: [5,4,3,2,1,3,2,1] },   // F minor
    6: { R: [2,3,1,2,3,1,2,3], L: [4,3,2,1,3,2,1,4] },   // F# minor
    7: { R: [1,2,3,1,2,3,4,5], L: [5,4,3,2,1,3,2,1] },   // G minor
    8: { R: [3,4,1,2,3,1,2,3], L: [3,2,1,3,2,1,4,3] },   // G# minor
    9: { R: [1,2,3,1,2,3,4,5], L: [5,4,3,2,1,3,2,1] },   // A minor
    10: { R: [2,1,2,3,1,2,3,4], L: [2,1,3,2,1,4,3,2] },   // Bb minor
    11: { R: [1,2,3,1,2,3,4,5], L: [4,3,2,1,4,3,2,1] },   // B minor
  },
};

/* ==========================================================================
   Finger numbers (D-078)
   1 is the thumb, 5 the little finger, in either hand. Chords are fingered by
   rule, because every method agrees on the rule. Scales are looked up, because
   they don't follow one: F major, B major and the black-key scales each have
   their own. The app can't see your hands, so all of this is suggested, never
   checked.
   ========================================================================== */

/* How far one hand reaches, in keys from the lowest note to the highest. An
   octave by default: about 3 in 10 adult women can't play one comfortably on a
   standard keyboard, and most can't reach a tenth (Boyle, Boyle & Booker). */
const HAND_REACH = [
  { id: "7th", keys: 11 }, { id: "octave", keys: 12 }, { id: "9th", keys: 14 }, { id: "10th", keys: 16 },
];
const DEFAULT_REACH = 12;
const FINGER_HANDS = ["off", "right", "left", "both"];
/* Which hand's fingers show: whatever was chosen, and until something is,
   the right hand in Learn and nothing anywhere else. */
const effectiveFingerHand = (choice, tab) => choice ?? (tab === "learn" ? "right" : "off");
const FINGER_COPY = {
  suggested: "Suggested fingering",
  split: "Split between hands",
  tooWide: "Too wide to play as written",
};

/* One hand, notes rising. Right-hand fingers rise with the notes, left-hand
   fingers fall. Three notes: the middle finger is 3, unless the gap between
   it and the little finger's note is a fourth or more; then 2. That one rule
   gives the standard fingering for every triad in every inversion. */
function handFingers(notes, hand) {
  const n = notes.length;
  const R = hand === "R";
  if (n === 1) return [R ? 1 : 5];
  if (n === 2) {
    const d = notes[1] - notes[0];
    const outer = d <= 2 ? 2 : d <= 4 ? 3 : d <= 6 ? 4 : 5;
    return R ? [1, outer] : [outer, 1];
  }
  if (n === 3) {
    return R ? [1, notes[2] - notes[1] >= 5 ? 2 : 3, 5]
             : [5, notes[1] - notes[0] >= 5 ? 2 : 3, 1];
  }
  if (n === 4) return R ? [1, 2, 3, 5] : [5, 3, 2, 1];
  if (n === 5) return R ? [1, 2, 3, 4, 5] : [5, 4, 3, 2, 1];
  return null;
}

const fitsHand = (notes, reach) =>
  notes.length >= 1 && notes.length <= 5 && notes[notes.length - 1] - notes[0] <= reach;

/* Which hand plays which note of a chord, and with which finger.
   hand: "right" | "left" | "both". In "both" the left hand plays the bass
   (a slash chord's bass, or the root an octave below the chord) and the right
   hand the chord. A chord one hand can't reach is split, whatever was asked,
   the left taking as few of the lowest notes as it can.
   Returns { keys: [{ midi, finger, hand }], brackets, split, tooWide, extraBass }. */
function fingerChord(chordNotes, { hand = "right", reach = DEFAULT_REACH, rootPc = null, bassPc = null } = {}) {
  const notes = [...new Set(chordNotes)].sort((a, b) => a - b);
  const none = { keys: [], brackets: [], split: false, tooWide: false, extraBass: null };
  if (!notes.length || hand === "off") return none;
  const assign = (ns, h) => handFingers(ns, h).map((finger, i) => ({ midi: ns[i], finger, hand: h }));
  const bracket = (ns, h) => ({ lo: ns[0], hi: ns[ns.length - 1], hand: h });
  const twoHands = (L, R, extra = null, split = false) => ({
    keys: [...assign(L, "L"), ...assign(R, "R")], brackets: [bracket(L, "L"), bracket(R, "R")],
    split, tooWide: false, extraBass: extra,
  });
  const splitOf = (ns) => {
    for (let k = 1; k < ns.length; k++) {
      const L = ns.slice(0, k), R = ns.slice(k);
      if (fitsHand(L, reach) && fitsHand(R, reach)) return twoHands(L, R, null, true);
    }
    return { ...none, tooWide: true };
  };

  if (hand === "both") {
    const target = bassPc ?? rootPc ?? pc(notes[0]);
    // a chord that already carries its own bass under it (C/E typed as a slash chord)
    if (bassPc !== null && bassPc !== rootPc && pc(notes[0]) === bassPc && notes.length > 1 && fitsHand(notes.slice(1), reach)) {
      return twoHands([notes[0]], notes.slice(1));
    }
    if (!fitsHand(notes, reach)) return splitOf(notes);
    let bass = notes[0] - 12;
    while (pc(bass) !== target) bass++;
    if (bass > notes[0] - 12) bass -= 12;   // at least an octave below the chord
    return twoHands([bass], notes, bass);
  }
  const h = hand === "left" ? "L" : "R";
  if (fitsHand(notes, reach)) return { ...none, keys: assign(notes, h) };
  return splitOf(notes);
}

/* Where the hand has to move in a run of fingers. Going the natural way
   (right hand up, left hand down) fingers rise; a step against that is either
   the thumb tucking under or a finger crossing over it. */
function fingerCrossings(fingers, hand, direction = "up") {
  const rising = (hand === "R") === (direction === "up");
  const out = [];
  for (let i = 1; i < fingers.length; i++) {
    const against = rising ? fingers[i] < fingers[i - 1] : fingers[i] > fingers[i - 1];
    if (against) out.push({ index: i, label: fingers[i] === 1 ? "thumb under" : `${fingers[i]} crosses over` });
  }
  return out;
}

/* A one-octave scale run as fingers: the table entry for its tonic and mode,
   reversed for a run downwards. midis: the 8 notes in the order played.
   Returns [{ midi, finger, cross }] or null when the table has no answer. */
function scaleFingering(midis, mode, hand) {
  if (midis.length !== 8) return null;
  const down = midis[0] > midis[7];
  const up = down ? [...midis].reverse() : midis;
  const table = SCALE_FINGERING[mode === "minor" ? "minor" : "major"]?.[pc(up[0])];
  if (!table) return null;
  const scale = scalePcs(pc(up[0]), mode === "minor" ? "natural-minor" : "major");
  if (!up.slice(0, 7).every((m, i) => pc(m) === scale[i]) || pc(up[7]) !== pc(up[0])) return null;
  const ascending = table[hand];
  const fingers = down ? [...ascending].reverse() : ascending;
  const crosses = fingerCrossings(fingers, hand, down ? "down" : "up");
  return midis.map((m, i) => ({ midi: m, finger: fingers[i], cross: crosses.find((c) => c.index === i)?.label ?? null }));
}

/* The fingering a lesson step suggests, as keys and as one line of words. */
function stepFingering(step, mode, hand = "R", reach = DEFAULT_REACH, system = "letters") {
  const nm = (m) => noteName(m, system);
  const handName = hand === "R" ? "right hand" : "left hand";
  if (step.target.kind === "sequence") {
    const run = scaleFingering(step.show, mode, hand);
    if (run) {
      const parts = [];
      let group = [];
      for (const k of run) {
        if (k.cross) { parts.push(group.join(" ")); parts.push(`${k.cross} onto ${nm(k.midi)}`); group = []; }
        group.push(k.finger);
      }
      parts.push(group.join(" "));
      return { keys: run.map(({ midi, finger }) => ({ midi, finger, hand })),
               text: `${FINGER_COPY.suggested}, ${handName}: ${parts.join(", ")}.` };
    }
    const sorted = [...step.show].sort((a, b) => a - b);
    if (!fitsHand(sorted, reach)) return null;   // a long run with no table answer: say nothing rather than guess
    const f = handFingers(sorted, hand);
    const byMidi = new Map(sorted.map((m, i) => [m, f[i]]));
    const fingers = step.show.map((m) => byMidi.get(m));
    return { keys: step.show.map((m, i) => ({ midi: m, finger: fingers[i], hand })),
             text: `${FINGER_COPY.suggested}, ${handName}: ${fingers.join("-")}.` };
  }
  const chord = fingerChord(step.show, { hand: hand === "R" ? "right" : "left", reach });
  if (!chord.keys.length) return null;
  const keys = [...chord.keys].sort((a, b) => a.midi - b.midi);
  const text = chord.split
    ? `${FINGER_COPY.suggested}: ${FINGER_COPY.split.toLowerCase()}.`
    : `${FINGER_COPY.suggested}, ${handName}: ${keys.map((k) => k.finger).join("-")}.`;
  return { keys, text };
}

/* Fingers for the keys a lesson has lit: the notes played so far, plus any
   shown or hinted. A sequence is matched note by note, a chord by name. */
function litLessonFingers(fingering, step, attempt, shown, hint) {
  if (!fingering) return [];
  const out = new Map();
  if (step.target.kind === "sequence") {
    attempt.forEach((m, i) => { const k = fingering.keys[i]; if (k && pc(k.midi) === pc(m)) out.set(m, k); });
    if (hint !== null && fingering.keys[attempt.length]) out.set(hint, fingering.keys[attempt.length]);
  } else {
    for (const m of attempt) { const k = fingering.keys.find((x) => pc(x.midi) === pc(m)); if (k) out.set(m, k); }
    if (hint !== null) { const k = fingering.keys.find((x) => pc(x.midi) === pc(hint)); if (k) out.set(hint, k); }
  }
  for (const m of shown) { const k = fingering.keys.find((x) => x.midi === m); if (k) out.set(m, k); }
  return [...out.entries()].map(([midi, k]) => ({ midi, finger: k.finger, hand: k.hand }));
}

/* ==========================================================================
   Typing chord names (D-077)
   "Bm7 F#m7 Fmaj7" is quicker than tapping twenty notes, and chord charts
   are written that way. The vocabulary is the dictionary: a name is read only
   if the dictionary can voice it, so a typed chord sounds exactly like the
   same chord picked from a list. Anything else is refused with a reason,
   never guessed.
   ========================================================================== */

const TYPED_LETTER_PC = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
const SOLFEGE_PC = [["sol", 7], ["do", 0], ["re", 2], ["mi", 4], ["fa", 5], ["so", 7], ["la", 9], ["si", 11], ["ti", 11]];

/* The spellings chord charts actually use, mapped onto dictionary names.
   Keys are compared after tidying: ♭ ♯ to b #, brackets dropped. */
const CHORD_ALIASES = {
  maj: "", major: "", M: "",
  min: "m", minor: "m", "-": "m",
  "°": "dim", "+": "aug", "#5": "aug",
  M7: "maj7", "Δ": "maj7", "Δ7": "maj7", ma7: "maj7", "7M": "maj7", j7: "maj7",
  min7: "m7", "-7": "m7",
  "ø": "m7♭5", "ø7": "m7♭5", "-7b5": "m7♭5", min7b5: "m7♭5",
  "°7": "dim7", mM7: "mMaj7", mmaj7: "mMaj7", "m7M": "mMaj7", "-Δ7": "mMaj7",
  M9: "maj9", "Δ9": "maj9", "-9": "m9", min9: "m9",
  sus: "sus4", "7sus": "7sus4", "9sus": "9sus4", "7sus49": "9sus4", "74/9": "9sus4", "7sus9": "9sus4",
  "69": "6/9", add2: "add9", "2": "add9", madd9: "m(add9)", "-add9": "m(add9)",
  "-6": "m6", "-11": "m11", M13: "maj13", "Δ13": "maj13", "-13": "m13",
  "Δ#11": "maj7♯11", "M7#11": "maj7♯11", sus49: "sus4(9)", sus24: "sus4(9)",
};
const tidySuffix = (x) => x.replace(/♭/g, "b").replace(/♯/g, "#").replace(/[()]/g, "");
const SUFFIXES = (() => {
  const out = new Map();
  for (const d of DICTIONARY) out.set(tidySuffix(d.q), d.q);
  for (const [alias, q] of Object.entries(CHORD_ALIASES)) out.set(tidySuffix(alias), q);
  return out;
})();

/* A note name at the start of text: letters (any case, # or b after) or,
   when the app speaks Do-Re-Mi, solfège. Returns { pc, rest } or null. */
function readRoot(text, system = "letters") {
  if (baseOf(system) === "solfege") {
    const low = text.toLowerCase();
    for (const [syl, p] of SOLFEGE_PC) {
      if (low.startsWith(syl)) return withAccidental(p, text.slice(syl.length));
    }
    return null;
  }
  const p = TYPED_LETTER_PC[text[0]?.toLowerCase()];
  return p === undefined ? null : withAccidental(p, text.slice(1));
}
function withAccidental(p, rest) {
  if (/^(#|♯)/.test(rest)) return { pc: pc(p + 1), rest: rest.slice(1) };
  if (/^(b|♭)/.test(rest)) return { pc: pc(p - 1), rest: rest.slice(1) };
  return { pc: p, rest };
}

/* The dictionary name nearest to something unknown: the one sharing the
   longest start, shortest first. Offered, never applied. */
function nearestSuffix(suffix) {
  const t = tidySuffix(suffix);
  let best = null, bestLen = 0;
  for (const d of DICTIONARY) {
    const k = tidySuffix(d.q);
    let n = 0;
    while (n < k.length && n < t.length && k[n] === t[n]) n++;
    if (n > bestLen || (n === bestLen && n > 0 && k.length < tidySuffix(best).length)) { best = d.q; bestLen = n; }
  }
  return bestLen > 0 ? best : null;
}

/* One chord name. { ok, rootPc, sym, full, bassPc, text } or { ok: false, text, reason }. */
function parseChordName(text, system = "letters") {
  const raw = text.trim();
  const nm = (p) => noteName(p, system);
  let body = raw, bassPc = null;
  const slash = raw.lastIndexOf("/");
  if (slash > 0) {
    const bass = readRoot(raw.slice(slash + 1), system);
    if (bass && bass.rest === "") { bassPc = bass.pc; body = raw.slice(0, slash); }
  }
  const root = readRoot(body, system);
  if (!root) {
    const names = baseOf(system) === "solfege" ? "Do, Re, Mi, Fa, Sol, La, Si" : "A to G";
    return { ok: false, text: raw, reason: `"${raw}" doesn't start with a note name (${names}).` };
  }
  const q = SUFFIXES.get(tidySuffix(root.rest));
  if (q === undefined) {
    const near = nearestSuffix(root.rest);
    return { ok: false, text: raw,
      reason: `"${root.rest}" isn't a chord type I know${near !== null ? `. Did you mean ${nm(root.pc)}${near}?` : "."}` };
  }
  const d = DICTIONARY.find((x) => x.q === q);
  return { ok: true, text: raw, rootPc: root.pc, sym: q, full: d.full, bassPc };
}

/* A line from a chord chart: spaces, commas, bar lines and dashes between
   chords are all just separators. */
function parseChordNames(line, system = "letters") {
  return line.split(/[\s,|]+/).filter((t) => t && !/^[-–—/.]+$/.test(t)).map((t) => parseChordName(t, system));
}

/* A parsed name as a chord the app can play, loop and explain: voiced by the
   dictionary, numbered in the current key, with a slash bass under it. */
function typedChord(parsed, tonic, mode, base = DEFAULT_BASE) {
  const d = DICTIONARY.find((x) => x.q === parsed.sym);
  let notes = voice(parsed.rootPc, d.iv, base);
  if (parsed.bassPc !== null && parsed.bassPc !== parsed.rootPc) {
    // the nearest note of that name below the chord; the chord keeps all its notes
    let bass = notes[0] - 1;
    while (pc(bass) !== parsed.bassPc) bass--;
    notes = [bass, ...notes];
  }
  const scale = scalePcs(tonic, mode === "minor" ? "natural-minor" : "major");
  const offset = pc(parsed.rootPc - tonic);
  let degreeIndex = scale.indexOf(parsed.rootPc);
  if (degreeIndex < 0) {
    degreeIndex = MAJOR_REF.indexOf(offset);
    if (degreeIndex < 0) degreeIndex = MAJOR_REF.indexOf(offset + 1);   // a flattened degree: ♭II, ♭V
  }
  return {
    id: `typed-${parsed.rootPc}-${parsed.sym}-${parsed.bassPc ?? "r"}`,
    rootPc: parsed.rootPc, sym: parsed.sym, full: d.full, plain: d.plain,
    bassPc: parsed.bassPc,
    notes, degreeIndex, base,
    roman: romanFor(tonic, parsed.rootPc, degreeIndex, parsed.sym),
    typed: true,
  };
}

/* A typed chord's name as the app writes it, with the key's spelling. */
/* Buttons that type the awkward characters on a phone keyboard. */
const TYPING_CHIPS = [["#", "#"], ["♭", "b"], ["m", "m"], ["7", "7"], ["maj7", "maj7"], ["m7", "m7"], ["sus4", "sus4"], ["dim", "dim"], ["/", "/"], ["space", " "]];

const typedLabel = (c, system) =>
  chordLabel(c.rootPc, c.sym, system) + (c.bassPc !== null && c.bassPc !== undefined && c.bassPc !== c.rootPc ? `/${noteName(c.bassPc, system)}` : "");

/* A scale needs enough notes to be one. Five to eight, and the lowest note
   chosen is the tonic unless one is given. */
function customScaleFrom(midis, name, tonicPc = null) {
  const pcs = [...new Set(midis.map(pc))];
  if (pcs.length < 5 || pcs.length > 8) return null;
  const tonic = tonicPc ?? pc(Math.min(...midis));
  const iv = pcs.map((p) => pc(p - tonic)).sort((a, b) => a - b);
  return {
    id: `mine-s-${iv.join("_")}`,
    name: name?.trim() || "My scale",
    iv, tonicPc: tonic, mode: "custom",
    mood: "Yours", tags: ["custom"], mine: true,
  };
}

/* Anything saved should answer the same questions as anything built in. */
const customScalePcs = (def) => def.iv.map((i) => pc(def.tonicPc + i));
const harmonizeCustom = (def, size = 3, base = DEFAULT_BASE) =>
  def.iv.length === 7 ? harmonizeIntervals(def.tonicPc, def.iv, size, def.id, base) : [];

/* ============================================================================
   STYLE AS A WAY IN — which scales and chord colours suit an intention.
   (D-048, UC-46)
   ========================================================================== */

const STYLE_COLOURS = {
  "hip-hop":    { chords: ["m7", "m9", "maj7", "sus4"], note: "Short repeating loops. Minor sevenths and a suspended chord for air." },
  soul:         { chords: ["m9", "maj7", "m7", "9", "6"], note: "Rich but never harsh. Ninths everywhere, and a sixth to soften a landing." },
  funk:         { chords: ["9", "7", "m7", "m9"], note: "Dominants with bite. The rhythm does the work; the chords stay put." },
  house:        { chords: ["m7", "m9", "maj7", "sus2"], note: "Stabs you can chop. Nothing that demands resolution." },
  "west coast": { chords: ["m7", "m9", "maj7", "sus4"], note: "Sustained and wide. Extended minor chords over a melodic bass." },
  cinematic:    { chords: ["", "m", "maj7", "sus4", "m9"], note: "Open and unresolved. Plain triads leave the most room." },
};

/* Scales that suit an intention, the tagged ones first. */
function scalesForStyle(style, mode) {
  const inMode = SCALES.filter((s) => s.mode === mode);
  const tagged = inMode.filter((s) => s.tags.includes(style));
  const rest = inMode.filter((s) => !s.tags.includes(style));
  return { suited: tagged, others: rest, ...STYLE_COLOURS[style] };
}


/* Which notes the marker channel shows. A scale of your own has to light the
   piano exactly like a built-in one, or saving it was pointless. (D-049) */
function activeScalePcs(customScale, tonic, scaleId) {
  return customScale ? customScalePcs(customScale) : scalePcs(tonic, scaleId);
}


/* ============================================================================
   THE GUIDE — content as data, so a tab can never quietly go undocumented.
   (D-050)
   ========================================================================== */

const TAB_IDS = ["chords", "find", "scales", "prog", "bass", "theory", "sheet", "learn", "guide"];

const GUIDE = [
  { id: "start", tab: null, title: "Start here",
    lead: "This is a sketchpad for finding chords that work together, hearing them, and understanding why afterwards. Nothing has to be read in order, and if you would rather be led, the Learn tab has short lessons you practise on the piano.",
    points: [
      "Pick the key your track is in at the top. Everything below rebuilds around it.",
      "Tap a chord. It lights up on the piano and stays lit, so you can copy it onto your own keyboard.",
      "The line under the piano always explains whatever you just did. It is the whole idea of the app in one sentence at a time.",
      "If you only do one thing: pick a key, tap four chords with “add”, and press Play in the Progression tab.",
    ] },

  { id: "levels", tab: null, title: "How much is on screen",
    lead: "The app has more in it than anyone needs at first, so it starts small. The control at the top right chooses how much is shown, and each level only adds to the one before it.",
    points: [
      "Start — a key, some chords, a loop and the lessons. Everything you need to make something in a minute, or to learn how.",
      "Produce — the working tools: richer chords, voicings, chord sets, bass ideas, riffs and the printable sheet.",
      "Study — where it all comes from: the chord dictionary, inversions, harmonisation, and the more formal wording.",
      "Nothing ever moves or disappears when you go up a level, so anything you have found stays where you found it.",
      "If the screen feels busy, drop back to Start. Your key, loop and chords are kept.",
    ] },

  { id: "piano", tab: null, title: "Reading the piano",
    lead: "The keyboard says two different things at once, and it uses two different signals so neither hides the other.",
    points: [
      "Orange fill is harmony — the chord you have selected right now. The one with a dark ring is its root.",
      "Pale orange is a note used somewhere else in your loop.",
      "A teal dot underneath means the note is in your scale. The larger glowing dot is the home note of the key.",
      "So: orange with a dot is a safe, strong note. Orange with no dot is a note from outside the scale — usually the interesting one.",
      "A chord lights only in the octave it will actually sound in, so you can play it at the right height without guessing.",
      "Drag the keyboard sideways for more range, or use the ‹ Oct › control. Press and hold a key to sustain it.",
      "Fingers puts a suggested finger on each lit key, 1 the thumb to 5 the little finger: solid discs for the right hand, outlined purple for the left. Both puts the bass in the left hand and the chord in the right.",
      "Hand reaches sets how wide one hand can stretch; a chord wider than that is split between the hands. The app can't see your fingers, so it suggests and never checks.",
    ] },

  { id: "sound", tab: null, title: "Sound controls",
    lead: "All of these sit above the piano, so they work from any tab.",
    points: [
      "Five instruments. The grand piano is real recordings, built into the app — nothing is downloaded and it works offline.",
      "The recordings are the Salamander Grand Piano by Alexander Holm, used under CC-BY 3.0, shortened and re-encoded to fit in the file. Thirteen notes from C1 to C7 are embedded and everything between them is one of those played faster or slower, never by more than three semitones. If you publish this, keep that credit.",
      "Echo is one switch with a setting chosen to suit each instrument. It flatters the Rhodes and the pad in particular.",
      "“sound / muted” is a standing state — the app stays usable as a chord reference with the sound off.",
      "“silence” is different: it stops whatever is ringing now without changing anything you have built.",
      "If the browser pauses audio — usually after switching apps — a banner appears offering to resume it.",
    ] },

  { id: "chords", tab: "chords", title: "Chords",
    lead: "What can I play in this key, and how should I arrange it?",
    points: [
      "The seven chords shown are the ones built from your key. Triads are the simplest; 7ths and 9ths are richer and are what soul, house and R&B actually use.",
      "“add” puts a chord into your loop. It also selects it, so the Bass and Theory tabs follow along.",
      "The Voicing list is the same chord arranged differently. This is most of what separates a chord that sounds like a record from one that sounds like an exercise — try Open and Spread on a 9th.",
      "Chord sets are ready-made palettes by style, each with a progression you can take whole with “add all”.",
      "If a chord contains notes from outside your key, a panel appears naming the scale it belongs to.",
    ] },

  { id: "find", tab: "find", title: "Find",
    lead: "The other direction: play notes, and the app tells you what you made.",
    points: [
      "On this tab, tapping the piano chooses notes instead of playing them momentarily. Tap again to remove one.",
      "You get every reading, not one. E G# B C# genuinely is both E6 and C#m7/E — which it is depends on the bass, and the app says so.",
      "It also shows which keys those notes fit and which scales contain them, tightest fit first.",
      "Save a set as a chord and it behaves like any other chord, with your voicing kept exactly as you played it.",
      "Save five to eight notes as a scale. If it has seven, it harmonises into its own chords.",
    ] },

  { id: "scales", tab: "scales", title: "Scales",
    lead: "Which notes can I play over this, and what will they feel like?",
    points: [
      "Start from the style row if you know the mood you want. Scales that suit it are marked and listed first, with the chord colours that go with them.",
      "Selecting a scale marks its notes on the piano and, where it differs from the last one by a single note, names that note. That one note is usually the whole difference.",
      "The ▲ ▼ ⤨ buttons play the scale up, down, or shuffled. Hearing two scales back to back teaches more than reading about them.",
      "The chords in the Chords tab are built from whichever scale you select here.",
    ] },

  { id: "prog", tab: "prog", title: "Progression",
    lead: "Your loop, and everything the app can tell you about it.",
    points: [
      "Type chord names at the top, as a chord chart writes them: “Am7 F#m7 Dm7 G7sus4”. Anything it can't read turns red with a suggestion, and the keys the chords fit are offered.",
      "Tap a chord in the loop to remove it. Play loops it at whatever tempo you set.",
      "“Why it works” describes each move, including the wrap back to the first chord, naming the notes the chords share.",
      "“What could come next” suggests chords ranked by how harmony actually behaves — a fourth up scores highest, and coming home scores once the loop is long enough to want it.",
      "“Voice leading” shows which notes hold and which move between each pair, plus the smoothest way to play the next chord.",
      "“Scales that fit” ranks scales against the notes you actually used, naming what each one misses.",
      "Riffs and basslines: pick a style, then browse the patterns or press “surprise me”. Tap a bar to hear it alone.",
    ] },

  { id: "bass", tab: "bass", title: "Bass",
    lead: "Which note should the low end play, and how do I get to the next chord?",
    points: [
      "The list ranks your options under the current chord: root is safest, the fifth is stable, the third carries the mood, and everything else works best passing through.",
      "It follows whatever chord is selected — or, if you have not selected one, the first chord of your loop.",
      "Below that are four ways of walking to the next chord: direct, through the scale, via its fifth, or chromatically from a semitone below.",
      "Tap any of them to hear it. The chromatic one leaves the key for a beat, which is exactly why it works.",
    ] },

  { id: "sheet", tab: "sheet", title: "Sheet",
    lead: "The sketch on paper, for taking to an instrument when you would rather not look at a screen.",
    points: [
      "Each bar is drawn as a small keyboard with its chord filled in — a chord name on paper tells you nothing you did not already know.",
      "The scale and the bass line are on it too, so nothing has to be worked out again at the instrument.",
      "Press Print for paper, or choose Save as PDF in the print dialogue. Only the sheet prints, not the app around it.",
      "Copy as text gives the same thing without pictures, for pasting into notes.",
      "Tick Show suggested fingering to print finger numbers on each chord and on the bass: solid for the right hand, outlined for the left.",
      "There is no theory on it yet, deliberately: the sheet is for playing, and the app is where the explaining happens.",
    ] },

  { id: "theory", tab: "theory", title: "Theory",
    lead: "Where all of it comes from. Read this after playing, not before.",
    points: [
      "“Build it” walks through making a chord out of your scale one note at a time, lighting the piano as it goes. Start on a note, skip one, take the next.",
      "The dictionary has fifteen chord types on your root, each with its formula and what it is for. It always plays them in close position so the differences are clear.",
      "Inversions are the same chord with a different note at the bottom. The chord does not change; its weight does.",
      "The bass paragraph is the short version of everything the Bass tab does.",
    ] },

  { id: "learn", tab: "learn", title: "Learn",
    lead: "Short lessons on notes, scales and chords that you practise on the piano, with the app listening to each note you play.",
    points: [
      "Pick a lesson and read one line about it. Each step asks you to play something: a note, a scale, or a chord.",
      "Play it on the piano. Each note is answered straight away, and a wrong one is explained: how many keys you counted, which scale note a chord skips, or how big the next step of a scale is.",
      "Chords can be played one note at a time or all together, in any octave. Scales have to go the way the step says, up or down.",
      "“Hint” first tells you how to find the next note, by counting keys or by the black keys around it. Press it again to light the note. “Show me” plays the whole answer.",
      "When a step is done, “Take away” gives you the rule that works in every key, and chords show their shape of white and black keys, shared with other chords.",
      "Lessons follow the key at the top. When you finish one, “next key” moves one step round the circle of fifths so you can play it again somewhere new.",
      "Lessons that end in a progression can send it straight to your loop, ready to play in the Progression tab.",
    ] },
];

const guideFor = (tabId) => GUIDE.filter((g) => g.tab === tabId);


/* How many sentences is this? The beginner cap in D-011 was written as a rule
   and never checked; two thirds of explanations broke it. (D-051) */
const sentenceCount = (text) => (String(text).match(/[.!?](?:\s|$)/g) || []).length;


/* ============================================================================
   HELD NOTES — several fingers at once. (D-052)

   The set was being replaced on every press, so a second finger unlit the
   first and lifting one finger cleared them all. Bookkeeping, so it is
   arithmetic and can be tested.
   ========================================================================== */

const MAX_HELD = 8;                       // the piano's stated polyphony (D-007)

function heldAfterDown(held, midi, max = MAX_HELD) {
  if (held.includes(midi)) return held;             // already down; ignore the repeat
  if (held.length >= max) return held;              // refuse rather than steal a voice
  return [...held, midi].sort((a, b) => a - b);
}

const heldAfterUp = (held, midi) => held.filter((m) => m !== midi);


/* ============================================================================
   SLIDING ACROSS KEYS — a finger rolling left and right. (D-053)

   A touch belongs to the key it started on, so keys you slide onto never hear
   about it. The fix is to track which note each finger is currently over and
   work out what changed. Which is bookkeeping, so it lives here.
   ========================================================================== */

/* `active` maps pointer id to the note that finger is on. Returns the new map
   plus what should sound and what should stop — nothing stops if another
   finger is still holding it. */
function slideTo(active, pointerId, midi) {
  const prev = Object.prototype.hasOwnProperty.call(active, pointerId) ? active[pointerId] : null;
  if (prev === midi) return { next: active, pressed: null, released: null };

  const next = { ...active };
  if (midi === null) delete next[pointerId];
  else next[pointerId] = midi;

  const heldElsewhere = (m) => Object.entries(next).some(([id, v]) => v === m && Number(id) !== pointerId);
  return {
    next,
    pressed: midi !== null && !Object.values(active).includes(midi) ? midi : null,
    released: prev !== null && !heldElsewhere(prev) && !Object.values(next).includes(prev) ? prev : null,
  };
}

const notesUnderFingers = (active) => [...new Set(Object.values(active))].sort((a, b) => a - b);


/* Which key is under this point? Geometry, not the DOM. (D-055)

   Asking the document what element is under the finger depended on pointer
   capture, hit-testing and event retargeting all behaving — three things this
   environment can't be asked about here. The keyboard knows its own layout, so
   the question is arithmetic: black keys occupy the top 64% and sit at known
   offsets; everything else is the white key the x falls into. */
function keyAtPosition(x, y, width, height, startMidi, octaves = 4) {
  if (x < 0 || y < 0 || x > width || y > height) return null;
  const midis = Array.from({ length: octaves * 12 + 1 }, (_, i) => startMidi + i);
  const whites = midis.filter((m) => WHITE_PCS.includes(pc(m)));
  const ww = width / whites.length;

  if (y <= height * 0.64) {
    for (const m of midis.filter((n) => !WHITE_PCS.includes(pc(n)))) {
      const before = whites.filter((w) => w < m).length;
      const left = before * ww - ww * 0.31;
      if (x >= left && x <= left + ww * 0.62) return m;
    }
  }
  const i = Math.min(whites.length - 1, Math.max(0, Math.floor(x / ww)));
  return whites[i];
}


/* ============================================================================
   MELODY GUIDE, WHAT CHANGED, TENSION. (D-056)
   ========================================================================== */

/* Over the chord playing right now, which notes are safe and which pull?
   The scale says what is available; the chord says what is strong. (UC-50) */
function melodyRole(pitch, chordPcs, scaleSet) {
  const p = pc(pitch);
  if (chordPcs.includes(p)) return "stable";
  if (scaleSet.includes(p)) return "movement";
  return "tension";
}

const MELODY_ROLES = {
  stable:   { label: "Lands well", why: "A chord tone — safe to hold, and safe to end on." },
  movement: { label: "Moves",      why: "In the scale but not the chord. Good passing through, less good to sit on." },
  tension:  { label: "Pulls",      why: "Outside the scale. Effective for a moment, on the way to a chord tone." },
};

/* Group the notes of an octave by what they would do over this chord. */
function melodyGuide(chord, scaleSet) {
  const chordPcs = chord ? chord.notes.map(pc) : [];
  const out = { stable: [], movement: [], tension: [] };
  for (let p = 0; p < 12; p++) out[melodyRole(p, chordPcs, scaleSet)].push(p);
  return out;
}

/* What actually changed between two sets of notes? Answering this is what
   makes a switch teach something instead of just happening. (UC-51) */
function changedNotes(before, after) {
  const a = [...new Set(before.map(pc))];
  const b = [...new Set(after.map(pc))];
  return {
    added: b.filter((p) => !a.includes(p)).sort((x, y) => x - y),
    removed: a.filter((p) => !b.includes(p)).sort((x, y) => x - y),
    held: b.filter((p) => a.includes(p)).sort((x, y) => x - y),
  };
}

function describeChange(before, after, system = "letters") {
  const { added, removed, held } = changedNotes(before, after);
  const nm = (p) => noteName(p, system);
  if (!added.length && !removed.length) return "Nothing changed.";
  if (added.length === 1 && removed.length === 1) {
    return `${nm(removed[0])} became ${nm(added[0])} — that one note is the whole difference.`;
  }
  const parts = [];
  if (added.length) parts.push(`${added.map(nm).join(", ")} came in`);
  if (removed.length) parts.push(`${removed.map(nm).join(", ")} went out`);
  return `${parts.join(" and ")}. ${held.length} note${held.length === 1 ? "" : "s"} stayed.`;
}

/* ---- tension: safe to adventurous, without needing the terminology (UC-52) ---- */
const TENSION_LEVELS = [
  { level: 0, name: "Safe",        note: "The seven chords of the key, plain. Nothing here can sound wrong." },
  { level: 1, name: "Colour",      note: "Sevenths and ninths. The same harmony, richer and less final." },
  { level: 2, name: "Borrowed",    note: "Chords from neighbouring scales. Familiar, but they lean somewhere new." },
  { level: 3, name: "Adventurous", note: "Chromatic colour. Wrong on paper, and often the most interesting thing in the bar." },
];

/* Chords beyond the key, and why each is worth trying. */
const BORROWED = {
  minor: [
    { offset: 8, sym: "7", from: 2, why: "The dominant from harmonic minor. Pulls home harder than anything diatonic." },
    { offset: 5, sym: "", from: 2, why: "A major fourth, borrowed from Dorian. Lifts without leaving." },
    { offset: 1, sym: "maj7", from: 3, why: "The ♭II from Phrygian. Dark and sudden — one bar is usually enough." },
    { offset: 2, sym: "7", from: 3, why: "A secondary dominant. It points at the chord a fourth above it." },
  ],
  major: [
    { offset: 5, sym: "m", from: 2, why: "The minor fourth, borrowed from the parallel minor. The classic sad turn." },
    { offset: 10, sym: "", from: 2, why: "The ♭VII. Rock and gospel lean on this constantly." },
    { offset: 8, sym: "maj7", from: 3, why: "The ♭VI. Steps outside the key and back without drama." },
    { offset: 2, sym: "7", from: 3, why: "A secondary dominant — it makes the fifth chord feel like a destination." },
  ],
};

function chordsAtTension(tonic, mode, level, base = DEFAULT_BASE) {
  const parent = mode === "minor" ? "natural-minor" : "major";
  const size = level === 0 ? 3 : 4;
  const core = harmonize(tonic, parent, size, base).map((c) => ({ ...c, extra: false, why: null }));
  if (level < 2) return core;

  const borrowed = BORROWED[mode]
    .filter((b) => b.from <= level)
    .map((b, i) => {
      const rootPc = pc(tonic + b.offset);
      const entry = DICTIONARY.find((d) => d.q === b.sym);
      return {
        id: `borrowed-${mode}-${i}-${rootPc}`,
        rootPc, sym: b.sym, full: entry?.full ?? "chord",
        notes: voice(rootPc, entry ? entry.iv : [0, 4, 7], base), base,
        degreeIndex: 0, roman: "", extra: true, why: b.why,
      };
    });
  return [...core, ...borrowed];
}


/* ============================================================================
   THE SHEET — a sketch you can take to an instrument, with no device.
   (D-057, UC-53)

   Nothing on paper can be tapped, so a chord name is not enough: the sheet
   carries the voicing as a small keyboard diagram. What goes on it is a pure
   function of the loop, so the layout can be checked without rendering it.
   ========================================================================== */

/* Key positions for a small diagram, in units of 0..1 across the width, so the
   caller picks the size. Shares its layout rules with the real keyboard. */
function diagramKeys(startMidi, octaves, lit = []) {
  const midis = Array.from({ length: octaves * 12 + 1 }, (_, i) => startMidi + i);
  const whites = midis.filter((m) => WHITE_PCS.includes(pc(m)));
  const w = 1 / whites.length;
  const on = (m) => lit.includes(m);
  return {
    whites: whites.map((m, i) => ({ midi: m, x: i * w, w, on: on(m) })),
    blacks: midis.filter((m) => !WHITE_PCS.includes(pc(m))).map((m) => {
      const before = whites.filter((x) => x < m).length;
      return { midi: m, x: before * w - w * 0.31, w: w * 0.62, on: on(m) };
    }),
  };
}

/* The window of the keyboard worth drawing: enough to hold every note, snapped
   to whole octaves so the diagrams all line up with each other. */
function diagramRange(allNotes, minOctaves = 2) {
  if (!allNotes.length) return { startMidi: 48, octaves: minOctaves };
  const lo = Math.min(...allNotes), hi = Math.max(...allNotes);
  const startMidi = Math.floor(lo / 12) * 12;
  const octaves = Math.max(minOctaves, Math.ceil((hi - startMidi + 1) / 12));
  return { startMidi, octaves };
}

function sheetData({ tonic, mode, scaleId, customScale, progression = [],
                     bpm = 88, bassFigure = null, system = "letters",
                     fingering = false, reach = DEFAULT_REACH }) {
  const scaleNotes = activeScalePcs(customScale, tonic, scaleId);
  const scaleName = customScale ? customScale.name : `${noteName(tonic, system)} ${scaleById(scaleId).name}`;
  const allNotes = progression.flatMap((c) => c.notes);
  const range = diagramRange(allNotes);

  /* the scale is drawn in one octave from the tonic, which is how anyone
     would write it out by hand */
  const scaleStart = 48 + tonic;
  const scalePitches = scaleNotes.map((p) => place(p, scaleStart + 5));

  return {
    title: `${noteName(tonic, system)} ${mode}`,
    meta: [`${bpm} bpm`, scaleName, `${progression.length} bar${progression.length === 1 ? "" : "s"}`],
    range,
    scale: { name: scaleName, notes: [...new Set(scalePitches)].sort((a, b) => a - b),
             names: scaleNotes.map((p) => noteName(p, system)),
             start: Math.floor(scaleStart / 12) * 12 },
    chords: progression.map((c, i) => ({
      bar: i + 1,
      label: chordLabel(c.rootPc, c.sym, system),
      notes: c.notes,
      names: c.notes.map((m) => noteName(m, system)),
      roman: c.roman || "",
      // D-078: right hand on the chord when asked for; a chord too wide is split
      fingers: fingering ? fingerChord(c.notes, { hand: "right", reach }).keys : [],
    })),
    bass: progression.map((c, i) => ({
      bar: i + 1,
      notes: bassFigure?.[i]?.map((n) => n.midi) ?? [c.notes[0] - 24],
      names: (bassFigure?.[i]?.map((n) => n.midi) ?? [c.notes[0] - 24]).map((m) => noteName(m, system)),
      // one bass note is the left hand's little finger; a bass riff's fingering is out of scope
      finger: fingering && (bassFigure?.[i]?.length ?? 1) === 1 ? 5 : null,
    })),
  };
}

/* The same sheet as text, for pasting somewhere that has no pictures. */
function sheetAsText(sheet) {
  const lines = [`${sheet.title}  ·  ${sheet.meta.join("  ·  ")}`, ""];
  lines.push(`Scale: ${sheet.scale.names.join(" ")}`, "");
  for (const c of sheet.chords) {
    const bass = sheet.bass.find((b) => b.bar === c.bar);
    const rh = c.fingers?.length ? `  fingers ${[...c.fingers].sort((a, b) => a.midi - b.midi).map((k) => (k.hand === "L" ? "L" : "") + k.finger).join("-")}` : "";
    lines.push(`${c.bar}. ${c.label.padEnd(10)} ${c.names.join(" ").padEnd(20)} bass: ${bass ? bass.names.join(" ") : ""}${bass?.finger ? ` (L${bass.finger})` : ""}${rh}`);
  }
  return lines.join("\n");
}


/* ============================================================================
   LEVELS — how much of the app is on screen. (D-058, UC-54)

   Feedback on first use: too much at once. The old Beginner/Producer toggle
   changed how things were *described* and never what was *shown*, which is the
   wrong axis. A level chooses the surface; depth follows from it.

   Levels are cumulative, so nothing a user has found ever moves or disappears.
   ========================================================================== */

const LEVELS = [
  { id: "start", name: "Start",
    /* Lessons are here, not at Study: learning is the mode with the fewest
       prerequisites, so it has to be reachable on the first screen. (D-073) */
    note: "A key, some chords, a loop, and lessons to practise. Enough to make something in a minute.",
    adds: ["key", "piano", "sound", "chords", "scales", "loop", "explain", "lessons", "guide"] },
  { id: "produce", name: "Produce",
    note: "The working tools: richer chords, voicings, chord sets, bass, riffs and the printable sheet.",
    adds: ["sevenths", "voicings", "sets", "tension", "find", "bass", "riffs", "sheet", "numerals", "naming"] },
  { id: "study", name: "Study",
    note: "Where everything comes from: the dictionary, inversions, harmonisation and the formal wording.",
    adds: ["theory", "dictionary", "inversions", "harmonise", "formal", "melodyGuide"] },
];

const levelIndex = (id) => Math.max(0, LEVELS.findIndex((l) => l.id === id));

/* Everything available at this level and every level below it. */
function featuresAt(levelId) {
  const upto = levelIndex(levelId);
  return new Set(LEVELS.slice(0, upto + 1).flatMap((l) => l.adds));
}

const has = (levelId, feature) => featuresAt(levelId).has(feature);

const TABS_BY_FEATURE = {
  chords: "chords", find: "find", scales: "scales", loop: "prog",
  bass: "bass", theory: "theory", sheet: "sheet", lessons: "learn", guide: "guide",
};

/* Tabs in a fixed order, so a tab never moves when a new one appears. */
function tabsAt(levelId) {
  const available = featuresAt(levelId);
  return TAB_IDS.filter((id) => {
    const feature = Object.entries(TABS_BY_FEATURE).find(([, t]) => t === id)?.[0];
    return feature ? available.has(feature) : false;
  });
}

/* The main scenario has to be completable at the simplest level, or the split
   is wrong. These are the features UC-00 actually needs. (D-058) */
const UC00_NEEDS = ["key", "piano", "sound", "chords", "scales", "loop", "explain"];


/* Which voice should the next note use? (D-066)

   Building a synth per note and throwing it away meant hundreds of audio nodes
   created and destroyed a minute. The browser kept up for a while and then
   started to drag, which is what "it slows down and scrambles" sounds like.
   A fixed pool is reused instead, and choosing from it is arithmetic. */
function pickVoiceIndex(busyUntil, now) {
  let freeIdx = -1, oldestIdx = 0;
  for (let i = 0; i < busyUntil.length; i++) {
    if (busyUntil[i] <= now) { freeIdx = i; break; }
    if (busyUntil[i] < busyUntil[oldestIdx]) oldestIdx = i;
  }
  return freeIdx >= 0 ? freeIdx : oldestIdx;   // steal the one finishing soonest
}


/* ============================================================================
   ROLLING A CHORD — laying the fingers down one at a time. (D-068, UC-57)

   Six notes struck together are one sound, and a big voicing becomes a wash
   you cannot pick apart. Spread the same notes over a fraction of a second and
   every one of them is audible, while the chord still arrives as a chord.
   ========================================================================== */

const ROLL_STYLES = [
  { id: "block", name: "Together", spread: 0,     note: "All at once. How a chord is normally played." },
  { id: "roll",  name: "Roll",     spread: 0.045, note: "Laid down left to right, quickly. You hear each note without losing the chord." },
  { id: "slow",  name: "Slow roll", spread: 0.11, note: "Deliberate, like someone showing you the notes one at a time." },
];

const rollStyleById = (id) => ROLL_STYLES.find((r) => r.id === id) ?? ROLL_STYLES[0];

/* When does each note of the chord start? Low to high, capped so that even a
   slow roll on eight notes still arrives well inside a bar. */
function rollOffsets(count, spread, maxTotal = 0.5) {
  if (count <= 0) return [];
  if (count === 1 || spread <= 0) return new Array(count).fill(0);
  const step = Math.min(spread, maxTotal / (count - 1));
  return Array.from({ length: count }, (_, i) => i * step);
}



/* Turning an embedded data URI back into bytes. Pure, and the only part of
   decoding that can be checked without an audio device. (D-070) */
function base64Payload(uri) {
  const i = String(uri).indexOf(",");
  return i < 0 ? "" : String(uri).slice(i + 1);
}

function payloadBytes(uri) {
  const b64 = base64Payload(uri);
  if (!b64) return 0;
  const padding = (b64.match(/=+$/) || [""])[0].length;
  return Math.max(0, Math.floor(b64.length * 3 / 4) - padding);
}


/* ============================================================================
   LESSONS — short practice on the piano, judged note by note. (D-073, UC-58)

   A lesson is data: a few steps, each asking for something to be played. The
   judging is a pure function of the step and the notes played so far, so the
   one part a learner has to trust can be tested like the rest of the theory.

   Every lesson is built for whichever key is chosen, so each one can be
   practised in all twelve. The prompt says what to play; the reason why only
   appears once it has been played, which keeps D-011: theory follows the sound.
   ========================================================================== */

const LESSON_TOPICS = [
  { id: "scales", name: "Scales" },
  { id: "chords", name: "Chords" },
  { id: "progressions", name: "Progressions" },
];

const setTarget = (pcs, extra = {}) => ({ kind: "set", pcs: [...new Set(pcs)], ...extra });
const seqTarget = (pcs, direction) => ({ kind: "sequence", pcs, direction });

/* The notes a demonstration plays. A set is stacked upwards from its bottom
   note in close position; a sequence walks up or down one note at a time. */
function showSet(pcs, bassPc, base) {
  const b = bassPc ?? pcs[0];
  const order = [...pcs].sort((x, y) => pc(x - b) - pc(y - b));
  return voice(b, stackAscending(order, b), base);
}

function showSequence(pcs, direction, base) {
  const out = [];
  let m = direction === "down" ? base + pcs[0] + 12 : base + pcs[0];
  out.push(m);
  for (const p of pcs.slice(1)) {
    do { m += direction === "down" ? -1 : 1; } while (pc(m) !== p);
    out.push(m);
  }
  return out;
}

const showFor = (target, base) =>
  target.kind === "sequence" ? showSequence(target.pcs, target.direction, base) : showSet(target.pcs, target.bassPc, base);

/* A lesson's chords, taken from the same harmonisation the Chords tab uses, so
   what a lesson hands to the loop is exactly what the rest of the app plays. */
const chordPcs = (c) => c.notes.map(pc);

const LESSONS = [
  { id: "home", topic: "scales", title: "Find the home note",
    build: ({ r, nm }) => ({
      intro: `Every key has a home note, and here it is ${nm(r)}. The glowing dot on the piano marks it.`,
      steps: [
        { prompt: `Play ${nm(r)}.`, target: setTarget([r]),
          why: `Every ${nm(r)} on the keyboard is the same note, higher or lower. Music keeps coming back to it.`,
          rule: `Find ${nm(r)} by its neighbours: it is ${keyLandmark(r)}.` },
        { prompt: `Play ${nm(r)}, then the next ${nm(r)} up.`, target: seqTarget([r, r], "up"),
          why: "That jump is an octave: the same note, twice as high. Chords and scales repeat every octave.",
          rule: "Count every key, black and white: an octave is always 12 keys up." },
      ] }) },

  { id: "major-scale", topic: "scales", title: "The major scale",
    build: ({ r, nm, major }) => ({
      intro: `A scale is the set of notes a key uses. The ${nm(r)} major scale sounds bright and settled.`,
      steps: [
        { prompt: `Play it going up: ${[...major, r].map(nm).join(" ")}.`, target: seqTarget([...major, r], "up"),
          why: "The steps go whole, whole, half, whole, whole, whole, half. A half step is the very next key, black or white.",
          rule: "Every major scale is whole, whole, half, whole, whole, whole, half, from any starting note." },
        { prompt: "Now play it back down, from the top.", target: seqTarget([r, ...[...major].reverse()], "down"),
          why: "Same notes in reverse. Playing both directions is how the sound of a key gets into your ear.",
          rule: "The two half steps sit between notes 3 and 4 and between 7 and 8, whichever way you go." },
      ] }) },

  { id: "major-triad", topic: "chords", title: "Your first chord",
    build: ({ r, nm, major }) => {
      const tri = [major[0], major[2], major[4]];
      return {
        intro: "A chord is three or more notes played together. The simplest is built from notes 1, 3 and 5 of the scale.",
        steps: [
          { prompt: `Play ${tri.map(nm).join(", ")} one at a time, going up.`, target: seqTarget(tri, "up"),
            why: "You skipped a scale note each time. Stacking every other note is how chords are built.",
            rule: "A chord takes every other note of the scale: 1, skip, 3, skip, 5." },
          { prompt: "Now play all three together.", target: setTarget(tri),
            why: `That's ${nm(r)} major, the home chord of the key. It sounds finished because it is built on home.`,
            rule: "Every major chord is 4 + 3: four keys up from the root, then three more." },
        ] };
    } },

  { id: "minor-triad", topic: "chords", title: "Major to minor",
    build: ({ r, nm, major }) => {
      const maj = [major[0], major[2], major[4]];
      const min = [r, pc(r + 3), major[4]];
      return {
        intro: "Moving one note by a single key turns a bright chord into a sad one.",
        steps: [
          { prompt: `Play ${nm(r)} major: ${maj.map(nm).join(" ")}.`, target: setTarget(maj),
            why: "Remember how that sounds: bright and open.",
            rule: "Major is 4 + 3: the big gap is at the bottom." },
          { prompt: `Move ${nm(maj[1])} down one key to ${nm(min[1])}, and play ${min.map(nm).join(" ")}.`, target: setTarget(min),
            why: `That's ${nm(r)} minor. Only the middle note moved, and the whole mood changed.`,
            rule: "Minor is 3 + 4: the same outside notes, with the middle one a key lower." },
        ] };
    } },

  { id: "minor-scale", topic: "scales", title: "The minor scale", mode: "minor",
    build: ({ r, nm, minor }) => ({
      intro: "The natural minor scale is the darker sibling of the major. A lot of hip-hop and film music lives here.",
      steps: [
        { prompt: `Play ${nm(r)} minor going up: ${[...minor, r].map(nm).join(" ")}.`, target: seqTarget([...minor, r], "up"),
          why: "Compared with major, notes 3, 6 and 7 are one key lower. Those three notes carry the darkness.",
          rule: "Every natural minor scale is whole, half, whole, whole, half, whole, whole." },
        { prompt: "Now play it back down, from the top.", target: seqTarget([r, ...[...minor].reverse()], "down"),
          why: "Minor keys are named after their home note too, and every run of the scale ends there.",
          rule: `It uses the same notes as ${nm(minor[2])} major, starting three keys lower.` },
      ] }) },

  { id: "pentatonic", topic: "scales", title: "Five notes that always work", mode: "minor",
    build: ({ r, nm, penta }) => ({
      intro: "The minor pentatonic keeps five notes of the minor scale and drops the two that clash. It's the safest palette for a riff.",
      steps: [
        { prompt: `Play ${nm(r)} minor pentatonic going up: ${[...penta, r].map(nm).join(" ")}.`, target: seqTarget([...penta, r], "up"),
          why: "There are no half steps in it, so no two notes rub against each other. That's why it's hard to play a wrong note.",
          rule: "The jumps are 3, 2, 2, 3, 2 keys, from any home note." },
        { prompt: "Now play it back down, from the top.", target: seqTarget([r, ...[...penta].reverse()], "down"),
          why: "Any of these notes works over a minor chord on the same home note. Try making up a riff from them.",
          rule: `Over ${nm(r)} minor, any of these five notes is safe, so you can think about rhythm instead of notes.` },
      ] }) },

  { id: "key-chords", topic: "chords", title: "The three main chords",
    build: ({ nm, lbl, tri }) => {
      const [I, IV, V] = [tri[0], tri[3], tri[4]];
      const shared = chordPcs(I).filter((p) => chordPcs(IV).includes(p));
      return {
        intro: "Every note of the scale has its own chord. Three of them, on notes 1, 4 and 5, carry most songs.",
        steps: [
          { prompt: `Play chord I, ${lbl(I)}: ${chordPcs(I).map(nm).join(" ")}.`, target: setTarget(chordPcs(I)),
            why: "Chord I is home: stable and bright.",
            rule: "In every major key, chords I, IV and V are the three major chords." },
          { prompt: `Play chord IV, ${lbl(IV)}: ${chordPcs(IV).map(nm).join(" ")}.`, target: setTarget(chordPcs(IV)),
            why: `Chord IV lifts away from home. It shares ${shared.map(nm).join(" and ")} with chord I, so the move is smooth.`,
            rule: "Chord IV is always 5 keys above the home note." },
          { prompt: `Play chord V, ${lbl(V)}: ${chordPcs(V).map(nm).join(" ")}.`, target: setTarget(chordPcs(V)),
            why: "Chord V pulls back towards home. Play chord I straight after it and you hear the pull resolve.",
            rule: "Chord V is always 7 keys above the home note, and it wants to go back to I." },
        ],
        loop: [I, IV, V, I] };
    } },

  { id: "four-chords", topic: "progressions", title: "The four-chord loop",
    build: ({ nm, lbl, tri }) => {
      const [I, V, vi, IV] = [tri[0], tri[4], tri[5], tri[3]];
      const ask = (numeral, c) => ({ prompt: `Play ${numeral}, ${lbl(c)}: ${chordPcs(c).map(nm).join(" ")}.`, target: setTarget(chordPcs(c)) });
      return {
        intro: "One progression, I–V–vi–IV, sits under hundreds of pop songs. Play it chord by chord.",
        steps: [
          { ...ask("I", I), why: "Chord I: home, where the loop starts.",
            rule: "Think in numbers, not names: I–V–vi–IV works in every key." },
          { ...ask("V", V), why: "Chord V builds tension and wants to move on.",
            rule: "V is 7 keys above I, in every key: count from the home chord's root." },
          { ...ask("vi", vi), why: "Chord vi is minor, so the mood darkens for a moment.",
            rule: "vi is 3 keys below I, and always minor." },
          { ...ask("IV", IV), why: "Chord IV lifts, and leads back to I when the loop comes round again.",
            rule: "IV is 5 keys above I, one step before home on the circle of fifths." },
        ],
        loop: [I, V, vi, IV] };
    } },

  { id: "inversions", topic: "chords", title: "Same chord, different bottom",
    build: ({ r, nm, major }) => {
      const tri = [major[0], major[2], major[4]];
      return {
        intro: "An inversion is a chord with a different note at the bottom. The chord stays the same; its weight changes.",
        steps: [
          { prompt: `Play ${nm(r)} major with ${nm(tri[0])} at the bottom.`, target: setTarget(tri, { bassPc: tri[0] }),
            why: "This is root position: solid and grounded.",
            rule: "Root position puts the chord's name at the bottom." },
          { prompt: `Now put ${nm(tri[1])} at the bottom: ${nm(tri[1])}, ${nm(tri[2])}, ${nm(tri[0])}.`, target: setTarget(tri, { bassPc: tri[1] }),
            why: "First inversion. It sounds lighter and less final, which suits the middle of a phrase.",
            rule: "To invert, lift the bottom note up an octave; the other two stay put." },
          { prompt: `And ${nm(tri[2])} at the bottom: ${nm(tri[2])}, ${nm(tri[0])}, ${nm(tri[1])}.`, target: setTarget(tri, { bassPc: tri[2] }),
            why: "Second inversion. Pianists use inversions so their hand barely moves between chords.",
            rule: "Lift the bottom note once more and the fifth is at the bottom: that's second inversion." },
        ] };
    } },

  { id: "sevenths", topic: "chords", title: "Seventh chords",
    build: ({ nm, lbl, sev }) => {
      const [I7, V7] = [sev[0], sev[4]];
      return {
        intro: "Add one more skipped note on top of a triad and you get a seventh chord. It's the sound of soul, house and R&B.",
        steps: [
          { prompt: `Play ${lbl(I7)}: ${chordPcs(I7).map(nm).join(" ")}.`, target: setTarget(chordPcs(I7)),
            why: "The major seventh sits one key below the octave. It makes the home chord soft and dreamy.",
            rule: "A major seventh chord is 4 + 3 + 4: its top note is one key below the root." },
          { prompt: `Play ${lbl(V7)}: ${chordPcs(V7).map(nm).join(" ")}.`, target: setTarget(chordPcs(V7)),
            why: "On chord V the seventh is flatter, a dominant seventh. It pulls towards home even harder than plain V.",
            rule: "A dominant seventh is 4 + 3 + 3: its top note is two keys below the root." },
        ],
        loop: [sev[0], sev[5], sev[1], sev[4]] };
    } },
];

/* A lesson, built for one key. `base` is the octave the demonstration plays
   in; the app passes one that is always on screen. Each lesson is spelled for
   its own key — a minor-scale lesson reads E♭ in C even when the app is set to
   C major — and carries that spelling so its feedback matches. (D-074) */
function buildLesson(id, root, system = "letters", base = 60) {
  const def = LESSONS.find((l) => l.id === id);
  if (!def) return null;
  const r = pc(root);
  const names = spelling(system, r, def.mode ?? "major");
  const nm = (p) => noteName(p, names);
  const tri = harmonize(r, "major", 3, base);
  const sev = harmonize(r, "major", 4, base);
  const keyScale = scalePcs(r, def.mode === "minor" ? "natural-minor" : "major");
  const body = def.build({
    r, nm,
    lbl: (c) => chordLabel(c.rootPc, c.sym, names),
    major: scalePcs(r, "major"),
    minor: scalePcs(r, "natural-minor"),
    penta: scalePcs(r, "minor-pentatonic"),
    tri, sev,
  });
  return {
    id: def.id, topic: def.topic, title: def.title, root: r, system: names, mode: def.mode ?? "major",
    intro: body.intro,
    steps: body.steps.map((s, i) => ({ ...s, index: i, scale: keyScale, show: showFor(s.target, base) })),
    loop: body.loop ?? null,
  };
}

const lessonsFor = (root, system = "letters", base = 60) => LESSONS.map((l) => buildLesson(l.id, root, system, base));

/* Judge one note against a step. `attempt` holds the notes already accepted,
   in the order they were played. Nothing is ever taken away from an attempt,
   so a slip costs nothing: the wrong note is named and the step carries on.

     set       every pitch class, any order, any octave, one at a time or
               together; optionally with a named note at the bottom
     sequence  the pitch classes in order, and if a direction is given, each
               note really must be higher (or lower) than the last */
function practiceNote(target, attempt, midi) {
  const p = pc(midi);
  if (target.kind === "sequence") {
    const want = target.pcs[attempt.length];
    const last = attempt[attempt.length - 1];
    if (want === undefined) return { attempt, verdict: "done", played: p };
    if (p !== want) return { attempt, verdict: "wrong", played: p, want };
    if (last !== undefined && target.direction === "up" && midi <= last) return { attempt, verdict: "direction", played: p, want };
    if (last !== undefined && target.direction === "down" && midi >= last) return { attempt, verdict: "direction", played: p, want };
    const next = [...attempt, midi];
    const done = next.length === target.pcs.length;
    return { attempt: next, verdict: done ? "done" : "progress", played: p, want: target.pcs[next.length], left: target.pcs.length - next.length };
  }

  const have = new Set(attempt.map(pc));
  if (!target.pcs.includes(p)) {
    return { attempt, verdict: "wrong", played: p, missing: target.pcs.filter((x) => !have.has(x)) };
  }
  const next = attempt.includes(midi) ? attempt : [...attempt, midi];
  const got = new Set(next.map(pc));
  const missing = target.pcs.filter((x) => !got.has(x));
  if (missing.length) return { attempt: next, verdict: "progress", played: p, missing };
  const lowest = pc(Math.min(...next));
  if (target.bassPc !== undefined && lowest !== target.bassPc) {
    return { attempt: next, verdict: "bass", played: p, lowest, want: target.bassPc };
  }
  return { attempt: next, verdict: "done", played: p, missing: [] };
}

/* What to say about it. Two sentences at most, and a wrong note is always
   answered with the right one, so a slip teaches a name. (D-051, D-073) */
function practiceFeedback(step, result, system = "letters") {
  const nm = (p) => noteName(p, system);
  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
  switch (result.verdict) {
    case "done":
      return { head: "That's it.", plain: step.why };
    case "progress":
      return step.target.kind === "sequence"
        ? { head: `${nm(result.played)} — yes.`, plain: `${plural(result.left, "note")} to go.` }
        : { head: `${nm(result.played)} — yes.`, plain: `${plural(result.missing.length, "note")} still to find.` };
    case "wrong":
      return step.target.kind === "sequence"
        ? { head: `${nm(result.played)} isn't next.`, plain: diagnoseSlip(step, result, system) }
        : { head: `${nm(result.played)} isn't in this one.`,
            plain: `${diagnoseSlip(step, result, system)} Still to find: ${result.missing.map(nm).join(" ")}.` };
    case "direction":
      return { head: `Right note, wrong way.`,
        plain: `Play the ${nm(result.want)} ${step.target.direction === "down" ? "below" : "above"} your last note.` };
    case "bass":
      return { head: "All the notes are there.",
        plain: `${nm(result.lowest)} is at the bottom, though. Add another ${nm(result.want)} below the others.` };
    default:
      return { head: "", plain: "" };
  }
}

/* The note a hint lights: the next one a sequence wants, the first one a chord
   is still missing, or the bottom note an inversion needs. */
function practiceHint(step, attempt) {
  const t = step.target;
  if (t.kind === "sequence") return step.show[attempt.length] ?? null;
  const got = new Set(attempt.map(pc));
  const missing = t.pcs.find((p) => !got.has(p));
  if (missing !== undefined) return step.show.find((m) => pc(m) === missing) ?? null;
  return step.show[0] ?? null;
}

/* ============================================================================
   HOW TO THINK — feedback that teaches a way of finding the note, not only
   the note. (D-075)

   Most wrong notes come from a handful of thinking errors, and each one has
   its own fix: a third counted one key short, a scale note taken where a chord
   skips it, a scale note skipped, a step of the wrong size. Naming the error
   teaches the method, and the method is what works on your own instrument,
   without the app. Everything counts keys the way a beginner can check it:
   every key, black and white.
   ========================================================================== */

/* Where a note lives, by the black keys around it. */
const LANDMARKS = [
  "just left of the pair of black keys",
  "the first of the pair of black keys",
  "between the pair of black keys",
  "the second of the pair of black keys",
  "just right of the pair of black keys",
  "just left of the three black keys",
  "the first of the three black keys",
  "between the first and second of the three black keys",
  "the middle of the three black keys",
  "between the second and third of the three black keys",
  "the last of the three black keys",
  "just right of the three black keys",
];
const keyLandmark = (p) => LANDMARKS[pc(p)];

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

/* The size of a step and its direction, said so it can be found on the
   keyboard. A step of 0 between two notes of the same name is an octave. */
function stepWords(n, dir = "up") {
  if (n === 1) return `a half step ${dir} (the very next key)`;
  if (n === 2) return `a whole step ${dir} (skip one key)`;
  if (n === 3) return `three keys ${dir} (a minor third)`;
  if (n === 0 || n === 12) return `an octave ${dir} (12 keys)`;
  return `${plural(n, "key")} ${dir}`;
}

/* The name of a chord tone by its distance from the root. */
const TONE_WORDS = { 0: "root", 2: "ninth", 3: "minor third", 4: "major third", 6: "flat fifth",
  7: "fifth", 8: "sharp fifth", 9: "sixth", 10: "seventh", 11: "major seventh" };
const toneWord = (semis) => TONE_WORDS[pc(semis)] ?? "note";

/* A chord's notes as the scale walk that makes them: "C, skip D, E, skip F, G".
   Only when every chord tone is in the scale and they really are every other
   note; otherwise null, and the counting explanation is used instead. */
function skipWalk(chordPcsRootFirst, scale, system) {
  if (!scale || !chordPcsRootFirst.every((p) => scale.includes(p))) return null;
  const start = scale.indexOf(chordPcsRootFirst[0]);
  const walk = [];
  for (let k = 0; k < chordPcsRootFirst.length; k++) {
    const want = scale[(start + 2 * k) % scale.length];
    if (want !== chordPcsRootFirst[k]) return null;
    if (k > 0) walk.push(`skip ${noteName(scale[(start + 2 * k - 1) % scale.length], system)}`);
    walk.push(noteName(want, system));
  }
  return walk.join(", ");
}

/* One sentence on why this note was not the one, and how to find the right one. */
function diagnoseSlip(step, result, system = "letters") {
  const nm = (p) => noteName(p, system);
  const t = step.target;
  const P = result.played;

  if (t.kind === "sequence") {
    const W = result.want;
    if (!result.attempt.length) return `A scale starts on its home note, ${nm(W)}, ${keyLandmark(W)}.`;
    const prev = pc(result.attempt[result.attempt.length - 1]);
    const down = t.direction === "down";
    const size = down ? pc(prev - W) : pc(W - prev);
    const later = t.pcs.slice(result.attempt.length + 1).includes(P);
    if (later) return `You skipped ${nm(W)}: from ${nm(prev)} the next note is ${stepWords(size, down ? "down" : "up")}.`;
    if (Math.min(pc(P - W), pc(W - P)) === 1) {
      return `From ${nm(prev)} it's ${stepWords(size, down ? "down" : "up")}, which lands on ${nm(W)}, not ${nm(P)}.`;
    }
    return `The next note is ${nm(W)}: from ${nm(prev)} it's ${stepWords(size, down ? "down" : "up")}.`;
  }

  const root = t.pcs[0];
  if (t.pcs.length === 1) return `${nm(root)} is ${keyLandmark(root)}.`;
  const walk = skipWalk(t.pcs, step.scale, system);
  if (walk && step.scale.includes(P)) return `${nm(P)} is in the scale, but a chord takes every other note: ${walk}.`;
  const missing = result.missing ?? [];
  const near = missing.find((m) => Math.min(pc(P - m), pc(m - P)) === 1);
  if (near !== undefined && near !== root) {
    return `${nm(P)} is ${plural(pc(P - root), "key")} above ${nm(root)}; the ${toneWord(near - root)} is ${plural(pc(near - root), "key")} up, at ${nm(near)}.`;
  }
  if (near === root) return `${nm(P)} is one key away from the root, ${nm(root)}.`;
  const gaps = t.pcs.slice(1).map((p, i) => pc(p - t.pcs[i]));
  return `From ${nm(root)} this chord counts ${gaps.join(" + ")} keys; ${nm(P)} is ${plural(pc(P - root), "key")} up.`;
}

/* The first rung of the hint ladder: how to find the next note, without
   naming the key to press. The second rung lights it; Show me plays it all. */
function hintMethod(step, attempt, system = "letters") {
  const nm = (p) => noteName(p, system);
  const t = step.target;
  if (t.kind === "sequence") {
    if (!attempt.length) return `Start on ${nm(t.pcs[0])}, ${keyLandmark(t.pcs[0])}.`;
    const prev = pc(attempt[attempt.length - 1]);
    const want = t.pcs[attempt.length];
    const down = t.direction === "down";
    return `From ${nm(prev)}, go ${stepWords(down ? pc(prev - want) : pc(want - prev), down ? "down" : "up")}.`;
  }
  const root = t.pcs[0];
  const got = new Set(attempt.map(pc));
  const missing = t.pcs.find((p) => !got.has(p));
  if (t.pcs.length === 1) return `Look for ${nm(root)}: it is ${keyLandmark(root)}.`;
  if (missing === root) return `Start with the root, ${nm(root)}: the chord is named after it.`;
  if (missing !== undefined) return `Count ${plural(pc(missing - root), "key")} up from ${nm(root)} for the ${toneWord(missing - root)}, counting every key.`;
  return `Play another ${nm(t.bassPc)} to the left of everything else: the lowest note decides the inversion.`;
}

/* Pianists remember chords as shapes of white and black keys, and the shape
   repeats: C, F and G major are all white; D, E and A put a black key in the
   middle. Naming the family is what makes a new key feel familiar. */
const SHAPE_WORDS = { W: "white", B: "black" };
function chordShape(pcsRootFirst, system = "letters") {
  if (pcsRootFirst.length !== 3) return null;
  const root = pcsRootFirst[0];
  const iv = pcsRootFirst.map((p) => pc(p - root));
  const quality = QUALITIES[iv.join(",")];
  if (!quality || !["", "m"].includes(quality.sym)) return null;
  const pattern = (r) => iv.map((i) => (WHITE_PCS.includes(pc(r + i)) ? "W" : "B")).join("");
  const own = pattern(root);
  const words = own === "WWW" ? "all white keys" : own === "BBB" ? "all black keys"
    : own.split("").map((c) => SHAPE_WORDS[c]).join(", ");
  const mode = quality.sym === "m" ? "minor" : "major";
  const others = [];
  for (let r = 0; r < 12; r++) {
    if (r !== root && pattern(r) === own) others.push(chordLabel(r, quality.sym, spelling(system, r, mode)));
  }
  return {
    pattern: own, others,
    text: others.length
      ? `Shape: ${words}, the same as ${others.join(", ")}.`
      : `Shape: ${words}, and no other ${mode} chord has it.`,
  };
}

/* One step round the circle of fifths: the key whose scale differs from this
   one by a single note, and the natural next place to practise. */
const nextKeyRound = (root) => pc(root + 7);

/* THEORY:END */

/* ============================================================================
   AUDIO — one instrument behind an interface, always releasable. (D-009, D-017)
   ========================================================================== */

function useInstrument() {
  const ref = useRef(null);            // { out, delay }
  const live = useRef([]);             // [{ synth, until }] — timed voices
  const held = useRef(new Map());      // midi -> synth, while a finger is down
  const preset = useRef(INSTRUMENTS[0]);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("idle");
  const [detail, setDetail] = useState("not started");
  const [voiceCount, setVoiceCount] = useState(0);
  const muted = useRef(false);

  const refresh = useCallback(() => {
    try { setStatus(Tone.getContext().state === "running" ? "running" : "suspended"); }
    catch (e) { setStatus("error"); }
  }, []);

  const resume = useCallback(async () => {
    try {
      const c = Tone.getContext();
      if (c.state !== "running") await c.resume();
      refresh();
    } catch (e) { setStatus("suspended"); }
  }, [refresh]);

  const reap = useCallback((force = false) => {
    const now = (() => { try { return Tone.now(); } catch (e) { return 0; } })();
    if (force) {
      for (const [m, v] of held.current) {
        try { v.sampler ? v.sampler.triggerRelease(Tone.Frequency(m, "midi").toFrequency()) : v.dispose(); } catch (e) {}
      }
      held.current.clear();
      try { for (const k of Object.keys(ref.current?.samplers ?? {})) ref.current.samplers[k].node.releaseAll?.(); } catch (e) {}
    }
    const { keep, expired } = force
      ? { keep: [], expired: live.current }
      : reapVoices(live.current, now);
    expired.forEach((v) => { try { v.synth.dispose(); } catch (e) {} });
    live.current = keep;
    setVoiceCount(keep.length);
  }, []);

  const init = useCallback(async () => {
    if (ref.current) { await resume(); return; }
    /* An instrument should sound with the iPhone's silent switch on, as
       GarageBand does. Safari 16.4+ lets a page ask for that; elsewhere this
       property does not exist and nothing changes. (D-076) */
    try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) {}
    try { await Tone.start(); }
    catch (e) { setStatus("error"); setDetail(`start failed: ${e.message}`); return; }
    try {
      /* One delay in the chain, always present, wet at zero when off. Adding
         and removing a node while notes are in flight is a good way to lose
         them; changing one number is not. (D-041) */
      /* voice → delay → reverb → out. Both always present, both at zero when
         off, because swapping nodes while notes are in flight loses them. */
      const reverb = new Tone.Reverb({ decay: 1.1, wet: 0 }).toDestination();
      const delay = new Tone.FeedbackDelay({ delayTime: 0.28, feedback: 0, wet: 0 }).connect(reverb);
      ref.current = { out: delay, delay, reverb, samplers: {} };
      setReady(true);
      setDetail(preset.current.name);
      refresh();
    } catch (e) {
      try { ref.current = { out: Tone.getDestination(), delay: null, reverb: null, samplers: {} }; setReady(true); setDetail("no effects"); }
      catch (e2) { setStatus("error"); setDetail(`audio failed: ${e.message}`); }
    }
  }, [resume, refresh]);

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible" && ref.current) resume(); };
    const timer = setInterval(() => { if (ref.current) { reap(); refresh(); } }, 1000);
    document.addEventListener("visibilitychange", onVisible);
    return () => { document.removeEventListener("visibilitychange", onVisible); clearInterval(timer); };
  }, [resume, refresh, reap]);

  const panic = useCallback(() => {
    reap(true);
    try { for (const v of ref.current?.pool?.voices ?? []) { v.synth.triggerRelease(); v.until = 0; } } catch (e) {}
    setVoiceCount(0);
  }, [reap]);
  const setMutedState = useCallback((on) => { muted.current = on; if (on) panic(); }, [panic]);

  /* Changing instrument leaves sounding notes alone: they finish on the old
     voice and are reaped normally. Only the next note is different. */
  /* Recorded instruments are loaded on demand and shared: a Sampler handles
     its own polyphony, so it is one node rather than a voice per note. (D-062) */
  /* Decoding the recordings ourselves, rather than handing the audio library a
     URL to fetch. Even a data: URI goes through fetch, and a page whose policy
     restricts where requests may go blocks that as readily as any website —
     which is why the embedded piano still reported "did not arrive". (D-070) */
  const decodeSamples = useCallback(async (preset) => {
    const out = {};
    for (const [note, uri] of Object.entries(preset.samples.urls)) {
      const b64 = uri.slice(uri.indexOf(",") + 1);
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      out[note] = await Tone.getContext().decodeAudioData(bytes.buffer);
    }
    return out;
  }, []);

  const samplerFor = useCallback((preset) => {
    const store = ref.current?.samplers;
    if (!store) return null;
    const entry = store[preset.id];
    if (entry) return entry.loaded ? entry.node : null;

    /* The record goes in before any work starts: onload can fire immediately
       when the buffers are already in hand, and writing into an entry that did
       not exist yet threw, was swallowed, and rebuilt the sampler on every note. (D-064) */
    store[preset.id] = { node: null, loaded: false, failed: false };
    setDetail(`preparing ${preset.name}…`);

    decodeSamples(preset)
      .then((buffers) => {
        const node = new Tone.Sampler({
          urls: buffers,
          release: preset.options.release ?? 1,
          volume: preset.volume,
        }).connect(ref.current.out);
        const e = store[preset.id];
        if (e) { e.node = node; e.loaded = true; }
        setDetail(preset.name);
      })
      .catch((err) => {
        const e = store[preset.id];
        if (e) e.failed = true;
        setDetail(`${preset.name} could not be decoded (${err.message}) — using a stand-in`);
      });

    return null;
  }, [decodeSamples]);

  const setInstrument = useCallback((id) => {
    preset.current = instrumentById(id);
    setDetail(preset.current.name);
    if (preset.current.kind === "sampler" && ref.current) samplerFor(preset.current);
  }, [samplerFor]);

  const setSpace = useCallback(async (spaceId) => {
    const r = ref.current?.reverb;
    if (!r) return;
    const { decay, wet } = reverbSettings(spaceId);
    try {
      r.wet.value = wet;
      if (wet > 0) { r.decay = decay; await r.generate(); }
    } catch (e) {}
  }, []);

  const setEcho = useCallback((on) => {
    const d = ref.current?.delay;
    if (!d) return;
    const s = delaySettings(preset.current.id, on);
    try {
      d.wet.value = s.wet;
      d.feedback.value = s.feedback;
      d.delayTime.value = s.time;
    } catch (e) {}
  }, []);

  /* A fixed pool per instrument, built once and reused. Nothing is created or
     destroyed while playing. (D-066) */
  const poolFor = useCallback((p) => {
    const r = ref.current;
    if (!r) return null;
    if (r.pool && r.pool.id === p.id) return r.pool;
    if (r.pool) { for (const v of r.pool.voices) { try { v.synth.dispose(); } catch (e) {} } }
    const Voice = p.kind === "fm" ? Tone.FMSynth : p.kind === "am" ? Tone.AMSynth : Tone.Synth;
    const voices = [];
    for (let i = 0; i < MAX_VOICES; i++) {
      try {
        const synth = new Voice(p.options).connect(r.out);
        synth.volume.value = p.volume;
        voices.push({ synth, until: 0 });
      } catch (e) { break; }
    }
    r.pool = { id: p.id, voices };
    setVoiceCount(0);
    return r.pool;
  }, []);

  const play = useCallback((notes, seconds, time, velocity = 0.8, spread = 0) => {
    if (!ref.current || muted.current) return;
    const p = preset.current;
    const list = (Array.isArray(notes) ? notes : [notes]).slice(0, 8);

    /* Low to high, each note a moment after the one below it. (D-068) */
    const sorted = [...list].sort((a, b) => a - b);
    const offsets = rollOffsets(sorted.length, spread);
    const startAt = typeof time === "number"
      ? time
      : (() => { try { return Tone.now(); } catch (e) { return 0; } })();

    /* A recorded instrument that has not arrived yet plays through a stand-in
       rather than nothing. Waiting in silence is indistinguishable from
       broken, and was reported as exactly that. (D-064) */
    let voicePreset = p;
    if (p.kind === "sampler") {
      const node = samplerFor(p);
      if (node) {
        try {
          sorted.forEach((m, i) => {
            node.triggerAttackRelease(
              Tone.Frequency(m, "midi").toFrequency(),
              Math.max(0.05, seconds), startAt + offsets[i], velocity
            );
          });
        } catch (e) { setDetail(`note failed: ${e.message}`); }
        return;
      }
      voicePreset = instrumentById(p.fallback ?? "felt");
    }

    const pool = poolFor(voicePreset);
    if (!pool || !pool.voices.length) return;
    const dur = Math.max(0.05, seconds);
    const at = startAt;
    const busy = pool.voices.map((v) => v.until);
    let sounding = 0;

    sorted.forEach((m, k) => {
      const startsAt = startAt + offsets[k];
      const i = pickVoiceIndex(busy, startsAt);
      const v = pool.voices[i];
      try {
        v.synth.triggerAttackRelease(Tone.Frequency(m, "midi").toFrequency(), dur, startsAt, velocity);
        v.until = startsAt + voiceLifetime(dur, voicePreset.release);
        busy[i] = v.until;
        sounding++;
      } catch (e) { setDetail(`note failed: ${e.message}`); }
    });
    if (sounding) {
      const now = at;
      setVoiceCount(pool.voices.filter((v) => v.until > now).length);
    }
  }, [reap]);

  /* Held notes: pressed and not yet let go. Kept apart from the timed voices
     so a finger on a key can never be reaped out from under itself. (D-045) */
  const holdOn = useCallback(async (midi) => {
    await init(); await resume();
    if (!ref.current || muted.current || held.current.has(midi)) return;
    if (held.current.size >= MAX_HELD) return;
    const p = preset.current;

    let q = p;
    if (p.kind === "sampler") {
      const node = samplerFor(p);
      if (node) {
        try {
          node.triggerAttack(Tone.Frequency(midi, "midi").toFrequency(), undefined, 0.85);
          held.current.set(midi, { sampler: node, midi });
        } catch (e) {}
        return;
      }
      q = instrumentById(p.fallback ?? "felt");
    }

    try {
      const Voice = q.kind === "fm" ? Tone.FMSynth : q.kind === "am" ? Tone.AMSynth : Tone.Synth;
      const synth = new Voice(q.options).connect(ref.current.out);
      synth.volume.value = q.volume;
      synth.triggerAttack(Tone.Frequency(midi, "midi").toFrequency(), undefined, 0.85);
      held.current.set(midi, synth);
    } catch (e) { setDetail(`hold failed: ${e.message}`); }
  }, [init, resume]);

  const holdOff = useCallback((midi) => {
    const synth = held.current.get(midi);
    if (!synth) return;
    held.current.delete(midi);
    if (synth.sampler) {
      try { synth.sampler.triggerRelease(Tone.Frequency(midi, "midi").toFrequency()); } catch (e) {}
      return;
    }
    try {
      synth.triggerRelease();
      const now = (() => { try { return Tone.now(); } catch (e) { return 0; } })();
      live.current.push({ synth, until: now + preset.current.release + 0.3 });
    } catch (e) { try { synth.dispose(); } catch (e2) {} }
  }, []);

  const test = useCallback(async () => {
    await init(); await resume();
    const before = muted.current;
    muted.current = false;
    play([60], 0.6, undefined, 0.9);
    muted.current = before;
  }, [init, resume, play]);

  /* Reset really rebuilds: releasing notes does not help when the audio graph
     itself has become the problem. (D-066) */
  const reset = useCallback(() => {
    reap(true);
    const r = ref.current;
    if (r?.pool) {
      for (const v of r.pool.voices) { try { v.synth.dispose(); } catch (e) {} }
      r.pool = null;
    }
    setVoiceCount(0);
    setDetail(`${preset.current.name} · rebuilt`);
    refresh();
  }, [reap, refresh]);

  return { init, resume, play, panic, test, reset, setInstrument, setEcho, setSpace,
           holdOn, holdOff, setMuted: setMutedState, ready, status, detail, voiceCount };
}

/* ============================================================================
   DESIGN TOKENS — Bone palette. (D-018)
   Named by role, not by colour, so new roles slot in without renaming anything.
   ========================================================================== */

const T = {
  ground: "#EDE7DA", surface: "#E3DBCA", raised: "#D8CFBB", edge: "#CFC4AE",
  ink: "#2E2A24", inkSoft: "#7A7166", inkOnAccent: "#2A1A06",

  keyWhite: "#FFFDF7", keyBlack: "#B3ABA0",   // grey, not black: colour reads on it (D-029)

  /* key labels, one per fill state — never a literal in a component (X-16) */
  labelPlain: "#9C948A", labelSharp: "#5A544B", labelLoop: "#7A5A24",
  labelOnBass: "#FFF2FA", labelRing: "#FFFFFF",
  padInk: "#FFF6E8", padSub: "#FBE6CB",

  /* fill channel — harmony */
  chordW: "#D4802F", chordB: "#BE6F23", chordRootRing: "#7A3F0E",
  loopW: "#F0DCB6", loopB: "#DEC49A",
  soundingW: "#FFC46B", soundingB: "#F0B052",

  /* marker channel — palette */
  scaleDot: "#2F6470", scaleDotOnFill: "#8FD8D0",
  homeDot: "#0E7C86", homeDotOnFill: "#5BEBDA",

  /* reserved for roles not yet built, kept here so the system stays coherent */
  bass: "#7B4B8A", bassW: "#9A6BA8", bassB: "#8A5A99",   // UC-19, UC-29 bass
  pickedW: "#8C63A0", pickedB: "#7A5490",                // UC-42 notes chosen for identification
  moveDot: "#8AA37B", tensionDot: "#C2586A",             // UC-50 melody guide
  changedRing: "#7B4B8A",                                // UC-51 what just changed

  /* the printed sheet: paper, not screen (D-057) */
  paper: "#FFFFFF", paperInk: "#1C1814", paperFaint: "#6A6258", paperLine: "#3A342C",
  passing: "#9A8A6B",   // UC-20 approach and passing notes
  tension: "#B23A48",   // outside-the-scale emphasis, stop states
  ok: "#3E7D5A",        // compatibility confirmations
};

function Piano({ startMidi, octaves = 4, chordNotes, chordRootMidi, loopNotes, scaleSet, tonic, sounding, bassLit, picked = [], changed = [], guide = false, system, onDown, onUp, fingers = [], brackets = [] }) {
  const midis = useMemo(() => Array.from({ length: octaves * 12 + 1 }, (_, i) => startMidi + i), [startMidi, octaves]);
  const whites = midis.filter(isWhite);
  const w = 100 / whites.length;
  const snd = [...sounding];

  const look = (m) => {
    const white = isWhite(m);
    const role = picked.includes(m) ? "picked" : keyRole(m, { chordNotes, chordRootMidi, loopNotes, sounding: snd, bass: bassLit });
    const marker = keyMarker(m, { tonic, scaleSet });
    let fill = white ? T.keyWhite : T.keyBlack;
    let text = white ? T.labelPlain : T.labelSharp;
    let ring = null;

    if (role === "inLoop")    { fill = white ? T.loopW : T.loopB;   text = T.labelLoop; }
    if (role === "chordTone") { fill = white ? T.chordW : T.chordB; text = T.inkOnAccent; }
    if (role === "chordRoot") { fill = white ? T.chordW : T.chordB; text = T.inkOnAccent; ring = `inset 0 0 0 3px ${T.chordRootRing}`; }
    if (role === "bass")      { fill = white ? T.bassW : T.bassB;   text = T.labelOnBass; ring = `inset 0 0 0 2px ${T.bass}`; }
    if (role === "picked")    { fill = white ? T.pickedW : T.pickedB; text = T.inkOnAccent; ring = `inset 0 0 0 3px ${T.bass}`; }
    if (role === "sounding")  { fill = white ? T.soundingW : T.soundingB; text = T.inkOnAccent; ring = `inset 0 0 0 3px ${T.labelRing}`; }

    /* Both key types are light now, so the dot colour follows the FILL rather
       than the key. Dark teal on pale keys, pale teal on saturated ones. */
    const onFill = role === "chordTone" || role === "chordRoot" || role === "bass" || role === "picked";
    let dotColor = marker === "home"
      ? (onFill ? T.homeDotOnFill : T.homeDot)
      : (onFill ? T.scaleDotOnFill : T.scaleDot);
    let mark = marker;

    /* the melody guide replaces the plain in-scale dot with three answers:
       lands well, moves through, pulls. (D-056) */
    if (guide) {
      const r = melodyRole(m, chordNotes.map(pc), scaleSet);
      mark = r === "tension" ? "scale" : mark ?? "scale";
      dotColor = r === "stable" ? (onFill ? T.homeDotOnFill : T.homeDot)
        : r === "movement" ? T.moveDot : T.tensionDot;
      if (r === "tension" && !chordNotes.map(pc).includes(pc(m))) mark = "scale";
    }

    if (changed.includes(pc(m))) ring = `inset 0 0 0 3px ${T.changedRing}`;
    return { fill, text, ring, marker: mark, dotColor };
  };

  /* Pointer handling lives on the window, not on the keys and not on the
     container. A key cannot learn that a finger rolled onto it, and container
     handlers depend on capture behaving; window listeners always fire. (D-055) */
  const active = useRef({});
  const surface = useRef(null);

  const midiAt = (e) => {
    const el = surface.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return keyAtPosition(e.clientX - r.left, e.clientY - r.top, r.width, r.height, startMidi, octaves);
  };

  const apply = (pointerId, midi) => {
    const { next, pressed, released } = slideTo(active.current, pointerId, midi);
    active.current = next;
    if (released !== null) onUp(released);
    if (pressed !== null) onDown(pressed);
  };

  const handleDown = (e) => {
    e.preventDefault();
    apply(e.pointerId, midiAt(e));
  };

  useEffect(() => {
    const move = (e) => {
      if (!Object.prototype.hasOwnProperty.call(active.current, e.pointerId)) return;
      e.preventDefault();
      apply(e.pointerId, midiAt(e));
    };
    const up = (e) => {
      if (!Object.prototype.hasOwnProperty.call(active.current, e.pointerId)) return;
      apply(e.pointerId, null);
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }); // no dep array: the handlers close over the current layout every render

  const fingerOn = (m) => fingers.find((k) => k.midi === m);
  const keyLeft = (m) => isWhite(m) ? whites.indexOf(m) * w : whites.filter((x) => x < m).length * w - w * 0.31;
  const keyRight = (m) => isWhite(m) ? (whites.indexOf(m) + 1) * w : whites.filter((x) => x < m).length * w + w * 0.31;

  const Dot = ({ marker, color, size }) =>
    !marker ? null : (
      <span className="block rounded-full" style={{
        width: size, height: size, background: color,
        boxShadow: marker === "home" ? `0 0 0 3px ${color}44` : "none",
      }} />
    );

  /* Wider than the screen and scrollable, so the whole usable range is
     reachable by dragging rather than only by the octave buttons. (D-045) */
  return (
    <div className="overflow-x-auto -mx-1 px-1" style={{ WebkitOverflowScrolling: "touch" }}>
    {/* the strip above the keys is what scrolls: the keys themselves take
        touch-action none, or the browser treats a second finger as a pan and
        cancels the note (D-052) */}
    <div style={{ width: `${octaves * 190}px`, minWidth: "100%" }}>
      {/* pannable: this strip is the only way to scroll, and it is deliberately
          not inside the keyboard, because touch-action is intersected down the
          ancestor chain and a child cannot re-enable what a parent forbids */}
      <div className="flex items-center justify-center"
        style={{ height: 16, color: T.inkSoft, fontSize: 9, letterSpacing: ".08em" }}>
        drag here to move the keyboard
      </div>

      {/* which hand takes which keys, when a chord needs both (D-078) */}
      {brackets.length > 0 && (
        <div className="relative pointer-events-none" style={{ height: 16 }}>
          {brackets.filter((b) => b.lo >= startMidi && b.hi <= startMidi + octaves * 12).map((b) => (
            <div key={b.hand} className="absolute" style={{
              left: `${keyLeft(b.lo)}%`, width: `${keyRight(b.hi) - keyLeft(b.lo)}%`, bottom: 1, height: 6,
              borderTop: `2px solid ${b.hand === "L" ? T.bass : T.ink}`, borderLeft: `2px solid ${b.hand === "L" ? T.bass : T.ink}`,
              borderRight: `2px solid ${b.hand === "L" ? T.bass : T.ink}` }}>
              <span className="absolute text-[9px] font-semibold whitespace-nowrap" style={{ bottom: 5, left: 0, color: b.hand === "L" ? T.bass : T.ink }}>
                {b.hand === "L" ? "left hand" : "right hand"}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* the keyboard refuses pan and zoom outright, so a sideways drag is a
          glissando and never a scroll (D-054) */}
      <div ref={surface} className="relative select-none"
        style={{ height: 140, touchAction: "none" }}
        onPointerDown={handleDown}>
      <div className="flex w-full gap-px absolute left-0 right-0" style={{ top: 0, bottom: 0 }}>
        {whites.map((m) => {
          const { fill, text, ring, marker, dotColor } = look(m);
          return (
            <button key={m} data-midi={m}
              className="relative flex-1 rounded-b-md"
              style={{
                background: fill,
                boxShadow: `${ring ? ring + ", " : ""}inset 0 -3px 0 rgba(0,0,0,.10), inset 0 0 0 1px ${T.edge}`,
                transition: "background 90ms linear", touchAction: "none",
              }}>
              {fingerOn(m) && (
                <span className="absolute inset-x-0 flex justify-center" style={{ bottom: 30 }}><FingerMark k={fingerOn(m)} /></span>
              )}
              <span className="absolute inset-x-0 text-[9.5px] font-semibold text-center"
                    style={{ color: text, bottom: 16 }}>{noteName(m, system)}</span>
              <span className="absolute inset-x-0 flex justify-center" style={{ bottom: 6 }}>
                <Dot marker={marker} color={dotColor} size={7} />
              </span>
            </button>
          );
        })}
      </div>
      <div className="absolute left-0 right-0 pointer-events-none" style={{ top: 0, bottom: 0 }}>
        {midis.filter((m) => !isWhite(m)).map((m) => {
          const before = whites.filter((x) => x < m).length;
          const { fill, text, ring, marker, dotColor } = look(m);
          return (
            <button key={m} data-midi={m}
              className="absolute top-0 rounded-b-md pointer-events-auto"
              style={{
                left: `calc(${before * w}% - ${w * 0.31}%)`,
                width: `${w * 0.62}%`, height: "64%",
                background: fill, border: `1px solid ${T.ground}`,
                boxShadow: `${ring ? ring + ", " : ""}inset 0 0 0 1px ${T.edge}`,
                transition: "background 90ms linear", touchAction: "none",
              }}>
              {fingerOn(m) && (
                <span className="absolute inset-x-0 flex justify-center" style={{ bottom: 25 }}><FingerMark k={fingerOn(m)} small /></span>
              )}
              <span className="absolute inset-x-0 text-[7.5px] font-semibold text-center"
                    style={{ color: text, bottom: 14 }}>{noteName(m, system)}</span>
              <span className="absolute inset-x-0 flex justify-center" style={{ bottom: 5 }}>
                <Dot marker={marker} color={dotColor} size={6} />
              </span>
            </button>
          );
        })}
      </div>
      </div>
    </div>
    </div>
  );
}

/* A finger number. Right hand: a solid dark disc. Left hand: a light disc with
   a purple ring, purple being the bass colour. Solid against outlined tells
   them apart without colour, on screen and in black and white. (D-078) */
const FingerMark = ({ k, small = false }) => (
  <span role="img" aria-label={`${k.hand === "L" ? "left" : "right"} hand, finger ${k.finger}`}
    className="flex items-center justify-center rounded-full font-bold"
    style={{ width: small ? 15 : 17, height: small ? 15 : 17, fontSize: small ? 9.5 : 10.5, lineHeight: 1,
      background: k.hand === "L" ? T.padInk : T.ink, color: k.hand === "L" ? T.bass : T.padInk,
      boxShadow: k.hand === "L" ? `inset 0 0 0 2px ${T.bass}` : "none" }}>{k.finger}</span>
);

/* A chord as a picture, because a name on paper tells you nothing you did not
   already know. (D-057) */
const Diagram = ({ startMidi, octaves, notes, width = 168, height = 46, fingers = [] }) => {
  const { whites, blacks } = diagramKeys(startMidi, octaves, notes);
  const at = (m) => whites.find((k) => k.midi === m) ?? blacks.find((k) => k.midi === m);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
      {whites.map((k) => (
        <rect key={k.midi} x={k.x * width} y={0} width={k.w * width - 0.8} height={height}
          fill={k.on ? T.chordW : T.paper} stroke={T.paperLine} strokeWidth="0.7" />
      ))}
      {blacks.map((k) => (
        <rect key={k.midi} x={k.x * width} y={0} width={k.w * width} height={height * 0.62}
          fill={k.on ? T.chordB : T.paperLine} stroke={T.paperLine} strokeWidth="0.7" />
      ))}
      {fingers.filter((f) => at(f.midi)).map((f) => {
        const k = at(f.midi);
        const cx = (k.x + k.w / 2) * width - (isWhite(f.midi) ? 0.4 : 0);
        const cy = isWhite(f.midi) ? height - 7 : height * 0.62 - 6;
        return (
          <g key={f.midi}>
            <circle cx={cx} cy={cy} r={5.2} fill={f.hand === "L" ? T.paper : T.paperInk}
              stroke={f.hand === "L" ? T.bass : "none"} strokeWidth={f.hand === "L" ? 1.6 : 0} />
            <text x={cx} y={cy + 2.9} fontSize="7.5" fontWeight="700" textAnchor="middle"
              fill={f.hand === "L" ? T.bass : T.paper}>{f.finger}</text>
          </g>
        );
      })}
    </svg>
  );
};

const Legend = () => (
  <div className="flex items-center gap-3 flex-wrap text-[10px] mb-1.5" style={{ color: T.inkSoft }}>
    <span className="flex items-center gap-1.5"><i className="block rounded-full" style={{ width: 7, height: 7, background: T.homeDot, boxShadow: `0 0 0 3px ${T.homeDot}44` }} /> home</span>
    <span className="flex items-center gap-1.5"><i className="block rounded-full" style={{ width: 7, height: 7, background: T.scaleDot }} /> in scale</span>
    <span className="flex items-center gap-1.5"><i className="block rounded-sm" style={{ width: 9, height: 9, background: T.chordW }} /> this chord</span>
    <span className="flex items-center gap-1.5"><i className="block rounded-sm" style={{ width: 9, height: 9, background: T.loopW, boxShadow: `inset 0 0 0 1px ${T.edge}` }} /> in your loop</span>
    <span className="flex items-center gap-1.5"><i className="block rounded-sm" style={{ width: 9, height: 9, background: T.bassW }} /> bass</span>
  </div>
);

const SpeakerIcon = ({ on }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" />
    {on ? (
      <>
        <path d="M15.5 8.5a5 5 0 0 1 0 7" />
        <path d="M18.5 5.5a9 9 0 0 1 0 13" />
      </>
    ) : (
      <>
        <line x1="16" y1="9" x2="21" y2="15" />
        <line x1="21" y1="9" x2="16" y2="15" />
      </>
    )}
  </svg>
);

const TAB_LABELS = {
  chords: "Chords", find: "Find", scales: "Scales",
  prog: "Progression", bass: "Bass", theory: "Theory", sheet: "Sheet", learn: "Learn", guide: "How to use",
};
const TABS = TAB_IDS.map((id) => ({ id, label: TAB_LABELS[id] }));

const Row = ({ left, mid, right, onClick, accent = T.homeDot }) => (
  <button onClick={onClick} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left mb-1.5"
    style={{ background: T.surface, boxShadow: `inset 0 0 0 1px ${T.edge}` }}>
    <span className="text-sm font-semibold w-10 shrink-0" style={{ color: accent }}>{left}</span>
    <span className="text-sm font-medium shrink-0">{mid}</span>
    <span className="text-[11px] ml-auto text-right" style={{ color: T.inkSoft }}>{right}</span>
  </button>
);

/* Tone 15 moved the transport and the draw scheduler behind accessors.
   its accessors, and then kept failing for reasons I could not observe. It is
   gone: the loop now runs on our own lookahead scheduler. (D-039, D-043) */
const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  #sheet, #sheet * { visibility: visible !important; }
  #sheet { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; padding: 0 !important; }
  .no-print { display: none !important; }
  @page { margin: 14mm; }
}`;

export default function App() {
  const inst = useInstrument();

  const [tonic, setTonic] = useState(0);      // C, not C# (D-060)
  const [mode, setMode] = useState("major");  // major is where most people start
  const [scaleId, setScaleId] = useState("major");
  const [size, setSize] = useState(3);
  const [chord, setChord] = useState(null);
  const [prog, setProg] = useState([]);
  const [bpm, setBpm] = useState(88);
  const [playing, setPlaying] = useState(false);
  const [step, setStep] = useState(-1);
  const [withBass, setWithBass] = useState(true);
  const [startMidi, setStartMidi] = useState(48);
  const [sounding, setSounding] = useState(new Set());
  const [bassLit, setBassLit] = useState([]);
  const [muted, setMuted] = useState(false);
  const [instId, setInstId] = useState("grand");
  const [echo, setEchoOn] = useState(true);
  const [space, setSpace] = useState("room");
  const [roll, setRoll] = useState("block");
  const [voicingId, setVoicingId] = useState("close");
  const [lesson, setLesson] = useState({ degree: 0, step: -1 });
  const [picked, setPicked] = useState([]);
  /* Kept for the session only. Real persistence arrives with deployment —
     saving to a device nobody has opened yet would be pointless. (D-048) */
  const [mine, setMine] = useState({ chords: [], scales: [] });
  const [customScale, setCustomScale] = useState(null);
  const [guide, setGuide] = useState(false);
  const [changed, setChanged] = useState([]);
  const [tension, setTension] = useState(0);
  const [level, setLevel] = useState("start");
  const [baseSystem, setSystem] = useState("letters");
  const [chordText, setChordText] = useState("");   // D-077: chord names typed in the Progression tab
  /* D-078: finger numbers. null until chosen, so Learn can show the right hand
     by itself while everywhere else stays clean. */
  const [fingerChoice, setFingerChoice] = useState(null);
  const [reach, setReach] = useState(DEFAULT_REACH);
  const [sheetFingers, setSheetFingers] = useState(false);
  /* Names are spelled for the key: letters or Do-Re-Mi, with flats where the
     key uses them. Every `system` below is this spelling. (D-019, D-074) */
  const system = useMemo(() => spelling(baseSystem, tonic, mode), [baseSystem, tonic, mode]);
  const [note, setNote] = useState(null);
  const [tab, setTab] = useState("chords");
  const [setId, setSetId] = useState(null);
  const [style, setStyle] = useState("soul");
  const [bassPat, setBassPat] = useState(null);
  const [riffPat, setRiffPat] = useState(null);
  const [seed, setSeed] = useState(1);
  const [playRiff, setPlayRiff] = useState(true);
  /* Practice: which lesson is open, which step, the notes accepted so far, and
     what the piano is lighting for it. Judging is pure; this only holds the
     result. Completed lessons are kept for the session, like saved chords. (D-073) */
  /* hintLevel is the rung of the hint ladder: 0 nothing yet, 1 the method,
     2 the note lit. It goes back to 0 whenever a right note is played. (D-075) */
  const NO_PRACTICE = { lessonId: null, step: 0, attempt: [], stepDone: false, lessonDone: false, slips: 0, shown: [], hint: null, hintLevel: 0, method: null };
  const [practice, setPractice] = useState(NO_PRACTICE);
  const [learned, setLearned] = useState([]);
  const practiceRef = useRef(practice); practiceRef.current = practice;

  const pro = has(level, "numerals");           // depth follows from the level
  const can = (f) => has(level, f);
  const spread = rollStyleById(roll).spread;
  const ctx = { tonic, mode, scaleId };
  const scaleSet = useMemo(() => activeScalePcs(customScale, tonic, scaleId), [customScale, tonic, scaleId]);
  const parentScale = mode === "minor" ? "natural-minor" : "major";
  /* Harmonise the scale the user actually chose. Picking Dorian and still
     being shown natural-minor chords was simply wrong. (D-046) */
  const harmonyScale = scaleById(scaleId).iv.length === 7 ? scaleId : parentScale;
  /* everything is built in the octave the keyboard is showing (D-060) */
  const base = startMidi;
  const chords = useMemo(
    () => (tension > 0
      ? chordsAtTension(tonic, mode, tension, base)
      : harmonize(tonic, harmonyScale, size, base)),
    [tonic, mode, harmonyScale, size, tension, base]
  );
  const chordNotes = chord ? chord.notes : [];
  const loopNotes = useMemo(() => [...new Set(prog.flatMap((c) => c.notes))], [prog]);
  const activeSet = useMemo(() => (setId ? buildSet(CHORD_SETS.find((x) => x.id === setId), tonic, base) : null), [setId, tonic, base]);
  const lbl = (c) => typedLabel(c, system);   // a slash chord keeps its bass in its name (D-077)
  /* Lessons are built in the octave the keyboard shows, so a demonstration is
     always on screen and a lesson's loop matches the Chords tab. */
  const lessonNow = useMemo(
    () => (practice.lessonId ? buildLesson(practice.lessonId, tonic, system, startMidi) : null),
    [practice.lessonId, tonic, system, startMidi]
  );
  const stepNow = lessonNow ? lessonNow.steps[practice.step] : null;

  /* D-078: which hand's fingers are on the keys, and for what */
  const fingerHand = effectiveFingerHand(fingerChoice, tab);
  const inLesson = tab === "learn" && !!lessonNow;
  const lessonFingering = useMemo(
    () => (stepNow && fingerHand !== "off" ? stepFingering(stepNow, lessonNow.mode, fingerHand === "left" ? "L" : "R", reach, lessonNow.system) : null),
    [stepNow, lessonNow, fingerHand, reach]);
  const chordFingering = useMemo(
    () => (chord && fingerHand !== "off" ? fingerChord(chord.notes, { hand: fingerHand, reach, rootPc: chord.rootPc, bassPc: chord.bassPc ?? null }) : null),
    [chord, fingerHand, reach]);
  const pianoFingers = inLesson
    ? litLessonFingers(lessonFingering, stepNow, practice.attempt, practice.shown, practice.hint)
    : chordFingering?.keys ?? [];
  const pianoBrackets = inLesson ? [] : chordFingering?.brackets ?? [];
  const extraBass = inLesson ? null : chordFingering?.extraBass ?? null;
  useEffect(() => {   // a left-hand bass below the visible keys brings the view down to it
    if (extraBass !== null && extraBass < startMidi) setStartMidi(Math.max(PIANO_RANGE.lowest, Math.floor(extraBass / 12) * 12));
  }, [extraBass]);

  const timers = useRef([]);
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const panic = () => { clearTimers(); inst.panic(); setSounding(new Set()); setBassLit([]); };

  useEffect(() => {
    if (scaleById(scaleId).mode !== mode) setScaleId(mode === "minor" ? "natural-minor" : "major");
    if (activeSet && activeSet.mode !== mode) setSetId(null);
  }, [mode]); // eslint-disable-line
  useEffect(() => { inst.setMuted(muted); }, [muted]); // eslint-disable-line
  /* Leaving a tab with a finger down used to leave the note sounding for ever,
     because the key that would have released it is no longer on screen. */
  useEffect(() => { inst.panic(); setSounding(new Set()); }, [tab]); // eslint-disable-line
  useEffect(() => { inst.setInstrument(instId); inst.setEcho(echo); inst.setSpace(space); }, [instId]); // eslint-disable-line
  useEffect(() => { inst.setEcho(echo); }, [echo, inst.ready]); // eslint-disable-line
  useEffect(() => { inst.setSpace(space); }, [space, inst.ready]); // eslint-disable-line

  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    setChord(null);
    setNote({
      head: `${noteName(tonic, system)} ${mode}`,
      plain: `Home note is ${noteName(tonic, system)}. Your seven notes are ${scalePcs(tonic, parentScale).map((p) => noteName(p, system)).join(" ")}.`,
      formal: `Tonic ${noteName(tonic, system)}, ${mode}.`,
    });
  }, [tonic, mode, system]); // eslint-disable-line

  /* A lesson follows the key. Changing key restarts the open lesson in the new
     one rather than judging half an attempt against notes that have moved. */
  useEffect(() => {
    const id = practiceRef.current.lessonId;
    if (!id) return;
    setPractice({ ...NO_PRACTICE, lessonId: id });
    const l = buildLesson(id, tonic, system, startMidi);
    setNote({ head: `${l.title} in ${noteName(tonic, system)} · step 1 of ${l.steps.length}`, plain: l.steps[0].prompt });
  }, [tonic]); // eslint-disable-line

  /* Show what moved, not just the result. Only the notes that came in or went
     out are ringed, and only for a moment. (D-056) */
  const prevScale = useRef(scaleSet);
  useEffect(() => {
    const diff = changedNotes(prevScale.current, scaleSet);
    prevScale.current = scaleSet;
    const marks = [...diff.added, ...diff.removed];
    if (!marks.length) return;
    setChanged(marks);
    const id = setTimeout(() => setChanged([]), 1600);
    return () => clearTimeout(id);
  }, [scaleSet.join(",")]); // eslint-disable-line

  const flash = (notes, ms = 420) => {
    setSounding(new Set(notes));
    const id = setTimeout(() => {
      setSounding(new Set());
      timers.current = timers.current.filter((t) => t !== id);
    }, ms);
    timers.current.push(id);
  };

  /* One note played during a lesson. The ref is updated at once, so a quick run
     of notes — a finger sliding up a scale — is judged against the attempt as
     it really stands, not against a render that has not happened yet. (D-073) */
  const judgeNote = (m) => {
    const p = practiceRef.current;
    const step = lessonNow?.steps[p.step];
    if (!step || p.stepDone) return;
    const r = practiceNote(step.target, p.attempt, m);
    const slips = p.slips + (r.verdict === "wrong" || r.verdict === "direction" ? 1 : 0);
    const stepDone = r.verdict === "done";
    const lessonDone = stepDone && p.step === lessonNow.steps.length - 1;
    const moved = r.verdict === "progress" || r.verdict === "done";
    const next = { ...p, attempt: r.attempt, slips, stepDone, lessonDone, hint: null,
      hintLevel: moved ? 0 : p.hintLevel, method: moved ? null : p.method };
    practiceRef.current = next;
    setPractice(next);
    setNote(practiceFeedback(step, r, lessonNow.system));
    if (lessonDone) {
      const key = `${lessonNow.id}@${tonic}`;
      setLearned((l) => (l.includes(key) ? l : [...l, key]));
    }
  };

  const openLesson = (id) => {
    const l = buildLesson(id, tonic, system, startMidi);
    setPractice({ ...NO_PRACTICE, lessonId: id });
    setNote({ head: `${l.title} · step 1 of ${l.steps.length}`, plain: l.steps[0].prompt });
  };

  const nextStep = () => {
    if (!lessonNow) return;
    const i = practice.step + 1;
    setPractice({ ...NO_PRACTICE, lessonId: practice.lessonId, step: i, slips: practice.slips });
    setNote({ head: `${lessonNow.title} · step ${i + 1} of ${lessonNow.steps.length}`, plain: lessonNow.steps[i].prompt });
  };

  const showStep = async () => {
    if (!stepNow) return;
    await inst.init(); await inst.resume();
    setPractice({ ...practice, shown: stepNow.show, hint: null });
    if (stepNow.target.kind === "sequence") playSequence(stepNow.show, 330, 0.4);
    else inst.play(stepNow.show, 1.1, undefined, 0.7, spread);
  };

  /* The hint ladder: first how to find the note, then the note itself. Show me
     is the last rung, and stays a separate button. (D-075) */
  const hintStep = () => {
    if (!stepNow) return;
    if (practice.hintLevel === 0) {
      const method = hintMethod(stepNow, practice.attempt, lessonNow.system);
      setPractice({ ...practice, hintLevel: 1, method });
      setNote({ head: "How to find it", plain: method });
      return;
    }
    const h = practiceHint(stepNow, practice.attempt);
    setPractice({ ...practice, hint: h, hintLevel: 2 });
    if (h !== null) setNote({ head: `Try ${noteName(h, lessonNow.system)}.`, plain: "It's lit on the piano." });
  };

  /* Press and hold sustains; a quick tap still behaves like a tap, because
     the note is released as soon as the finger lifts. (D-045) */
  const noteDown = async (m) => {
    if (tab === "find") {
      setPicked((p) => (p.includes(m) ? p.filter((x) => x !== m) : [...p, m].sort((a, b) => a - b)));
      await inst.init(); await inst.resume();
      inst.play([m], 0.5, undefined, 0.85);
      return;
    }
    setSounding((prev) => new Set(heldAfterDown([...prev], m)));
    /* judged before the sound is awaited, so feedback never waits on audio */
    if (tab === "learn" && lessonNow) { judgeNote(m); await inst.holdOn(m); return; }
    await inst.holdOn(m);
    const p = pc(m);
    setNote(
      p === tonic
        ? { head: `${noteName(p, system)} — home`, plain: "The note your key is named after. Everything resolves here." }
        : scaleSet.includes(p)
        ? { head: `${noteName(p, system)} — in your scale`, plain: `Degree ${scaleSet.indexOf(p) + 1} of ${noteName(tonic, system)} ${scaleById(scaleId).name.toLowerCase()}.` }
        : { head: `${noteName(p, system)} — outside the scale`, plain: "Tense on its own, but it works well as a passing note." }
    );
  };

  const noteUp = (m) => {
    if (tab === "find") return;
    inst.holdOff(m);
    setSounding((prev) => new Set(heldAfterUp([...prev], m)));
  };

  /* A chord is played in the voicing the user has chosen, and the piano shows
     that voicing — the arrangement is the chord, not a decoration of it. (D-042) */
  const voiced = useCallback((c) => {
    if (!c) return c;
    const v = voicingsFor(c).find((x) => x.id === voicingId);
    return v ? { ...c, notes: v.notes } : c;
  }, [voicingId]);

  const tapChord = async (c, explain = true) => {
    const vc = voiced(c);
    await inst.init(); await inst.resume();
    if (!playing) inst.panic();
    inst.play(vc.notes, 0.85, undefined, 0.65, spread);
    setChord(vc);
    if (explain) setNote(explainChord(vc, ctx, system));
  };

  const playSequence = async (notes, gapMs = 260, dur = 0.3, asBass = false) => {
    await inst.init(); await inst.resume();
    clearTimers();
    notes.forEach((m, i) => {
      const id = setTimeout(() => {
        inst.play([m], dur, undefined, 0.85);
        if (asBass) setBassLit([m]); else setSounding(new Set([m]));
        if (i === notes.length - 1) {
          const clear = setTimeout(() => { setSounding(new Set()); setBassLit([]); }, 420);
          timers.current.push(clear);
        }
      }, i * gapMs);
      timers.current.push(id);
    });
  };

  /* The dictionary is about the quality, so it always plays close position.
     Heard through a chosen voicing — rootless, say — a major and a minor triad
     can end up sounding far more alike than they are. (D-044) */
  const playDictionaryChord = async (c) => {
    await inst.init(); await inst.resume();
    if (!playing) inst.panic();
    inst.play(c.notes, 1.1, undefined, 0.7, spread);
    setChord(c);
    setNote({
      head: `${lbl(c)} — ${c.full}`,
      plain: `${c.plain} Notes: ${c.notes.map((m) => noteName(m, system)).join(" ")}.`,
      formal: `Formula ${c.formula}. Played in close position so the quality is what you hear.`,
    });
  };

  const playArp = async (notes, direction) => {
    await inst.init(); await inst.resume();
    playSequence(arpeggio(notes, direction), 170, 0.45);
  };

  const addChord = (c) => { if (prog.length < 8) { const vc = voiced(c); setProg([...prog, vc]); setChord(vc); } };
  const addAll = (cs) => setProg(cs.slice(0, 8).map(voiced));

  /* Typed chords keep the dictionary's voicing, and a slash chord its bass. */
  const typed = useMemo(() => parseChordNames(chordText, system), [chordText, system]);
  const typedOk = typed.filter((r) => r.ok).map((r) => typedChord(r, tonic, mode, base));
  const typedErrors = typed.filter((r) => !r.ok);
  const addTyped = (replace) => {
    if (typedErrors.length || !typedOk.length) return;
    const next = replace ? typedOk : [...prog, ...typedOk];
    if (next.length > 8) return;
    setProg(next); setChord(typedOk[typedOk.length - 1]); setChordText("");
  };

  const progRef = useRef(prog); progRef.current = prog;
  const bassRef = useRef(withBass); bassRef.current = withBass;
  const sysRef = useRef(system); sysRef.current = system;
  const bpmRef = useRef(bpm); bpmRef.current = bpm;

  const bassFigure = useMemo(
    () => (bassPat && prog.length ? renderProgressionFigure(bassPat, prog, scaleSet, seed, 36) : null),
    [bassPat, prog, scaleSet, seed]
  );
  const riffFigure = useMemo(
    () => (riffPat && prog.length ? renderProgressionFigure(riffPat, prog, scaleSet, seed + 101, 64) : null),
    [riffPat, prog, scaleSet, seed]
  );
  const figRef = useRef({}); figRef.current = { bass: bassFigure, riff: riffFigure, playRiff };

  const suggest = () => {
    const b = patternsFor("bass", style), m = patternsFor("melody", style);
    const r = rng(seed + 31);
    setBassPat(b[Math.floor(r() * b.length)] || null);
    setRiffPat(m[Math.floor(r() * m.length)] || null);
    setSeed((x) => x + 1);
  };



  const stop = () => {
    if (clock.current) { clearInterval(clock.current); clock.current = null; }
    clearTimers();
    inst.panic();
    setPlaying(false); setStep(-1); setSounding(new Set()); setBassLit([]);
  };

  /* Our own scheduler. The library transport failed silently twice — once on a
     moved API, once for a reason I never identified — and I cannot test it.
     A lookahead loop over `barsToSchedule` is arithmetic I can. (D-043) */
  const clock = useRef(null);
  const cursor = useRef({ nextBarAt: 0, barIndex: 0 });

  const emitBar = (index, at) => {
    const p = progRef.current;
    if (!p.length) return;
    const idx = index % p.length;
    const c = p[idx];
    const { bass, riff, playRiff: rOn } = figRef.current;
    const secs = barSecondsAt(bpmRef.current);
    const sixteenth = secs / 16;

    const events = planBar({
      chordNotes: c.notes,
      bassFigure: bass?.[idx] ?? (bassRef.current ? [{ midi: c.notes[0] - 24, pos: 0, dur: 8, role: "root" }] : []),
      riffFigure: rOn ? (riff?.[idx] ?? []) : [],
      sixteenth, barSeconds: secs,
    });

    for (const e of events) inst.play(e.notes, e.dur, at + e.at, e.vel);

    const delayMs = Math.max(0, (at - Tone.now()) * 1000);
    const id = setTimeout(() => {
      setStep(idx); setChord(c); setNote(explainChord(c, ctx, sysRef.current));
      timers.current = timers.current.filter((t) => t !== id);
    }, delayMs);
    timers.current.push(id);
  };

  const start = async () => {
    if (!prog.length || playing) return;
    await inst.init(); await inst.resume();
    try {
      cursor.current = { nextBarAt: Tone.now() + 0.15, barIndex: 0 };
      const tick = () => {
        const secs = barSecondsAt(bpmRef.current);
        const { bars, state } = barsToSchedule(cursor.current, Tone.now(), 0.6, secs);
        cursor.current = state;
        for (const b of bars) emitBar(b.index, b.at);
      };
      tick();
      clock.current = setInterval(tick, 120);
      setPlaying(true);
    } catch (e) {
      setNote({ head: "The loop could not start", plain: String(e.message ?? e) });
    }
  };

  useEffect(() => () => { if (clock.current) clearInterval(clock.current); }, []);

  const playScale = (dir) => {
    const iv = scaleById(scaleId).iv;
    let seq = [...iv, 12].map((i) => 48 + tonic + i);
    if (dir === "down") seq = seq.reverse();
    if (dir === "shuffle") {
      const r = rng(seed * 13 + 7);
      seq = [...iv].map((i) => 48 + tonic + i);
      for (let i = seq.length - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        [seq[i], seq[j]] = [seq[j], seq[i]];
      }
      seq = [...seq, 48 + tonic + 12];
      setSeed((x) => x + 1);
    }
    playSequence(seq, 260, 0.24);
  };

  const pickScale = (sc) => {
    setCustomScale(null);                 // a built-in choice replaces one of your own
    const prev = scaleById(scaleId);
    setScaleId(sc.id);
    const a = scalePcs(tonic, prev.id), b = scalePcs(tonic, sc.id);
    const gained = b.filter((x) => !a.includes(x)), lost = a.filter((x) => !b.includes(x));
    setNote({
      head: `${noteName(tonic, system)} ${sc.name}`,
      plain: `${sc.mood}. ${describeChange(a, b, system)}`,
      formal: `Intervals: ${sc.iv.join(" ")}. Common in ${sc.tags.join(", ")}.`,
    });
  };

  const sheet = useMemo(
    () => sheetData({ tonic, mode, scaleId, customScale, progression: prog, bpm, bassFigure, system, fingering: sheetFingers, reach }),
    [tonic, mode, scaleId, customScale, prog, bpm, bassFigure, system, sheetFingers, reach]
  );
  const styleGuide = useMemo(() => scalesForStyle(style, mode), [style, mode]);
  const fits = useMemo(() => fitScales(prog, tonic), [prog, tonic]);
  const scaleHint = useMemo(() => (chord ? suggestScaleFor(chord, ctx) : null), [chord, tonic, mode, scaleId]); // eslint-disable-line
  const progStory = useMemo(() => explainProgression(prog, ctx, system), [prog, tonic, mode, system]); // eslint-disable-line
  const activeChord = activeChordFor({ selected: chord, playingIndex: step, progression: prog, palette: chords });
  const nextBassTarget = (() => {
    if (!activeChord) return null;
    if (prog.length > 1) {
      const i = prog.findIndex((c) => c.id === activeChord.id);
      return prog[((i < 0 ? 0 : i) + 1) % prog.length];
    }
    /* no loop yet: still useful to show how to reach the home chord */
    const home = chords[0];
    return home && home.id !== activeChord.id ? home : chords[3] ?? null;
  })();

  /* The harmonisation lesson, one note at a time, lit on the piano. (UC-38) */
  const lessonSteps = useMemo(
    () => harmonizeSteps(tonic, parentScale, lesson.degree, 3, system),
    [tonic, parentScale, lesson.degree, system]
  );

  const stepLesson = async () => {
    const next = lesson.step >= lessonSteps.length - 1 ? 0 : lesson.step + 1;
    setLesson({ ...lesson, step: next });
    const st = lessonSteps[next];
    if (!st) return;
    await inst.init(); await inst.resume();
    const midis = st.pcs.map((p) => place(p, 54));
    inst.play(st.added !== null ? [place(st.added, 54)] : midis, st.added !== null ? 0.6 : 1.2, undefined, 0.75);
    setChord({ id: "lesson", rootPc: tonic, sym: "", full: "building", notes: midis, degreeIndex: 0, roman: "" });
  };

  const H = ({ children, right }) => (
    <div className="flex items-baseline justify-between mb-2 mt-1">
      <h2 className="text-[11px] font-semibold tracking-wide uppercase" style={{ color: T.inkSoft }}>{children}</h2>
      {right}
    </div>
  );

  return (
    <div className="min-h-screen w-full" style={{ background: T.ground, color: T.ink, fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif" }}>

      {/* ---- key ---- */}
      <style>{PRINT_CSS}</style>
      <div className="max-w-2xl mx-auto px-4 pt-3">
        <header className="mb-3 flex items-center justify-between">
          <h1 className="text-base font-semibold tracking-tight">Sketchpad</h1>
          <div className="flex gap-1.5">
            {can("naming") && (
              <button onClick={() => setSystem(baseSystem === "letters" ? "solfege" : "letters")}
                className="text-xs px-2 py-1 rounded" style={{ background: T.raised, color: T.ink }}>
                {baseSystem === "letters" ? "A B C" : "Do Re Mi"}
              </button>
            )}
            <div className="flex rounded-md overflow-hidden" style={{ background: T.raised }}>
              {LEVELS.map((l) => (
                <button key={l.id} onClick={() => { setLevel(l.id); if (!tabsAt(l.id).includes(tab)) setTab("chords"); }}
                  className="text-xs px-2.5 py-1"
                  style={{ background: level === l.id ? T.ink : "transparent", color: level === l.id ? T.keyWhite : T.inkSoft, fontWeight: level === l.id ? 600 : 400 }}>
                  {l.name}
                </button>
              ))}
            </div>
          </div>
        </header>

        <div className="grid grid-cols-6 gap-1 mb-1.5">
          {NAMES.map((_, i) => (
            <button key={i} onClick={() => setTonic(i)} className="py-1.5 rounded-md text-[13px]"
              style={{ background: i === tonic ? T.homeDot : T.raised, color: i === tonic ? T.keyWhite : T.ink, fontWeight: i === tonic ? 600 : 400 }}>
              {/* each key is labelled the way it is written in the current mode:
                  E♭ major, but D# minor */}
              {noteName(i, spelling(baseSystem, i, mode))}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 mb-3">
          {["major", "minor"].map((m) => (
            <button key={m} onClick={() => setMode(m)} className="px-3 py-1.5 rounded-md text-sm capitalize"
              style={{ background: mode === m ? T.homeDot : T.raised, color: mode === m ? T.keyWhite : T.ink, fontWeight: mode === m ? 600 : 400 }}>
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* ---- piano + explanation + tabs, pinned ---- */}
      <div className="sticky top-0 z-10" style={{ background: T.ground, borderBottom: `1px solid ${T.edge}` }}>
        <div className="max-w-2xl mx-auto px-4 pt-2 pb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Legend />
            {can("melodyGuide") && <button onClick={() => setGuide(!guide)} aria-pressed={guide}
              className="text-[10px] px-2 py-0.5 rounded ml-auto"
              style={{ background: guide ? T.homeDot : T.raised, color: guide ? T.keyWhite : T.inkSoft, fontWeight: guide ? 600 : 400 }}>
              melody guide
            </button>}
          </div>
          {guide && (
            <div className="flex items-center gap-3 flex-wrap text-[10px] mb-1.5" style={{ color: T.inkSoft }}>
              <span className="flex items-center gap-1.5"><i className="block rounded-full" style={{ width: 7, height: 7, background: T.homeDot }} /> lands well</span>
              <span className="flex items-center gap-1.5"><i className="block rounded-full" style={{ width: 7, height: 7, background: T.moveDot }} /> moves through</span>
              <span className="flex items-center gap-1.5"><i className="block rounded-full" style={{ width: 7, height: 7, background: T.tensionDot }} /> pulls</span>
              <span>over {activeChord ? lbl(activeChord) : "the key"}</span>
            </div>
          )}
          {/* In a lesson the piano shows only what the lesson is about: the
              answer when asked for, the notes already right, and the home dot.
              Scale dots would give a scale step away before it was played. (D-073) */}
          <Piano startMidi={startMidi}
            chordNotes={tab === "learn" && lessonNow ? (practice.shown.length ? practice.shown : practice.hint !== null ? [practice.hint] : []) : chordNotes}
            chordRootMidi={tab === "learn" && lessonNow ? -1 : chord?.notes?.[0] ?? -1}
            loopNotes={tab === "learn" && lessonNow ? [] : loopNotes}
            scaleSet={tab === "learn" && lessonNow ? [] : scaleSet} tonic={tonic} sounding={sounding}
            bassLit={extraBass !== null ? [...bassLit, extraBass] : bassLit} picked={tab === "find" ? picked : tab === "learn" && lessonNow ? practice.attempt : []}
            changed={changed} guide={guide}
            fingers={pianoFingers} brackets={pianoBrackets}
            system={system} onDown={noteDown} onUp={noteUp} octaves={KEYBOARD_OCTAVES} />

          {/* D-078: finger numbers, for either hand or both */}
          <div className="flex items-center gap-1 flex-wrap mt-1.5 text-[10px]" style={{ color: T.inkSoft }}>
            <span className="mr-0.5">Fingers</span>
            {FINGER_HANDS.map((h) => (
              <button key={h} onClick={() => setFingerChoice(h)} aria-pressed={fingerHand === h}
                className="px-2 py-0.5 rounded"
                style={{ background: fingerHand === h ? T.homeDot : T.raised, color: fingerHand === h ? T.keyWhite : T.ink, fontWeight: fingerHand === h ? 600 : 400 }}>{h}</button>
            ))}
            {fingerHand !== "off" && (
              <>
                <span className="ml-2 mr-0.5">hand reaches</span>
                {HAND_REACH.map((r) => (
                  <button key={r.id} onClick={() => setReach(r.keys)} aria-pressed={reach === r.keys}
                    className="px-1.5 py-0.5 rounded"
                    style={{ background: reach === r.keys ? T.homeDot : T.raised, color: reach === r.keys ? T.keyWhite : T.ink, fontWeight: reach === r.keys ? 600 : 400 }}>{r.id}</button>
                ))}
              </>
            )}
          </div>
          {fingerHand !== "off" && !inLesson && chordFingering && (chordFingering.split || chordFingering.tooWide) && (
            <p className="text-[11px] mt-1" style={{ color: chordFingering.tooWide ? T.tension : T.inkSoft }}>
              {FINGER_COPY.suggested}: {(chordFingering.tooWide ? FINGER_COPY.tooWide : FINGER_COPY.split).toLowerCase()}.
            </p>
          )}

          <div className="flex items-center gap-2 mt-2">
            <div className="flex items-center rounded-md overflow-hidden" style={{ background: T.raised }}>
              <button onClick={() => setStartMidi(Math.max(PIANO_RANGE.lowest, startMidi - 12))} aria-label="Octave down"
                disabled={startMidi <= PIANO_RANGE.lowest}
                className="px-2.5 py-1 text-sm disabled:opacity-40" style={{ color: T.ink }}>‹</button>
              <span className="text-[11px] px-1 tabular-nums" style={{ color: T.inkSoft }}>Oct {Math.floor(startMidi / 12) - 1}</span>
              <button onClick={() => setStartMidi(Math.min(HIGHEST_START_MIDI, startMidi + 12))} aria-label="Octave up"
                disabled={startMidi >= HIGHEST_START_MIDI}
                className="px-2.5 py-1 text-sm disabled:opacity-40" style={{ color: T.ink }}>›</button>
            </div>
            <button onClick={() => setMuted(!muted)} aria-pressed={muted}
              aria-label={muted ? "Turn sound on" : "Turn sound off"}
              className="ml-auto flex items-center gap-1.5 text-xs px-2 py-1 rounded"
              style={{ background: muted ? T.tension : T.raised, color: muted ? T.keyWhite : T.ink, fontWeight: muted ? 600 : 400 }}>
              <SpeakerIcon on={!muted} />{muted ? "muted" : "sound"}
            </button>
            <button onClick={panic} className="text-xs px-2 py-1 rounded" style={{ background: T.raised, color: T.tension, fontWeight: 600 }}>silence</button>
          </div>

          <div className="flex items-center gap-1 mt-2 -mx-1 px-1 overflow-x-auto">
            {INSTRUMENTS.map((ins) => (
              <button key={ins.id} onClick={() => setInstId(ins.id)} title={ins.note}
                className="px-2.5 py-1 rounded-md text-xs whitespace-nowrap"
                style={{ background: instId === ins.id ? T.ink : T.raised, color: instId === ins.id ? T.keyWhite : T.inkSoft, fontWeight: instId === ins.id ? 600 : 400 }}>
                {ins.name}
              </button>
            ))}
            <button onClick={() => setEchoOn(!echo)} aria-pressed={echo}
              className="px-2.5 py-1 rounded-md text-xs whitespace-nowrap"
              style={{ background: echo ? T.bass : T.raised, color: echo ? T.keyWhite : T.inkSoft, fontWeight: echo ? 600 : 400 }}>
              echo {echo ? "on" : "off"}
            </button>
            {ROLL_STYLES.map((r) => (
              <button key={r.id} onClick={() => setRoll(r.id)} title={r.note}
                className="px-2.5 py-1 rounded-md text-xs whitespace-nowrap"
                style={{ background: roll === r.id ? T.chordW : T.raised, color: roll === r.id ? T.keyWhite : T.inkSoft, fontWeight: roll === r.id ? 600 : 400 }}>
                {r.name}
              </button>
            ))}
            {SPACES.map((sp) => (
              <button key={sp.id} onClick={() => setSpace(sp.id)} title={sp.note}
                className="px-2.5 py-1 rounded-md text-xs whitespace-nowrap"
                style={{ background: space === sp.id ? T.homeDot : T.raised, color: space === sp.id ? T.keyWhite : T.inkSoft, fontWeight: space === sp.id ? 600 : 400 }}>
                {sp.name}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <button onClick={inst.test} className="text-xs px-2.5 py-1 rounded font-semibold"
              style={{ background: T.homeDot, color: T.keyWhite }}>test sound</button>
            <span className="text-[10px] px-2 py-1 rounded"
              style={{ background: T.raised, color: inst.status === "running" ? T.ok : inst.status === "error" ? T.tension : T.inkSoft }}>
              {inst.status} · {inst.detail}
            </span>
            <span className="text-[10px] px-2 py-1 rounded" style={{ background: T.raised, color: T.inkSoft }}>
              {inst.voiceCount}/24 voices
            </span>
            {instrumentById(instId).credit && (
              <span className="text-[10px] px-2 py-1 rounded" style={{ background: T.raised, color: T.inkSoft }}>
                {instrumentById(instId).credit}
              </span>
            )}
            <button onClick={inst.reset} className="text-[10px] px-2 py-1 rounded ml-auto"
              style={{ background: T.raised, color: T.tension }}>reset audio</button>
          </div>
          {inst.status === "suspended" && (
            <button onClick={() => inst.resume()} className="w-full text-xs py-1.5 mt-2 rounded"
              style={{ background: T.tension, color: T.keyWhite, fontWeight: 600 }}>
              Sound is paused by the browser — tap to resume
            </button>
          )}

          <div className="mt-2 min-h-[40px]">
            {note ? (
              <>
                <div className="text-xs font-semibold" style={{ color: T.chordB }}>{note.head}</div>
                <div className="text-xs leading-snug" style={{ color: T.inkSoft }}>{pro && note.formal ? note.formal : note.plain}</div>
              </>
            ) : (
              <div className="text-xs" style={{ color: T.inkSoft }}>
                Tap a chord or a key — the first tap also turns the sound on. New here?{" "}
                <button onClick={() => setTab("guide")} className="underline" style={{ color: T.homeDot }}>How to use</button>.
              </div>
            )}
          </div>

          {levelIndex(level) < LEVELS.length - 1 && (
            <p className="text-[10px] mt-1.5" style={{ color: T.inkSoft }}>
              {LEVELS[levelIndex(level)].note}{" "}
              <button onClick={() => setLevel(LEVELS[levelIndex(level) + 1].id)} className="underline" style={{ color: T.homeDot }}>
                Show {LEVELS[levelIndex(level) + 1].name.toLowerCase()} tools
              </button>
            </p>
          )}
          <div className="flex gap-1 mt-2 -mx-1 px-1 overflow-x-auto">
            {TABS.filter((t) => tabsAt(level).includes(t.id)).map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="px-3 py-1.5 rounded-md text-[13px] whitespace-nowrap"
                style={{ background: tab === t.id ? T.ink : T.raised, color: tab === t.id ? T.keyWhite : T.inkSoft, fontWeight: tab === t.id ? 600 : 400 }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ---- tab content ---- */}
      <div className="max-w-2xl mx-auto px-4 py-4" style={{ paddingBottom: 80 }}>

        {tab === "chords" && (
          <>
            {can("tension") && <div className="mb-3">
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: T.inkSoft }}>
                  How adventurous?
                </span>
                <span className="text-[11px] font-semibold" style={{ color: tension > 1 ? T.tension : T.chordB }}>
                  {TENSION_LEVELS[tension].name}
                </span>
              </div>
              <input type="range" min="0" max="3" value={tension} onChange={(e) => setTension(+e.target.value)}
                className="w-full" style={{ accentColor: tension > 1 ? T.tension : T.chordB }} />
              <p className="text-[11px]" style={{ color: T.inkSoft }}>{TENSION_LEVELS[tension].note}</p>
            </div>}

            <H right={
              <div className="flex gap-1">
                {can("sevenths") && tension === 0 && [[3, "Triads"], [4, "7ths"], [5, "9ths"]].map(([n, label]) => (
                  <button key={n} onClick={() => setSize(n)} className="px-2.5 py-1 rounded text-xs"
                    style={{ background: size === n ? T.chordW : T.raised, color: size === n ? T.keyWhite : T.inkSoft, fontWeight: size === n ? 600 : 400 }}>
                    {label}
                  </button>
                ))}
              </div>
            }>In this key</H>
            <div className="grid grid-cols-4 gap-1.5 mb-5">
              {chords.map((c) => {
                const on = chord?.id === c.id;
                return (
                  <div key={c.id} className="rounded-lg overflow-hidden"
                    style={{ background: on ? T.chordW : T.surface, boxShadow: `inset 0 0 0 1px ${on ? T.chordW : c.extra ? T.tension : T.edge}` }}>
                    <button onClick={() => { tapChord(c); if (c.why) setNote({ head: `${lbl(c)} — borrowed`, plain: c.why }); }}
                      className="w-full px-2 pt-2 pb-1 text-left">
                      <div className="text-[14px] font-semibold leading-tight" style={{ color: on ? T.padInk : T.ink }}>{lbl(c)}</div>
                      <div className="text-[9px] leading-tight" style={{ color: on ? T.padSub : T.inkSoft }}>
                        {c.extra ? "borrowed" : pro ? c.roman : c.notes.map((m) => noteName(m, system)).join(" ")}
                      </div>
                    </button>
                    <button onClick={() => addChord(c)} className="w-full text-[10px] py-1"
                      style={{ background: on ? "rgba(0,0,0,.14)" : T.raised, color: on ? T.padInk : T.inkSoft }}>add</button>
                  </div>
                );
              })}
            </div>

            {scaleHint && (
              <div className="rounded-lg p-3 mb-5" style={{ background: T.surface, boxShadow: `inset 0 0 0 1px ${T.tension}` }}>
                <p className="text-[11px] mb-2" style={{ color: T.inkSoft }}>
                  <strong style={{ color: T.tension }}>{scaleHint.outside.map((p) => noteName(p, system)).join(" and ")}</strong> {scaleHint.outside.length > 1 ? "are" : "is"} outside your scale. {scaleHint.why}
                </p>
                <button onClick={() => { pickScale(scaleHint.scale); setTab("scales"); }}
                  className="px-3 py-1.5 rounded-md text-xs font-semibold"
                  style={{ background: T.homeDot, color: T.keyWhite }}>
                  Try {noteName(tonic, system)} {scaleHint.scale.name}
                </button>
              </div>
            )}

            {can("voicings") && <><H right={activeChord ? (
              <div className="flex gap-1">
                <button onClick={() => tapChord(activeChord)} className="text-xs px-2 py-1 rounded"
                  style={{ background: T.raised, color: T.chordB, fontWeight: 600 }}>▶ chord</button>
                <button onClick={() => playArp(activeChord.notes, "up")} className="text-xs px-2 py-1 rounded"
                  style={{ background: T.raised, color: T.chordB }}>arp ↑</button>
                <button onClick={() => playArp(activeChord.notes, "down")} className="text-xs px-2 py-1 rounded"
                  style={{ background: T.raised, color: T.chordB }}>arp ↓</button>
              </div>
            ) : null}>Voicing</H>
            <p className="text-[11px] mb-2" style={{ color: T.inkSoft }}>
              The same chord, arranged differently. This is most of why a chord sounds like a record rather than an exercise.
            </p>
            <div className="mb-5">
              {(activeChord ? voicingsFor(activeChord) : []).map((v) => (
                <button key={v.id} onClick={async () => {
                    /* play these notes directly: setVoicingId has not applied
                       yet, so going through tapChord would sound the previous
                       arrangement — right list, wrong sound. (D-049) */
                    setVoicingId(v.id);
                    const c = { ...activeChord, notes: v.notes };
                    setChord(c);
                    await inst.init(); await inst.resume();
                    if (!playing) inst.panic();
                    inst.play(v.notes, 0.9, undefined, 0.65, spread);
                    setNote({ head: `${lbl(activeChord)} — ${v.name}`, plain: v.why });
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left mb-1.5"
                  style={{ background: voicingId === v.id ? T.raised : T.surface, boxShadow: `inset 0 0 0 1px ${voicingId === v.id ? T.chordW : T.edge}` }}>
                  <span className="text-sm font-semibold shrink-0" style={{ minWidth: 62, color: voicingId === v.id ? T.chordB : T.ink }}>{v.name}</span>
                  <span className="text-[10px] shrink-0" style={{ color: T.inkSoft, minWidth: 92 }}>
                    {v.notes.map((m) => noteName(m, system)).join(" ")}
                  </span>
                  <span className="text-[11px] ml-auto text-right" style={{ color: T.inkSoft }}>{v.why}</span>
                </button>
              ))}
            </div>

            {mine.chords.length > 0 && (
              <>
                <H right={<button onClick={() => setMine({ ...mine, chords: [] })} className="text-xs" style={{ color: T.inkSoft }}>clear</button>}>Yours</H>
                <div className="grid grid-cols-3 gap-1.5 mb-5">
                  {mine.chords.map((c) => (
                    <div key={c.id} className="rounded-lg overflow-hidden" style={{ background: T.surface, boxShadow: `inset 0 0 0 1px ${chord?.id === c.id ? T.bass : T.edge}` }}>
                      <button onClick={() => { tapChord(c, false); setNote({ head: c.name, plain: `Your own: ${c.notes.map((m) => noteName(m, system)).join(" ")}. ${c.full}.` }); }}
                        className="w-full px-2 pt-2 pb-1 text-left">
                        <div className="text-[13px] font-semibold leading-tight">{c.name}</div>
                        <div className="text-[9px] leading-tight" style={{ color: T.inkSoft }}>{c.notes.map((m) => noteName(m, system)).join(" ")}</div>
                      </button>
                      <button onClick={() => addChord(c)} className="w-full text-[10px] py-1" style={{ background: T.raised, color: T.inkSoft }}>add</button>
                    </div>
                  ))}
                </div>
              </>
            )}

</>}

            {can("sets") && <><H>Chord sets</H>
            <div className="flex gap-1.5 flex-wrap mb-3">
              {setsFor(mode).map((sd) => (
                <button key={sd.id} onClick={() => setSetId(setId === sd.id ? null : sd.id)}
                  className="px-2.5 py-1.5 rounded-md text-xs"
                  style={{ background: setId === sd.id ? T.bass : T.raised, color: setId === sd.id ? T.keyWhite : T.inkSoft, fontWeight: setId === sd.id ? 600 : 400 }}>
                  {sd.name}
                </button>
              ))}
            </div>

            {activeSet && (
              <div className="rounded-lg p-3" style={{ background: T.surface, boxShadow: `inset 0 0 0 1px ${T.edge}` }}>
                <p className="text-[11px] mb-2.5" style={{ color: T.inkSoft }}>{activeSet.note}</p>
                <div className="grid grid-cols-4 gap-1.5 mb-3">
                  {activeSet.chords.map((c) => (
                    <button key={c.id} onClick={() => tapChord(c)}
                      className="px-2 py-2 rounded-md text-left"
                      style={{ background: chord?.id === c.id ? T.chordW : T.raised, boxShadow: `inset 0 0 0 1px ${T.edge}` }}>
                      <div className="text-[13px] font-semibold" style={{ color: chord?.id === c.id ? T.padInk : T.ink }}>{lbl(c)}</div>
                      <div className="text-[9px]" style={{ color: chord?.id === c.id ? T.padSub : T.inkSoft }}>{c.notes.map((m) => noteName(m, system)).join(" ")}</div>
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap mb-2">
                  <span className="text-[11px] font-semibold" style={{ color: T.inkSoft }}>Progression</span>
                  {activeSet.progressionChords.map((c, i) => (
                    <button key={i} onClick={() => tapChord(c)} className="px-2.5 py-1 rounded text-xs font-medium"
                      style={{ background: T.raised, boxShadow: `inset 0 0 0 1px ${T.edge}` }}>{lbl(c)}</button>
                  ))}
                  <button onClick={() => { addAll(activeSet.progressionChords); setTab("prog"); }}
                    className="ml-auto px-2.5 py-1 rounded text-xs font-semibold"
                    style={{ background: T.homeDot, color: T.keyWhite }}>add all</button>
                </div>
                <p className="text-[11px]" style={{ color: T.inkSoft }}>{activeSet.why}</p>
              </div>
            )}</>}
          </>
        )}

        {tab === "sheet" && (
          <>
            {prog.length === 0 ? (
              <p className="text-sm" style={{ color: T.inkSoft }}>
                Build a loop first. The sheet is the thing you take to an instrument once you have one.
              </p>
            ) : (
              <>
                <div className="flex gap-1.5 flex-wrap mb-3 no-print">
                  <button onClick={() => window.print()} className="px-3 py-1.5 rounded-md text-xs font-semibold"
                    style={{ background: T.homeDot, color: T.keyWhite }}>Print</button>
                  <button onClick={() => { try { navigator.clipboard?.writeText(sheetAsText(sheet)); setNote({ head: "Copied", plain: "The sheet is on your clipboard as plain text." }); } catch (e) {} }}
                    className="px-3 py-1.5 rounded-md text-xs" style={{ background: T.raised, color: T.ink }}>Copy as text</button>
                  <span className="text-[11px] self-center" style={{ color: T.inkSoft }}>
                    Print, or save as PDF from the print dialogue.
                  </span>
                  <label className="flex items-center gap-1.5 text-[12px] w-full mt-1" style={{ color: T.ink }}>
                    <input type="checkbox" checked={sheetFingers} onChange={(e) => setSheetFingers(e.target.checked)} style={{ accentColor: T.homeDot }} />
                    Show suggested fingering
                  </label>
                </div>

                <div id="sheet" className="rounded-lg p-4"
                  style={{ background: T.paper, color: T.paperInk, boxShadow: `inset 0 0 0 1px ${T.edge}` }}>
                  <div className="flex items-baseline justify-between mb-3">
                    <h2 className="text-lg font-semibold">{sheet.title}</h2>
                    <span className="text-[11px]" style={{ color: T.paperFaint }}>{sheet.meta.join("  ·  ")}</span>
                  </div>

                  <div className="mb-4">
                    <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: T.paperFaint }}>Scale</div>
                    <Diagram startMidi={sheet.scale.start} octaves={2} notes={sheet.scale.notes} width={300} height={52} />
                    <div className="text-[11px] mt-1">{sheet.scale.names.join("  ")}</div>
                  </div>

                  <div className="text-[10px] uppercase tracking-wide mb-1.5" style={{ color: T.paperFaint }}>Chords</div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-3 mb-4">
                    {sheet.chords.map((c) => (
                      <div key={c.bar}>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-[13px] font-semibold">{c.bar}. {c.label}</span>
                          <span className="text-[10px]" style={{ color: T.paperFaint }}>{c.roman}</span>
                        </div>
                        <Diagram startMidi={sheet.range.startMidi} octaves={sheet.range.octaves} notes={c.notes} width={168} height={44} fingers={c.fingers} />
                        <div className="text-[10px] mt-0.5" style={{ color: T.paperLine }}>{c.names.join(" ")}</div>
                      </div>
                    ))}
                  </div>

                  <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: T.paperFaint }}>Bass</div>
                  <div className="flex gap-3 flex-wrap text-[11px]">
                    {sheet.bass.map((b) => (
                      <span key={b.bar} className="inline-flex items-center gap-1"><strong>{b.bar}.</strong> {b.names.join(" ")}
                        {b.finger && (
                          <svg width="13" height="13" viewBox="0 0 13 13" aria-label={`left hand, finger ${b.finger}`}>
                            <circle cx="6.5" cy="6.5" r="5.3" fill={T.paper} stroke={T.bass} strokeWidth="1.5" />
                            <text x="6.5" y="9.3" fontSize="7.5" fontWeight="700" textAnchor="middle" fill={T.bass}>{b.finger}</text>
                          </svg>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {tab === "learn" && !lessonNow && (
          <>
            <p className="text-[12px] leading-relaxed mb-4" style={{ color: T.inkSoft }}>
              Short lessons you play on the piano. Each note is checked as you play it. They follow the key at the top — you are in{" "}
              <span style={{ color: T.homeDot, fontWeight: 600 }}>{noteName(tonic, system)}</span> now.
            </p>
            {/* one list in teaching order: each lesson leans on the ones above it,
                so grouping by topic would scramble the path */}
            <div className="mb-4">
              {lessonsFor(tonic, system, startMidi).map((l, i) => {
                const got = learned.includes(`${l.id}@${tonic}`);
                const topic = LESSON_TOPICS.find((t) => t.id === l.topic)?.name ?? "";
                return (
                  <Row key={l.id} left={got ? "✓" : `${i + 1}`}
                    mid={l.title}
                    right={got ? `done in ${noteName(tonic, system)}` : `${topic} · ${l.steps.length} steps`}
                    accent={got ? T.ok : T.homeDot}
                    onClick={() => openLesson(l.id)} />
                );
              })}
            </div>
            <p className="text-[11px] pt-2" style={{ color: T.inkSoft, borderTop: `1px solid ${T.edge}` }}>
              Finished lessons are ticked for this session only. Saving arrives with the sketchbook.
            </p>
          </>
        )}

        {tab === "learn" && lessonNow && stepNow && (
          <>
            <div className="flex items-baseline gap-2 mb-2">
              <button onClick={() => { setPractice(NO_PRACTICE); setNote(null); }} className="text-xs" style={{ color: T.homeDot }}>‹ Lessons</button>
              <span className="text-[11px] ml-auto tabular-nums" style={{ color: T.inkSoft }}>
                {noteName(tonic, system)} · step {practice.step + 1} of {lessonNow.steps.length}
              </span>
            </div>
            <h2 className="text-[17px] font-semibold mb-1">{lessonNow.title}</h2>
            <p className="text-[12px] leading-relaxed mb-3" style={{ color: T.inkSoft }}>{lessonNow.intro}</p>

            <div className="rounded-lg px-3 py-3 mb-3" style={{ background: T.surface, boxShadow: `inset 0 0 0 1px ${practice.stepDone ? T.ok : T.edge}` }}>
              <p className="text-[15px] font-medium leading-snug mb-2">{stepNow.prompt}</p>
              {lessonFingering && (
                <p className="text-[12px] leading-relaxed mb-2" style={{ color: T.inkSoft }}>{lessonFingering.text}</p>
              )}
              {practice.method && !practice.stepDone && (
                <p className="text-[12px] leading-relaxed mb-2" style={{ color: T.homeDot }}>{practice.method}</p>
              )}
              <div className="flex items-center gap-1.5 flex-wrap min-h-[28px] mb-2">
                {practice.attempt.length === 0 ? (
                  <span className="text-[12px]" style={{ color: T.inkSoft }}>Play on the piano above.</span>
                ) : practice.attempt.map((m, i) => (
                  <span key={`${m}-${i}`} className="px-2 py-0.5 rounded-md text-xs font-medium" style={{ background: T.bass, color: T.keyWhite }}>
                    {noteName(m, lessonNow.system)}
                  </span>
                ))}
              </div>
              {!practice.stepDone && (
                <div className="flex gap-1.5 flex-wrap">
                  <button onClick={showStep} className="px-3 py-1.5 rounded-md text-xs font-semibold" style={{ background: T.homeDot, color: T.keyWhite }}>▶ Show me</button>
                  <button onClick={hintStep} className="px-3 py-1.5 rounded-md text-xs" style={{ background: T.raised, color: T.ink }}>
                    {practice.hintLevel === 0 ? "Hint" : "Show the note"}
                  </button>
                  {practice.attempt.length > 0 && (
                    <button onClick={() => setPractice({ ...practice, attempt: [], shown: [], hint: null })}
                      className="px-3 py-1.5 rounded-md text-xs ml-auto" style={{ color: T.inkSoft }}>start over</button>
                  )}
                </div>
              )}
              {practice.stepDone && (
                <>
                  <p className="text-[12px] leading-relaxed mb-2" style={{ color: T.ink }}>
                    <span style={{ color: T.ok, fontWeight: 600 }}>✓ </span>{stepNow.why}
                  </p>
                  {/* the rule to take away, and the shape family for a triad:
                      the parts that work on any keyboard, without the app (D-075) */}
                  <p className="text-[12px] leading-relaxed mb-1" style={{ color: T.ink }}>
                    <span className="font-semibold" style={{ color: T.homeDot }}>Take away: </span>{stepNow.rule}
                  </p>
                  {stepNow.target.kind === "set" && chordShape(stepNow.target.pcs, lessonNow.system) && (
                    <p className="text-[12px] leading-relaxed mb-2" style={{ color: T.inkSoft }}>
                      {chordShape(stepNow.target.pcs, lessonNow.system).text}
                    </p>
                  )}
                  {!practice.lessonDone && (
                    <button onClick={nextStep} className="w-full py-2 rounded-md text-sm font-semibold" style={{ background: T.homeDot, color: T.keyWhite }}>
                      Next step
                    </button>
                  )}
                </>
              )}
            </div>

            {practice.lessonDone && (
              <div className="rounded-lg px-3 py-3 mb-3" style={{ background: T.raised }}>
                <p className="text-sm font-semibold mb-1">Lesson done in {noteName(tonic, system)}.</p>
                <p className="text-[12px] mb-3" style={{ color: T.inkSoft }}>
                  {practice.slips === 0 ? "No slips at all." : `${practice.slips} slip${practice.slips === 1 ? "" : "s"} on the way — play it again and see if that number drops.`}
                </p>
                <div className="flex flex-col gap-1.5">
                  <button onClick={() => setTonic(nextKeyRound(tonic))}
                    className="w-full py-2 rounded-md text-sm font-semibold" style={{ background: T.homeDot, color: T.keyWhite }}>
                    Again in {noteName(nextKeyRound(tonic), spelling(baseSystem, nextKeyRound(tonic), mode))} — one step round the circle of fifths
                  </button>
                  {lessonNow.loop && (
                    <button onClick={() => { addAll(lessonNow.loop); setTab("prog"); }}
                      className="w-full py-2 rounded-md text-sm" style={{ background: T.surface, color: T.ink, boxShadow: `inset 0 0 0 1px ${T.edge}` }}>
                      Put {lessonNow.loop.map(lbl).join(" ")} in my loop
                    </button>
                  )}
                  <button onClick={() => openLesson(lessonNow.id)} className="text-xs py-1" style={{ color: T.inkSoft }}>play it again here</button>
                </div>
              </div>
            )}
          </>
        )}

        {tab === "guide" && (
          <>
            {GUIDE.map((g) => (
              <section key={g.id} className="mb-6">
                <h2 className="text-[15px] font-semibold mb-1">{g.title}</h2>
                <p className="text-[12px] leading-relaxed mb-2" style={{ color: T.inkSoft }}>{g.lead}</p>
                <ul className="mb-2">
                  {g.points.map((pt, i) => (
                    <li key={i} className="flex gap-2 text-[12px] leading-relaxed mb-1.5" style={{ color: T.ink }}>
                      <span style={{ color: T.chordB }}>·</span>
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
                {g.tab && (
                  <button onClick={() => setTab(g.tab)} className="px-3 py-1.5 rounded-md text-xs font-semibold"
                    style={{ background: T.raised, color: T.homeDot }}>
                    Open {TAB_LABELS[g.tab]} →
                  </button>
                )}
              </section>
            ))}
            <p className="text-[11px] pt-2" style={{ color: T.inkSoft, borderTop: `1px solid ${T.edge}` }}>
              Nothing is saved yet — reload and you start fresh. That is coming.
            </p>
          </>
        )}

        {tab === "find" && (
          <>
            <p className="text-[12px] leading-relaxed mb-3" style={{ color: T.inkSoft }}>
              Tap notes on the piano to choose them, then see what you have made. The piano is an input here, not a display.
            </p>

            <div className="flex items-center gap-1.5 flex-wrap mb-4">
              {picked.length === 0 ? (
                <span className="text-sm" style={{ color: T.inkSoft }}>Nothing chosen yet.</span>
              ) : (
                <>
                  {picked.map((m) => (
                    <button key={m} onClick={() => setPicked(picked.filter((x) => x !== m))}
                      className="px-2.5 py-1 rounded-md text-xs font-medium"
                      style={{ background: T.bass, color: T.keyWhite }}>
                      {noteName(m, system)}
                    </button>
                  ))}
                  <button onClick={() => { inst.init().then(() => inst.play(picked, 1.1, undefined, 0.7, spread)); }}
                    className="px-2.5 py-1 rounded-md text-xs font-semibold" style={{ background: T.homeDot, color: T.keyWhite }}>▶ together</button>
                  <button onClick={() => playArp(picked, "up")} className="px-2.5 py-1 rounded-md text-xs" style={{ background: T.raised, color: T.ink }}>▶ arp ↑</button>
                  <button onClick={() => playArp(picked, "down")} className="px-2.5 py-1 rounded-md text-xs" style={{ background: T.raised, color: T.ink }}>▶ arp ↓</button>
                  <button onClick={() => setPicked([])} className="text-xs ml-auto" style={{ color: T.inkSoft }}>clear</button>
                </>
              )}
            </div>

            {picked.length >= 2 && (
              <>
                <H>What you played</H>
                <div className="mb-4">
                  {identifyChord(picked, system).length === 0 ? (
                    <p className="text-sm" style={{ color: T.inkSoft }}>
                      No standard chord matches these notes. That is not a mistake — it just has no common name.
                    </p>
                  ) : (
                    identifyChord(picked, system).slice(0, 4).map((r, i) => (
                      <button key={i}
                        onClick={() => { const c = { id: `found-${i}`, rootPc: r.rootPc, sym: r.sym, full: r.full, notes: picked, degreeIndex: 0, roman: "" }; tapChord(c, false); setNote({ head: `${r.label} — ${r.full}`, plain: r.why }); }}
                        className="w-full flex items-baseline gap-3 px-3 py-2.5 rounded-lg text-left mb-1.5"
                        style={{ background: i === 0 ? T.raised : T.surface, boxShadow: `inset 0 0 0 1px ${i === 0 ? T.chordW : T.edge}` }}>
                        <span className="text-base font-semibold shrink-0" style={{ minWidth: 88, color: i === 0 ? T.chordB : T.ink }}>{r.label}</span>
                        <span className="text-[11px] shrink-0" style={{ color: T.inkSoft, minWidth: 92 }}>{r.full}</span>
                        <span className="text-[11px] ml-auto text-right" style={{ color: T.inkSoft }}>{r.why}</span>
                      </button>
                    ))
                  )}
                  {identifyChord(picked, system).length > 1 && (
                    <p className="text-[11px] mt-1" style={{ color: T.inkSoft }}>
                      More than one reading fits. Which one it is depends on what the bass is doing and what came before it.
                    </p>
                  )}
                </div>

                {identifyChord(picked, system)[0]?.sym !== undefined && picked.length >= 3 && (
                  <button onClick={() => { const r = identifyChord(picked, system)[0]; addChord({ id: `found-add-${Date.now()}`, rootPc: r.rootPc, sym: r.sym, full: r.full, notes: picked, degreeIndex: 0, roman: "" }); setTab("prog"); }}
                    className="w-full py-2 rounded-md text-sm font-semibold mb-5"
                    style={{ background: T.homeDot, color: T.keyWhite }}>
                    Add to progression
                  </button>
                )}

                <H>Keep it</H>
                <div className="flex gap-1.5 flex-wrap mb-5">
                  <button onClick={() => {
                      const c = customChordFrom(picked);
                      if (c && !mine.chords.some((x) => x.id === c.id)) setMine({ ...mine, chords: [...mine.chords, c] });
                      setNote({ head: `Saved ${c?.name}`, plain: "It's in the Chords tab under “Yours”, and behaves like any other chord." });
                    }}
                    className="px-3 py-1.5 rounded-md text-xs font-semibold" style={{ background: T.bass, color: T.keyWhite }}>
                    Save as chord
                  </button>
                  {picked.length >= 5 && picked.length <= 8 && (
                    <button onClick={() => {
                        const sc = customScaleFrom(picked);
                        if (sc && !mine.scales.some((x) => x.id === sc.id)) setMine({ ...mine, scales: [...mine.scales, sc] });
                        setCustomScale(sc);
                        setNote({ head: `Saved ${sc?.name}`, plain: sc && sc.iv.length === 7 ? "Seven notes, so it can be harmonised into chords. Look under “Yours” in Scales." : "Under “Yours” in Scales. Fewer than seven notes, so it has no chords of its own." });
                      }}
                      className="px-3 py-1.5 rounded-md text-xs font-semibold" style={{ background: T.homeDot, color: T.keyWhite }}>
                      Save as scale
                    </button>
                  )}
                  <span className="text-[11px] self-center" style={{ color: T.inkSoft }}>kept for this session</span>
                </div>

                <H>Keys these notes fit</H>
                <div className="flex gap-1.5 flex-wrap mb-5">
                  {keysContaining(picked).length === 0 ? (
                    <span className="text-[12px]" style={{ color: T.inkSoft }}>No single key holds all of them — something here is borrowed.</span>
                  ) : keysContaining(picked).map((k, i) => (
                    <button key={i} onClick={() => { setTonic(k.tonic); setMode(k.mode); }}
                      className="px-2.5 py-1.5 rounded-md text-xs"
                      style={{ background: k.tonic === tonic && k.mode === mode ? T.homeDot : T.raised, color: k.tonic === tonic && k.mode === mode ? T.keyWhite : T.ink }}>
                      {noteName(k.tonic, system)} {k.mode}
                    </button>
                  ))}
                </div>

                <H>Scales that contain them</H>
                <div>
                  {scalesContaining(picked).map((f, i) => (
                    <Row key={i} left={noteName(f.tonic, system)} mid={f.scale.name}
                      right={f.extra === 0 ? "exactly these notes" : `adds ${f.extra} more note${f.extra === 1 ? "" : "s"}`}
                      accent={f.extra === 0 ? T.ok : T.homeDot}
                      onClick={() => { setTonic(f.tonic); pickScale(f.scale); setTab("scales"); }} />
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {tab === "scales" && (
          <>
            <H right={
              <div className="flex gap-1">
                {[["up", "▲"], ["down", "▼"], ["shuffle", "⤨"]].map(([d, glyph]) => (
                  <button key={d} onClick={() => playScale(d)} className="px-2.5 py-1 rounded text-xs"
                    style={{ background: T.raised, color: T.homeDot, fontWeight: 600 }}>{glyph}</button>
                ))}
              </div>
            }>Play the scale</H>
            <p className="text-[11px] mb-2" style={{ color: T.inkSoft }}>What are you going for?</p>
            <div className="flex gap-1.5 flex-wrap mb-2">
              {STYLES.map((sName) => (
                <button key={sName} onClick={() => setStyle(sName)} className="px-2.5 py-1 rounded-md text-xs"
                  style={{ background: style === sName ? T.homeDot : T.raised, color: style === sName ? T.keyWhite : T.inkSoft, fontWeight: style === sName ? 600 : 400 }}>
                  {sName}
                </button>
              ))}
            </div>
            {styleGuide.note && (
              <p className="text-[11px] mb-3" style={{ color: T.inkSoft }}>
                {styleGuide.note} Chord colours: <strong style={{ color: T.chordB }}>{styleGuide.chords.map((q) => q || "major").join(" · ")}</strong>
              </p>
            )}

            {mine.scales.length > 0 && (
              <>
                <p className="text-[11px] font-semibold mb-1.5" style={{ color: T.inkSoft }}>Yours</p>
                <div className="grid gap-1.5 mb-3">
                  {mine.scales.map((sc) => (
                    <button key={sc.id} onClick={() => { setCustomScale(sc); setTonic(sc.tonicPc); setNote({ head: sc.name, plain: `${customScalePcs(sc).map((p) => noteName(p, system)).join(" ")}. ${sc.iv.length === 7 ? "Seven notes, so it harmonises into its own chords." : "Fewer than seven notes, so no chords are built from it."}` }); }}
                      className="text-left px-3 py-2.5 rounded-lg"
                      style={{ background: customScale?.id === sc.id ? T.raised : T.surface, boxShadow: `inset 0 0 0 1px ${customScale?.id === sc.id ? T.bass : T.edge}` }}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-sm font-medium" style={{ color: T.bass }}>{sc.name}</span>
                        <span className="text-[11px]" style={{ color: T.inkSoft }}>{customScalePcs(sc).map((p) => noteName(p, system)).join(" ")}</span>
                      </div>
                      {customScale?.id === sc.id && harmonizeCustom(sc).length > 0 && (
                        <div className="mt-1.5 flex gap-1 flex-wrap">
                          {harmonizeCustom(sc, size, base).map((c) => (
                            <span key={c.id} onClick={(e) => { e.stopPropagation(); tapChord(c, false); }}
                              className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: T.raised }}>
                              {lbl(c)}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}

            <div className="grid gap-1.5">
              {[...styleGuide.suited, ...styleGuide.others].map((sc) => {
                const on = sc.id === scaleId;
                return (
                  <button key={sc.id} onClick={() => pickScale(sc)}
                    className="text-left px-3 py-2.5 rounded-lg"
                    style={{ background: on ? T.raised : T.surface, boxShadow: `inset 0 0 0 1px ${on ? T.homeDot : T.edge}` }}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-medium" style={{ color: on ? T.homeDot : T.ink }}>
                        {sc.name}
                        {styleGuide.suited.includes(sc) && <span className="ml-1.5 text-[10px]" style={{ color: T.ok }}>suits {style}</span>}
                      </span>
                      <span className="text-[11px] text-right" style={{ color: T.inkSoft }}>{sc.mood}</span>
                    </div>
                    {on && (
                      <div className="mt-1.5 text-[11px]" style={{ color: T.inkSoft }}>
                        {scalePcs(tonic, sc.id).map((p) => noteName(p, system)).join(" ")} · good for {sc.tags.join(", ")}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {tab === "prog" && (
          <>
            <H>Type chords</H>
            <input value={chordText} onChange={(e) => setChordText(e.target.value)}
              placeholder={baseOf(system) === "solfege" ? "e.g. Lam7 Fa#m7 Rem7 Sol7sus4" : "e.g. Am7 F#m7 Dm7 G7sus4"}
              aria-label="Chord names" autoCapitalize="none" autoCorrect="off" spellCheck={false}
              className="w-full px-3 py-2.5 rounded-md text-base mb-2"
              style={{ background: T.keyWhite, color: T.ink, boxShadow: `inset 0 0 0 1px ${T.edge}` }} />
            <div className="flex gap-1.5 flex-wrap mb-3">
              {TYPING_CHIPS.map(([show, insert]) => (
                <button key={show} onClick={() => setChordText(chordText + insert)}
                  className="px-2.5 py-1.5 rounded-md text-xs" style={{ background: T.raised, color: T.ink }}>{show}</button>
              ))}
            </div>
            {typed.length > 0 && (
              <div className="mb-4">
                <div className="flex gap-1.5 flex-wrap mb-2">
                  {typed.map((r, i) => r.ok ? (
                    <button key={i} onClick={() => tapChord(typedChord(r, tonic, mode, base))}
                      className="px-2.5 py-1.5 rounded-md text-sm"
                      style={{ background: T.surface, color: T.ink, boxShadow: `inset 0 0 0 1px ${T.ok}` }}>
                      {typedLabel(typedChord(r, tonic, mode, base), system)}
                      <span className="ml-1.5 text-[11px]" style={{ color: T.inkSoft }}>{typedChord(r, tonic, mode, base).roman}</span>
                    </button>
                  ) : (
                    <span key={i} className="px-2.5 py-1.5 rounded-md text-sm"
                      style={{ background: T.surface, color: T.tension, boxShadow: `inset 0 0 0 1px ${T.tension}` }}>{r.text}</span>
                  ))}
                </div>
                {typedErrors.map((r, i) => (
                  <p key={i} className="text-[12px] mb-1" style={{ color: T.tension }}>{r.reason}</p>
                ))}
                {typedErrors.length === 0 && typedOk.length > 0 && (
                  <>
                    <p className="text-[12px] mb-1.5" style={{ color: T.inkSoft }}>
                      {keysContaining(typedOk.flatMap((c) => c.notes)).length === 0
                        ? "No single key holds all of these. Songs often change key between sections: try one section at a time."
                        : "Keys these chords fit:"}
                    </p>
                    <div className="flex gap-1.5 flex-wrap mb-2">
                      {keysContaining(typedOk.flatMap((c) => c.notes)).map((k, i) => (
                        <button key={i} onClick={() => { setTonic(k.tonic); setMode(k.mode); }}
                          className="px-2.5 py-1.5 rounded-md text-xs"
                          style={{ background: k.tonic === tonic && k.mode === mode ? T.homeDot : T.raised, color: k.tonic === tonic && k.mode === mode ? T.keyWhite : T.ink }}>
                          {noteName(k.tonic, spelling(baseSystem, k.tonic, k.mode))} {k.mode}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <button onClick={() => addTyped(false)} disabled={prog.length + typedOk.length > 8}
                        className="px-3 py-2 rounded-md text-sm font-semibold disabled:opacity-40" style={{ background: T.homeDot, color: T.keyWhite }}>
                        Add {typedOk.length === 1 ? "it" : `these ${typedOk.length}`} to the loop
                      </button>
                      {prog.length > 0 && (
                        <button onClick={() => addTyped(true)} disabled={typedOk.length > 8}
                          className="px-3 py-2 rounded-md text-sm disabled:opacity-40" style={{ background: T.raised, color: T.ink }}>
                          Replace the loop
                        </button>
                      )}
                    </div>
                    {prog.length + typedOk.length > 8 && (
                      <p className="text-[12px] mt-1.5" style={{ color: T.inkSoft }}>The loop holds 8 chords.</p>
                    )}
                  </>
                )}
              </div>
            )}

            <H right={prog.length ? <button onClick={() => { stop(); setProg([]); }} className="text-xs" style={{ color: T.inkSoft }}>clear</button> : null}>
              Your loop
            </H>
            {prog.length === 0 ? (
              <p className="text-sm mb-4" style={{ color: T.inkSoft }}>
                Nothing yet. Type chord names above, add chords from the Chords tab, or take a whole progression from a chord set.
              </p>
            ) : (
              <>
                <div className="flex gap-1.5 flex-wrap mb-3">
                  {prog.map((c, i) => (
                    <button key={i} onClick={() => setProg(prog.filter((_, j) => j !== i))}
                      className="px-3 py-2 rounded-md text-sm font-medium"
                      style={{ background: step === i ? T.chordW : T.surface, color: step === i ? T.padInk : T.ink, boxShadow: `inset 0 0 0 1px ${step === i ? T.chordW : T.edge}` }}>
                      {lbl(c)}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3 flex-wrap mb-4">
                  <button onClick={() => (playing ? stop() : start())} className="px-4 py-2 rounded-md text-sm font-semibold"
                    style={{ background: playing ? T.tension : T.homeDot, color: T.keyWhite }}>
                    {playing ? "Stop" : "Play loop"}
                  </button>
                  <label className="flex items-center gap-2 text-xs" style={{ color: T.inkSoft }}>
                    {bpm} bpm
                    <input type="range" min="60" max="140" value={bpm} onChange={(e) => setBpm(+e.target.value)} style={{ width: 90, accentColor: T.homeDot }} />
                  </label>
                  <button onClick={() => setWithBass(!withBass)} className="text-xs px-2 py-1 rounded"
                    style={{ background: T.raised, color: withBass ? T.bass : T.inkSoft, fontWeight: withBass ? 600 : 400 }}>bass root</button>
                </div>

                {progStory && (
                  <>
                    <H>Why it works</H>
                    <p className="text-[12px] mb-2" style={{ color: T.inkSoft }}>{progStory.summary}</p>
                    <div className="mb-4">
                      {progStory.moves.map((m, i) => (
                        <div key={i} className="flex gap-2 py-1.5 text-[11px]" style={{ borderBottom: `1px solid ${T.edge}` }}>
                          <span className="font-semibold shrink-0" style={{ minWidth: 78 }}>{m.from} → {m.to}</span>
                          <span style={{ color: T.inkSoft }}>{m.why}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <H>What could come next</H>
                <div className="mb-4">
                  {suggestNextChords(prog, tonic, mode, size).map(({ chord: c, why }) => (
                    <Row key={c.id} left={lbl(c)} mid="" right={why} accent={T.chordB}
                      onClick={() => { tapChord(c); addChord(c); }} />
                  ))}
                  <p className="text-[11px]" style={{ color: T.inkSoft }}>Tap one to hear it and add it to the loop.</p>
                </div>

                {prog.length > 1 && (
                  <>
                    <H>Voice leading</H>
                    <p className="text-[11px] mb-2" style={{ color: T.inkSoft }}>
                      Which notes stay put between chords, and which have to move. Fewer moving notes sounds smoother.
                    </p>
                    <div className="mb-4">
                      {prog.map((c, i) => {
                        const next = prog[(i + 1) % prog.length];
                        const vl = voiceLeading(c, next, system);
                        return (
                          <button key={i}
                            onClick={() => { setChord(c); playSequence([...c.notes, ...next.notes], 420, 0.9); }}
                            className="w-full text-left px-3 py-2 rounded-lg mb-1.5"
                            style={{ background: T.surface, boxShadow: `inset 0 0 0 1px ${T.edge}` }}>
                            <div className="flex items-baseline justify-between">
                              <span className="text-sm font-medium">{lbl(c)} → {lbl(next)}</span>
                              <span className="text-[11px]" style={{ color: vl.common.length >= 2 ? T.ok : vl.common.length === 1 ? T.chordB : T.tension }}>
                                {vl.smoothness}
                              </span>
                            </div>
                            <div className="text-[11px] mt-0.5" style={{ color: T.inkSoft }}>
                              {vl.common.length > 0 && (
                                <>held: <strong>{vl.common.map((p) => noteName(p, system)).join(" ")}</strong> · </>
                              )}
                              {vl.moves.filter((m) => m.from !== null && m.to !== null)
                                .map((m) => `${noteName(m.from, system)}→${noteName(m.to, system)}`).join(", ") || "everything moves"}
                            </div>
                            <div className="text-[10px] mt-1" style={{ color: T.bass }}>
                              smoothest: {smoothestVoicing(c, next, system).name} — {smoothestVoicing(c, next, system).notes.map((m) => noteName(m, system)).join(" ")}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}

                <H>Scales that fit</H>
                <div className="mb-4">
                  {fits.map(({ scale: sc, fit, missing }) => (
                    <Row key={sc.id} left={fit === 1 ? "✓" : "~"} mid={`${noteName(tonic, system)} ${sc.name}`}
                      right={fit === 1 ? "every note fits" : `misses ${missing.map((p) => noteName(p, system)).join(", ")}`}
                      accent={fit === 1 ? T.ok : T.inkSoft}
                      onClick={() => { pickScale(sc); setTab("scales"); }} />
                  ))}
                </div>

                {can("riffs") && <><H right={<button onClick={suggest} className="text-xs px-2 py-1 rounded" style={{ background: T.raised, color: T.bass, fontWeight: 600 }}>surprise me</button>}>
                  Riffs &amp; basslines
                </H>
                <div className="flex gap-1.5 flex-wrap mb-3">
                  {STYLES.map((sName) => (
                    <button key={sName} onClick={() => { setStyle(sName); setBassPat(null); setRiffPat(null); }}
                      className="px-2.5 py-1 rounded-md text-xs"
                      style={{ background: style === sName ? T.bass : T.raised, color: style === sName ? T.keyWhite : T.inkSoft, fontWeight: style === sName ? 600 : 400 }}>
                      {sName}
                    </button>
                  ))}
                </div>

                {[["bass", "Basslines", bassPat, setBassPat], ["melody", "Mini melodies", riffPat, setRiffPat]].map(([kind, title, current, setter]) => (
                  <div key={kind} className="mb-4">
                    <p className="text-[11px] font-semibold mb-1.5" style={{ color: T.inkSoft }}>{title}</p>
                    {patternsFor(kind, style).map((pat) => {
                      const on = current?.id === pat.id;
                      return (
                        <button key={pat.id} onClick={() => setter(on ? null : pat)}
                          className="w-full flex items-baseline gap-3 px-3 py-2 rounded-lg text-left mb-1.5"
                          style={{ background: on ? T.raised : T.surface, boxShadow: `inset 0 0 0 1px ${on ? T.bass : T.edge}` }}>
                          <span className="text-sm font-medium shrink-0" style={{ color: on ? T.bass : T.ink, minWidth: 104 }}>{pat.name}</span>
                          <span className="text-[11px]" style={{ color: T.inkSoft }}>{pat.note}</span>
                        </button>
                      );
                    })}
                  </div>
                ))}

                {(bassFigure || riffFigure) && (
                  <div className="rounded-lg p-3 mb-2" style={{ background: T.surface, boxShadow: `inset 0 0 0 1px ${T.edge}` }}>
                    {[[bassPat, bassFigure, "Bass"], [riffPat, riffFigure, "Riff"]].map(([pat, fig, kind]) =>
                      !pat || !fig ? null : (
                        <div key={kind} className="mb-2 last:mb-0">
                          <div className="flex items-baseline justify-between mb-1">
                            <span className="text-[11px] font-semibold">{kind} — {pat.name}</span>
                            {kind === "Riff" && (
                              <button onClick={() => setPlayRiff(!playRiff)} className="text-[10px] px-2 py-0.5 rounded"
                                style={{ background: T.raised, color: playRiff ? T.bass : T.inkSoft }}>{playRiff ? "playing" : "muted"}</button>
                            )}
                          </div>
                          <div className="flex gap-1.5 flex-wrap">
                            {fig.map((barNotes, i) => (
                              <button key={i} onClick={() => playSequence(barNotes.map((n) => n.midi), 200, 0.2, kind === "Bass")}
                                className="text-[10px] px-2 py-1 rounded"
                                style={{ background: step === i ? T.bass : T.raised, color: step === i ? T.keyWhite : T.ink }}>
                                {barNotes.map((n) => noteName(n.midi, system)).join(" ")}
                              </button>
                            ))}
                          </div>
                        </div>
                      )
                    )}
                    {bassPat && bassFigure?.[0] && (
                      <p className="text-[11px] mt-1.5" style={{ color: T.inkSoft }}>
                        {explainFigure(bassPat, bassFigure[0], system)}
                      </p>
                    )}
                    <p className="text-[11px] mt-1" style={{ color: T.inkSoft }}>Tap a bar to hear it on its own, or press play to hear it over the loop.</p>
                  </div>
                )}</>}
              </>
            )}
          </>
        )}

        {tab === "bass" && (
          <>
            <p className="text-[12px] leading-relaxed mb-4" style={{ color: T.inkSoft }}>{BASS_PARAGRAPH}</p>
            {!activeChord ? (
              <p className="text-sm" style={{ color: T.inkSoft }}>Pick a key to get started.</p>
            ) : (
              <>
                <H right={!chord && prog.length ? <span className="text-[10px]" style={{ color: T.inkSoft }}>first chord of your loop</span> : null}>
                  Under {lbl(activeChord)}
                </H>
                {bassOptions(activeChord, scaleSet).slice(0, 7).map((o, i) => (
                  <Row key={i} left={noteName(o.pc, system)} mid={o.label} right={o.why}
                    accent={o.role === "passing" ? T.passing : T.bass}
                    onClick={() => { const m = 36 + o.pc; inst.init().then(() => { inst.play([m], 0.5, undefined, 0.9); setBassLit([m]); }); }} />
                ))}

                {nextBassTarget && (
                  <>
                    <H>Getting to {lbl(nextBassTarget)}</H>
                    {bassTransitions(activeChord, nextBassTarget, scaleSet).map((t, i) => (
                      <Row key={i} left="▶" mid={t.name}
                        right={t.notes.map((m) => noteName(m, system)).join(" → ")}
                        accent={T.bass}
                        onClick={() => playSequence(t.notes, 300, 0.28, true)} />
                    ))}
                    <p className="text-[11px] mt-1" style={{ color: T.inkSoft }}>
                      Tap any of these to hear it. They all start on {noteName(activeChord.rootPc, system)} and land on {noteName(nextBassTarget.rootPc, system)}.
                    </p>
                  </>
                )}
                {!nextBassTarget && (
                  <p className="text-[11px] mt-3" style={{ color: T.inkSoft }}>
                    Add a second chord to your loop to see ways of walking between them.
                  </p>
                )}
              </>
            )}
          </>
        )}

        {tab === "theory" && (
          <>
            <H>Where the chords come from</H>
            <p className="text-[12px] leading-relaxed mb-2" style={{ color: T.inkSoft }}>
              Take your scale — {scalePcs(tonic, parentScale).map((p) => noteName(p, system)).join(" ")} — start on any note, then skip
              every other one. Three notes gives a triad, four gives a seventh, five gives a ninth. Do that from all seven
              notes and you get exactly the chords in this key. Nothing else is involved.
            </p>
            <div className="flex gap-1.5 flex-wrap mb-3">
              {harmonize(tonic, parentScale, 3, base).map((c, i) => (
                <button key={c.id} onClick={() => { setLesson({ degree: i, step: -1 }); tapChord(c); }}
                  className="px-2.5 py-1 rounded text-xs font-medium"
                  style={{ background: lesson.degree === i ? T.chordW : T.raised, color: lesson.degree === i ? T.padInk : T.ink, boxShadow: `inset 0 0 0 1px ${T.edge}` }}>
                  {lbl(c)} <span style={{ color: lesson.degree === i ? T.padSub : T.inkSoft }}>{c.roman}</span>
                </button>
              ))}
            </div>

            <div className="rounded-lg p-3 mb-5" style={{ background: T.surface, boxShadow: `inset 0 0 0 1px ${T.edge}` }}>
              <p className="text-[12px] mb-2" style={{ color: T.inkSoft }}>
                {lessonSteps[lesson.step]?.text ?? "Step through it one note at a time and watch the piano."}
              </p>
              <div className="flex gap-1.5">
                <button onClick={stepLesson} className="px-3 py-1.5 rounded-md text-xs font-semibold"
                  style={{ background: T.homeDot, color: T.keyWhite }}>
                  {lesson.step < 0 ? "Build it" : lesson.step >= lessonSteps.length - 1 ? "Again" : "Next note"}
                </button>
                <span className="text-[11px] self-center" style={{ color: T.inkSoft }}>
                  {lesson.step >= 0 ? `${lesson.step + 1} of ${lessonSteps.length}` : `${scalePcs(tonic, parentScale).map((p) => noteName(p, system)).join(" ")}`}
                </span>
              </div>
            </div>

            <H>Chord dictionary — {noteName(tonic, system)}</H>
            <div className="mb-5">
              {dictionaryFor(tonic, base).map((c) => (
                <button key={c.id} onClick={() => { playDictionaryChord(c); }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left mb-1.5"
                  style={{ background: chord?.id === c.id ? T.raised : T.surface, boxShadow: `inset 0 0 0 1px ${chord?.id === c.id ? T.chordW : T.edge}` }}>
                  <span className="text-sm font-semibold shrink-0" style={{ minWidth: 62 }}>{lbl(c)}</span>
                  <span className="text-[11px] shrink-0" style={{ color: T.chordB, minWidth: 70 }}>{c.formula}</span>
                  <span className="text-[10px] shrink-0" style={{ color: T.inkSoft, minWidth: 84 }}>
                    {c.notes.map((m) => noteName(m, system)).join(" ")}
                  </span>
                  <span className="text-[11px] ml-auto text-right" style={{ color: T.inkSoft }}>{c.plain}</span>
                </button>
              ))}
            </div>

            <H>Inversions</H>
            {!activeChord ? (
              <p className="text-sm mb-5" style={{ color: T.inkSoft }}>Pick a chord to hear its inversions.</p>
            ) : (
              <div className="mb-5">
                <p className="text-[12px] mb-2" style={{ color: T.inkSoft }}>
                  Same notes, different note at the bottom. The chord doesn't change; its weight does.
                </p>
                {inversions(activeChord).map((inv, i) => (
                  <Row key={i} left={noteName(inv.bass, system)} mid={inv.name}
                    right={inv.notes.map((m) => noteName(m, system)).join(" ")}
                    accent={T.chordB}
                    onClick={() => { inst.init().then(() => { inst.play(inv.notes, 0.9, undefined, 0.7, spread); flash(inv.notes, 700); }); }} />
                ))}
              </div>
            )}

            <H>Bass in one paragraph</H>
            <p className="text-[12px] leading-relaxed" style={{ color: T.inkSoft }}>{BASS_PARAGRAPH}</p>
          </>
        )}
      </div>
    </div>
  );
}

/* For the J-6 Explorer page (j6/app.jsx): it reuses the piano, the sound, the
   colour tokens and the theory from here, imported rather than copied, so
   there is one of each. Its engine's theory import is pointed at this file
   when the page is bundled. (D-086) */
export { T, Piano, useInstrument, pc, NAMES, FLAT_NAMES, DICTIONARY, parseChordName, keyNames, spelling, scalePcs, romanFor };

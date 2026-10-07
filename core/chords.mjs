/* core/chords — What a chord is: the quality table, the dictionary of chord types with their intervals and plain descriptions, naming a chord from the notes played, labels, inversions and chords of your own.
   Layer 1. Depends on: core/notes. Pure: no React, no Tone, no DOM, no dates, no randomness.
   Interface, behaviour and requirements: core/MODULES.md (chords).
   Moved verbatim from the THEORY block of sketchpad.jsx (D-096); behaviour unchanged. */

import { pc, noteName } from "./notes.mjs";

const chordLabel = (rootPc, sym, system) => noteName(rootPc, system) + sym;

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


/* ============================================================================
   CHORD DICTIONARY, BASS ROLES, TRANSITIONS, INVERSIONS, CHORD SETS
   Everything the Chords, Bass and Theory tabs need. All pure. (D-035)
   ========================================================================== */

const DEGREE_NAMES = { 0:"1", 1:"♭2", 2:"2", 3:"♭3", 4:"3", 5:"4", 6:"♭5", 7:"5",
                       8:"♯5", 9:"6", 10:"♭7", 11:"7", 13:"♭9", 14:"9", 15:"♯9", 17:"11", 18:"♯11", 21:"13" };

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

/* Notes in, names out. The question has one answer shape and two levels of
   tolerance (D-099):
     exact     the notes ARE a chord: every tone present, nothing left over.
               Ranked: a reading with the lowest note as root first.
     missing   the notes are PART of a chord: every note belongs to it, tones
               may be absent. A hardware chord key often leaves out the fifth but
               keeps the root at the bottom, so the root in the bass outweighs
               two missing tones, then the simpler chord (the dictionary's order)
               wins. Needs three different notes.
   Each reading: { rootPc, sym, full, label, notes, bass, tones, missing, score, why }.
   `tones` is the chord's own pitch classes above its root; `missing` how many of
   them the notes lack (0 for an exact reading). */
function identifyChord(midis, system = "letters", { missing = false } = {}) {
  const sorted = [...new Set(midis)].sort((a, b) => a - b);
  if (sorted.length < 2) return [];
  const pcs = [...new Set(sorted.map(pc))];
  const bass = pc(sorted[0]);

  if (missing) {
    if (pcs.length < 3) return [];
    const found = [];
    for (const root of pcs) {
      const rel = pcs.map((p) => pc(p - root));
      DICTIONARY.forEach((d, order) => {
        const tones = [...new Set(d.iv.map(pc))];
        if (!rel.every((x) => tones.includes(x))) return;
        const lacking = tones.length - rel.length, inverted = root !== bass;
        found.push({
          order, penalty: lacking + (inverted ? 2 : 0),
          reading: {
            rootPc: root, sym: d.q, full: d.full, notes: sorted, bass, tones, missing: lacking,
            label: chordLabel(root, d.q, system) + (inverted ? `/${noteName(bass, system)}` : ""),
            score: -(lacking + (inverted ? 2 : 0)),
            why: lacking
              ? `${lacking} note${lacking === 1 ? " is" : "s are"} left out of this chord, which is common when only part of it is played.`
              : "Every note of the chord is there.",
          },
        });
      });
    }
    return found.sort((a, b) => a.penalty - b.penalty || a.order - b.order).map((f) => f.reading);
  }

  if (pcs.length === 2) {
    /* measured upward from the lowest note played, not by the smaller of the
       two inversions — C up to G is a fifth, whatever G down to C is. */
    const top = pc(sorted[sorted.length - 1]);
    const up = pc(top - bass);
    return [{
      label: `${noteName(bass, system)} + ${noteName(top, system)}`,
      full: INTERVAL_NAMES[up] ?? "interval", rootPc: bass, sym: "", notes: sorted, bass,
      tones: [0, up], missing: 0,
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
      tones: sig.split(",").map(Number), missing: 0,
      label: chordLabel(root, q.sym, system) + (inverted ? `/${noteName(bass, system)}` : ""),
      score: q.rank + (inverted ? 0 : 2),
      why: inverted
        ? `Same notes, with ${noteName(bass, system)} at the bottom instead of ${noteName(root, system)}.`
        : "The lowest note is the root, so this is the most likely reading.",
    });
  }
  return out.sort((a, b) => b.score - a.score);
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

export { chordLabel, QUALITIES, DEGREE_NAMES, DICTIONARY, inversions, SIGNATURES, identifyChord, customChordFrom };

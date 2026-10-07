/* core/fingering — Suggested finger numbers: chords by rule, scales from a checked table, hand reach and crossings. Suggested, never checked.
   Layer 2. Depends on: core/notes, core/scales. Pure: no React, no Tone, no DOM, no dates, no randomness.
   Interface, behaviour and requirements: core/MODULES.md (fingering).
   Moved verbatim from the THEORY block of sketchpad.jsx (D-096); behaviour unchanged. */

import { pc, noteName } from "./notes.mjs";
import { scalePcs } from "./scales.mjs";


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

export { SCALE_FINGERING, HAND_REACH, DEFAULT_REACH, FINGER_HANDS, effectiveFingerHand, FINGER_COPY, handFingers, fitsHand, fingerChord, fingerCrossings, scaleFingering, stepFingering, litLessonFingers };

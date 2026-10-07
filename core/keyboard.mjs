/* core/keyboard — The logic of a piano keyboard on a touch screen: the role a key plays, fingers held, a finger sliding across keys, the key under a finger.
   Layer 1. Depends on: core/notes. Pure: no React, no Tone, no DOM, no dates, no randomness.
   Interface, behaviour and requirements: core/MODULES.md (keyboard).
   Moved verbatim from the THEORY block of sketchpad.jsx (D-096); behaviour unchanged. */

import { WHITE_PCS, pc } from "./notes.mjs";


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

export { keyRole, keyMarker, MAX_HELD, heldAfterDown, heldAfterUp, slideTo, notesUnderFingers, keyAtPosition };

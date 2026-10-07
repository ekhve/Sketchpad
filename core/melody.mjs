/* core/melody — Which notes of a scale land well, move through, or pull against a chord, and which notes changed between two chords.
   Layer 1. Depends on: core/notes. Pure: no React, no Tone, no DOM, no dates, no randomness.
   Interface, behaviour and requirements: core/MODULES.md (melody).
   Moved verbatim from the THEORY block of sketchpad.jsx (D-096); behaviour unchanged. */

import { pc } from "./notes.mjs";



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

export { melodyRole, MELODY_ROLES, melodyGuide, changedNotes };

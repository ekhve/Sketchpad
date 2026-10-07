/* core/styles — Style as a way in: which scales and chord colours suit an intention such as hip-hop, soul or funk.
   Layer 2. Depends on: core/scales. Pure: no React, no Tone, no DOM, no dates, no randomness.
   Interface, behaviour and requirements: core/MODULES.md (styles).
   Moved verbatim from the THEORY block of sketchpad.jsx (D-096); behaviour unchanged. */

import { SCALES } from "./scales.mjs";


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

export { STYLE_COLOURS, scalesForStyle };

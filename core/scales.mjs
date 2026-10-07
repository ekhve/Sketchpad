/* core/scales — The scale catalogue and the questions asked of it: which notes a scale has, which scales fit a set of notes, which keys contain them, and scales of your own.
   Layer 1. Depends on: core/notes. Pure: no React, no Tone, no DOM, no dates, no randomness.
   Interface, behaviour and requirements: core/MODULES.md (scales).
   Moved verbatim from the THEORY block of sketchpad.jsx (D-096); behaviour unchanged. */

import { pc } from "./notes.mjs";


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


/* Which notes the marker channel shows. A scale of your own has to light the
   piano exactly like a built-in one, or saving it was pointless. (D-049) */
function activeScalePcs(customScale, tonic, scaleId) {
  return customScale ? customScalePcs(customScale) : scalePcs(tonic, scaleId);
}

export { SCALES, scaleById, scalePcs, fitScales, keysContaining, scalesContaining, customScaleFrom, customScalePcs, activeScalePcs };

/* core/explain — Plain-language explanations of a chord or a progression in a key, and of what changed between two chords.
   Layer 2. Depends on: core/chords, core/melody, core/notes, core/scales. Pure: no React, no Tone, no DOM, no dates, no randomness.
   Interface, behaviour and requirements: core/MODULES.md (explain).
   Moved verbatim from the THEORY block of sketchpad.jsx (D-096); behaviour unchanged. */

import { chordLabel } from "./chords.mjs";
import { changedNotes } from "./melody.mjs";
import { pc, noteName } from "./notes.mjs";
import { scaleById, scalePcs } from "./scales.mjs";


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

export { explainChord, explainProgression, describeChange };

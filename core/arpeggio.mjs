/* core/arpeggio — How a set of notes is played in time: all at once, rolled, or one at a time up, down, up and back, or at random. One setting for chords and for scales.
   Layer 3. Depends on: core/figures, core/playback, core/voicing. Pure: no React, no Tone, no DOM, no dates, no randomness.
   Interface, behaviour and requirements: core/MODULES.md (arpeggio).
   Added for the shared Played setting (D-108); it joins the roll styles of core/playback and core/voicing's arpeggio. */

import { rng } from "./figures.mjs";
import { ROLL_STYLES, rollOffsets } from "./playback.mjs";
import { arpeggio } from "./voicing.mjs";


/* The ways to play a set of notes. The first three are how a chord is struck (all at once, or laid down
   quickly or slowly); the rest run through the notes one at a time. A scale can only run. */
const RUNS = [
  { id: "up",     name: "Up",       kind: "run", note: "One note at a time, low to high." },
  { id: "down",   name: "Down",     kind: "run", note: "One note at a time, high to low." },
  { id: "updown", name: "Up & down", kind: "run", note: "Up, and back down without repeating the top." },
  { id: "random", name: "Random",   kind: "run", note: "Every note once, in a new order each time." },
];
const PLAY_PATTERNS = [...ROLL_STYLES.map((r) => ({ id: r.id, name: r.name, kind: "chord", note: r.note, spread: r.spread })), ...RUNS];

/** Seconds between notes of a run: quick for a chord, easy for a scale. */
const RUN_STEP = { chord: 0.12, scale: 0.26 };

const patternById = (id) => PLAY_PATTERNS.find((p) => p.id === id) ?? PLAY_PATTERNS[0];
const isRun = (id) => RUNS.some((r) => r.id === id);

/** The notes in the order a run plays them. Random keeps `endOn` (a scale's top note) for last. */
function runOrder(notes, id, { seed = 1, endOn = false } = {}) {
  const asc = [...new Set(notes)].sort((a, b) => a - b);
  if (id === "random") {
    const keep = endOn && asc.length > 1 ? asc.pop() : null;
    const r = rng(seed);
    for (let i = asc.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [asc[i], asc[j]] = [asc[j], asc[i]]; }
    return keep === null ? asc : [...asc, keep];
  }
  return arpeggio(asc, id === "updown" ? "updown" : id === "down" ? "down" : "up");
}

/** When each note of a chord or a scale starts, from the moment it is played:
 *  [{ midi, at }] in seconds. `kind` is "chord" or "scale"; a scale given a chord style runs up. */
function playPlan(notes, id, { seed = 1, kind = "chord" } = {}) {
  const p = patternById(id);
  if (p.kind === "run" || kind === "scale") {
    const run = runOrder(notes, p.kind === "run" ? p.id : "up", { seed, endOn: kind === "scale" });
    return run.map((midi, i) => ({ midi, at: i * RUN_STEP[kind] }));
  }
  const sorted = [...new Set(notes)].sort((a, b) => a - b);
  const offs = rollOffsets(sorted.length, p.spread);
  return sorted.map((midi, i) => ({ midi, at: offs[i] }));
}

export { PLAY_PATTERNS, RUN_STEP, patternById, isRun, runOrder, playPlan };

/* core/harmony — Chords in a key: roman numerals, harmonising a scale into chords, suggesting a scale or the next chord, borrowed chords and tension, and typed chords placed in a key.
   Layer 3. Depends on: core/chords, core/notes, core/scales, core/voicing. Pure: no React, no Tone, no DOM, no dates, no randomness.
   Interface, behaviour and requirements: core/MODULES.md (harmony).
   Moved verbatim from the THEORY block of sketchpad.jsx (D-096); behaviour unchanged. */

import { chordLabel, QUALITIES, DICTIONARY } from "./chords.mjs";
import { pc, noteName } from "./notes.mjs";
import { SCALES, scaleById, scalePcs } from "./scales.mjs";
import { DEFAULT_BASE, voice, stackAscending, voiceLeading } from "./voicing.mjs";


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
const harmonizeCustom = (def, size = 3, base = DEFAULT_BASE) =>
  def.iv.length === 7 ? harmonizeIntervals(def.tonicPc, def.iv, size, def.id, base) : [];

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

export { romanFor, harmonizeIntervals, harmonize, suggestScaleFor, harmonizeSteps, suggestNextChords, typedChord, harmonizeCustom, TENSION_LEVELS, BORROWED, chordsAtTension };

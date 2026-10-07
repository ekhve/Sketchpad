// J-6 Explorer — the engine. (D-079–D-088)
// Pure functions only. The chord sets are the manual's, exactly as printed, in sets.mjs;
// its labels are read by labels.mjs; the theory is Sketchpad's.

import { SETS } from "./sets.mjs";
import { readLabel } from "./labels.mjs";
export { SETS };

export const KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/* ---------- shared theory (D-086) ----------
   Spelling, chord qualities, scales and numerals come from Sketchpad's theory
   layer, the block between THEORY:START and THEORY:END in sketchpad.jsx. Node
   reads it from the module extracted for the tests; the page build points this
   same import at sketchpad.jsx itself, so there is one copy of the theory. */
import { pc, NAMES, FLAT_NAMES, DICTIONARY, parseChordName, keyNames, scalePcs, romanFor, SCALES } from "../tests/theory.mjs";

/* ---------- notes ---------- */
const LETTER = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const ACC = { "": 0, "#": 1, "♯": 1, b: -1, "♭": -1 };

export function pcOf(name) {
  const m = /^([A-G])(#|♯|b|♭)?$/.exec(name);
  if (!m) throw new Error(`not a note: ${name}`);
  return pc(LETTER[m[1]] + ACC[m[2] ?? ""]);
}

export function midiOf(note) {
  const m = /^([A-G](?:#|♯|b|♭)?)(-?\d)$/.exec(note);
  if (!m) throw new Error(`not a pitch: ${note}`);
  return pcOf(m[1]) + 12 * (Number(m[2]) + 1);
}

/** Voicing as printed (high→low) → ascending MIDI numbers. */
export const voicing = (s) => s.split(/\s+/).map(midiOf).sort((a, b) => a - b);

/* ---------- chord symbols ---------- */
/** quality → intervals above the root, folded into one octave, from Sketchpad's dictionary. */
export const QUALITIES = Object.fromEntries(DICTIONARY.map((d) => [d.q, [...new Set(d.iv.map(pc))]]));

const ivKey = (iv) => [...new Set(iv.map(pc))].sort((a, b) => a - b).join(",");
const DICTIONARY_BY_IV = new Map(DICTIONARY.map((d) => [ivKey(d.iv), d.q]).reverse());

/** "Cmaj7", "CM7/E", "A#7", "B♭maj7", "CM9/#11", "D7alt" → { root, quality, bass, iv }:
 *  pitch classes, the quality's name, and its intervals above the root.
 *  Sketchpad's chord-name reader comes first, so both apps read the same spellings the
 *  same way (D-077); the manual's own spellings are read by labels.mjs (D-088). A chord
 *  whose notes are in Sketchpad's dictionary takes the dictionary's name. */
export function parseChord(symbol) {
  const r = parseChordName(symbol);
  if (r.ok) return { root: r.rootPc, quality: r.sym, bass: r.bassPc ?? r.rootPc, iv: QUALITIES[r.sym] };
  const l = readLabel(symbol);
  if (!l.ok) throw new Error(`cannot read chord: ${r.reason}`);
  return { root: l.root, quality: DICTIONARY_BY_IV.get(ivKey(l.iv)) ?? l.name, bass: l.bass, iv: l.iv };
}

export const pcsOf = ({ root, iv, bass }) => new Set([...iv.map((i) => pc(root + i)), bass]);
const sameChord = (a, b) => a.root === b.root && ivKey(a.iv) === ivKey(b.iv);

/** Display name (D-079): musician spelling. Without a key, flats for the black keys;
 *  with one, the key's own spelling (D-086), so F#m7 in D major is never G♭m7. */
export function nameOf({ root, quality, bass }, names = FLAT_NAMES) {
  return names[root] + quality + (bass !== root ? "/" + names[bass] : "");
}
export const nameInKey = (chord, tonic, mode = "major") => nameOf(chord, keyNames(tonic, mode));
export { FLAT_NAMES };

/* ---------- data validation (D-082) ---------- */
/** A J-6 voicing is valid for its label if the label can be read, the label's root is
 *  sounded, every sounded pitch class belongs to the labelled chord, a slash bass is the
 *  lowest note, and no note is printed twice. Missing tones are allowed: the J-6 has 4
 *  voices. An unlabelled key (sets 14–16, interval stacks) is not a chord and not an error. */
export function validateKey(label, notes) {
  if (label === "") return [];
  let chord;
  try { chord = parseChord(label); } catch (e) { return [`the label can't be read`]; }
  const want = pcsOf(chord);
  const midi = voicing(notes);
  const got = new Set(midi.map((n) => n % 12));
  const problems = [];
  if (new Set(midi).size !== midi.length) problems.push("a note is printed twice");
  const strays = [...got].filter((pc) => !want.has(pc));
  /* A rootless voicing (D-080, amended): jazz voicings leave the root to the bass
     player. With three or more notes, all of them the chord's, it is the chord. */
  const rootless = !got.has(chord.root) && !strays.length && got.size >= 3;
  if (!got.has(chord.root) && !rootless) problems.push("root not sounded");
  if (strays.length) problems.push(`notes outside the chord: ${strays.map((p) => NAMES[p]).join(" ")}`);
  if (chord.bass !== chord.root && midi[0] % 12 !== chord.bass) problems.push("slash bass is not the lowest note");
  return problems;
}

const validated = new Map();
/** Sets the search leaves out altogether: most of their keys fail (D-082). */
export const untrustedSet = (n) => validateSet(n).length > 6;
export function validateSet(n) {
  if (!validated.has(n)) validated.set(n, SETS[n].keys
    .map(([label, notes], i) => ({ key: KEYS[i], label, problems: validateKey(label, notes) }))
    .filter((r) => r.problems.length));
  return validated.get(n);
}

/* ---------- J-6 adapter ---------- */
/** Chord produced by key index k on set n at KEY transpose t. */
/** chord is null for an unlabelled key or a label that can't be read. */
const parsed = new Map();
const labelOf = (label) => {
  if (!parsed.has(label)) { let c = null; try { if (label) c = parseChord(label); } catch (e) {} parsed.set(label, c); }
  return parsed.get(label);
};
/** KEY transpose moves the chord's root and bass by t semitones (D-081). */
const shift = (c, t) => c && { root: pc(c.root + t), quality: c.quality, bass: pc(c.bass + t), iv: c.iv };
export function chordAt(n, k, t = 0) {
  const [label, notes] = SETS[n].keys[k];
  return {
    key: KEYS[k], label,
    chord: shift(labelOf(label), t),
    midi: voicing(notes).map((m) => m + t),
  };
}

/* ---------- naming a voicing from its notes (D-093) ---------- */
/** The chord a set of notes makes, read the way the validator reads a label (D-080): a root
 *  that sounds, every note in the chord, missing tones allowed. A root in the bass counts
 *  for two missing tones; then the simpler chord wins (Sketchpad's dictionary order).
 *  → { root, quality, bass, iv } or null. For a misprinted key: what the printed notes make. */
export function nameFromNotes(midi) {
  const sorted = [...midi].sort((a, b) => a - b);
  const got = [...new Set(sorted.map(pc))];
  if (got.length < 3) return null;
  const bass = pc(sorted[0]);
  let best = null;
  for (const root of got) {
    const rel = got.map((p) => pc(p - root));
    DICTIONARY.forEach((d, order) => {
      const iv = [...new Set(d.iv.map(pc))];
      if (!rel.every((x) => iv.includes(x))) return;
      /* the J-6 often leaves out the fifth but keeps the root at the bottom, so a root in
         the bass outweighs a missing tone */
      const score = (iv.length - rel.length) + (root === bass ? 0 : 2);
      if (!best || score < best.score || (score === best.score && order < best.order)) best = { score, order, root, quality: d.q, iv };
    });
  }
  return best && { root: best.root, quality: best.quality, bass, iv: best.iv };
}

/* ---------- scales to play over the progression (D-092) ---------- */
/** Two or three scales to play a melody with, over chords in a major key: the key's own
 *  major scale (every note fits), its major pentatonic (five notes, nothing to avoid), and
 *  the relative minor's pentatonic (the same five-note feel, darker and bluesier). Each
 *  pentatonic lies inside the major scale, so all three sit under every chord in the key.
 *  Chords outside the key are named, because over them some notes will clash. */
export function scalesToPlay(chords) {
  const real = chords.filter(Boolean);
  const [key] = likelyKeys(real);
  if (!key) return { scales: [], outside: [] };
  const t = key.tonic;
  const pick = [[t, "major"], [t, "major-pentatonic"], [pc(t + 9), "minor-pentatonic"]];
  const major = new Set(scalePcs(t, "major"));
  return {
    scales: pick.map(([tonic, id]) => {
      const s = SCALES.find((x) => x.id === id);
      return { tonic, id, name: s.name, mood: s.mood, notes: scalePcs(tonic, id) };
    }),
    outside: real.filter((c) => ![...pcsOf(c)].every((p) => major.has(p))),
  };
}

/* ---------- display ---------- */
/** A chord type cut into lines for a pad about 33 px wide: at most 6 characters a line, and
 *  only ever before a bracket, a slash, "add" or "sus", so "maj9(no3)/G" is maj9 / (no3) / /G.
 *  (D-089: pads were cutting long names off) */
export function typeLines(rest) {
  const parts = rest.split(/(?=[(/]|add|sus)/).filter(Boolean);
  const lines = [];
  for (const p of parts) {
    if (lines.length && (lines[lines.length - 1] + p).length <= 6) lines[lines.length - 1] += p;
    else lines.push(p);
  }
  return lines;
}

/* ---------- analysis ---------- */
const MAJOR_REF = [0, 2, 4, 5, 7, 9, 11];

/** Major keys in which every chord is diatonic, best first (tie-break: first chord's root). */
export function likelyKeys(chords) {
  const fits = [];
  for (let tonic = 0; tonic < 12; tonic++) {
    const scale = new Set(scalePcs(tonic, "major"));
    const inKey = chords.filter((c) => [...pcsOf(c)].every((p) => scale.has(p))).length;
    fits.push({ tonic, inKey });
  }
  const first = chords[0]?.root;
  return fits.filter((f) => f.inKey > 0)
    .sort((a, b) => b.inKey - a.inKey || (b.tonic === first) - (a.tonic === first) || a.tonic - b.tonic);
}

/** The chord's numeral in a major key: Sketchpad's numeral (case, ♭/♯, °, +) plus the
 *  chord's extension, so Imaj7, iii7, V7, ♭VII7. */
export function romanOf(chord, tonic) {
  const offset = pc(chord.root - tonic);
  let degree = MAJOR_REF.indexOf(offset);
  if (degree < 0) degree = MAJOR_REF.indexOf(offset + 1);   // a flattened degree: ♭III, ♭VII
  const suffix = chord.quality.replace(/^m(?!aj)/, "").replace(/^(dim|aug)/, "");
  return romanFor(tonic, chord.root, degree, chord.quality) + suffix;
}

/* ---------- reverse search ---------- */
const third = (c) => (c.iv.includes(4) ? 4 : c.iv.includes(3) ? 3 : null);
const subset = (a, b) => [...a].every((x) => b.has(x));

/** Score one produced chord against one requested chord. */
export function matchScore(want, got, mode) {
  if (!got || got.root !== want.root) return { score: 0, kind: "none" };
  if (sameChord(got, want)) {
    if (got.bass === want.bass) return { score: 1, kind: "exact" };
    return mode === "exact" ? { score: 0, kind: "none" } : { score: 0.9, kind: "inversion" };
  }
  if (mode === "exact") return { score: 0, kind: "none" };
  const a = new Set(want.iv.map((i) => pc(want.root + i)));
  const b = new Set(got.iv.map((i) => pc(got.root + i)));
  const shared = [...a].filter((x) => b.has(x)).length;
  if (third(want) === third(got) && shared >= 3 && (subset(a, b) || subset(b, a))) return { score: 0.6, kind: "close" };
  return { score: 0, kind: "none" };
}

/** Rank chord sets for a progression. TRANSPOSE_RANGE is an assumption until checked on the device (D-081). */
export const TRANSPOSE_RANGE = [-6, 5];
export function search(progression, { sets = Object.keys(SETS).map(Number), mode = "musical", transpose = true } = {}) {
  const wanted = progression.trim().split(/\s+/).map(parseChord);
  const [lo, hi] = transpose ? TRANSPOSE_RANGE : [0, 0];
  const results = [];
  for (const n of sets) {
    /* A key whose data fails is never suggested; a set where most keys fail is left
       out altogether, since what it plays can't be trusted at all. (D-082, amended) */
    const failing = new Set(validateSet(n).map((r) => KEYS.indexOf(r.key)));
    if (failing.size > 6) continue;
    for (let t = lo; t <= hi; t++) {
      const rows = wanted.map((want) => {
        let best = { score: 0, kind: "none", keys: [] };
        for (let k = 0; k < 12; k++) {
          if (failing.has(k)) continue;
          const got = shift(labelOf(SETS[n].keys[k][0]), t);
          const m = matchScore(want, got, mode);
          if (m.score > best.score) best = { ...m, keys: [KEYS[k]], got };
          else if (m.score > 0 && m.score === best.score) best.keys.push(KEYS[k]);
        }
        return { want, ...best };
      });
      const score = rows.reduce((s, r) => s + r.score, 0) / rows.length;
      results.push({ set: n, genre: SETS[n].genre, transpose: t, score, rows });
    }
  }
  return results.sort((a, b) => b.score - a.score || Math.abs(a.transpose) - Math.abs(b.transpose) || a.set - b.set)
    .filter((r, i, all) => all.findIndex((x) => x.set === r.set) === i); // best transpose per set
}

/* core/symbols — Reading chord names as people write them: root, quality and slash bass, in letters or Do-Re-Mi, with the spellings charts use mapped onto the dictionary. Refuses what it cannot read, and says why.
   Layer 2. Depends on: core/chords, core/notes. Pure: no React, no Tone, no DOM, no dates, no randomness.
   Interface, behaviour and requirements: core/MODULES.md (symbols).
   Moved verbatim from the THEORY block of sketchpad.jsx (D-096); behaviour unchanged. */

import { chordLabel, DICTIONARY } from "./chords.mjs";
import { pc, baseOf, noteName } from "./notes.mjs";


/* ==========================================================================
   Typing chord names (D-077)
   "Bm7 F#m7 Fmaj7" is quicker than tapping twenty notes, and chord charts
   are written that way. The vocabulary is the dictionary: a name is read only
   if the dictionary can voice it, so a typed chord sounds exactly like the
   same chord picked from a list. Anything else is refused with a reason,
   never guessed.
   ========================================================================== */

const TYPED_LETTER_PC = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
const SOLFEGE_PC = [["sol", 7], ["do", 0], ["re", 2], ["mi", 4], ["fa", 5], ["so", 7], ["la", 9], ["si", 11], ["ti", 11]];

/* The spellings chord charts actually use, mapped onto dictionary names.
   Keys are compared after tidying: ♭ ♯ to b #, brackets dropped. */
const CHORD_ALIASES = {
  maj: "", major: "", M: "",
  min: "m", minor: "m", "-": "m",
  "°": "dim", "+": "aug", "#5": "aug",
  M7: "maj7", "Δ": "maj7", "Δ7": "maj7", ma7: "maj7", "7M": "maj7", j7: "maj7",
  min7: "m7", "-7": "m7",
  "ø": "m7♭5", "ø7": "m7♭5", "-7b5": "m7♭5", min7b5: "m7♭5",
  "°7": "dim7", mM7: "mMaj7", mmaj7: "mMaj7", "m7M": "mMaj7", "-Δ7": "mMaj7",
  M9: "maj9", "Δ9": "maj9", "-9": "m9", min9: "m9",
  sus: "sus4", "7sus": "7sus4", "9sus": "9sus4", "7sus49": "9sus4", "74/9": "9sus4", "7sus9": "9sus4",
  "69": "6/9", add2: "add9", "2": "add9", madd9: "m(add9)", "-add9": "m(add9)",
  "-6": "m6", "-11": "m11", M13: "maj13", "Δ13": "maj13", "-13": "m13",
  "Δ#11": "maj7♯11", "M7#11": "maj7♯11", sus49: "sus4(9)", sus24: "sus4(9)",
};
const tidySuffix = (x) => x.replace(/♭/g, "b").replace(/♯/g, "#").replace(/[()]/g, "");
const SUFFIXES = (() => {
  const out = new Map();
  for (const d of DICTIONARY) out.set(tidySuffix(d.q), d.q);
  for (const [alias, q] of Object.entries(CHORD_ALIASES)) out.set(tidySuffix(alias), q);
  return out;
})();

/* A note name at the start of text: letters (any case, # or b after) or,
   when the app speaks Do-Re-Mi, solfège. Returns { pc, rest } or null. */
function readRoot(text, system = "letters") {
  if (baseOf(system) === "solfege") {
    const low = text.toLowerCase();
    for (const [syl, p] of SOLFEGE_PC) {
      if (low.startsWith(syl)) return withAccidental(p, text.slice(syl.length));
    }
    return null;
  }
  const p = TYPED_LETTER_PC[text[0]?.toLowerCase()];
  return p === undefined ? null : withAccidental(p, text.slice(1));
}
function withAccidental(p, rest) {
  if (/^(#|♯)/.test(rest)) return { pc: pc(p + 1), rest: rest.slice(1) };
  if (/^(b|♭)/.test(rest)) return { pc: pc(p - 1), rest: rest.slice(1) };
  return { pc: p, rest };
}

/* The dictionary name nearest to something unknown: the one sharing the
   longest start, shortest first. Offered, never applied. */
function nearestSuffix(suffix) {
  const t = tidySuffix(suffix);
  let best = null, bestLen = 0;
  for (const d of DICTIONARY) {
    const k = tidySuffix(d.q);
    let n = 0;
    while (n < k.length && n < t.length && k[n] === t[n]) n++;
    if (n > bestLen || (n === bestLen && n > 0 && k.length < tidySuffix(best).length)) { best = d.q; bestLen = n; }
  }
  return bestLen > 0 ? best : null;
}

/* One chord name. { ok, rootPc, sym, full, bassPc, text } or { ok: false, text, reason }. */
function parseChordName(text, system = "letters") {
  const raw = text.trim();
  const nm = (p) => noteName(p, system);
  let body = raw, bassPc = null;
  const slash = raw.lastIndexOf("/");
  if (slash > 0) {
    const bass = readRoot(raw.slice(slash + 1), system);
    if (bass && bass.rest === "") { bassPc = bass.pc; body = raw.slice(0, slash); }
  }
  const root = readRoot(body, system);
  if (!root) {
    const names = baseOf(system) === "solfege" ? "Do, Re, Mi, Fa, Sol, La, Si" : "A to G";
    return { ok: false, text: raw, reason: `"${raw}" doesn't start with a note name (${names}).` };
  }
  const q = SUFFIXES.get(tidySuffix(root.rest));
  if (q === undefined) {
    const near = nearestSuffix(root.rest);
    return { ok: false, text: raw,
      reason: `"${root.rest}" isn't a chord type I know${near !== null ? `. Did you mean ${nm(root.pc)}${near}?` : "."}` };
  }
  const d = DICTIONARY.find((x) => x.q === q);
  return { ok: true, text: raw, rootPc: root.pc, sym: q, full: d.full, bassPc };
}

/* A line from a chord chart: spaces, commas, bar lines and dashes between
   chords are all just separators. */
function parseChordNames(line, system = "letters") {
  return line.split(/[\s,|]+/).filter((t) => t && !/^[-–—/.]+$/.test(t)).map((t) => parseChordName(t, system));
}

/* A typed chord's name as the app writes it, with the key's spelling. */
/* Buttons that type the awkward characters on a phone keyboard. */
const TYPING_CHIPS = [["#", "#"], ["♭", "b"], ["m", "m"], ["7", "7"], ["maj7", "maj7"], ["m7", "m7"], ["sus4", "sus4"], ["dim", "dim"], ["/", "/"], ["space", " "]];

const typedLabel = (c, system) =>
  chordLabel(c.rootPc, c.sym, system) + (c.bassPc !== null && c.bassPc !== undefined && c.bassPc !== c.rootPc ? `/${noteName(c.bassPc, system)}` : "");

export { CHORD_ALIASES, nearestSuffix, parseChordName, parseChordNames, TYPING_CHIPS, typedLabel };

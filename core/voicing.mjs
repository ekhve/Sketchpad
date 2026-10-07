/* core/voicing — Putting a chord's intervals into actual notes: the octave they sit in, stacking extensions, the voicings of a chord, arpeggios, and choosing the voicing that moves least from the last.
   Layer 2. Depends on: core/chords, core/notes. Pure: no React, no Tone, no DOM, no dates, no randomness.
   Interface, behaviour and requirements: core/MODULES.md (voicing).
   Moved verbatim from the THEORY block of sketchpad.jsx (D-096); behaviour unchanged. */

import { DEGREE_NAMES, DICTIONARY } from "./chords.mjs";
import { pc, noteName } from "./notes.mjs";


/* Chords are built in whichever octave the keyboard is showing. They used to
   be pinned to C3 regardless, so shifting the keyboard moved the picture and
   left the sound where it was. (D-007, D-060) */
const DEFAULT_BASE = 48;

function voice(rootPc, intervals, base = DEFAULT_BASE) {
  const root = base + rootPc;
  return intervals.map((i) => root + i);
}

/* Stack scale tones upward instead of folding them into one octave. A ninth
   has to sit above the seventh; reduced to a pitch class it becomes a second
   and the chord turns to mud. (D-035) */
function stackAscending(tones, rootPc) {
  let last = -1;
  return tones.map((t) => {
    let i = pc(t - rootPc);
    while (i <= last) i += 12;
    last = i;
    return i;
  });
}

function dictionaryFor(rootPc, base = DEFAULT_BASE) {
  return DICTIONARY.map((d) => ({
    id: `dict-${rootPc}-${d.q}`,
    rootPc, sym: d.q, full: d.full, plain: d.plain,
    formula: d.iv.map((i) => DEGREE_NAMES[i] ?? String(i)).join(" – "),
    notes: voice(rootPc, d.iv, base),
    base,
  }));
}

/* ---- voicings: the J-6 lesson, applied. (D-042, UC-35) ----
   The same chord arranged differently. Close is what the app has always
   played; the rest are what make a chord sound like a record rather than an
   exercise. Some deliberately drop notes — that is the point of them. */
function voicingsFor(chord) {
  /* Arrangements are derived from the chord's CLOSE position, never from
     whatever arrangement it is currently wearing. Choosing one used to rewrite
     the chord's notes, so the next list was built from the previous choice and
     every option collapsed towards the others. (D-065) */
  const entry = DICTIONARY.find((d) => d.q === chord.sym);
  /* The octave comes from the chord itself. Inferring it from the lowest note
     meant a spread voicing, whose root sits an octave down, re-derived the
     whole chord an octave lower the next time it was asked. (D-065) */
  const base = chord.base ?? Math.floor(Math.min(...chord.notes) / 12) * 12;
  const notes = entry
    ? voice(chord.rootPc, entry.iv, base)
    : [...chord.notes].sort((a, b) => a - b);
  const out = [{ id: "close", name: "Close", notes,
                 why: "Every note as tightly packed as possible. Clear, and a little plain." }];

  /* Extended chords depend on their spacing far more than on their notes: a
     minor 11th stacked in thirds is mud, and in fourths it is the sound people
     mean by the name. Where the dictionary knows the spacing, offer it. (D-059) */
  if (entry?.voicing) {
    out.push({ id: "signature", name: "Signature", notes: voice(chord.rootPc, entry.voicing, base),
               why: "The spacing this chord is usually played with. Wider, and it stops sounding like a stack." });
  }

  if (notes.length >= 3) {
    /* Drop-2 for small chords. For five notes and up, drop-2-and-4: dropping a
       single note out of a six-note stack leaves the rest just as crowded,
       which is why the big extended chords all sounded alike. (D-065) */
    const dropped = [...notes];
    dropped[dropped.length - 2] -= 12;
    if (notes.length >= 5) dropped[dropped.length - 4] -= 12;
    out.push({ id: "open", name: "Open", notes: [...dropped].sort((a, b) => a - b),
               why: notes.length >= 5
                 ? "Two inner notes dropped an octave. The gaps are what stop a big chord turning to mud."
                 : "One inner note dropped an octave. More air between the notes." });
  }

  if (notes.length >= 3) {
    out.push({ id: "spread", name: "Spread", notes: [notes[0] - 12, ...notes.slice(1)],
               why: "Root well below the rest. Sounds big, and leaves room for a bassline." });
  }

  if (notes.length >= 4) {
    out.push({ id: "rootless", name: "Rootless", notes: notes.slice(1),
               why: "No root at all — the bass covers it. The chord floats." });
    out.push({ id: "shell", name: "Shell", notes: [notes[0], notes[1], notes[3]],
               why: "Root, third and seventh only. The fifth adds nothing here." });
  }

  return out.map((v) => ({ ...v, notes: v.notes.slice(0, 8) }));
}

/* Which notes stay put between two chords, and which have to move. (UC-39) */
function voiceLeading(from, to, system = "letters") {
  const a = [...new Set(from.notes.map(pc))];
  const b = [...new Set(to.notes.map(pc))];
  const common = a.filter((p) => b.includes(p));
  const leaving = a.filter((p) => !b.includes(p));
  const arriving = b.filter((p) => !a.includes(p));

  /* pair each departing note with its nearest arrival */
  const moves = [];
  const unclaimed = [...arriving];
  for (const p of leaving) {
    let best = null, bestDist = 99;
    for (const q of unclaimed) {
      const d = Math.min(pc(q - p), pc(p - q));
      if (d < bestDist) { bestDist = d; best = q; }
    }
    if (best !== null) {
      unclaimed.splice(unclaimed.indexOf(best), 1);
      moves.push({ from: p, to: best, semitones: bestDist });
    } else {
      moves.push({ from: p, to: null, semitones: null });
    }
  }
  for (const q of unclaimed) moves.push({ from: null, to: q, semitones: null });

  const distance = moves.reduce((n, m) => n + (m.semitones ?? 2), 0);
  return {
    common, moves, distance,
    smoothness: common.length >= 2 ? "very smooth" : common.length === 1 ? "smooth" : "a real move",
    why: common.length
      ? `${common.map((p) => noteName(p, system)).join(" and ")} stay${common.length === 1 ? "s" : ""} where ${common.length === 1 ? "it is" : "they are"}. Only ${moves.filter((m) => m.from !== null).length} note${moves.filter((m) => m.from !== null).length === 1 ? "" : "s"} moves.`
      : "Nothing is held over — every note moves. Use it where you want a lift.",
  };
}

/* Arpeggios: the same notes, one at a time. (UC-43) */
function arpeggio(notes, direction = "up") {
  const asc = [...notes].sort((a, b) => a - b);
  if (direction === "down") return [...asc].reverse();
  if (direction === "updown") return [...asc, ...asc.slice(0, -1).reverse().slice(0, -1)];
  return asc;
}

/* Of the ways to play the next chord, which moves the least? (UC-44) */
function smoothestVoicing(from, to, system = "letters") {
  const options = voicingsFor(to);
  const scored = options.map((v) => {
    const distance = v.notes.reduce((sum, n) => {
      const nearest = from.notes.reduce((best, f) => Math.min(best, Math.abs(f - n)), 99);
      return sum + nearest;
    }, 0) / v.notes.length;
    return { ...v, distance };
  }).sort((a, b) => a.distance - b.distance);

  const best = scored[0];
  const held = voiceLeading(from, to).common;
  return {
    ...best,
    why: held.length
      ? `Of the ${options.length} ways to play it, this one moves least — ${held.map((p) => noteName(p, system)).join(" and ")} stay where they are.`
      : `Of the ${options.length} ways to play it, this one asks the hands to travel least.`,
    alternatives: scored.slice(1),
  };
}

export { DEFAULT_BASE, voice, stackAscending, dictionaryFor, voicingsFor, voiceLeading, arpeggio, smoothestVoicing };

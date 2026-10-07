/* core/figures — Rhythm as authored intent with pitch chosen by rule: bass lines and riffs from patterns, planned bar by bar into events, notes with a start, a length and a velocity.
   Layer 1. Depends on: core/notes. Pure: no React, no Tone, no DOM, no dates, no randomness.
   Interface, behaviour and requirements: core/MODULES.md (figures).
   Moved verbatim from the THEORY block of sketchpad.jsx (D-096); behaviour unchanged. */

import { pc, noteName } from "./notes.mjs";


/* ============================================================================
   RHYTHM AND FIGURES — basslines and riffs. (D-022, D-023, UC-29)

   Two ingredients, deliberately separated:
     PATTERN — authored rhythm and intent. Says "root on 1, chord tone on the
               and-of-2, approach the next chord at the end". Says nothing
               about pitch, so one pattern works over every chord in every key.
     RULES   — resolve each intent to an actual note using the current chord,
               the next chord, and the active scale.

   Authored rhythm is what makes a figure sound like a genre; generated pitch
   is what makes it fit the user's harmony. Doing both by rule sounds generic;
   doing both by hand doesn't transpose. (D-023)
   ========================================================================== */

const STEPS_PER_BAR = 16;                     // sixteenth notes

/* Seeded so "suggest again" is reproducible and testable. Pure: same seed in,
   same figure out — no Math.random anywhere in this file. */
function rng(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PATTERNS = [
  /* --- bass --- */
  { id: "bass-anchor", name: "Anchored", kind: "bass", styles: ["hip-hop", "cinematic"],
    note: "Root on the downbeat and nothing clever, letting the drums breathe.",
    steps: [{ p: 0, d: 6, r: "root" }, { p: 8, d: 6, r: "root" }] },

  { id: "bass-octave", name: "Octave push", kind: "bass", styles: ["house", "funk"],
    note: "Root and its octave alternating — the engine of four-to-the-floor.",
    steps: [{ p: 0, d: 2, r: "root" }, { p: 4, d: 2, r: "octave" },
            { p: 8, d: 2, r: "root" }, { p: 12, d: 2, r: "octave" }] },

  { id: "bass-walk", name: "Walk to the next chord", kind: "bass", styles: ["soul", "west coast"],
    note: "Sits on the root, then steps up to meet the next chord.",
    steps: [{ p: 0, d: 4, r: "root" }, { p: 6, d: 2, r: "fifth" },
            { p: 10, d: 2, r: "chordTone" }, { p: 14, d: 2, r: "approach" }] },

  { id: "bass-sixteenths", name: "Syncopated", kind: "bass", styles: ["funk", "soul"],
    note: "Sixteenth-note push and pull, leaving holes on purpose.",
    steps: [{ p: 0, d: 1, r: "root" }, { p: 3, d: 1, r: "root" },
            { p: 6, d: 2, r: "fifth" }, { p: 10, d: 1, r: "root" },
            { p: 11, d: 1, r: "octave" }, { p: 14, d: 2, r: "approach" }] },

  { id: "bass-hold", name: "Held root", kind: "bass", styles: ["cinematic", "west coast"],
    note: "One note per chord, all bar, so everything else gets room.",
    steps: [{ p: 0, d: 16, r: "root" }] },

  /* --- melody --- */
  { id: "bass-dub", name: "Dub drop", kind: "bass", styles: ["house", "hip-hop"],
    note: "Nothing on the downbeat, because the space is the hook.",
    steps: [{ p: 2, d: 4, r: "root" }, { p: 10, d: 4, r: "fifth" }] },

  { id: "bass-eighths", name: "Rolling eighths", kind: "bass", styles: ["funk", "cinematic"],
    note: "Steady eighths that never stop, driving everything above them.",
    steps: [{ p: 0, d: 2, r: "root" }, { p: 2, d: 2, r: "root" },
            { p: 4, d: 2, r: "fifth" }, { p: 6, d: 2, r: "root" },
            { p: 8, d: 2, r: "root" }, { p: 10, d: 2, r: "octave" },
            { p: 12, d: 2, r: "fifth" }, { p: 14, d: 2, r: "approach" }] },

  { id: "bass-pushed", name: "Pushed", kind: "bass", styles: ["soul", "west coast"],
    note: "Lands just before the beat, making the whole loop lean forward.",
    steps: [{ p: 0, d: 3, r: "root" }, { p: 7, d: 2, r: "chordTone" },
            { p: 11, d: 2, r: "fifth" }, { p: 15, d: 1, r: "approach" }] },

  { id: "riff-hook", name: "Pentatonic hook", kind: "melody", styles: ["hip-hop", "west coast"],
    note: "A short repeating shape with chord tones on the strong beats.",
    steps: [{ p: 0, d: 2, r: "chordTone" }, { p: 2, d: 2, r: "step" },
            { p: 6, d: 2, r: "chordTone" }, { p: 10, d: 2, r: "step" },
            { p: 12, d: 4, r: "chordTone" }] },

  { id: "riff-sparse", name: "Sparse and late", kind: "melody", styles: ["soul", "cinematic"],
    note: "Enters after the beat, because space is most of the sound.",
    steps: [{ p: 2, d: 4, r: "top" }, { p: 8, d: 2, r: "step" }, { p: 11, d: 5, r: "chordTone" }] },

  { id: "riff-stabs", name: "Stabs", kind: "melody", styles: ["funk", "house"],
    note: "Percussive and off the grid, with rhythm doing the work.",
    steps: [{ p: 0, d: 1, r: "top" }, { p: 3, d: 1, r: "chordTone" },
            { p: 7, d: 1, r: "top" }, { p: 10, d: 1, r: "chordTone" }, { p: 11, d: 1, r: "step" }] },

  { id: "riff-rise", name: "Rising line", kind: "melody", styles: ["cinematic", "house"],
    note: "Climbs through the scale into the next chord.",
    steps: [{ p: 0, d: 2, r: "root" }, { p: 4, d: 2, r: "stepUp" },
            { p: 8, d: 2, r: "stepUp" }, { p: 12, d: 4, r: "approach" }] },

  { id: "riff-call", name: "Call and answer", kind: "melody", styles: ["soul", "hip-hop"],
    note: "A short phrase, a gap, then a reply a little lower.",
    steps: [{ p: 0, d: 2, r: "top" }, { p: 2, d: 2, r: "step" },
            { p: 8, d: 2, r: "chordTone" }, { p: 10, d: 4, r: "stepDown" }] },

  { id: "riff-motif", name: "Two-note motif", kind: "melody", styles: ["cinematic", "west coast"],
    note: "Two notes repeated, so that you remember them.",
    steps: [{ p: 0, d: 3, r: "chordTone" }, { p: 4, d: 3, r: "step" },
            { p: 8, d: 3, r: "chordTone" }, { p: 12, d: 3, r: "step" }] },

  { id: "riff-arp", name: "Arpeggio up", kind: "melody", styles: ["house", "cinematic"],
    note: "The chord one note at a time, climbing, never surprising.",
    steps: [{ p: 0, d: 2, r: "root" }, { p: 2, d: 2, r: "third" },
            { p: 4, d: 2, r: "fifth" }, { p: 6, d: 2, r: "top" },
            { p: 8, d: 2, r: "fifth" }, { p: 10, d: 2, r: "third" }] },

  { id: "riff-tumble", name: "Tumbling", kind: "melody", styles: ["funk", "hip-hop"],
    note: "Falls quickly through the scale and catches on a chord tone.",
    steps: [{ p: 0, d: 1, r: "top" }, { p: 1, d: 1, r: "stepDown" },
            { p: 2, d: 1, r: "stepDown" }, { p: 3, d: 1, r: "stepDown" },
            { p: 6, d: 2, r: "chordTone" }, { p: 12, d: 4, r: "chordTone" }] },

  { id: "riff-fall", name: "Falling line", kind: "melody", styles: ["soul", "west coast"],
    note: "Drops from the top of the chord down through the scale.",
    steps: [{ p: 0, d: 2, r: "top" }, { p: 4, d: 2, r: "stepDown" },
            { p: 8, d: 2, r: "stepDown" }, { p: 12, d: 4, r: "chordTone" }] },
];

const STYLES = ["hip-hop", "soul", "funk", "house", "west coast", "cinematic"];
const patternsFor = (kind, style) => PATTERNS.filter((p) => p.kind === kind && p.styles.includes(style));

/* Nearest midi with this pitch class to a reference note. Keeps figures from
   leaping an octave between consecutive notes. */
function place(pitchClass, near) {
  const base = near - (((near % 12) - pitchClass + 12) % 12);
  return Math.abs(base - near) <= Math.abs(base + 12 - near) ? base : base + 12;
}

/* Resolve one pattern over one chord. Pure. (UC-29) */
function renderFigure(pattern, chord, nextChord, scaleSet, seed, center) {
  const r = rng(seed);
  const rootPc = chord.rootPc;
  const intervals = chord.notes.map((m) => pc(m - chord.notes[0]));
  const has = (i) => intervals.includes(i);
  const third = has(3) ? 3 : has(4) ? 4 : null;
  const fifth = has(7) ? 7 : has(6) ? 6 : has(8) ? 8 : null;
  const out = [];
  let prev = null;

  for (const s of pattern.steps) {
    let midi = null;
    const ref = prev ?? center;

    switch (s.r) {
      case "root":
        midi = place(rootPc, center);
        break;
      case "octave":
        midi = place(rootPc, center) + 12;
        break;
      case "fifth":
        midi = fifth === null ? place(rootPc, ref) : place(pc(rootPc + fifth), ref);
        break;
      case "third":
        midi = third === null ? place(rootPc, ref) : place(pc(rootPc + third), ref);
        break;
      case "top":
        midi = place(pc(rootPc + intervals[intervals.length - 1]), ref);
        break;
      case "chordTone": {
        const i = intervals[Math.floor(r() * intervals.length)];
        midi = place(pc(rootPc + i), ref);
        break;
      }
      case "step":
      case "stepUp":
      case "stepDown": {
        /* move to an adjacent scale note; direction is the pattern's choice
           when it declares one, otherwise the seed decides */
        const up = s.r === "stepUp" ? true : s.r === "stepDown" ? false : r() < 0.5;
        const sorted = [...scaleSet].sort((a, b) => a - b);
        const here = prev === null ? place(rootPc, center) : prev;
        let cand = null;
        for (let k = 1; k <= 12 && cand === null; k++) {
          const test = here + (up ? k : -k);
          if (sorted.includes(pc(test))) cand = test;
        }
        midi = cand ?? here;
        break;
      }
      case "approach": {
        /* lean into the next chord: a semitone below its root, or the nearest
           scale note above it. This is the one place a note may leave the scale. */
        const target = nextChord ? nextChord.rootPc : rootPc;
        const t = place(target, ref);
        midi = r() < 0.6 ? t - 1 : t + 1;
        break;
      }
      default:
        continue;
    }
    if (midi === null) continue;
    out.push({ midi, pos: s.p, dur: s.d, role: s.r });
    prev = midi;
  }
  return out;
}

/* A figure for every chord in the progression. (UC-29) */
function renderProgressionFigure(pattern, progression, scaleSet, seed, center) {
  return progression.map((chord, i) =>
    renderFigure(pattern, chord, progression[(i + 1) % progression.length], scaleSet, seed + i * 7919, center)
  );
}

/* Explain a figure in plain language. (D-011) */
function explainFigure(pattern, figure, system = "letters") {
  const strong = figure.filter((n) => n.pos % 4 === 0);
  const approaches = figure.filter((n) => n.role === "approach");
  const bits = [pattern.note];
  if (strong.length) bits.push(`Lands on ${strong.map((n) => noteName(n.midi, system)).join(", ")} on the strong beats.`);
  if (approaches.length) bits.push("The last note leans into the next chord from a semitone away — that pull is what makes the change feel intended.");
  return bits.join(" ");
}


/* ============================================================================
   BAR SCHEDULING — pure, so the bug class that caused it can be tested. (D-031)

   Every event carries a start time and a duration in SECONDS, and no two events
   on the same voice may overlap. The previous version built duration strings
   like "4*16n" and handed them to the audio library's text parser, which is
   both fragile and free to produce a note longer than the gap before the next
   one — which is exactly how notes piled up until the synth ran out of voices.
   ========================================================================== */

const VOICES = ["chord", "bass", "riff"];

/* Chords sit under the melody rather than competing with it, so the mix is a
   property of the plan and can be checked like anything else. (D-034) */
const VELOCITY = { chord: 0.5, bass: 0.85, riff: 0.8 };

function planBar({ chordNotes = [], bassFigure = [], riffFigure = [],
                   sixteenth, barSeconds, gap = 0.05 }) {
  const events = [];

  if (chordNotes.length) {
    events.push({ voice: "chord", notes: [...chordNotes], at: 0,
                  dur: Math.max(0.1, barSeconds * 0.5 - gap), vel: VELOCITY.chord });
  }

  for (const [voice, figure] of [["bass", bassFigure], ["riff", riffFigure]]) {
    const sorted = [...figure].sort((a, b) => a.pos - b.pos);
    sorted.forEach((n, i) => {
      const at = n.pos * sixteenth;
      const nextAt = i + 1 < sorted.length ? sorted[i + 1].pos * sixteenth : barSeconds;
      /* never longer than the room available before the next note on this voice */
      const dur = Math.max(0.05, Math.min(n.dur * sixteenth, nextAt - at - gap));
      events.push({ voice, notes: [n.midi], at, dur, role: n.role, vel: VELOCITY[voice] });
    });
  }
  return events.sort((a, b) => a.at - b.at);
}

/* True when no voice is ever asked to hold two notes at once, and nothing
   spills past the end of the bar. (R-118) */
function planIsClean(events, barSeconds) {
  for (const voice of VOICES) {
    const v = events.filter((e) => e.voice === voice).sort((a, b) => a.at - b.at);
    for (let i = 0; i < v.length; i++) {
      if (v[i].dur <= 0) return false;
      if (v[i].at < 0 || v[i].at >= barSeconds) return false;
      if (i + 1 < v.length && v[i].at + v[i].dur > v[i + 1].at + 1e-9) return false;
    }
  }
  return true;
}

export { STEPS_PER_BAR, rng, PATTERNS, STYLES, patternsFor, place, renderFigure, renderProgressionFigure, explainFigure, VOICES, VELOCITY, planBar, planIsClean };

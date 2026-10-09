/* sketchpad/model — What the Sketchpad shell shows: the levels and the features each adds, which tabs exist at each level, and which chord is active when none is selected.
   Layer 4. Depends on: core/arpeggio, core/instruments, core/notes. Pure: no React, no Tone, no DOM, no dates, no randomness.
   Interface, behaviour and requirements: sketchpad/MODULES.md (model).
   Moved from the THEORY block of sketchpad.jsx (D-096); namingFor added (D-097).
   Everything else is unchanged. */

import { spelling } from "../core/notes.mjs";
import { ECHO_LEVELS, INSTRUMENTS, SPACES } from "../core/instruments.mjs";
import { PLAY_PATTERNS } from "../core/arpeggio.mjs";




/* How notes are written in Sketchpad: sharps (the default) or the way the key
   writes them. The plain systems spell every black key as a sharp, so "sharps"
   is the base system unchanged. (D-097, D-019, D-074) */
function namingFor({ base = "letters", accidentals = "sharps", tonic = 0, mode = "major" } = {}) {
  return accidentals === "key" ? spelling(base, tonic, mode) : base;
}

/* The sound options, as the panel offers them: what the notes sound like, how a chord is
   struck, how much reverb, and echo. Built from the catalogues, so a new instrument or
   room appears without the panel being touched. Each is a choice of one. (D-105) */
function soundSections() {
  const from = (list) => list.map((x) => ({ id: x.id, name: x.name, note: x.note }));
  return [
    { id: "instrument", label: "Sound", options: from(INSTRUMENTS) },
    { id: "played", label: "Played", options: from(PLAY_PATTERNS) },
    { id: "room", label: "Reverb", options: from(SPACES) },
    { id: "echo", label: "Echo", options: from(ECHO_LEVELS) },
  ];
}

/* Which chord should the Bass and Theory tabs describe? (D-039)

   They used to require an explicitly selected chord, so a user who built a
   loop with the "add" button — never tapping a chord pad — found those tabs
   empty and no explanation of why. Fall back to something sensible instead:
   what is playing, then what they built, then the home chord. */
function activeChordFor({ selected = null, playingIndex = -1, progression = [], palette = [] }) {
  if (selected) return selected;
  if (playingIndex >= 0 && progression[playingIndex]) return progression[playingIndex];
  if (progression.length) return progression[0];
  return palette[0] ?? null;
}


/* ============================================================================
   THE GUIDE — content as data, so a tab can never quietly go undocumented.
   (D-050)
   ========================================================================== */

const TAB_IDS = ["chords", "find", "scales", "prog", "bass", "theory", "sheet", "learn", "guide"];


/* ============================================================================
   LEVELS — how much of the app is on screen. (D-058, UC-54)

   Feedback on first use: too much at once. The old Beginner/Producer toggle
   changed how things were *described* and never what was *shown*, which is the
   wrong axis. A level chooses the surface; depth follows from it.

   Levels are cumulative, so nothing a user has found ever moves or disappears.
   ========================================================================== */

const LEVELS = [
  { id: "start", name: "Start",
    /* Lessons are here, not at Study: learning is the mode with the fewest
       prerequisites, so it has to be reachable on the first screen. (D-073) */
    note: "A key, some chords, a loop, and lessons to practise. Enough to make something in a minute.",
    adds: ["key", "piano", "sound", "chords", "scales", "loop", "explain", "lessons", "guide"] },
  { id: "produce", name: "Produce",
    note: "The working tools: richer chords, voicings, chord sets, bass, riffs and the printable sheet.",
    adds: ["sevenths", "voicings", "sets", "tension", "find", "bass", "riffs", "sheet", "numerals", "naming"] },
  { id: "study", name: "Study",
    note: "Where everything comes from: the dictionary, inversions, harmonisation and the formal wording.",
    adds: ["theory", "dictionary", "inversions", "harmonise", "formal", "melodyGuide"] },
];

const levelIndex = (id) => Math.max(0, LEVELS.findIndex((l) => l.id === id));

/* Everything available at this level and every level below it. */
function featuresAt(levelId) {
  const upto = levelIndex(levelId);
  return new Set(LEVELS.slice(0, upto + 1).flatMap((l) => l.adds));
}

const has = (levelId, feature) => featuresAt(levelId).has(feature);

const TABS_BY_FEATURE = {
  chords: "chords", find: "find", scales: "scales", loop: "prog",
  bass: "bass", theory: "theory", sheet: "sheet", lessons: "learn", guide: "guide",
};

/* Tabs in a fixed order, so a tab never moves when a new one appears. */
function tabsAt(levelId) {
  const available = featuresAt(levelId);
  return TAB_IDS.filter((id) => {
    const feature = Object.entries(TABS_BY_FEATURE).find(([, t]) => t === id)?.[0];
    return feature ? available.has(feature) : false;
  });
}

/* The main scenario has to be completable at the simplest level, or the split
   is wrong. These are the features UC-00 actually needs. (D-058) */
const UC00_NEEDS = ["key", "piano", "sound", "chords", "scales", "loop", "explain"];

export { soundSections, namingFor, activeChordFor, TAB_IDS, LEVELS, levelIndex, featuresAt, has, TABS_BY_FEATURE, tabsAt, UC00_NEEDS };

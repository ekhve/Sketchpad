/* core/chordsets — Genre chord sets: eight chords and a ready-made progression per set, built in any key.
   Layer 3. Depends on: core/chords, core/notes, core/voicing. Pure: no React, no Tone, no DOM, no dates, no randomness.
   Interface, behaviour and requirements: core/MODULES.md (chordsets).
   Moved verbatim from the THEORY block of sketchpad.jsx (D-096); behaviour unchanged. */

import { DICTIONARY } from "./chords.mjs";
import { pc } from "./notes.mjs";
import { DEFAULT_BASE, voice } from "./voicing.mjs";


/* ---- chord sets: 8 slots plus a progression, authored in C and transposed.
   Structure borrowed from the J-6; the content is ours. (D-014) ---- */
const CHORD_SETS = [
  { id: "neo-soul", name: "Neo-soul keys", mode: "minor",
    note: "Extended minor chords with a maj7 lift. Slow, warm, harmonically rich.",
    slots: [[0,"m9"],[5,"m7"],[8,"maj7"],[10,"7"],[3,"maj9"],[7,"m7"],[2,"m7♭5"],[8,"maj9"]],
    progression: [0,2,4,3], why: "Home, then a warm lift, a bright step up, and a push back." },

  { id: "lofi", name: "Lo-fi loop", mode: "minor",
    note: "Four chords that go round forever without demanding attention.",
    slots: [[0,"m7"],[5,"m7"],[10,"maj7"],[3,"maj7"],[8,"maj7"],[7,"m7"],[0,"m9"],[5,"m9"]],
    progression: [0,3,1,2], why: "Never resolves hard, so the loop never asks you to stop." },

  { id: "house", name: "House stabs", mode: "minor",
    note: "Short minor sevenths built to be chopped and played on the offbeat.",
    slots: [[0,"m7"],[3,"maj7"],[5,"m7"],[7,"m7"],[10,"7"],[8,"maj7"],[0,"m9"],[5,"m9"]],
    progression: [0,2,1,4], why: "A rising line under a repeating groove." },

  { id: "motown", name: "Soul changes", mode: "major",
    note: "Bright, moving harmony with a strong pull home.",
    slots: [[0,"maj7"],[9,"m7"],[2,"m7"],[7,"7"],[5,"maj7"],[4,"m7"],[0,"6"],[7,"9"]],
    progression: [0,1,2,3], why: "The oldest working progression in popular music: home, sad, motion, return." },

  { id: "jazz", name: "ii – V – I", mode: "major",
    note: "The sentence jazz is built from. Everything else is a variation on it.",
    slots: [[2,"m7"],[7,"7"],[0,"maj7"],[9,"m7"],[4,"m7"],[5,"maj7"],[2,"m9"],[7,"9"]],
    progression: [0,1,2,2], why: "Tension, more tension, release — then sit on the release." },

  { id: "westcoast", name: "West coast", mode: "minor",
    note: "Sustained minor chords with a melodic bass underneath. Space, not density.",
    slots: [[0,"m9"],[0,"m7"],[10,"maj7"],[5,"m9"],[3,"maj9"],[8,"maj7"],[7,"m7"],[0,"sus4"]],
    progression: [0,2,3,1], why: "Barely moves. The bass and the melody do the travelling." },

  { id: "trap", name: "Dark loop", mode: "minor",
    note: "Two or three chords, mostly plain, with one tense one to lean on.",
    slots: [[0,"m"],[1,"maj7"],[8,"maj7"],[5,"m"],[0,"m9"],[3,"maj7"],[10,""],[7,"m"]],
    progression: [0,1,0,2], why: "The ♭II is borrowed from Phrygian — one foreign chord is what makes it dark." },

  { id: "gospel", name: "Gospel turns", mode: "major",
    note: "Chords that move a lot in a small space. Built to be played, not held.",
    slots: [[0,"maj7"],[2,"m7"],[4,"m7"],[5,"maj7"],[7,"7"],[9,"m9"],[10,"7"],[0,"6"]],
    progression: [0,2,1,4], why: "Down and back up, landing on a dominant that wants to go home." },

  { id: "bossa", name: "Bossa", mode: "major",
    note: "Sevenths and ninths that lean on each other. Sparse and even.",
    slots: [[0,"maj9"],[2,"m7"],[7,"9"],[9,"m9"],[5,"maj7"],[4,"m7"],[11,"m7♭5"],[7,"7"]],
    progression: [1,2,0,0], why: "Two chords of tension, then two bars to sit in the release." },

  { id: "boombap", name: "Boom bap", mode: "minor",
    note: "Sampled-sounding minor harmony. Warm, slightly out of tune with itself.",
    slots: [[0,"m7"],[3,"maj7"],[8,"maj9"],[5,"m7"],[10,"7"],[0,"m9"],[7,"m7"],[2,"m7♭5"]],
    progression: [0,2,4,0], why: "Away, up, a push, and straight back. Four bars that never get tired." },

  { id: "ambient", name: "Ambient major", mode: "major",
    note: "Slow, open and unhurried. Suspensions instead of resolutions.",
    slots: [[0,"maj9"],[5,"maj7"],[7,"sus4"],[9,"m9"],[2,"m7"],[0,"sus2"],[4,"m7"],[5,"maj9"]],
    progression: [0,1,3,2], why: "Nothing lands hard, so it can run for as long as you like." },

  { id: "storybook", name: "Storybook", mode: "major",
    note: "Wide, wandering major harmony. Lush extensions that never quite settle.",
    slots: [[0,"maj13"],[5,"maj7♯11"],[9,"m11"],[2,"m(add9)"],[7,"sus4(9)"],[4,"m13"],[10,"maj13"],[0,"6/9"]],
    progression: [0,1,2,4], why: "Two lush major chords, a wide minor, then a suspension that refuses to resolve." },

  { id: "quest", name: "Wandering minor", mode: "minor",
    note: "Minor elevenths and thirteenths, spaced wide. Room for a melody to travel over.",
    slots: [[0,"m11"],[8,"maj13"],[3,"maj7♯11"],[5,"m13"],[10,"6/9"],[7,"sus4(9)"],[0,"m(add9)"],[1,"maj7"]],
    progression: [0,1,3,2], why: "Home, a warm lift, a wide minor and a floating major — it travels and comes back." },

  { id: "cinematic", name: "Cinematic minor", mode: "minor",
    note: "Open, slow, unresolved. Room for something to happen over it.",
    slots: [[0,"m"],[8,"maj7"],[3,"maj7"],[10,""],[5,"m"],[7,"m"],[0,"sus4"],[5,"m9"]],
    progression: [0,1,3,2], why: "Falls away from home and only half comes back." },
];

function buildSet(setDef, tonicPc, base = DEFAULT_BASE) {
  const chords = setDef.slots.map(([offset, sym], i) => {
    const rootPc = pc(tonicPc + offset);
    const entry = DICTIONARY.find((d) => d.q === sym);
    const iv = entry ? entry.iv : [0, 4, 7];
    return { id: `${setDef.id}-${i}`, rootPc, sym, full: entry?.full ?? "chord",
             notes: voice(rootPc, iv, base), base, degreeIndex: 0, roman: "" };
  });
  return { ...setDef, chords, progressionChords: setDef.progression.map((i) => chords[i]) };
}

const setsFor = (mode) => CHORD_SETS.filter((s) => s.mode === mode);

export { CHORD_SETS, buildSet, setsFor };

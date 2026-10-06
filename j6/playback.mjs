/* Playing the progression back: tempo, length per chord, loop, click. (D-090)

   Not a sequencer: no steps, no swing, no per-chord lengths, nothing saved.
   Every chord in the progression gets the same length. Pure: this decides
   what happens on each beat; the page schedules the beats with Sketchpad's
   own look-ahead scheduler (D-043) and makes the sound. */
import { barSecondsAt } from "../tests/theory.mjs";

export const TEMPO = { min: 60, max: 160, start: 90, step: 5 };
/** Bars per chord: half a bar, one bar, two bars. */
export const LENGTHS = [0.5, 1, 2];
export const OPTIONS = { bpm: TEMPO.start, bars: 1, loop: true, click: false };
const BEATS_PER_BAR = 4;

export const setTempo = (bpm) => Math.max(TEMPO.min, Math.min(TEMPO.max, Math.round(bpm)));
export const beatSeconds = (bpm) => barSecondsAt(bpm, 1);

/** What happens on beat n of a play-through, counting from the first beat after Play:
 *  { chord: index of the chord that starts here, or null; click: "accent" | "beat" | null;
 *    end: true once a single pass is over }. With the click on, one bar is counted in
 *  first; the click then marks every beat, the first of each bar stronger. */
export function beatAt(n, count, { bars, loop, click }) {
  const countIn = click ? BEATS_PER_BAR : 0;
  if (n < countIn) return { chord: null, click: n === 0 ? "accent" : "beat", end: false };
  const perChord = bars * BEATS_PER_BAR;
  const pass = count * perChord;
  const m = n - countIn;
  if (!count || (!loop && m >= pass)) return { chord: null, click: null, end: true };
  const k = m % pass;
  return {
    chord: k % perChord === 0 ? k / perChord : null,
    click: click ? (k % BEATS_PER_BAR === 0 ? "accent" : "beat") : null,
    end: false,
  };
}

/** How long a chord sounds, in seconds: its length, less a breath before the next. */
export const chordSeconds = ({ bpm, bars }) => bars * BEATS_PER_BAR * beatSeconds(bpm) * 0.92;

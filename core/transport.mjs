/* core/transport — Playing a progression over time: tempo, bars per chord, loop, click with a count-in, and the driver that keeps asking the scheduler what is due. For any app that plays a loop.
   Layer 1. Depends on: core/playback. Pure: no React, no Tone, no DOM, no dates, no randomness.
   Interface, behaviour and requirements: core/MODULES.md (transport).
   Taken from the J-6 Explorer's playback model (D-090) and the two apps' copies of the loop driver (D-043), joined into one (D-098). */

import { barSecondsAt, barsToSchedule } from "./playback.mjs";


/* ============================================================================
   WHAT HAPPENS ON EACH BEAT — arithmetic, no sound. (D-090)

   Not a sequencer: no steps, no swing, no per-chord lengths, nothing saved.
   Every chord in a progression gets the same length. This decides what each
   beat holds; the app schedules the beats and makes the sound.
   ========================================================================== */

const TEMPO = { min: 60, max: 160, start: 90, step: 5 };
/** Bars per chord: half a bar, one bar, two bars. */
const LENGTHS = [0.5, 1, 2];
const OPTIONS = { bpm: TEMPO.start, bars: 1, loop: true, click: false };
const BEATS_PER_BAR = 4;

const setTempo = (bpm) => Math.max(TEMPO.min, Math.min(TEMPO.max, Math.round(bpm)));
const beatSeconds = (bpm) => barSecondsAt(bpm, 1);

/** What happens on beat n of a play-through, counting from the first beat after Play:
 *  { chord: index of the chord that starts here, or null; click: "accent" | "beat" | null;
 *    end: true once a single pass is over }. With the click on, one bar is counted in
 *  first; the click then marks every beat, the first of each bar stronger. */
function beatAt(n, count, { bars, loop, click }) {
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
const chordSeconds = ({ bpm, bars }) => bars * BEATS_PER_BAR * beatSeconds(bpm) * 0.92;

/** Which chord of a loop a unit (a bar or a beat, counted from the start) lands on; null for an empty loop. */
const loopIndex = (unit, length) => (length > 0 ? unit % length : null);


/* ============================================================================
   THE DRIVER — one look-ahead loop for every app. (D-043, D-098)

   Both apps ran the same loop by hand: note where the clock is, ask which units
   (bars, or beats) start inside the next half second, hand each to the app, ask
   again shortly. The clock and the timer are the only things that touch the
   world, so they are arguments: the app passes Tone's clock and the browser's
   timer, a test passes a fake pair and steps time by hand.
   ========================================================================== */

/** Where a play-through starts: `lead` seconds from now, so the first unit is never late. */
const startCursor = (now, lead = 0.15) => ({ nextBarAt: now + lead, barIndex: 0 });

/** The units due inside the window, and the cursor after them. A unit is { at, index }. */
function advance(cursor, now, lookahead, unitSeconds) {
  const { bars, state } = barsToSchedule(cursor, now, lookahead, unitSeconds);
  return { units: bars, cursor: state };
}

/** A driver over a clock and a timer: `now()` in seconds, `every(fn, ms)` returning a handle, `cancel(handle)`.
 *  `start({ unitSeconds, onUnit })` ticks at once and then every `interval` ms. `unitSeconds()` is read on
 *  every tick, so a tempo change takes effect on the next unit. `onUnit({ at, index })` may return "end",
 *  which stops the driver and drops the rest of that tick's units. */
function createDriver({ now, every, cancel }) {
  let timer = null, cursor = null;
  const stop = () => { if (timer !== null) cancel(timer); timer = null; };
  return {
    get running() { return timer !== null; },
    start({ unitSeconds, onUnit, lead = 0.15, lookahead = 0.5, interval = 100 }) {
      if (timer !== null) return false;
      cursor = startCursor(now(), lead);
      let ended = false;
      const tick = () => {
        const due = advance(cursor, now(), lookahead, unitSeconds());
        cursor = due.cursor;
        for (const u of due.units) if (onUnit(u) === "end") { ended = true; stop(); return; }
      };
      tick();
      if (!ended) timer = every(tick, interval);
      return !ended;
    },
    stop,
  };
}

export { TEMPO, LENGTHS, OPTIONS, setTempo, beatSeconds, beatAt, chordSeconds, loopIndex, startCursor, advance, createDriver };

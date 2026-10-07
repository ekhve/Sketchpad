/* core/playback — The arithmetic of playing sound: the look-ahead scheduler, bar length from tempo, the voice budget and its reaping, and rolling a chord.
   Layer 0. Depends on: nothing. Pure: no React, no Tone, no DOM, no dates, no randomness.
   Interface, behaviour and requirements: core/MODULES.md (playback).
   Moved verbatim from the THEORY block of sketchpad.jsx (D-096); behaviour unchanged. */



/* ============================================================================
   VOICE BUDGET — pure. (D-038)

   The app went permanently silent after about thirty notes. That number is the
   polyphony limit, so voices were being allocated and never returned. The pool
   that leaked them belongs to the audio library, where no test here can reach
   it, so the pool is gone: one voice is created per note and destroyed when
   that note is finished. What remains is a budget, and a budget is arithmetic.
   ========================================================================== */

const MAX_VOICES = 24;

/* When can this voice be thrown away? Once it has finished sounding, plus a
   margin so the tail is never cut. */
function voiceLifetime(seconds, release = 0.4, margin = 0.25) {
  return Math.max(0.1, seconds) + release + margin;
}

/* Split live voices into those still needed and those safe to destroy. */
function reapVoices(voices, now) {
  const keep = [], expired = [];
  for (const v of voices) (v.until <= now ? expired : keep).push(v);
  return { keep, expired };
}

/* How many of these notes can be started without exceeding the budget?
   Dropping a note is bad; going silent forever is worse. */
function allocatable(liveCount, requested, max = MAX_VOICES) {
  return Math.max(0, Math.min(requested, max - liveCount));
}


/* ============================================================================
   LOOP SCHEDULING — our own, because the library transport kept failing
   quietly and I could not test it. Pure arithmetic. (D-043)
   ========================================================================== */

/* Which bars fall inside the lookahead window, and where does the cursor end
   up? A scheduler is a question about time, and time is arithmetic. */
function barsToSchedule({ nextBarAt, barIndex }, now, lookahead, barSeconds) {
  const bars = [];
  let at = nextBarAt, i = barIndex, guard = 0;
  while (at < now + lookahead && guard++ < 32) {
    bars.push({ at: Math.max(at, now), index: i });
    at += barSeconds;
    i += 1;
  }
  return { bars, state: { nextBarAt: at, barIndex: i } };
}

const barSecondsAt = (bpm, beats = 4) => (60 / bpm) * beats;


/* Which voice should the next note use? (D-066)

   Building a synth per note and throwing it away meant hundreds of audio nodes
   created and destroyed a minute. The browser kept up for a while and then
   started to drag, which is what "it slows down and scrambles" sounds like.
   A fixed pool is reused instead, and choosing from it is arithmetic. */
function pickVoiceIndex(busyUntil, now) {
  let freeIdx = -1, oldestIdx = 0;
  for (let i = 0; i < busyUntil.length; i++) {
    if (busyUntil[i] <= now) { freeIdx = i; break; }
    if (busyUntil[i] < busyUntil[oldestIdx]) oldestIdx = i;
  }
  return freeIdx >= 0 ? freeIdx : oldestIdx;   // steal the one finishing soonest
}


/* ============================================================================
   ROLLING A CHORD — laying the fingers down one at a time. (D-068, UC-57)

   Six notes struck together are one sound, and a big voicing becomes a wash
   you cannot pick apart. Spread the same notes over a fraction of a second and
   every one of them is audible, while the chord still arrives as a chord.
   ========================================================================== */

const ROLL_STYLES = [
  { id: "block", name: "Together", spread: 0,     note: "All at once. How a chord is normally played." },
  { id: "roll",  name: "Roll",     spread: 0.045, note: "Laid down left to right, quickly. You hear each note without losing the chord." },
  { id: "slow",  name: "Slow roll", spread: 0.11, note: "Deliberate, like someone showing you the notes one at a time." },
];

const rollStyleById = (id) => ROLL_STYLES.find((r) => r.id === id) ?? ROLL_STYLES[0];

/* When does each note of the chord start? Low to high, capped so that even a
   slow roll on eight notes still arrives well inside a bar. */
function rollOffsets(count, spread, maxTotal = 0.5) {
  if (count <= 0) return [];
  if (count === 1 || spread <= 0) return new Array(count).fill(0);
  const step = Math.min(spread, maxTotal / (count - 1));
  return Array.from({ length: count }, (_, i) => i * step);
}

/* ============================================================================
   STARTING THE AUDIO — when is it safe to play the first note? (D-101)

   A browser starts audio only after a touch, and even then the first moments are
   unreliable: the context reports itself running before its clock moves, and a
   phone's audio hardware takes a fraction of a second to come up, during which a
   note is clipped or lost. The first note was reported missing in one app and
   wrong in the other. This decides, from what has been observed, whether to
   play now or look again a moment later. The app reads the clock and the state;
   this only decides.
   ========================================================================== */

/** observed: { state, contextTime, runningForMs, ready, waitedMs } — the context's state and clock,
 *  how long it has been running, whether the instrument is ready, and how long we have waited.
 *  → { go: boolean, reason }. Gives up waiting after `maxWaitMs` and plays with what there is. */
function startupStep({ state, contextTime, runningForMs, ready, waitedMs }, { settleMs = 120, maxWaitMs = 1500 } = {}) {
  if (waitedMs >= maxWaitMs) return { go: true, reason: "waited long enough" };
  if (state !== "running") return { go: false, reason: "the audio is starting" };
  if (!(contextTime > 0)) return { go: false, reason: "the audio clock has not moved yet" };
  if (runningForMs < settleMs) return { go: false, reason: "the audio is settling" };
  if (!ready) return { go: false, reason: "the instrument is being prepared" };
  return { go: true, reason: "ready" };
}

export { startupStep, MAX_VOICES, voiceLifetime, reapVoices, allocatable, barsToSchedule, barSecondsAt, pickVoiceIndex, ROLL_STYLES, rollStyleById, rollOffsets };

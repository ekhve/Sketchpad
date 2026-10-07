/* core/playback — unit tests, one per requirement in core/REQUIREMENTS.md (CR-PLAYBACK-nn). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { startupStep, MAX_VOICES, voiceLifetime, reapVoices, allocatable, barsToSchedule, barSecondsAt, pickVoiceIndex, ROLL_STYLES, rollStyleById, rollOffsets } from "../playback.mjs";

test("CR-PLAYBACK-01 a bar lasts four beats of 60 over the tempo, or as many beats as asked", () => {
  assert.equal(barSecondsAt(60), 4); assert.equal(barSecondsAt(120), 2); assert.equal(barSecondsAt(90), 60 / 90 * 4);
  assert.equal(barSecondsAt(120, 3), 1.5);
  for (let bpm = 40; bpm <= 240; bpm += 5) assert.ok(Math.abs(barSecondsAt(bpm) * bpm - 240) < 1e-9, `${bpm} bpm`);
});

test("CR-PLAYBACK-02 barsToSchedule returns each bar that starts inside the look-ahead window, in order, none twice across calls", () => {
  const bar = 2;
  let state = { nextBarAt: 10, barIndex: 0 }, seen = [];
  for (let now = 10; now < 40; now += 0.5) {
    const r = barsToSchedule(state, now, 1.2, bar);
    r.bars.forEach((b) => seen.push(b.index));
    state = r.state;
  }
  assert.deepEqual(seen, [...Array(seen.length).keys()], "every bar exactly once, in order");
  assert.ok(seen.length >= 14);
  const r = barsToSchedule({ nextBarAt: 10, barIndex: 3 }, 10, 5, 2);
  assert.deepEqual(r.bars, [{ at: 10, index: 3 }, { at: 12, index: 4 }, { at: 14, index: 5 }]);
  assert.deepEqual(r.state, { nextBarAt: 16, barIndex: 6 });
  assert.deepEqual(barsToSchedule({ nextBarAt: 20, barIndex: 0 }, 10, 5, 2), { bars: [], state: { nextBarAt: 20, barIndex: 0 } }, "nothing yet");
});

test("CR-PLAYBACK-03 a bar already late is scheduled for now, never in the past, and a stalled clock cannot loop for ever", () => {
  const late = barsToSchedule({ nextBarAt: 5, barIndex: 0 }, 9, 1, 2);
  assert.ok(late.bars.every((b) => b.at >= 9));
  assert.equal(late.bars[0].at, 9);
  const stalled = barsToSchedule({ nextBarAt: 0, barIndex: 0 }, 1000, 1, 0.001);
  assert.ok(stalled.bars.length <= 32, "at most 32 bars in one call");
});

test("CR-PLAYBACK-04 a voice is released once it has finished sounding plus its tail and a margin", () => {
  assert.equal(voiceLifetime(1), 1 + 0.4 + 0.25);
  assert.equal(voiceLifetime(0), 0.1 + 0.4 + 0.25, "a shortest note still lives a moment");
  assert.equal(voiceLifetime(2, 1, 0), 3);
  assert.ok(voiceLifetime(-5) > 0);
});

test("CR-PLAYBACK-05 reapVoices splits live voices into those still sounding and those finished, keeping all of them", () => {
  const voices = [{ id: 1, until: 5 }, { id: 2, until: 10 }, { id: 3, until: 8 }, { id: 4, until: 9 }];
  const r = reapVoices(voices, 8);
  assert.deepEqual(r.expired.map((v) => v.id), [1, 3], "a voice ending exactly now is finished");
  assert.deepEqual(r.keep.map((v) => v.id), [2, 4]);
  assert.equal(r.keep.length + r.expired.length, voices.length);
  assert.deepEqual(reapVoices([], 0), { keep: [], expired: [] });
});

test("CR-PLAYBACK-06 allocatable never allows more notes than the budget has room for, and never a negative number", () => {
  assert.equal(MAX_VOICES, 24);
  for (let live = 0; live <= 40; live++) for (const asked of [0, 1, 6, 24, 50]) {
    const n = allocatable(live, asked);
    assert.ok(n >= 0 && n <= asked && live + n <= Math.max(live, MAX_VOICES), `${live}+${asked} -> ${n}`);
    assert.equal(n, Math.max(0, Math.min(asked, MAX_VOICES - live)));
  }
  assert.equal(allocatable(20, 6), 4); assert.equal(allocatable(0, 6, 4), 4, "or against a budget of your own");
});

test("CR-PLAYBACK-07 pickVoiceIndex takes the first free voice, and otherwise the one finishing soonest", () => {
  assert.equal(pickVoiceIndex([5, 3, 1, 9], 2), 2, "the first free voice");
  assert.equal(pickVoiceIndex([0, 0, 0], 1), 0);
  assert.equal(pickVoiceIndex([5, 3, 4, 9], 2), 1, "none free: steal the one finishing soonest");
  assert.equal(pickVoiceIndex([7, 7, 7], 2), 0, "a tie goes to the first");
  assert.equal(pickVoiceIndex([5], 5), 0, "free exactly when it finishes");
  assert.equal(pickVoiceIndex([], 0), 0);
});

test("CR-PLAYBACK-08 rolling has three styles, from all at once to a slow roll, found by id with the first as the fallback", () => {
  assert.deepEqual(ROLL_STYLES.map((r) => r.id), ["block", "roll", "slow"]);
  assert.ok(ROLL_STYLES.every((r, i) => r.name && r.note && (i === 0 || r.spread > ROLL_STYLES[i - 1].spread)), "each style spreads more than the one before");
  assert.equal(ROLL_STYLES[0].spread, 0);
  for (const r of ROLL_STYLES) assert.equal(rollStyleById(r.id), r);
  assert.equal(rollStyleById("nope"), ROLL_STYLES[0]); assert.equal(rollStyleById(undefined), ROLL_STYLES[0]);
});

test("CR-PLAYBACK-09 rollOffsets starts the notes low to high, one spread apart, and fits any chord inside half a second", () => {
  assert.deepEqual(rollOffsets(0, 0.045), []); assert.deepEqual(rollOffsets(1, 0.11), [0]);
  assert.deepEqual(rollOffsets(4, 0), [0, 0, 0, 0], "no spread, all together");
  assert.deepEqual(rollOffsets(3, 0.1), [0, 0.1, 0.2].map((x, i) => i * 0.1));
  for (const spread of [0.045, 0.11, 0.5]) for (let n = 2; n <= 12; n++) {
    const o = rollOffsets(n, spread);
    assert.equal(o.length, n); assert.equal(o[0], 0);
    assert.ok(o.every((x, i) => i === 0 || x > o[i - 1]), "strictly later each time");
    assert.ok(o[n - 1] <= 0.5 + 1e-9, `${n} notes at ${spread}: ${o[n - 1]}`);
  }
  assert.ok(Math.abs(rollOffsets(8, 0.11)[7] - 0.5) < 1e-9, "a slow roll on eight notes is held to the cap");
  assert.equal(rollOffsets(8, 0.11, 0.2)[7] <= 0.2 + 1e-9, true, "or to a cap of your own");
});

const ok = { state: "running", contextTime: 0.4, runningForMs: 300, ready: true, waitedMs: 300 };

test("CR-PLAYBACK-10 the first note waits until the audio is running, its clock is moving, it has settled and the instrument is ready", () => {
  assert.deepEqual(startupStep(ok), { go: true, reason: "ready" });
  assert.equal(startupStep({ ...ok, state: "suspended" }).go, false); assert.equal(startupStep({ ...ok, state: "interrupted" }).go, false);
  assert.equal(startupStep({ ...ok, contextTime: 0 }).go, false, "running, but the clock has not moved");
  assert.equal(startupStep({ ...ok, contextTime: undefined }).go, false);
  assert.equal(startupStep({ ...ok, runningForMs: 50 }).go, false, "up, but the hardware is still coming up");
  assert.equal(startupStep({ ...ok, ready: false }).go, false, "the piano is still being prepared");
  const why = new Set([startupStep({ ...ok, state: "suspended" }), startupStep({ ...ok, contextTime: 0 }), startupStep({ ...ok, runningForMs: 0 }), startupStep({ ...ok, ready: false })].map((r) => r.reason));
  assert.equal(why.size, 4, "each wait says why");
});

test("CR-PLAYBACK-11 the first note never waits for ever: after the longest wait it plays with what there is", () => {
  for (const bad of [{ state: "suspended" }, { contextTime: 0 }, { runningForMs: 0 }, { ready: false }]) {
    assert.equal(startupStep({ ...ok, ...bad, waitedMs: 1499 }).go, false);
    assert.equal(startupStep({ ...ok, ...bad, waitedMs: 1500 }).go, true, JSON.stringify(bad));
  }
  assert.equal(startupStep({ ...ok, state: "suspended", waitedMs: 300 }, { maxWaitMs: 200 }).go, true, "or a limit of your own");
  assert.equal(startupStep({ ...ok, runningForMs: 150 }, { settleMs: 200 }).go, false); assert.equal(startupStep({ ...ok, runningForMs: 150 }, { settleMs: 100 }).go, true);
});

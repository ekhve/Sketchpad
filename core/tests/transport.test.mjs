/* core/transport — unit tests, one per requirement in core/REQUIREMENTS.md (CR-TRANSPORT-nn). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { TEMPO, LENGTHS, OPTIONS, setTempo, beatSeconds, beatAt, chordSeconds, loopIndex, startCursor, advance, createDriver } from "../transport.mjs";
import { barsToSchedule } from "../playback.mjs";

const starts = (count, opts, beats) => Array.from({ length: beats }, (_, n) => beatAt(n, count, opts)).map((b, n) => (b.chord !== null ? `${n}:${b.chord}` : null)).filter(Boolean);

/** A clock and a timer a test can drive by hand. */
function fake() {
  const t = { time: 100, timers: new Map(), id: 0, cancelled: 0 };
  return { t,
    now: () => t.time,
    every: (fn, ms) => { t.timers.set(++t.id, { fn, ms }); return t.id; },
    cancel: (h) => { t.cancelled++; t.timers.delete(h); },
    advance: (s) => { t.time += s; for (const { fn } of [...t.timers.values()]) fn(); } };
}

test("CR-TRANSPORT-01 tempo runs from 60 to 160 BPM in steps of 5, starting at 90, and any value is brought into range", () => {
  assert.deepEqual(TEMPO, { min: 60, max: 160, start: 90, step: 5 });
  assert.deepEqual(OPTIONS, { bpm: 90, bars: 1, loop: true, click: false });
  assert.equal(setTempo(40), 60); assert.equal(setTempo(200), 160); assert.equal(setTempo(95), 95); assert.equal(setTempo(94.6), 95);
  for (let b = -50; b < 400; b += 7) { const s = setTempo(b); assert.ok(s >= 60 && s <= 160 && Number.isInteger(s)); }
});

test("CR-TRANSPORT-02 a beat lasts sixty over the tempo seconds", () => {
  assert.equal(beatSeconds(120), 0.5); assert.equal(beatSeconds(60), 1);
  for (let b = 60; b <= 160; b += 5) assert.ok(Math.abs(beatSeconds(b) * b - 60) < 1e-9);
});

test("CR-TRANSPORT-03 each chord lasts half a bar, one bar or two, and each starts on its own beat", () => {
  assert.deepEqual(LENGTHS, [0.5, 1, 2]);
  const opts = { loop: false, click: false };
  assert.deepEqual(starts(3, { ...opts, bars: 1 }, 12), ["0:0", "4:1", "8:2"]);
  assert.deepEqual(starts(3, { ...opts, bars: 0.5 }, 6), ["0:0", "2:1", "4:2"]);
  assert.deepEqual(starts(3, { ...opts, bars: 2 }, 24), ["0:0", "8:1", "16:2"]);
});

test("CR-TRANSPORT-04 with Loop on the progression repeats for ever, and with it off it plays once and ends", () => {
  assert.deepEqual(beatAt(8, 2, { bars: 1, loop: true, click: false }), { chord: 0, click: null, end: false });
  assert.equal(beatAt(8, 2, { bars: 1, loop: false, click: false }).end, true);
  assert.equal(beatAt(7, 2, { bars: 1, loop: false, click: false }).end, false);
  assert.equal(beatAt(0, 0, { bars: 1, loop: true, click: false }).end, true, "an empty progression plays nothing");
  for (const bars of LENGTHS) for (const count of [1, 2, 5]) {
    const pass = count * bars * 4;
    assert.deepEqual(beatAt(pass + 3, count, { bars, loop: true, click: false }), beatAt(3, count, { bars, loop: true, click: false }), "a pass later, the same beat");
  }
});

test("CR-TRANSPORT-05 the click counts in one bar, then marks every beat with the first of each bar stronger", () => {
  const on = { bars: 1, loop: true, click: true };
  assert.deepEqual([0, 1, 2, 3].map((n) => beatAt(n, 2, on)), [
    { chord: null, click: "accent", end: false }, { chord: null, click: "beat", end: false },
    { chord: null, click: "beat", end: false }, { chord: null, click: "beat", end: false }]);
  assert.deepEqual(beatAt(4, 2, on), { chord: 0, click: "accent", end: false }); assert.equal(beatAt(5, 2, on).click, "beat");
  const half = { bars: 0.5, loop: true, click: true };
  assert.deepEqual([4, 5, 6, 7, 8].map((n) => [beatAt(n, 4, half).chord, beatAt(n, 4, half).click]), [[0, "accent"], [null, "beat"], [1, "beat"], [null, "beat"], [2, "accent"]]);
  assert.equal(beatAt(2, 2, { bars: 1, loop: false, click: true }).end, false, "the count-in is not part of the pass");
});

test("CR-TRANSPORT-06 a chord sounds for its length less a breath before the next", () => {
  const secs = chordSeconds({ bpm: 120, bars: 1 });
  assert.ok(secs < 2 && secs > 1.7, `${secs}`); assert.ok(Math.abs(secs - 2 * 0.92) < 1e-9);
  for (const bars of LENGTHS) for (const bpm of [60, 90, 160]) { const s = chordSeconds({ bpm, bars }); assert.ok(s < bars * 4 * beatSeconds(bpm) && s > 0.9 * bars * 4 * beatSeconds(bpm)); }
});

test("CR-TRANSPORT-07 loopIndex says which chord a unit lands on, round and round, and nothing for an empty loop", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map((u) => loopIndex(u, 3)), [0, 1, 2, 0, 1, 2, 0]);
  assert.equal(loopIndex(5, 0), null); assert.equal(loopIndex(0, 1), 0);
});

test("CR-TRANSPORT-08 a play-through starts a little ahead of now, and the units due are the scheduler's, each once across calls", () => {
  assert.deepEqual(startCursor(10), { nextBarAt: 10.15, barIndex: 0 }); assert.deepEqual(startCursor(10, 0.5), { nextBarAt: 10.5, barIndex: 0 });
  let cursor = startCursor(0), seen = [];
  for (let now = 0; now < 20; now += 0.1) { const r = advance(cursor, now, 0.5, 0.5); r.units.forEach((u) => seen.push(u.index)); cursor = r.cursor; }
  assert.deepEqual(seen, [...Array(seen.length).keys()]); assert.ok(seen.length >= 38);
  const r = advance({ nextBarAt: 10, barIndex: 2 }, 10, 1, 0.5);
  assert.deepEqual(r, { units: [{ at: 10, index: 2 }, { at: 10.5, index: 3 }], cursor: { nextBarAt: 11, barIndex: 4 } });
  assert.deepEqual(advance({ nextBarAt: 10, barIndex: 2 }, 10, 1, 0.5).units, barsToSchedule({ nextBarAt: 10, barIndex: 2 }, 10, 1, 0.5).bars);
});

test("CR-TRANSPORT-09 a driver ticks at once and then on its timer, handing each unit to the app once and in order", () => {
  const f = fake(), d = createDriver(f), got = [];
  assert.equal(d.running, false);
  assert.equal(d.start({ unitSeconds: () => 0.5, onUnit: (u) => { got.push(u.index); } }), true);
  assert.equal(d.running, true); assert.ok(got.length >= 1, "the first units arrive before the first timer tick");
  assert.deepEqual([...f.t.timers.values()].map((x) => x.ms), [100]);
  for (let i = 0; i < 100; i++) f.advance(0.1);
  assert.deepEqual(got, [...Array(got.length).keys()]); assert.ok(got.length >= 19);
  assert.ok(got.length * 0.5 <= 100 * 0.1 + 0.15 + 0.5 + 0.5, "never far ahead of the clock");
});

test("CR-TRANSPORT-10 each unit carries the time it starts, which is a unit length after the one before", () => {
  const f = fake(), d = createDriver(f), at = [];
  d.start({ unitSeconds: () => 0.5, onUnit: (u) => { at.push(u.at); } });
  for (let i = 0; i < 40; i++) f.advance(0.1);
  assert.ok(Math.abs(at[0] - 100.15) < 1e-9, "the first unit starts at the lead");
  at.slice(1).forEach((a, i) => assert.ok(Math.abs(a - at[i] - 0.5) < 1e-9));
  assert.ok(at.every((a) => a >= 100), "never in the past");
});

test("CR-TRANSPORT-11 a tempo change takes effect on the next unit, because the length is asked for on every tick", () => {
  const f = fake(), d = createDriver(f), at = []; let secs = 1;
  d.start({ unitSeconds: () => secs, onUnit: (u) => { at.push(u.at); } });
  for (let i = 0; i < 20; i++) f.advance(0.1);
  secs = 0.25;
  for (let i = 0; i < 40; i++) f.advance(0.1);
  const gaps = at.slice(1).map((a, i) => +(a - at[i]).toFixed(6));
  assert.ok(gaps.includes(1) && gaps.at(-1) === 0.25, String(gaps));
});

test("CR-TRANSPORT-12 stopping cancels the timer and no more units arrive; a stopped driver can start again from the clock", () => {
  const f = fake(), d = createDriver(f), got = [];
  d.start({ unitSeconds: () => 0.5, onUnit: (u) => { got.push(u.index); } });
  d.stop(); assert.equal(d.running, false); assert.equal(f.t.timers.size, 0); assert.equal(f.t.cancelled, 1);
  const n = got.length; f.advance(5); assert.equal(got.length, n);
  d.stop(); assert.equal(f.t.cancelled, 1, "stopping twice cancels once");
  f.t.time = 500; got.length = 0;
  assert.equal(d.start({ unitSeconds: () => 0.5, onUnit: (u) => { got.push(u.index); } }), true);
  assert.equal(got[0], 0, "a new play-through begins at the first unit");
});

test("CR-TRANSPORT-13 starting a driver that is running changes nothing", () => {
  const f = fake(), d = createDriver(f), calls = [];
  d.start({ unitSeconds: () => 0.5, onUnit: (u) => { calls.push(["a", u.index]); } });
  const before = calls.length;
  assert.equal(d.start({ unitSeconds: () => 0.5, onUnit: (u) => { calls.push(["b", u.index]); } }), false);
  assert.equal(calls.length, before); assert.equal(f.t.timers.size, 1);
});

test("CR-TRANSPORT-14 an app can end the play-through from its unit callback: the driver stops, and the rest of that tick is dropped", () => {
  const f = fake(), d = createDriver(f), got = [];
  d.start({ lookahead: 5, unitSeconds: () => 0.5, onUnit: (u) => { got.push(u.index); return u.index === 2 ? "end" : undefined; } });
  assert.deepEqual(got, [0, 1, 2]); assert.equal(d.running, false); assert.equal(f.t.timers.size, 0);
  const g2 = [], f2 = fake(), d2 = createDriver(f2);
  d2.start({ unitSeconds: () => 0.5, onUnit: (u) => { g2.push(u.index); return u.index === 3 ? "end" : undefined; } });
  for (let i = 0; i < 40; i++) f2.advance(0.1);
  assert.deepEqual(g2, [0, 1, 2, 3]); assert.equal(d2.running, false);
});

test("CR-TRANSPORT-15 the driver reaches the world only through the clock and timer it is given", () => {
  const f = fake(), seen = [];
  const d = createDriver({ now: () => { seen.push("now"); return f.now(); }, every: (...a) => { seen.push("every"); return f.every(...a); }, cancel: (h) => { seen.push("cancel"); f.cancel(h); } });
  d.start({ unitSeconds: () => 1, onUnit: () => {} }); d.stop();
  assert.deepEqual([...new Set(seen)].sort(), ["cancel", "every", "now"]);
});

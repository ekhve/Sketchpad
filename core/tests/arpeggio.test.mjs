/* core/arpeggio — unit tests, one per requirement in core/REQUIREMENTS.md (CR-ARPEGGIO-nn). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { PLAY_PATTERNS, RUN_STEP, patternById, isRun, runOrder, playPlan } from "../arpeggio.mjs";
import { ROLL_STYLES, rollOffsets } from "../playback.mjs";
import { arpeggio } from "../voicing.mjs";

const C = [67, 60, 64, 72];                                   // C E G C, out of order
const deepFreeze = (o) => { Object.values(o).forEach((v) => typeof v === "object" && v && deepFreeze(v)); return Object.freeze(o); };

test("CR-ARPEGGIO-01 there are seven ways to play notes: the three ways to strike a chord, then up, down, up and down, and random", () => {
  assert.deepEqual(PLAY_PATTERNS.map((p) => p.id), ["block", "roll", "slow", "up", "down", "updown", "random"]);
  ROLL_STYLES.forEach((r, i) => { const p = PLAY_PATTERNS[i]; assert.deepEqual([p.id, p.name, p.spread, p.kind], [r.id, r.name, r.spread, "chord"]); });
  assert.deepEqual(PLAY_PATTERNS.slice(3).map((p) => p.kind), ["run", "run", "run", "run"]);
  for (const p of PLAY_PATTERNS) assert.ok(p.name && p.note.length > 10, p.id);
  assert.equal(new Set(PLAY_PATTERNS.map((p) => p.id)).size, 7);
});

test("CR-ARPEGGIO-02 a way to play is found by id, an unknown id is the first, and only the four running ones are runs", () => {
  for (const p of PLAY_PATTERNS) assert.equal(patternById(p.id), p);
  assert.equal(patternById("nope"), PLAY_PATTERNS[0]); assert.equal(patternById(undefined), PLAY_PATTERNS[0]);
  assert.deepEqual(PLAY_PATTERNS.filter((p) => isRun(p.id)).map((p) => p.id), ["up", "down", "updown", "random"]);
  assert.equal(isRun("roll"), false); assert.equal(isRun("nope"), false);
});

test("CR-ARPEGGIO-03 up and down run through each note once in order, and up and down comes back without repeating the top; each is core/voicing's arpeggio", () => {
  assert.deepEqual(runOrder(C, "up"), [60, 64, 67, 72]); assert.deepEqual(runOrder(C, "down"), [72, 67, 64, 60]);
  assert.deepEqual(runOrder(C, "updown"), [60, 64, 67, 72, 67, 64]);
  for (const [id, dir] of [["up", "up"], ["down", "down"], ["updown", "updown"]]) assert.deepEqual(runOrder(C, id), arpeggio([...C].sort((a, b) => a - b), dir));
  assert.deepEqual(runOrder([60, 60, 64], "up"), [60, 64], "a note repeated is one note");
  assert.deepEqual(runOrder([], "up"), []); assert.deepEqual(runOrder([60], "updown"), [60]);
});

test("CR-ARPEGGIO-04 random plays every note once in an order the seed decides: the same seed gives the same order, and the seeds are not all alike", () => {
  const eight = [60, 62, 64, 65, 67, 69, 71, 72];
  for (let seed = 1; seed < 30; seed++) { const r = runOrder(eight, "random", { seed }); assert.deepEqual([...r].sort((a, b) => a - b), eight); assert.deepEqual(r, runOrder(eight, "random", { seed })); }
  assert.ok(new Set(Array.from({ length: 30 }, (_, s) => runOrder(eight, "random", { seed: s + 1 }).join())).size > 20, "different seeds, different orders");
  assert.notDeepEqual(runOrder(eight, "random", { seed: 1 }), eight, "not just up");
  const kept = runOrder(eight, "random", { seed: 4, endOn: true }); assert.equal(kept.at(-1), 72, "a scale ends on its top note"); assert.deepEqual([...kept].sort((a, b) => a - b), eight);
  assert.deepEqual(runOrder([60], "random", { endOn: true }), [60]);
});

test("CR-ARPEGGIO-05 striking a chord plays its notes low to high: together at the same moment, rolled a little apart, slowly rolled further apart", () => {
  const at = (id) => playPlan(C, id).map((x) => x.at);
  assert.deepEqual(playPlan(C, "block").map((x) => x.midi), [60, 64, 67, 72]);
  assert.deepEqual(at("block"), [0, 0, 0, 0]);
  assert.deepEqual(at("roll"), rollOffsets(4, ROLL_STYLES[1].spread)); assert.deepEqual(at("slow"), rollOffsets(4, ROLL_STYLES[2].spread));
  assert.ok(at("slow")[3] > at("roll")[3] && at("roll")[3] > 0);
  for (const id of ["roll", "slow"]) assert.ok(at(id).every((x, i, a) => i === 0 || x > a[i - 1]), id);
});

test("CR-ARPEGGIO-06 a run starts its notes one step apart: a chord's steps are quick, a scale's easy", () => {
  assert.deepEqual(RUN_STEP, { chord: 0.12, scale: 0.26 });
  for (const id of ["up", "down", "updown", "random"]) {
    for (const [kind, step] of [["chord", 0.12], ["scale", 0.26]]) {
      const p = playPlan(C, id, { kind });
      p.forEach((x, i) => assert.ok(Math.abs(x.at - i * step) < 1e-12, `${id} ${kind} note ${i}`));
      assert.ok(p.every((x) => C.includes(x.midi)));
    }
  }
  assert.deepEqual(playPlan(C, "down").map((x) => x.midi), [72, 67, 64, 60]);
});

test("CR-ARPEGGIO-07 a scale can only run: given a way to strike a chord it runs up, and a random run ends on the top note", () => {
  const scale = [60, 62, 64, 65, 67, 69, 71, 72];
  for (const id of ["block", "roll", "slow"]) assert.deepEqual(playPlan(scale, id, { kind: "scale" }).map((x) => x.midi), scale, id);
  assert.deepEqual(playPlan(scale, "down", { kind: "scale" }).map((x) => x.midi), [...scale].reverse());
  for (let seed = 1; seed < 20; seed++) assert.equal(playPlan(scale, "random", { kind: "scale", seed }).at(-1).midi, 72);
  assert.equal(playPlan(scale, "up", { kind: "scale" }).at(-1).at, 7 * 0.26);
});

test("CR-ARPEGGIO-08 playing never changes the notes it is given, and gives the same plan for the same input", () => {
  const frozen = deepFreeze([...C]);
  for (const p of PLAY_PATTERNS) for (const kind of ["chord", "scale"]) {
    assert.deepEqual(playPlan(frozen, p.id, { kind, seed: 5 }), playPlan([...C], p.id, { kind, seed: 5 }));
  }
  assert.deepEqual(playPlan([], "up"), []); assert.deepEqual(playPlan([], "block"), []);
});

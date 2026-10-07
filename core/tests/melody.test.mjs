/* core/melody — unit tests, one per requirement in core/REQUIREMENTS.md (CR-MELODY-nn). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { melodyRole, MELODY_ROLES, melodyGuide, changedNotes } from "../melody.mjs";
import { scalePcs } from "../scales.mjs";
import { pc } from "../notes.mjs";

const C = { notes: [48, 52, 55] };

test("CR-MELODY-01 a pitch is stable over a chord if the chord holds it, movement if only the scale does, tension if neither", () => {
  const scale = scalePcs(0, "major");
  for (let m = 24; m < 100; m++) {
    const want = [0, 4, 7].includes(pc(m)) ? "stable" : scale.includes(pc(m)) ? "movement" : "tension";
    assert.equal(melodyRole(m, [0, 4, 7], scale), want, `midi ${m}`);
  }
  assert.equal(melodyRole(-1, [11], []), "stable", "a pitch is judged by its pitch class");
});

test("CR-MELODY-02 each role carries a label and a reason", () => {
  assert.deepEqual(Object.keys(MELODY_ROLES).sort(), ["movement", "stable", "tension"]);
  for (const r of Object.values(MELODY_ROLES)) assert.ok(r.label && r.why.length > 20);
  assert.equal(MELODY_ROLES.stable.label, "Lands well");
});

test("CR-MELODY-03 melodyGuide sorts the twelve notes of an octave into the three roles, each once, in ascending order", () => {
  for (const scaleId of ["major", "natural-minor", "minor-pentatonic", "blues"]) for (let t = 0; t < 12; t++) {
    const scale = scalePcs(t, scaleId);
    const g = melodyGuide({ notes: [48 + t, 52 + t, 55 + t] }, scale);
    assert.deepEqual([...g.stable, ...g.movement, ...g.tension].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    for (const k of ["stable", "movement", "tension"]) assert.ok(g[k].every((p, i) => i === 0 || p > g[k][i - 1]), `${k} ascends`);
    assert.deepEqual(g.stable, [t, pc(t + 4), pc(t + 7)].sort((a, b) => a - b));
    assert.ok(g.movement.every((p) => scale.includes(p)) && g.tension.every((p) => !scale.includes(p)));
  }
  assert.deepEqual(melodyGuide(C, scalePcs(0, "major")), { stable: [0, 4, 7], movement: [2, 5, 9, 11], tension: [1, 3, 6, 8, 10] });
});

test("CR-MELODY-04 with no chord, nothing is stable: every note is movement or tension", () => {
  const g = melodyGuide(null, scalePcs(0, "major"));
  assert.deepEqual(g.stable, []); assert.equal(g.movement.length, 7); assert.equal(g.tension.length, 5);
  assert.deepEqual(melodyGuide(undefined, []).tension.length, 12);
});

test("CR-MELODY-05 changedNotes says which pitch classes came in, went out and stayed, each in ascending order, ignoring octave and repeats", () => {
  assert.deepEqual(changedNotes([60, 64, 67], [57, 60, 64]), { added: [9], removed: [7], held: [0, 4] });
  assert.deepEqual(changedNotes([60, 72, 64], [48, 52]), { added: [], removed: [], held: [0, 4] }, "octaves are one note");
  assert.deepEqual(changedNotes([], [60, 64]), { added: [0, 4], removed: [], held: [] });
  assert.deepEqual(changedNotes([60], []), { added: [], removed: [0], held: [] });
  assert.deepEqual(changedNotes([60, 64], [60, 64]), { added: [], removed: [], held: [0, 4] });
  for (const [a, b] of [[[60, 64, 67], [62, 65, 69]], [[59, 62], [60, 63, 66]]]) {
    const c = changedNotes(a, b);
    assert.deepEqual([...c.removed, ...c.held].sort((x, y) => x - y), [...new Set(a.map(pc))].sort((x, y) => x - y), "what was there is gone or held");
    assert.deepEqual([...c.added, ...c.held].sort((x, y) => x - y), [...new Set(b.map(pc))].sort((x, y) => x - y), "what is there now is new or held");
  }
});

/* core/bass — unit tests, one per requirement in core/REQUIREMENTS.md (CR-BASS-nn). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { bassOptions, BASS_PARAGRAPH, bassTransitions } from "../bass.mjs";
import { harmonize } from "../harmony.mjs";
import { dictionaryFor } from "../voicing.mjs";
import { scalePcs } from "../scales.mjs";
import { pc } from "../notes.mjs";

const scale = scalePcs(0, "major");
const triads = harmonize(0, "major", 3), sevenths = harmonize(0, "major", 4);

test("CR-BASS-01 the bass options always start with the root, then fifth, third and seventh where the chord has them, then scale notes as passing", () => {
  const o = bassOptions(sevenths[4], scale);                              // G7
  assert.deepEqual(o.map((x) => x.role), ["root", "fifth", "third", "seventh", "passing", "passing", "passing", "passing"].slice(0, o.length));
  assert.deepEqual(o.slice(0, 4).map((x) => x.pc), [7, 2, 11, 5]);
  assert.equal(o[0].label, "Strongest"); assert.ok(o.every((x) => x.why && x.label));
  assert.deepEqual(bassOptions(triads[0], scale).map((x) => x.role).slice(0, 3), ["root", "fifth", "third"], "a triad has no seventh");
});

test("CR-BASS-02 no pitch class is offered twice, and the passing notes are exactly the scale notes the chord did not use", () => {
  for (const root of [0, 3, 7, 10]) for (const c of dictionaryFor(root)) {
    const o = bassOptions(c, scalePcs(root, "major"));
    assert.equal(new Set(o.map((x) => x.pc)).size, o.length, `${c.sym} on ${root}`);
    const chordRoles = o.filter((x) => x.role !== "passing").map((x) => x.pc);
    assert.deepEqual(o.filter((x) => x.role === "passing").map((x) => x.pc).sort((a, b) => a - b), scalePcs(root, "major").filter((p) => !chordRoles.includes(p)).sort((a, b) => a - b));
    assert.equal(o[0].pc, c.rootPc, "the root is first");
  }
});

test("CR-BASS-03 the fifth is a perfect fifth if the chord has one, else a flat or sharp one; the third is minor or major; the seventh is minor or major", () => {
  const pcOf = (c, role) => bassOptions(c, scale).find((x) => x.role === role)?.pc;
  const on = (sym) => dictionaryFor(0).find((d) => d.sym === sym);
  assert.equal(pcOf(on("dim"), "fifth"), 6); assert.equal(pcOf(on("aug"), "fifth"), 8); assert.equal(pcOf(on(""), "fifth"), 7);
  assert.equal(pcOf(on("m"), "third"), 3); assert.equal(pcOf(on(""), "third"), 4);
  assert.equal(pcOf(on("7"), "seventh"), 10); assert.equal(pcOf(on("maj7"), "seventh"), 11);
  assert.equal(pcOf(on("sus4"), "third"), undefined, "a suspended chord has no third to offer");
});

test("CR-BASS-04 the explanation paragraph is available for the app to show, and says what the scale and the chord each decide", () => {
  assert.match(BASS_PARAGRAPH, /scale is the general set of notes/); assert.match(BASS_PARAGRAPH, /root is safest/);
});

test("CR-BASS-05 bassTransitions offers a direct move, a scale walk where there is a gap, a fifth approach and a chromatic slide, all ending on the next chord's root", () => {
  for (const from of triads) for (const to of triads) {
    if (from === to) continue;
    const t = bassTransitions(from, to, scale);
    assert.ok(t.length >= 3 && t.length <= 4);
    assert.deepEqual(t.map((x) => x.name).filter((n) => n !== "Scale walk"), ["Direct", "Fifth approach", "Chromatic"]);
    for (const x of t) { assert.ok(x.why); assert.equal(x.notes[0], 36 + from.rootPc); assert.equal(pc(x.notes[x.notes.length - 1]), to.rootPc, `${x.name} ends on the next root`); }
    const walk = t.find((x) => x.name === "Scale walk");
    if (walk) { assert.ok(walk.notes.every((n) => scale.includes(pc(n))), "every step is in the scale"); assert.ok(walk.notes.length > 2); }
  }
});

test("CR-BASS-06 the transitions are the figures the bass would play: direct is two notes, fifth approach drops to the next chord's fifth, chromatic comes from a semitone below", () => {
  const [c, , , f, g] = triads;
  const t = Object.fromEntries(bassTransitions(c, g, scale).map((x) => [x.name, x.notes]));
  assert.deepEqual(t.Direct, [36, 31], "the nearest G, which is below");
  assert.equal(t.Chromatic[1], t.Chromatic[2] - 1);
  assert.equal(pc(t["Fifth approach"][1]), 2, "D, the fifth of G");
  assert.deepEqual(bassTransitions(c, f, scale).find((x) => x.name === "Scale walk").notes, [36, 38, 40, 41]);
  assert.equal(bassTransitions(c, c, scale).find((x) => x.name === "Direct").notes.length, 2, "even to itself, a transition exists");
});

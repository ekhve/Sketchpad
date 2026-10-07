/* core/figures — unit tests, one per requirement in core/REQUIREMENTS.md (CR-FIGURES-nn). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { STEPS_PER_BAR, rng, PATTERNS, STYLES, patternsFor, place, renderFigure, renderProgressionFigure, explainFigure, VOICES, VELOCITY, planBar, planIsClean } from "../figures.mjs";
import { STYLE_COLOURS } from "../styles.mjs";
import { harmonize } from "../harmony.mjs";
import { scalePcs } from "../scales.mjs";
import { pc } from "../notes.mjs";

const prog = harmonize(0, "major", 4).filter((_, i) => [0, 5, 3, 4].includes(i));
const scale = scalePcs(0, "major");
const deepFreeze = (o) => { Object.values(o).forEach((v) => typeof v === "object" && v && deepFreeze(v)); return Object.freeze(o); };

test("CR-FIGURES-01 rng is a seeded generator: the same seed gives the same sequence, always in [0, 1), and different seeds differ", () => {
  const a = rng(42), b = rng(42), c = rng(43);
  const sa = Array.from({ length: 50 }, a), sb = Array.from({ length: 50 }, b), sc = Array.from({ length: 50 }, c);
  assert.deepEqual(sa, sb); assert.notDeepEqual(sa, sc);
  assert.ok(sa.every((x) => x >= 0 && x < 1));
  assert.ok(new Set(sa).size > 45, "not stuck");
  assert.deepEqual(Array.from({ length: 3 }, rng(0)), Array.from({ length: 3 }, rng(0)), "seed 0 works");
  assert.ok(sa.some((x) => x < 0.5) && sa.some((x) => x >= 0.5), "both halves");
});

test("CR-FIGURES-02 every pattern has an id, a kind, styles from the known six, a note, and steps that fit in a bar without overlapping", () => {
  assert.equal(STEPS_PER_BAR, 16);
  assert.equal(new Set(PATTERNS.map((p) => p.id)).size, PATTERNS.length);
  for (const p of PATTERNS) {
    assert.ok(["bass", "melody"].includes(p.kind), p.id); assert.ok(p.note.length > 10, p.id);
    assert.ok(p.styles.length >= 1 && p.styles.every((s) => STYLES.includes(s)), p.id);
    assert.ok(p.steps.length >= 1);
    p.steps.forEach((s, i) => {
      assert.ok(Number.isInteger(s.p) && s.p >= 0 && s.p < STEPS_PER_BAR, `${p.id} step ${i} starts in the bar`);
      assert.ok(Number.isInteger(s.d) && s.d >= 1 && s.p + s.d <= STEPS_PER_BAR, `${p.id} step ${i} ends in the bar`);
      assert.ok(["root", "octave", "fifth", "third", "top", "chordTone", "step", "stepUp", "stepDown", "approach"].includes(s.r), `${p.id}: ${s.r}`);
      if (i > 0) assert.ok(s.p >= p.steps[i - 1].p + p.steps[i - 1].d || s.p > p.steps[i - 1].p, `${p.id} steps ascend`);
    });
  }
  assert.deepEqual(STYLES, Object.keys(STYLE_COLOURS), "the same six styles as core/styles");
});

test("CR-FIGURES-03 patternsFor lists the patterns of a kind that suit a style, and every style has at least one bass and one melody", () => {
  for (const style of STYLES) for (const kind of ["bass", "melody"]) {
    const found = patternsFor(kind, style);
    assert.ok(found.length >= 1, `${kind} for ${style}`);
    assert.ok(found.every((p) => p.kind === kind && p.styles.includes(style)));
  }
  assert.deepEqual(patternsFor("bass", "polka"), []);
});

test("CR-FIGURES-04 place gives the nearest note with a pitch class to a reference, never an octave away from the nearest", () => {
  for (let near = 20; near < 100; near++) for (let p = 0; p < 12; p++) {
    const m = place(p, near);
    assert.equal(pc(m), p); assert.ok(Math.abs(m - near) <= 6, `place(${p}, ${near}) = ${m}`);
  }
  assert.equal(place(0, 60), 60); assert.equal(place(7, 60), 55, "a tritone away goes down, by the tie-break");
});

test("CR-FIGURES-05 renderFigure turns a pattern into notes, one per step it can resolve, at the pattern's positions and lengths", () => {
  for (const p of PATTERNS) for (const chord of prog) {
    const f = renderFigure(p, chord, prog[0], scale, 7, 40);
    assert.equal(f.length, p.steps.length, p.id);
    f.forEach((n, i) => {
      assert.equal(n.pos, p.steps[i].p); assert.equal(n.dur, p.steps[i].d); assert.equal(n.role, p.steps[i].r);
      assert.ok(Number.isInteger(n.midi) && n.midi >= 0 && n.midi <= 127, `${p.id}: ${n.midi}`);
    });
  }
});

test("CR-FIGURES-06 the rules put each role where it says: root on the root, octave above it, fifth and third from the chord, approach a semitone from the next chord's root", () => {
  const [c, , , g] = prog;
  const bass = (id) => renderFigure(PATTERNS.find((p) => p.id === id), c, g, scale, 1, 40);
  const octave = bass("bass-octave");
  assert.ok(octave.filter((n) => n.role === "root").every((n) => pc(n.midi) === 0));
  octave.forEach((n, i) => { if (n.role === "octave") assert.equal(n.midi, octave[i - 1].midi + 12); });
  const walk = bass("bass-walk");
  assert.equal(pc(walk.find((n) => n.role === "fifth").midi), 7);
  const app = walk.find((n) => n.role === "approach");
  assert.ok([1, -1].includes(app.midi - place(7, walk[walk.length - 2].midi)), "a semitone either side of the next chord's root");
  const arp = renderFigure(PATTERNS.find((p) => p.id === "riff-arp"), c, g, scale, 1, 60);
  assert.deepEqual(arp.map((n) => pc(n.midi)).slice(0, 3), [0, 4, 7]);
  assert.equal(pc(renderFigure(PATTERNS.find((p) => p.id === "riff-sparse"), c, g, scale, 1, 60)[0].midi), 11, "top is the chord's highest tone");
});

test("CR-FIGURES-07 a figure is reproducible: the same seed gives the same notes, a different seed may differ, and nothing is read from outside", () => {
  const p = PATTERNS.find((x) => x.id === "riff-hook");
  const run = (seed) => renderFigure(p, prog[0], prog[1], scale, seed, 60);
  assert.deepEqual(run(5), run(5));
  assert.ok(Array.from({ length: 20 }, (_, i) => JSON.stringify(run(i))).some((j) => j !== JSON.stringify(run(0))), "the seed matters");
  const frozen = deepFreeze(JSON.parse(JSON.stringify({ prog, scale })));
  assert.deepEqual(renderFigure(p, frozen.prog[0], frozen.prog[1], frozen.scale, 5, 60), run(5), "inputs are left alone");
});

test("CR-FIGURES-08 step moves go to a neighbouring note of the scale, in the direction the pattern declares", () => {
  const f = renderFigure(PATTERNS.find((p) => p.id === "riff-fall"), prog[0], prog[1], scale, 3, 72);
  for (let i = 1; i < f.length; i++) if (f[i].role === "stepDown") { assert.ok(f[i].midi < f[i - 1].midi); assert.ok(scale.includes(pc(f[i].midi))); assert.ok(f[i - 1].midi - f[i].midi <= 3); }
  const up = renderFigure(PATTERNS.find((p) => p.id === "riff-rise"), prog[0], prog[1], scale, 3, 60);
  for (let i = 1; i < up.length; i++) if (up[i].role === "stepUp") { assert.ok(up[i].midi > up[i - 1].midi); assert.ok(scale.includes(pc(up[i].midi))); }
});

test("CR-FIGURES-09 renderProgressionFigure renders one figure per chord, each leaning into the next, the last into the first", () => {
  const p = PATTERNS.find((x) => x.id === "bass-walk");
  const all = renderProgressionFigure(p, prog, scale, 11, 40);
  assert.equal(all.length, prog.length);
  all.forEach((fig, i) => assert.deepEqual(fig, renderFigure(p, prog[i], prog[(i + 1) % prog.length], scale, 11 + i * 7919, 40)));
  assert.deepEqual(renderProgressionFigure(p, [], scale, 1, 40), []);
});

test("CR-FIGURES-10 explainFigure says what the pattern is, which notes land on the strong beats, and whether it leans into the next chord", () => {
  const p = PATTERNS.find((x) => x.id === "bass-walk");
  const f = renderFigure(p, prog[0], prog[1], scale, 1, 40);
  const e = explainFigure(p, f);
  assert.ok(e.startsWith(p.note));
  assert.match(e, /Lands on \w#?(, \w#?)* on the strong beats\./);
  assert.match(e, /leans into the next chord from a semitone away/);
  assert.doesNotMatch(explainFigure(PATTERNS.find((x) => x.id === "bass-anchor"), renderFigure(PATTERNS.find((x) => x.id === "bass-anchor"), prog[0], prog[1], scale, 1, 40)), /leans into/);
  assert.match(explainFigure(p, f, "solfege"), /Lands on (Do|Re|Mi|Fa|Sol|La|Si)/);
  assert.equal(explainFigure(p, []), p.note, "nothing to say about no notes");
});

test("CR-FIGURES-11 planBar plans a bar as events with a start and length in seconds: one chord event under the figures, the bass and riff notes on their own steps", () => {
  assert.deepEqual(VOICES, ["chord", "bass", "riff"]);
  assert.ok(VELOCITY.chord < VELOCITY.riff && VELOCITY.riff < VELOCITY.bass, "chords sit under the melody");
  const sixteenth = 0.125, barSeconds = 2;
  const events = planBar({ chordNotes: [60, 64, 67], bassFigure: [{ midi: 36, pos: 0, dur: 4, role: "root" }, { midi: 43, pos: 8, dur: 4, role: "fifth" }], riffFigure: [{ midi: 72, pos: 2, dur: 2, role: "top" }], sixteenth, barSeconds });
  assert.deepEqual(events.map((e) => e.voice), ["chord", "bass", "riff", "bass"]);
  assert.deepEqual(events.map((e) => e.at), [0, 0, 0.25, 1]);
  assert.deepEqual(events[0], { voice: "chord", notes: [60, 64, 67], at: 0, dur: 0.95, vel: VELOCITY.chord });
  assert.equal(events[1].vel, VELOCITY.bass); assert.deepEqual(events[1].notes, [36]);
  assert.deepEqual(planBar({ sixteenth, barSeconds }), [], "an empty bar plans nothing");
});

test("CR-FIGURES-12 no note on one voice is longer than the gap before the next, so notes cannot pile up", () => {
  const sixteenth = 0.1, barSeconds = 1.6;
  const tight = planBar({ bassFigure: [{ midi: 36, pos: 0, dur: 16, role: "root" }, { midi: 40, pos: 2, dur: 16, role: "root" }], sixteenth, barSeconds });
  assert.ok(tight[0].dur <= 2 * sixteenth - 0.05 + 1e-9, "cut short before the next note");
  assert.equal(planIsClean(tight, barSeconds), true);
  const unsorted = planBar({ bassFigure: [{ midi: 40, pos: 8, dur: 2, role: "root" }, { midi: 36, pos: 0, dur: 2, role: "root" }], sixteenth, barSeconds });
  assert.deepEqual(unsorted.map((e) => e.notes[0]), [36, 40], "a figure out of order is planned in order");
  for (const p of PATTERNS) for (const spb of [1, 1.5, 3]) {
    const fig = renderFigure(p, prog[0], prog[1], scale, 2, 48);
    const plan = planBar({ chordNotes: prog[0].notes, bassFigure: p.kind === "bass" ? fig : [], riffFigure: p.kind === "melody" ? fig : [], sixteenth: spb / 16, barSeconds: spb });
    assert.equal(planIsClean(plan, spb), true, `${p.id} at ${spb}s per bar`);
  }
  // known limit, recorded in core/DESIGN.md: the 50 ms floor on a note's length can overlap a next note when a sixteenth is
  // shorter than the floor plus the gap, which is a bar of half a second (480 BPM), far beyond any tempo the apps offer
  const crush = planBar({ bassFigure: [{ midi: 36, pos: 0, dur: 1, role: "root" }, { midi: 38, pos: 1, dur: 1, role: "root" }], sixteenth: 0.03, barSeconds: 0.5 });
  assert.equal(planIsClean(crush, 0.5), false);
});

test("CR-FIGURES-13 planIsClean rejects overlapping notes, empty notes, and notes that start outside the bar", () => {
  const ev = (voice, at, dur) => ({ voice, at, dur, notes: [60], vel: 1 });
  assert.equal(planIsClean([ev("bass", 0, 1), ev("bass", 1, 1)], 2), true, "touching is fine");
  assert.equal(planIsClean([ev("bass", 0, 1.5), ev("bass", 1, 1)], 2), false, "overlap");
  assert.equal(planIsClean([ev("bass", 0, 1.5), ev("riff", 1, 1)], 2), true, "different voices may overlap");
  assert.equal(planIsClean([ev("bass", 0, 0)], 2), false, "no length");
  assert.equal(planIsClean([ev("bass", 2, 1)], 2), false, "starts after the bar");
  assert.equal(planIsClean([ev("bass", -0.1, 1)], 2), false);
  assert.equal(planIsClean([], 2), true);
});

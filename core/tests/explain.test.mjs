/* core/explain — unit tests, one per requirement in core/REQUIREMENTS.md (CR-EXPLAIN-nn). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { explainChord, explainProgression, describeChange } from "../explain.mjs";
import { harmonize } from "../harmony.mjs";
import { chordLabel } from "../chords.mjs";

const cMajor = { tonic: 0, mode: "major", scaleId: "major" };
const triads = harmonize(0, "major", 3);
const aMinor = { tonic: 9, mode: "minor", scaleId: "natural-minor" };

/** Number of sentences, counting a full stop followed by a space and a capital. */
const sentences = (t) => (t.match(/[.!?](\s+[A-Z]|$)/g) || []).length;

test("CR-EXPLAIN-01 a chord in the key is explained by its role there and what it shares with home, in at most two sentences", () => {
  for (const [ctx, chords] of [[cMajor, triads], [aMinor, harmonize(9, "natural-minor", 3)]]) for (const c of chords) {
    const e = explainChord(c, ctx);
    assert.equal(e.head, `${chordLabel(c.rootPc, c.sym, "letters")} — ${c.full}`);
    assert.ok(e.plain.length > 20 && sentences(e.plain) <= 2, `${c.roman}: ${e.plain}`);
    assert.deepEqual(e.outside, []);
    assert.match(e.formal, new RegExp(`^${c.roman} in ${ctx.mode === "minor" ? "A" : "C"} ${ctx.mode}\\. Notes: `));
  }
  assert.match(explainChord(triads[0], cMajor).plain, /^Home, stable and bright, sharing C and E and G with home/);
  assert.match(explainChord(triads[1], cMajor).plain, /^Gentle motion away from home, sharing A/.source ? /^Gentle motion away from home, /: /x/);
  assert.match(explainChord(triads[1], cMajor).plain, /, with nothing in common with home|sharing/);
});

test("CR-EXPLAIN-02 a chord with notes outside the key is called out, and the outside notes are named", () => {
  const bVII = { rootPc: 10, sym: "", full: "major", notes: [58, 62, 65], degreeIndex: 6, roman: "♭VII" };
  const e = explainChord(bVII, cMajor);
  assert.equal(e.head, "A# — outside the key");
  assert.deepEqual(e.outside, [10]);
  assert.match(e.plain, /^A# is not in C major\. That clash is usually the point/);
  assert.match(e.formal, /^Non-diatonic: A#\./);
  assert.match(explainChord({ ...bVII, notes: [61, 63, 66] }, cMajor).plain, /are not in C major/, "plural for several notes");
});

test("CR-EXPLAIN-03 a note in the key but not in the scale chosen for melodies is named as that, and the chord is still called in key", () => {
  const pent = { tonic: 0, mode: "major", scaleId: "major-pentatonic" };
  const e = explainChord(triads[6], pent);                       // B D F: B and F are in C major, not in its pentatonic
  assert.deepEqual(e.outside, []); assert.deepEqual(e.outsidePalette, [11, 5], "in the chord's own order");
  assert.match(e.plain, / B and F are outside the major pentatonic you picked, but the chord is still fully in key\.$/);
  assert.deepEqual(explainChord(triads[0], pent).outsidePalette, [], "a chord inside the palette says nothing of it");
});

test("CR-EXPLAIN-04 a progression is explained as a loop, including the move from the last chord back to the first", () => {
  assert.equal(explainProgression([], cMajor), null); assert.equal(explainProgression([triads[0]], cMajor), null);
  const loop = [triads[0], triads[5], triads[3], triads[4]];     // I vi IV V
  const e = explainProgression(loop, cMajor);
  assert.equal(e.moves.length, 4);
  assert.deepEqual(e.moves.map((m) => m.from + ">" + m.to), ["C>Am", "Am>F", "F>G", "G>C"]);
  assert.match(e.summary, /^Starts at home, travels, and comes back/);
  assert.match(e.moves[0].why, /^Shares C and E — barely moves/);
  assert.match(e.moves[2].why, /^Nothing in common\. A real move|Nothing in common, but the roots are close/);
  assert.match(explainProgression([triads[1], triads[4]], cMajor).summary, /^Doesn't start at home/);
});

test("CR-EXPLAIN-05 every pair of chords gets one of four plain readings: two shared, one shared, close roots, or a real move", () => {
  const seen = new Set();
  for (const a of triads) for (const b of triads) {
    if (a === b) continue;
    const m = explainProgression([a, b], cMajor).moves[0];
    seen.add(m.why.split(" ").slice(0, 2).join(" "));
    const common = m.shared.length;
    if (common >= 2) assert.match(m.why, /barely moves/);
    else if (common === 1) assert.match(m.why, /^Only \w#? stays\./);
    else assert.match(m.why, /^Nothing in common/);
  }
  assert.ok(seen.size >= 3, [...seen].join("|"));
  assert.match(explainProgression([triads[0], triads[1]], cMajor).moves[0].why, /^Nothing in common, but the roots are close/, "C to Dm: a step, and nothing shared");
});

test("CR-EXPLAIN-06 describeChange says what changed between two note sets, as one sentence when one note moved", () => {
  assert.equal(describeChange([60, 64, 67], [60, 64, 67]), "Nothing changed.");
  assert.equal(describeChange([60, 64, 67], [60, 63, 67]), "E became D# — that one note is the whole difference.");
  assert.equal(describeChange([60, 64, 67], [57, 60, 64, 71]), "A, B came in and G went out. 2 notes stayed.");
  assert.equal(describeChange([60, 64], [60, 64, 67]), "G came in. 2 notes stayed.");
  assert.equal(describeChange([60, 64, 67], [60]), "E, G went out. 1 note stayed.");
  assert.equal(describeChange([60, 64], [61, 65], "solfege"), "Do#, Fa came in and Do, Mi went out. 0 notes stayed.", "none stayed, plural");
  assert.match(describeChange([60], [62], "solfege"), /^Do became Re/);
});

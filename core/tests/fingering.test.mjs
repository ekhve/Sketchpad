/* core/fingering — unit tests, one per requirement in core/REQUIREMENTS.md (CR-FINGERING-nn). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { SCALE_FINGERING, HAND_REACH, DEFAULT_REACH, FINGER_HANDS, effectiveFingerHand, FINGER_COPY, handFingers, fitsHand, fingerChord, fingerCrossings, scaleFingering, stepFingering, litLessonFingers } from "../fingering.mjs";
import { scalePcs } from "../scales.mjs";
import { pc } from "../notes.mjs";

const run = (tonic, mode) => { const iv = scalePcs(tonic, mode === "minor" ? "natural-minor" : "major"); let m = 60 + tonic, out = [m]; for (const p of iv.slice(1)) { while (pc(m) !== p) m++; out.push(m); } out.push(60 + tonic + 12); return out; };

test("CR-FINGERING-01 the scale table has a right and left hand fingering of eight notes, using fingers 1 to 5, for each of the 12 major and 12 minor scales", () => {
  for (const mode of ["major", "minor"]) for (let t = 0; t < 12; t++) for (const h of ["R", "L"]) {
    const f = SCALE_FINGERING[mode][t][h];
    assert.equal(f.length, 8, `${mode} ${t} ${h}`); assert.ok(f.every((x) => x >= 1 && x <= 5));
  }
  assert.deepEqual(SCALE_FINGERING.major[0].R, [1, 2, 3, 1, 2, 3, 4, 5]);
});

test("CR-FINGERING-02 every scale fingering is playable: a thumb never repeats, and the hand crosses once at most each way, at the thumb", () => {
  for (const mode of ["major", "minor"]) for (let t = 0; t < 12; t++) for (const h of ["R", "L"]) {
    const f = SCALE_FINGERING[mode][t][h];
    f.forEach((x, i) => { if (i && x === f[i - 1]) assert.fail(`${mode} ${t} ${h}: finger ${x} twice in a row`); });
    const turns = fingerCrossings(f, h);
    assert.ok(turns.length >= 1 && turns.length <= 2, `${mode} ${t} ${h}: ${turns.length} crossings`);
    for (const c of turns) assert.ok(c.label === "thumb under" || /^\d crosses over$/.test(c.label));
    assert.ok(f.includes(1), "a thumb in every octave");
  }
});

test("CR-FINGERING-03 reach options run from a seventh to a tenth, an octave by default", () => {
  assert.deepEqual(HAND_REACH.map((r) => r.id), ["7th", "octave", "9th", "10th"]);
  assert.ok(HAND_REACH.every((r, i) => i === 0 || r.keys > HAND_REACH[i - 1].keys));
  assert.equal(DEFAULT_REACH, 12); assert.equal(HAND_REACH.find((r) => r.id === "octave").keys, DEFAULT_REACH);
  assert.deepEqual(FINGER_HANDS, ["off", "right", "left", "both"]);
  assert.ok(FINGER_COPY.suggested && FINGER_COPY.split && FINGER_COPY.tooWide);
});

test("CR-FINGERING-04 fingers show for the right hand in Learn until a choice is made, and nowhere else", () => {
  assert.equal(effectiveFingerHand(null, "learn"), "right"); assert.equal(effectiveFingerHand(undefined, "learn"), "right");
  for (const tab of ["chords", "loop", "find", "sheet"]) assert.equal(effectiveFingerHand(null, tab), "off");
  for (const c of FINGER_HANDS) for (const tab of ["learn", "chords"]) assert.equal(effectiveFingerHand(c, tab), c, "a choice wins everywhere");
});

test("CR-FINGERING-05 handFingers gives each note a finger by rule: the thumb on the lowest in the right hand and the highest in the left, the little finger opposite", () => {
  assert.deepEqual(handFingers([60], "R"), [1]); assert.deepEqual(handFingers([60], "L"), [5]);
  assert.deepEqual(handFingers([60, 64, 67], "R"), [1, 3, 5]); assert.deepEqual(handFingers([60, 64, 67], "L"), [5, 3, 1]);
  assert.deepEqual(handFingers([60, 62], "R"), [1, 2]); assert.deepEqual(handFingers([60, 67], "R"), [1, 5]); assert.deepEqual(handFingers([60, 67], "L"), [5, 1]);
  assert.deepEqual(handFingers([60, 64, 67, 71], "R"), [1, 2, 3, 5]); assert.deepEqual(handFingers([60, 62, 64, 65, 67], "L"), [5, 4, 3, 2, 1]);
  assert.equal(handFingers([1, 2, 3, 4, 5, 6], "R"), null, "a hand has five fingers");
});

test("CR-FINGERING-06 in a triad the middle finger is 3, or 2 when the top gap is a fourth or more, which fingers every inversion of every triad", () => {
  assert.deepEqual(handFingers([60, 64, 67], "R"), [1, 3, 5], "C root position: gap 3");
  assert.deepEqual(handFingers([64, 67, 72], "R"), [1, 2, 5], "first inversion: gap 5");
  assert.deepEqual(handFingers([67, 72, 76], "R"), [1, 3, 5], "second inversion: gap 4");
  for (const [low, high] of [[4, 3], [3, 4], [3, 3], [4, 4]]) for (const inv of [[0, low, low + high], [low, low + high, 12], [low + high, 12, 12 + low]]) {
    const f = handFingers(inv.map((x) => 48 + x), "R");
    assert.ok(f[0] === 1 && f[2] === 5 && (f[1] === 2 || f[1] === 3), `${inv}: ${f}`);
  }
});

test("CR-FINGERING-07 fitsHand is true for one to five notes lying within the reach", () => {
  assert.equal(fitsHand([60, 72], 12), true); assert.equal(fitsHand([60, 73], 12), false);
  assert.equal(fitsHand([], 12), false); assert.equal(fitsHand([60, 61, 62, 63, 64, 65], 12), false, "six notes: too many fingers");
  assert.equal(fitsHand([60], 0), true);
});

test("CR-FINGERING-08 fingerChord gives one hand a chord it can reach: a finger for every note, no split, no brackets", () => {
  const r = fingerChord([60, 64, 67], { hand: "right" });
  assert.deepEqual(r.keys, [{ midi: 60, finger: 1, hand: "R" }, { midi: 64, finger: 3, hand: "R" }, { midi: 67, finger: 5, hand: "R" }]);
  assert.equal(r.split, false); assert.equal(r.tooWide, false); assert.deepEqual(r.brackets, []);
  const l = fingerChord([60, 64, 67], { hand: "left" }); assert.deepEqual(l.keys.map((k) => k.finger), [5, 3, 1]);
  assert.deepEqual(fingerChord([67, 60, 64, 60], { hand: "right" }).keys.map((k) => k.midi), [60, 64, 67], "sorted, each note once");
  for (const none of [fingerChord([], {}), fingerChord([60, 64], { hand: "off" })]) assert.deepEqual(none, { keys: [], brackets: [], split: false, tooWide: false, extraBass: null });
});

test("CR-FINGERING-09 a chord one hand cannot reach is split, the left taking as few of the lowest notes as it can, or is called too wide", () => {
  const wide = fingerChord([48, 55, 64, 67, 71], { hand: "right" });                  // 23 semitones
  assert.equal(wide.split, true); assert.deepEqual(wide.keys.filter((k) => k.hand === "L").map((k) => k.midi), [48, 55]);
  assert.equal(wide.brackets.length, 2); assert.deepEqual(wide.brackets[0], { lo: 48, hi: 55, hand: "L" });
  const six = fingerChord([36, 43, 48, 52, 55, 59], { hand: "right" });
  assert.equal(six.split, true); assert.ok(six.keys.length === 6);
  assert.deepEqual(fingerChord([24, 60, 96], { hand: "right" }), { keys: [], brackets: [], split: false, tooWide: true, extraBass: null });
  assert.equal(fingerChord([48, 55, 64, 67, 71], { hand: "right", reach: 24 }).split, false, "a longer reach needs no split");
});

test("CR-FINGERING-10 with both hands, the left plays the bass at least an octave below the chord and the right plays the chord", () => {
  const r = fingerChord([60, 64, 67], { hand: "both", rootPc: 0 });
  assert.deepEqual(r.keys.map((k) => [k.midi, k.hand]), [[48, "L"], [60, "R"], [64, "R"], [67, "R"]]);
  assert.equal(r.extraBass, 48); assert.equal(r.split, false); assert.equal(r.brackets.length, 2);
  assert.equal(fingerChord([64, 67, 72], { hand: "both", rootPc: 0 }).extraBass, 48, "an inversion's bass is still its root");
  const slash = fingerChord([52, 60, 64, 67], { hand: "both", rootPc: 0, bassPc: 4 });
  assert.deepEqual(slash.keys.filter((k) => k.hand === "L").map((k) => k.midi), [52], "a slash chord's own bass goes to the left hand");
  assert.equal(slash.extraBass, null);
  for (let root = 0; root < 12; root++) { const b = fingerChord([60 + root, 64 + root, 67 + root], { hand: "both", rootPc: root }).extraBass; assert.equal(pc(b), root); assert.ok(b <= 60 + root - 12); }
});

test("CR-FINGERING-11 fingerCrossings finds each step against the hand's natural direction, naming a thumb tucking under or a finger crossing over", () => {
  assert.deepEqual(fingerCrossings([1, 2, 3, 1, 2, 3, 4, 5], "R"), [{ index: 3, label: "thumb under" }]);
  assert.deepEqual(fingerCrossings([5, 4, 3, 2, 1, 3, 2, 1], "L"), [{ index: 5, label: "3 crosses over" }]);
  assert.deepEqual(fingerCrossings([1, 3, 2, 1, 4, 3, 2, 1], "R", "down"), [{ index: 1, label: "3 crosses over" }, { index: 4, label: "4 crosses over" }], "going down, the right hand's natural way is falling, so every rise is a crossing");
  assert.deepEqual(fingerCrossings([1, 2, 3], "R"), []); assert.deepEqual(fingerCrossings([], "R"), []);
});

test("CR-FINGERING-12 scaleFingering fingers a one-octave run from the table, upward or downward, and says nothing for notes that are not that scale", () => {
  const up = scaleFingering(run(0, "major"), "major", "R");
  assert.deepEqual(up.map((k) => k.finger), [1, 2, 3, 1, 2, 3, 4, 5]); assert.equal(up[3].cross, "thumb under"); assert.equal(up.filter((k) => k.cross).length, 1);
  const down = scaleFingering([...run(0, "major")].reverse(), "major", "R");
  assert.deepEqual(down.map((k) => k.finger), [5, 4, 3, 2, 1, 3, 2, 1]); assert.equal(down.find((k) => k.cross).cross, "3 crosses over");
  for (const mode of ["major", "minor"]) for (let t = 0; t < 12; t++) for (const h of ["R", "L"]) {
    const f = scaleFingering(run(t, mode), mode, h); assert.ok(f, `${mode} ${t}`);
    assert.deepEqual(f.map((k) => k.finger), SCALE_FINGERING[mode][t][h]);
  }
  assert.equal(scaleFingering([60, 62, 64, 65, 67, 69, 70, 72], "major", "R"), null, "a B♭ in C major is not C major");
  assert.equal(scaleFingering([60, 62, 64], "major", "R"), null); assert.equal(scaleFingering(run(0, "major"), "major", "R").length, 8);
});

test("CR-FINGERING-13 stepFingering turns a lesson step into keys and one line of words, or nothing rather than a guess", () => {
  const scaleStep = { target: { kind: "sequence" }, show: run(0, "major") };
  const s = stepFingering(scaleStep, "major", "R");
  assert.match(s.text, /^Suggested fingering, right hand: 1 2 3, thumb under onto F, 1 2 3 4 5\.$/);
  assert.equal(s.keys.length, 8); assert.ok(s.keys.every((k) => k.hand === "R"));
  assert.match(stepFingering(scaleStep, "major", "L", 12, "solfege").text, /^Suggested fingering, left hand: /);
  const chordStep = { target: { kind: "set" }, show: [60, 64, 67] };
  assert.equal(stepFingering(chordStep, "major", "R").text, "Suggested fingering, right hand: 1-3-5.");
  assert.equal(stepFingering({ target: { kind: "set" }, show: [48, 55, 64, 67, 71] }, "major", "R").text, "Suggested fingering: split between hands.");
  assert.equal(stepFingering({ target: { kind: "set" }, show: [24, 60, 96] }, "major", "R"), null, "too wide to say");
  const phrase = stepFingering({ target: { kind: "sequence" }, show: [60, 62, 64, 62, 60] }, "major", "R");
  assert.match(phrase.text, /^Suggested fingering, right hand: [\d-]+\.$/); assert.equal(phrase.keys.length, 5);
  assert.equal(stepFingering({ target: { kind: "sequence" }, show: [36, 80, 40, 90, 41, 100] }, "major", "R"), null, "a long run the table cannot answer");
});

test("CR-FINGERING-14 litLessonFingers shows the fingers of the notes played so far, any hinted, and any shown, each key once", () => {
  const f = stepFingering({ target: { kind: "sequence" }, show: run(0, "major") }, "major", "R");
  const seq = { target: { kind: "sequence" } };
  assert.deepEqual(litLessonFingers(null, seq, [], [], null), []);
  assert.deepEqual(litLessonFingers(f, seq, [60, 62], [], null).map((k) => [k.midi, k.finger]), [[60, 1], [62, 2]]);
  assert.deepEqual(litLessonFingers(f, seq, [60, 61], [], null).map((k) => k.midi), [60], "a wrong note gets no finger");
  assert.deepEqual(litLessonFingers(f, seq, [60], [], 62).map((k) => [k.midi, k.finger]), [[60, 1], [62, 2]], "the hint shows the next finger");
  assert.deepEqual(litLessonFingers(f, seq, [], [72], null).map((k) => [k.midi, k.finger]), [[72, 5]]);
  const chordFing = stepFingering({ target: { kind: "set" }, show: [60, 64, 67] }, "major", "R");
  assert.deepEqual(litLessonFingers(chordFing, { target: { kind: "set" } }, [76], [], null).map((k) => [k.midi, k.finger]), [[76, 3]], "a chord matches by note name, in any octave");
});

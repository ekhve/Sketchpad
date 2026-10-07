/* sketchpad/lessons — unit tests, one per requirement in sketchpad/REQUIREMENTS.md (SR-LESSONS-nn). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { LESSONS, LESSON_TOPICS, buildLesson, lessonsFor, practiceNote, practiceFeedback, practiceHint, keyLandmark, stepWords, toneWord, nextKeyRound, chordShape, skipWalk, diagnoseSlip, hintMethod } from "../lessons.mjs";
import { sentenceCount } from "../guide.mjs";
import { pc, noteName } from "../../core/notes.mjs";

test("SR-LESSONS-01 the catalogue has lessons under each of its topics, with unique ids", () => {
  assert.deepEqual(LESSON_TOPICS.map((t) => t.id), ["scales", "chords", "progressions"]);
  assert.equal(new Set(LESSONS.map((l) => l.id)).size, LESSONS.length); assert.ok(LESSONS.length >= 9);
  for (const t of LESSON_TOPICS) assert.ok(LESSONS.some((l) => l.topic === t.id), t.id);
  assert.ok(LESSONS.every((l) => LESSON_TOPICS.some((t) => t.id === l.topic)));
});

test("SR-LESSONS-02 every lesson can be built for every key and both naming systems, with steps that say what to play and why", () => {
  for (const l of LESSONS) for (let root = 0; root < 12; root++) for (const system of ["letters", "solfege"]) {
    const built = buildLesson(l.id, root, system);
    assert.equal(built.id, l.id); assert.equal(built.root, root); assert.ok(built.title && built.intro && built.steps.length >= 1, `${l.id} ${root}`);
    built.steps.forEach((s, i) => { assert.equal(s.index, i); assert.ok(s.prompt && s.why, `${l.id} step ${i}`); assert.ok(["set", "sequence"].includes(s.target.kind)); assert.ok(s.show.length >= 1); assert.equal(s.scale.length, 7); });
  }
  assert.equal(buildLesson("no-such-lesson", 0), null);
  assert.deepEqual(lessonsFor(2).map((l) => l.id), LESSONS.map((l) => l.id));
});

test("SR-LESSONS-03 a lesson is spelled for its own key, whatever the app's setting, and its words use that spelling", () => {
  const minor = buildLesson("minor-scale", 0);
  assert.match(minor.steps.map((s) => s.prompt + s.why).join(" "), /E♭/);
  const sharp = buildLesson("major-scale", 7);
  assert.doesNotMatch(sharp.steps.map((s) => s.prompt).join(" "), /♭/);
  assert.match(buildLesson("major-scale", 0, "solfege").steps[0].prompt, /Do/);
});

test("SR-LESSONS-04 every step shows the notes it asks for, in the octave the keyboard is at", () => {
  for (const base of [48, 60]) for (const l of LESSONS) for (const s of buildLesson(l.id, 5, "letters", base).steps) {
    const want = new Set(s.target.pcs);
    assert.ok(s.show.every((m) => want.has(pc(m))), `${l.id}: shown notes are asked-for notes`);
    assert.ok([...want].every((p) => s.show.some((m) => pc(m) === p)), `${l.id}: every asked-for note is shown`);
    assert.ok(s.show.every((m) => m >= base - 12 && m <= base + 36));
  }
});

test("SR-LESSONS-05 a note is judged against a step: a sequence in order, a set in any order, and a slip costs nothing", () => {
  const set = { kind: "set", pcs: [0, 4, 7] }, seq = { kind: "sequence", pcs: [0, 2, 4], direction: "up" };
  assert.equal(practiceNote(set, [], 60).verdict, "progress"); assert.deepEqual(practiceNote(set, [], 60).missing, [4, 7]);
  assert.equal(practiceNote(set, [60, 64], 67).verdict, "done");
  const wrong = practiceNote(set, [60], 61); assert.equal(wrong.verdict, "wrong"); assert.deepEqual(wrong.attempt, [60], "the attempt is not taken away");
  assert.equal(practiceNote({ ...set, bassPc: 0 }, [64, 67], 72).verdict, "bass", "all the notes, but not with the root at the bottom");
  assert.equal(practiceNote(seq, [], 60).verdict, "progress"); assert.equal(practiceNote(seq, [60], 64).verdict, "wrong");
  assert.equal(practiceNote(seq, [60, 62], 64).verdict, "done"); assert.equal(practiceNote({ kind: "sequence", pcs: [0, 0], direction: "up" }, [60], 48).verdict, "direction", "the right note, the wrong way");
  assert.equal(practiceNote(set, [60, 64], 72).verdict, "progress", "a note already named in another octave is not new");
});

test("SR-LESSONS-06 feedback is short, answers a wrong note with the right one, and says what to do about the wrong way", () => {
  const lesson = buildLesson("major-triad", 0), step = lesson.steps[0];
  for (const attempt of [[], [60]]) for (const midi of [60, 61, 64, 67, 71]) {
    const f = practiceFeedback(step, practiceNote(step.target, attempt, midi), lesson.system);
    assert.ok(typeof f.head === "string" && typeof f.plain === "string"); assert.ok(sentenceCount(f.plain) <= 2, f.plain);
  }
  const seqStep = buildLesson("major-scale", 0).steps.find((s) => s.target.kind === "sequence" && s.target.direction);
  const dir = practiceFeedback(seqStep, { verdict: "direction", want: 4 }, "letters"); assert.equal(dir.head, "Right note, wrong way.");
  assert.equal(practiceFeedback(step, { verdict: "done" }).head, "That's it."); assert.equal(practiceFeedback(step, { verdict: "done" }).plain, step.why);
  assert.deepEqual(practiceFeedback(step, { verdict: "unknown" }), { head: "", plain: "" });
});

test("SR-LESSONS-07 a hint lights the next note a step wants, and says how to find it", () => {
  const step = buildLesson("major-scale", 0).steps.find((s) => s.target.kind === "sequence");
  const first = practiceHint(step, []); assert.equal(pc(first), step.target.pcs[0]);
  assert.equal(pc(practiceHint(step, [first])), step.target.pcs[1]);
  const triad = buildLesson("major-triad", 0).steps[0];
  assert.ok(triad.target.pcs.includes(pc(practiceHint(triad, []))));
  assert.ok(typeof hintMethod(step, []) === "string" && hintMethod(step, []).length > 5);
});

test("SR-LESSONS-08 the words for distances, tones, landmarks and chord shapes are complete over the octave", () => {
  for (let p = 0; p < 12; p++) { assert.ok(keyLandmark(p), `landmark ${p}`); assert.ok(toneWord(p), `tone word ${p}`); }
  assert.equal(stepWords(1), "a half step up (the very next key)"); assert.match(stepWords(2, "down"), /whole step down/);
  assert.equal(nextKeyRound(0), 7); assert.equal(nextKeyRound(7), 2);
  for (let r = 0; r < 12; r++) { let x = r; const seen = new Set(); for (let i = 0; i < 12; i++) { seen.add(x); x = nextKeyRound(x); } assert.equal(seen.size, 12, "twelve fifths visit every key"); assert.equal(x, r); }
  assert.equal(chordShape([0, 4, 7]).pattern, "WWW"); assert.match(chordShape([0, 4, 7]).text, /^Shape: all white keys/);
  assert.match(skipWalk([0, 4, 7], [0, 2, 4, 5, 7, 9, 11], "letters"), /^C, skip D, E, skip F, G$/);
  const chordStep = buildLesson("major-triad", 0).steps.find((s) => s.target.kind === "set" && s.target.pcs.length === 3);
  assert.match(diagnoseSlip(chordStep, practiceNote(chordStep.target, [], 61)), /C#/, "a slip names the note that was played");
  const run = buildLesson("major-scale", 0).steps.find((s) => s.target.kind === "sequence");
  const slip = diagnoseSlip(run, practiceNote(run.target, [], 61)); assert.ok(slip.length > 10 && sentenceCount(slip) <= 2, slip);
});

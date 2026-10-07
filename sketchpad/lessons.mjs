/* sketchpad/lessons — Learn mode: the lessons, judging each note played, and feedback that teaches a way of finding the note.
   Layer 4. Depends on: core/chords, core/harmony, core/notes, core/scales, core/voicing. Pure: no React, no Tone, no DOM, no dates, no randomness.
   Interface, behaviour and requirements: sketchpad/MODULES.md (lessons).
   Moved verbatim from the THEORY block of sketchpad.jsx (D-096); behaviour unchanged. */

import { chordLabel, QUALITIES } from "../core/chords.mjs";
import { harmonize } from "../core/harmony.mjs";
import { WHITE_PCS, pc, noteName, spelling } from "../core/notes.mjs";
import { scalePcs } from "../core/scales.mjs";
import { voice, stackAscending } from "../core/voicing.mjs";



/* ============================================================================
   LESSONS — short practice on the piano, judged note by note. (D-073, UC-58)

   A lesson is data: a few steps, each asking for something to be played. The
   judging is a pure function of the step and the notes played so far, so the
   one part a learner has to trust can be tested like the rest of the theory.

   Every lesson is built for whichever key is chosen, so each one can be
   practised in all twelve. The prompt says what to play; the reason why only
   appears once it has been played, which keeps D-011: theory follows the sound.
   ========================================================================== */

const LESSON_TOPICS = [
  { id: "scales", name: "Scales" },
  { id: "chords", name: "Chords" },
  { id: "progressions", name: "Progressions" },
];

const setTarget = (pcs, extra = {}) => ({ kind: "set", pcs: [...new Set(pcs)], ...extra });
const seqTarget = (pcs, direction) => ({ kind: "sequence", pcs, direction });

/* The notes a demonstration plays. A set is stacked upwards from its bottom
   note in close position; a sequence walks up or down one note at a time. */
function showSet(pcs, bassPc, base) {
  const b = bassPc ?? pcs[0];
  const order = [...pcs].sort((x, y) => pc(x - b) - pc(y - b));
  return voice(b, stackAscending(order, b), base);
}

function showSequence(pcs, direction, base) {
  const out = [];
  let m = direction === "down" ? base + pcs[0] + 12 : base + pcs[0];
  out.push(m);
  for (const p of pcs.slice(1)) {
    do { m += direction === "down" ? -1 : 1; } while (pc(m) !== p);
    out.push(m);
  }
  return out;
}

const showFor = (target, base) =>
  target.kind === "sequence" ? showSequence(target.pcs, target.direction, base) : showSet(target.pcs, target.bassPc, base);

/* A lesson's chords, taken from the same harmonisation the Chords tab uses, so
   what a lesson hands to the loop is exactly what the rest of the app plays. */
const chordPcs = (c) => c.notes.map(pc);

const LESSONS = [
  { id: "home", topic: "scales", title: "Find the home note",
    build: ({ r, nm }) => ({
      intro: `Every key has a home note, and here it is ${nm(r)}. The glowing dot on the piano marks it.`,
      steps: [
        { prompt: `Play ${nm(r)}.`, target: setTarget([r]),
          why: `Every ${nm(r)} on the keyboard is the same note, higher or lower. Music keeps coming back to it.`,
          rule: `Find ${nm(r)} by its neighbours: it is ${keyLandmark(r)}.` },
        { prompt: `Play ${nm(r)}, then the next ${nm(r)} up.`, target: seqTarget([r, r], "up"),
          why: "That jump is an octave: the same note, twice as high. Chords and scales repeat every octave.",
          rule: "Count every key, black and white: an octave is always 12 keys up." },
      ] }) },

  { id: "major-scale", topic: "scales", title: "The major scale",
    build: ({ r, nm, major }) => ({
      intro: `A scale is the set of notes a key uses. The ${nm(r)} major scale sounds bright and settled.`,
      steps: [
        { prompt: `Play it going up: ${[...major, r].map(nm).join(" ")}.`, target: seqTarget([...major, r], "up"),
          why: "The steps go whole, whole, half, whole, whole, whole, half. A half step is the very next key, black or white.",
          rule: "Every major scale is whole, whole, half, whole, whole, whole, half, from any starting note." },
        { prompt: "Now play it back down, from the top.", target: seqTarget([r, ...[...major].reverse()], "down"),
          why: "Same notes in reverse. Playing both directions is how the sound of a key gets into your ear.",
          rule: "The two half steps sit between notes 3 and 4 and between 7 and 8, whichever way you go." },
      ] }) },

  { id: "major-triad", topic: "chords", title: "Your first chord",
    build: ({ r, nm, major }) => {
      const tri = [major[0], major[2], major[4]];
      return {
        intro: "A chord is three or more notes played together. The simplest is built from notes 1, 3 and 5 of the scale.",
        steps: [
          { prompt: `Play ${tri.map(nm).join(", ")} one at a time, going up.`, target: seqTarget(tri, "up"),
            why: "You skipped a scale note each time. Stacking every other note is how chords are built.",
            rule: "A chord takes every other note of the scale: 1, skip, 3, skip, 5." },
          { prompt: "Now play all three together.", target: setTarget(tri),
            why: `That's ${nm(r)} major, the home chord of the key. It sounds finished because it is built on home.`,
            rule: "Every major chord is 4 + 3: four keys up from the root, then three more." },
        ] };
    } },

  { id: "minor-triad", topic: "chords", title: "Major to minor",
    build: ({ r, nm, major }) => {
      const maj = [major[0], major[2], major[4]];
      const min = [r, pc(r + 3), major[4]];
      return {
        intro: "Moving one note by a single key turns a bright chord into a sad one.",
        steps: [
          { prompt: `Play ${nm(r)} major: ${maj.map(nm).join(" ")}.`, target: setTarget(maj),
            why: "Remember how that sounds: bright and open.",
            rule: "Major is 4 + 3: the big gap is at the bottom." },
          { prompt: `Move ${nm(maj[1])} down one key to ${nm(min[1])}, and play ${min.map(nm).join(" ")}.`, target: setTarget(min),
            why: `That's ${nm(r)} minor. Only the middle note moved, and the whole mood changed.`,
            rule: "Minor is 3 + 4: the same outside notes, with the middle one a key lower." },
        ] };
    } },

  { id: "minor-scale", topic: "scales", title: "The minor scale", mode: "minor",
    build: ({ r, nm, minor }) => ({
      intro: "The natural minor scale is the darker sibling of the major. A lot of hip-hop and film music lives here.",
      steps: [
        { prompt: `Play ${nm(r)} minor going up: ${[...minor, r].map(nm).join(" ")}.`, target: seqTarget([...minor, r], "up"),
          why: "Compared with major, notes 3, 6 and 7 are one key lower. Those three notes carry the darkness.",
          rule: "Every natural minor scale is whole, half, whole, whole, half, whole, whole." },
        { prompt: "Now play it back down, from the top.", target: seqTarget([r, ...[...minor].reverse()], "down"),
          why: "Minor keys are named after their home note too, and every run of the scale ends there.",
          rule: `It uses the same notes as ${nm(minor[2])} major, starting three keys lower.` },
      ] }) },

  { id: "pentatonic", topic: "scales", title: "Five notes that always work", mode: "minor",
    build: ({ r, nm, penta }) => ({
      intro: "The minor pentatonic keeps five notes of the minor scale and drops the two that clash. It's the safest palette for a riff.",
      steps: [
        { prompt: `Play ${nm(r)} minor pentatonic going up: ${[...penta, r].map(nm).join(" ")}.`, target: seqTarget([...penta, r], "up"),
          why: "There are no half steps in it, so no two notes rub against each other. That's why it's hard to play a wrong note.",
          rule: "The jumps are 3, 2, 2, 3, 2 keys, from any home note." },
        { prompt: "Now play it back down, from the top.", target: seqTarget([r, ...[...penta].reverse()], "down"),
          why: "Any of these notes works over a minor chord on the same home note. Try making up a riff from them.",
          rule: `Over ${nm(r)} minor, any of these five notes is safe, so you can think about rhythm instead of notes.` },
      ] }) },

  { id: "key-chords", topic: "chords", title: "The three main chords",
    build: ({ nm, lbl, tri }) => {
      const [I, IV, V] = [tri[0], tri[3], tri[4]];
      const shared = chordPcs(I).filter((p) => chordPcs(IV).includes(p));
      return {
        intro: "Every note of the scale has its own chord. Three of them, on notes 1, 4 and 5, carry most songs.",
        steps: [
          { prompt: `Play chord I, ${lbl(I)}: ${chordPcs(I).map(nm).join(" ")}.`, target: setTarget(chordPcs(I)),
            why: "Chord I is home: stable and bright.",
            rule: "In every major key, chords I, IV and V are the three major chords." },
          { prompt: `Play chord IV, ${lbl(IV)}: ${chordPcs(IV).map(nm).join(" ")}.`, target: setTarget(chordPcs(IV)),
            why: `Chord IV lifts away from home. It shares ${shared.map(nm).join(" and ")} with chord I, so the move is smooth.`,
            rule: "Chord IV is always 5 keys above the home note." },
          { prompt: `Play chord V, ${lbl(V)}: ${chordPcs(V).map(nm).join(" ")}.`, target: setTarget(chordPcs(V)),
            why: "Chord V pulls back towards home. Play chord I straight after it and you hear the pull resolve.",
            rule: "Chord V is always 7 keys above the home note, and it wants to go back to I." },
        ],
        loop: [I, IV, V, I] };
    } },

  { id: "four-chords", topic: "progressions", title: "The four-chord loop",
    build: ({ nm, lbl, tri }) => {
      const [I, V, vi, IV] = [tri[0], tri[4], tri[5], tri[3]];
      const ask = (numeral, c) => ({ prompt: `Play ${numeral}, ${lbl(c)}: ${chordPcs(c).map(nm).join(" ")}.`, target: setTarget(chordPcs(c)) });
      return {
        intro: "One progression, I–V–vi–IV, sits under hundreds of pop songs. Play it chord by chord.",
        steps: [
          { ...ask("I", I), why: "Chord I: home, where the loop starts.",
            rule: "Think in numbers, not names: I–V–vi–IV works in every key." },
          { ...ask("V", V), why: "Chord V builds tension and wants to move on.",
            rule: "V is 7 keys above I, in every key: count from the home chord's root." },
          { ...ask("vi", vi), why: "Chord vi is minor, so the mood darkens for a moment.",
            rule: "vi is 3 keys below I, and always minor." },
          { ...ask("IV", IV), why: "Chord IV lifts, and leads back to I when the loop comes round again.",
            rule: "IV is 5 keys above I, one step before home on the circle of fifths." },
        ],
        loop: [I, V, vi, IV] };
    } },

  { id: "inversions", topic: "chords", title: "Same chord, different bottom",
    build: ({ r, nm, major }) => {
      const tri = [major[0], major[2], major[4]];
      return {
        intro: "An inversion is a chord with a different note at the bottom. The chord stays the same; its weight changes.",
        steps: [
          { prompt: `Play ${nm(r)} major with ${nm(tri[0])} at the bottom.`, target: setTarget(tri, { bassPc: tri[0] }),
            why: "This is root position: solid and grounded.",
            rule: "Root position puts the chord's name at the bottom." },
          { prompt: `Now put ${nm(tri[1])} at the bottom: ${nm(tri[1])}, ${nm(tri[2])}, ${nm(tri[0])}.`, target: setTarget(tri, { bassPc: tri[1] }),
            why: "First inversion. It sounds lighter and less final, which suits the middle of a phrase.",
            rule: "To invert, lift the bottom note up an octave; the other two stay put." },
          { prompt: `And ${nm(tri[2])} at the bottom: ${nm(tri[2])}, ${nm(tri[0])}, ${nm(tri[1])}.`, target: setTarget(tri, { bassPc: tri[2] }),
            why: "Second inversion. Pianists use inversions so their hand barely moves between chords.",
            rule: "Lift the bottom note once more and the fifth is at the bottom: that's second inversion." },
        ] };
    } },

  { id: "sevenths", topic: "chords", title: "Seventh chords",
    build: ({ nm, lbl, sev }) => {
      const [I7, V7] = [sev[0], sev[4]];
      return {
        intro: "Add one more skipped note on top of a triad and you get a seventh chord. It's the sound of soul, house and R&B.",
        steps: [
          { prompt: `Play ${lbl(I7)}: ${chordPcs(I7).map(nm).join(" ")}.`, target: setTarget(chordPcs(I7)),
            why: "The major seventh sits one key below the octave. It makes the home chord soft and dreamy.",
            rule: "A major seventh chord is 4 + 3 + 4: its top note is one key below the root." },
          { prompt: `Play ${lbl(V7)}: ${chordPcs(V7).map(nm).join(" ")}.`, target: setTarget(chordPcs(V7)),
            why: "On chord V the seventh is flatter, a dominant seventh. It pulls towards home even harder than plain V.",
            rule: "A dominant seventh is 4 + 3 + 3: its top note is two keys below the root." },
        ],
        loop: [sev[0], sev[5], sev[1], sev[4]] };
    } },
];

/* A lesson, built for one key. `base` is the octave the demonstration plays
   in; the app passes one that is always on screen. Each lesson is spelled for
   its own key — a minor-scale lesson reads E♭ in C even when the app is set to
   C major — and carries that spelling so its feedback matches. (D-074) */
function buildLesson(id, root, system = "letters", base = 60) {
  const def = LESSONS.find((l) => l.id === id);
  if (!def) return null;
  const r = pc(root);
  const names = spelling(system, r, def.mode ?? "major");
  const nm = (p) => noteName(p, names);
  const tri = harmonize(r, "major", 3, base);
  const sev = harmonize(r, "major", 4, base);
  const keyScale = scalePcs(r, def.mode === "minor" ? "natural-minor" : "major");
  const body = def.build({
    r, nm,
    lbl: (c) => chordLabel(c.rootPc, c.sym, names),
    major: scalePcs(r, "major"),
    minor: scalePcs(r, "natural-minor"),
    penta: scalePcs(r, "minor-pentatonic"),
    tri, sev,
  });
  return {
    id: def.id, topic: def.topic, title: def.title, root: r, system: names, mode: def.mode ?? "major",
    intro: body.intro,
    steps: body.steps.map((s, i) => ({ ...s, index: i, scale: keyScale, show: showFor(s.target, base) })),
    loop: body.loop ?? null,
  };
}

const lessonsFor = (root, system = "letters", base = 60) => LESSONS.map((l) => buildLesson(l.id, root, system, base));

/* Judge one note against a step. `attempt` holds the notes already accepted,
   in the order they were played. Nothing is ever taken away from an attempt,
   so a slip costs nothing: the wrong note is named and the step carries on.

     set       every pitch class, any order, any octave, one at a time or
               together; optionally with a named note at the bottom
     sequence  the pitch classes in order, and if a direction is given, each
               note really must be higher (or lower) than the last */
function practiceNote(target, attempt, midi) {
  const p = pc(midi);
  if (target.kind === "sequence") {
    const want = target.pcs[attempt.length];
    const last = attempt[attempt.length - 1];
    if (want === undefined) return { attempt, verdict: "done", played: p };
    if (p !== want) return { attempt, verdict: "wrong", played: p, want };
    if (last !== undefined && target.direction === "up" && midi <= last) return { attempt, verdict: "direction", played: p, want };
    if (last !== undefined && target.direction === "down" && midi >= last) return { attempt, verdict: "direction", played: p, want };
    const next = [...attempt, midi];
    const done = next.length === target.pcs.length;
    return { attempt: next, verdict: done ? "done" : "progress", played: p, want: target.pcs[next.length], left: target.pcs.length - next.length };
  }

  const have = new Set(attempt.map(pc));
  if (!target.pcs.includes(p)) {
    return { attempt, verdict: "wrong", played: p, missing: target.pcs.filter((x) => !have.has(x)) };
  }
  const next = attempt.includes(midi) ? attempt : [...attempt, midi];
  const got = new Set(next.map(pc));
  const missing = target.pcs.filter((x) => !got.has(x));
  if (missing.length) return { attempt: next, verdict: "progress", played: p, missing };
  const lowest = pc(Math.min(...next));
  if (target.bassPc !== undefined && lowest !== target.bassPc) {
    return { attempt: next, verdict: "bass", played: p, lowest, want: target.bassPc };
  }
  return { attempt: next, verdict: "done", played: p, missing: [] };
}

/* What to say about it. Two sentences at most, and a wrong note is always
   answered with the right one, so a slip teaches a name. (D-051, D-073) */
function practiceFeedback(step, result, system = "letters") {
  const nm = (p) => noteName(p, system);
  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
  switch (result.verdict) {
    case "done":
      return { head: "That's it.", plain: step.why };
    case "progress":
      return step.target.kind === "sequence"
        ? { head: `${nm(result.played)} — yes.`, plain: `${plural(result.left, "note")} to go.` }
        : { head: `${nm(result.played)} — yes.`, plain: `${plural(result.missing.length, "note")} still to find.` };
    case "wrong":
      return step.target.kind === "sequence"
        ? { head: `${nm(result.played)} isn't next.`, plain: diagnoseSlip(step, result, system) }
        : { head: `${nm(result.played)} isn't in this one.`,
            plain: `${diagnoseSlip(step, result, system)} Still to find: ${result.missing.map(nm).join(" ")}.` };
    case "direction":
      return { head: `Right note, wrong way.`,
        plain: `Play the ${nm(result.want)} ${step.target.direction === "down" ? "below" : "above"} your last note.` };
    case "bass":
      return { head: "All the notes are there.",
        plain: `${nm(result.lowest)} is at the bottom, though. Add another ${nm(result.want)} below the others.` };
    default:
      return { head: "", plain: "" };
  }
}

/* The note a hint lights: the next one a sequence wants, the first one a chord
   is still missing, or the bottom note an inversion needs. */
function practiceHint(step, attempt) {
  const t = step.target;
  if (t.kind === "sequence") return step.show[attempt.length] ?? null;
  const got = new Set(attempt.map(pc));
  const missing = t.pcs.find((p) => !got.has(p));
  if (missing !== undefined) return step.show.find((m) => pc(m) === missing) ?? null;
  return step.show[0] ?? null;
}

/* ============================================================================
   HOW TO THINK — feedback that teaches a way of finding the note, not only
   the note. (D-075)

   Most wrong notes come from a handful of thinking errors, and each one has
   its own fix: a third counted one key short, a scale note taken where a chord
   skips it, a scale note skipped, a step of the wrong size. Naming the error
   teaches the method, and the method is what works on your own instrument,
   without the app. Everything counts keys the way a beginner can check it:
   every key, black and white.
   ========================================================================== */

/* Where a note lives, by the black keys around it. */
const LANDMARKS = [
  "just left of the pair of black keys",
  "the first of the pair of black keys",
  "between the pair of black keys",
  "the second of the pair of black keys",
  "just right of the pair of black keys",
  "just left of the three black keys",
  "the first of the three black keys",
  "between the first and second of the three black keys",
  "the middle of the three black keys",
  "between the second and third of the three black keys",
  "the last of the three black keys",
  "just right of the three black keys",
];
const keyLandmark = (p) => LANDMARKS[pc(p)];

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

/* The size of a step and its direction, said so it can be found on the
   keyboard. A step of 0 between two notes of the same name is an octave. */
function stepWords(n, dir = "up") {
  if (n === 1) return `a half step ${dir} (the very next key)`;
  if (n === 2) return `a whole step ${dir} (skip one key)`;
  if (n === 3) return `three keys ${dir} (a minor third)`;
  if (n === 0 || n === 12) return `an octave ${dir} (12 keys)`;
  return `${plural(n, "key")} ${dir}`;
}

/* The name of a chord tone by its distance from the root. */
const TONE_WORDS = { 0: "root", 2: "ninth", 3: "minor third", 4: "major third", 6: "flat fifth",
  7: "fifth", 8: "sharp fifth", 9: "sixth", 10: "seventh", 11: "major seventh" };
const toneWord = (semis) => TONE_WORDS[pc(semis)] ?? "note";

/* A chord's notes as the scale walk that makes them: "C, skip D, E, skip F, G".
   Only when every chord tone is in the scale and they really are every other
   note; otherwise null, and the counting explanation is used instead. */
function skipWalk(chordPcsRootFirst, scale, system) {
  if (!scale || !chordPcsRootFirst.every((p) => scale.includes(p))) return null;
  const start = scale.indexOf(chordPcsRootFirst[0]);
  const walk = [];
  for (let k = 0; k < chordPcsRootFirst.length; k++) {
    const want = scale[(start + 2 * k) % scale.length];
    if (want !== chordPcsRootFirst[k]) return null;
    if (k > 0) walk.push(`skip ${noteName(scale[(start + 2 * k - 1) % scale.length], system)}`);
    walk.push(noteName(want, system));
  }
  return walk.join(", ");
}

/* One sentence on why this note was not the one, and how to find the right one. */
function diagnoseSlip(step, result, system = "letters") {
  const nm = (p) => noteName(p, system);
  const t = step.target;
  const P = result.played;

  if (t.kind === "sequence") {
    const W = result.want;
    if (!result.attempt.length) return `A scale starts on its home note, ${nm(W)}, ${keyLandmark(W)}.`;
    const prev = pc(result.attempt[result.attempt.length - 1]);
    const down = t.direction === "down";
    const size = down ? pc(prev - W) : pc(W - prev);
    const later = t.pcs.slice(result.attempt.length + 1).includes(P);
    if (later) return `You skipped ${nm(W)}: from ${nm(prev)} the next note is ${stepWords(size, down ? "down" : "up")}.`;
    if (Math.min(pc(P - W), pc(W - P)) === 1) {
      return `From ${nm(prev)} it's ${stepWords(size, down ? "down" : "up")}, which lands on ${nm(W)}, not ${nm(P)}.`;
    }
    return `The next note is ${nm(W)}: from ${nm(prev)} it's ${stepWords(size, down ? "down" : "up")}.`;
  }

  const root = t.pcs[0];
  if (t.pcs.length === 1) return `${nm(root)} is ${keyLandmark(root)}.`;
  const walk = skipWalk(t.pcs, step.scale, system);
  if (walk && step.scale.includes(P)) return `${nm(P)} is in the scale, but a chord takes every other note: ${walk}.`;
  const missing = result.missing ?? [];
  const near = missing.find((m) => Math.min(pc(P - m), pc(m - P)) === 1);
  if (near !== undefined && near !== root) {
    return `${nm(P)} is ${plural(pc(P - root), "key")} above ${nm(root)}; the ${toneWord(near - root)} is ${plural(pc(near - root), "key")} up, at ${nm(near)}.`;
  }
  if (near === root) return `${nm(P)} is one key away from the root, ${nm(root)}.`;
  const gaps = t.pcs.slice(1).map((p, i) => pc(p - t.pcs[i]));
  return `From ${nm(root)} this chord counts ${gaps.join(" + ")} keys; ${nm(P)} is ${plural(pc(P - root), "key")} up.`;
}

/* The first rung of the hint ladder: how to find the next note, without
   naming the key to press. The second rung lights it; Show me plays it all. */
function hintMethod(step, attempt, system = "letters") {
  const nm = (p) => noteName(p, system);
  const t = step.target;
  if (t.kind === "sequence") {
    if (!attempt.length) return `Start on ${nm(t.pcs[0])}, ${keyLandmark(t.pcs[0])}.`;
    const prev = pc(attempt[attempt.length - 1]);
    const want = t.pcs[attempt.length];
    const down = t.direction === "down";
    return `From ${nm(prev)}, go ${stepWords(down ? pc(prev - want) : pc(want - prev), down ? "down" : "up")}.`;
  }
  const root = t.pcs[0];
  const got = new Set(attempt.map(pc));
  const missing = t.pcs.find((p) => !got.has(p));
  if (t.pcs.length === 1) return `Look for ${nm(root)}: it is ${keyLandmark(root)}.`;
  if (missing === root) return `Start with the root, ${nm(root)}: the chord is named after it.`;
  if (missing !== undefined) return `Count ${plural(pc(missing - root), "key")} up from ${nm(root)} for the ${toneWord(missing - root)}, counting every key.`;
  return `Play another ${nm(t.bassPc)} to the left of everything else: the lowest note decides the inversion.`;
}

/* Pianists remember chords as shapes of white and black keys, and the shape
   repeats: C, F and G major are all white; D, E and A put a black key in the
   middle. Naming the family is what makes a new key feel familiar. */
const SHAPE_WORDS = { W: "white", B: "black" };
function chordShape(pcsRootFirst, system = "letters") {
  if (pcsRootFirst.length !== 3) return null;
  const root = pcsRootFirst[0];
  const iv = pcsRootFirst.map((p) => pc(p - root));
  const quality = QUALITIES[iv.join(",")];
  if (!quality || !["", "m"].includes(quality.sym)) return null;
  const pattern = (r) => iv.map((i) => (WHITE_PCS.includes(pc(r + i)) ? "W" : "B")).join("");
  const own = pattern(root);
  const words = own === "WWW" ? "all white keys" : own === "BBB" ? "all black keys"
    : own.split("").map((c) => SHAPE_WORDS[c]).join(", ");
  const mode = quality.sym === "m" ? "minor" : "major";
  const others = [];
  for (let r = 0; r < 12; r++) {
    if (r !== root && pattern(r) === own) others.push(chordLabel(r, quality.sym, spelling(system, r, mode)));
  }
  return {
    pattern: own, others,
    text: others.length
      ? `Shape: ${words}, the same as ${others.join(", ")}.`
      : `Shape: ${words}, and no other ${mode} chord has it.`,
  };
}

/* One step round the circle of fifths: the key whose scale differs from this
   one by a single note, and the natural next place to practise. */
const nextKeyRound = (root) => pc(root + 7);


export { LESSON_TOPICS, LESSONS, buildLesson, lessonsFor, practiceNote, practiceFeedback, practiceHint, keyLandmark, stepWords, toneWord, skipWalk, diagnoseSlip, hintMethod, chordShape, nextKeyRound };

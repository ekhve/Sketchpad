/* Sketchpad — automated checks for the @auto scenarios in sketchpad.feature
 *
 *   node tests/extract-theory.mjs sketchpad.jsx tests/theory.mjs
 *   node --test tests/
 *
 * Each test name is the Gherkin scenario it implements, so a failure points
 * straight at the behaviour that broke rather than at a function name.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as th from "./theory.mjs";

const { pc, noteName, chordLabel, scalePcs, harmonize, explainChord, fitScales, keyRole, keyMarker, SCALES, scaleById } = th;

/* helpers ---------------------------------------------------------------- */
const WHITE_PCS_TEST = [0, 2, 4, 5, 7, 9, 11];
const NAMES_T = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const PC = { C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11 };
const names = (pcs) => pcs.map((p) => noteName(p, "letters")).join(" ");
const label = (c) => chordLabel(c.rootPc, c.sym, "letters");
const palette = (tonic, mode, size = 3) => harmonize(tonic, mode === "minor" ? "natural-minor" : "major", size);
const find = (chords, name) => chords.find((c) => label(c) === name);

describe("Feature: Choosing a key sets the musical context", () => {
  test("The scale of a minor key", () => {
    assert.equal(names(scalePcs(PC["C#"], "natural-minor")), "C# D# E F# G# A B");
  });

  test("Scales across keys", () => {
    const cases = [
      [PC.C, "major", "C D E F G A B"],
      [PC.A, "natural-minor", "A B C D E F G"],
      [PC["F#"], "natural-minor", "F# G# A B C# D E"],
      [PC["A#"], "natural-minor", "A# C C# D# F F# G#"],
    ];
    for (const [tonic, scale, expected] of cases) {
      assert.equal(names(scalePcs(tonic, scale)), expected, `${noteName(tonic, "letters")} ${scale}`);
    }
  });
});

describe("Feature: The chord palette", () => {
  test("Triads of a minor key", () => {
    const chords = palette(PC["C#"], "minor");
    assert.equal(chords.length, 7);
    assert.equal(chords.map(label).join(" "), "C#m D#dim E F#m G#m A B");
    assert.equal(names(find(chords, "C#m").notes.map(pc)), "C# E G#");
    assert.equal(names(find(chords, "A").notes.map(pc)), "A C# E");
  });

  test("Triads of a major key", () => {
    assert.equal(palette(PC.C, "major").map(label).join(" "), "C Dm Em F G Am Bdim");
  });

  test("Sevenths of a minor key", () => {
    const chords = palette(PC["C#"], "minor", 4);
    assert.equal(chords.map(label).join(" "), "C#m7 D#m7♭5 Emaj7 F#m7 G#m7 Amaj7 B7");
    assert.equal(names(find(chords, "C#m7").notes.map(pc)), "C# E G# B");
  });

  test("Every key produces a complete, recognised palette", () => {
    for (let tonic = 0; tonic < 12; tonic++) {
      for (const mode of ["minor", "major"]) {
        for (const size of [3, 4]) {
          const chords = palette(tonic, mode, size);
          assert.equal(chords.length, 7, `${tonic} ${mode} ${size}`);
          for (const c of chords) {
            assert.notEqual(c.sym, "?", `unrecognised quality: ${noteName(tonic, "letters")} ${mode} degree ${c.degreeIndex}`);
            assert.equal(c.notes.length, size);
            assert.equal(pc(c.notes[0]), c.rootPc, "first note of the voicing is the root");
          }
        }
      }
    }
  });

  test("Roman numerals match the degree and quality", () => {
    assert.deepEqual(palette(PC["C#"], "minor").map((c) => c.roman),
      ["i", "ii°", "♭III", "iv", "v", "♭VI", "♭VII"]);
    assert.deepEqual(palette(PC.C, "major").map((c) => c.roman),
      ["I", "ii", "iii", "IV", "V", "vi", "vii°"]);
  });
});

describe("Feature: Understanding why a chord fits", () => {
  const ctx = { tonic: PC["C#"], mode: "minor", scaleId: "natural-minor" };

  test("A diatonic chord shares notes with home", () => {
    const A = find(palette(PC["C#"], "minor"), "A");
    const e = explainChord(A, ctx);
    assert.deepEqual(e.outside, []);
    assert.match(e.plain, /C#/);
    assert.match(e.plain, /E/);
  });

  test("A borrowed chord is explained, not rejected", () => {
    const gSharp7 = { rootPc: PC["G#"], sym: "7", full: "dominant 7th", degreeIndex: 4, roman: "V7",
                      notes: [56, 60, 63, 66] };   // G#3 C4 D#4 F#4 — the C is B#
    const e = explainChord(gSharp7, ctx);
    assert.deepEqual(e.outside, [PC.C], "B# / C is the note outside the key of C# minor");
    assert.match(e.head, /outside the key/);
    assert.doesNotMatch(e.plain, /avoid|don't|do not use/i);
  });

  test("A diatonic chord is not called foreign just because a subset palette is selected", () => {
    // Regression: minor pentatonic is a five-note subset of the key, offered as
    // a melodic palette. Judging harmony against it made the perfectly diatonic
    // bVI chord report as "outside the scale", which was wrong and misleading.
    const A = find(palette(PC["C#"], "minor"), "A");
    for (const scaleId of ["minor-pentatonic", "blues", "natural-minor"]) {
      const e = explainChord(A, { tonic: PC["C#"], mode: "minor", scaleId });
      assert.deepEqual(e.outside, [], `${scaleId}: a diatonic chord must never read as outside the key`);
      assert.doesNotMatch(e.head, /outside/, `${scaleId}: headline should not cry foul`);
    }
  });

  test("A chord tone missing from the chosen palette is mentioned, gently", () => {
    const A = find(palette(PC["C#"], "minor"), "A");
    const pent = explainChord(A, { tonic: PC["C#"], mode: "minor", scaleId: "minor-pentatonic" });
    assert.deepEqual(pent.outsidePalette, [PC.A], "A is absent from C# minor pentatonic");
    assert.match(pent.plain, /still fully in key/);
    const nat = explainChord(A, { tonic: PC["C#"], mode: "minor", scaleId: "natural-minor" });
    assert.deepEqual(nat.outsidePalette, [], "nothing to mention when the palette is the parent scale");
    assert.doesNotMatch(nat.plain, /palette/);
  });

  test("Borrowed chords are still judged against the key, whatever palette is active", () => {
    const gSharp7 = { rootPc: PC["G#"], sym: "7", full: "dominant 7th", degreeIndex: 4, roman: "V7",
                      notes: [56, 60, 63, 66] };
    for (const scaleId of ["natural-minor", "minor-pentatonic", "dorian"]) {
      const e = explainChord(gSharp7, { tonic: PC["C#"], mode: "minor", scaleId });
      assert.deepEqual(e.outside, [PC.C], `${scaleId}: B# is outside the key regardless of palette`);
    }
  });

  test("The same chord explained in Do Re Mi", () => {
    const A = find(palette(PC["C#"], "minor"), "A");
    const e = explainChord(A, ctx, "solfege");
    assert.match(e.head, /^La /);
    assert.match(e.plain, /Do#/);
    assert.match(e.plain, /Mi/);
  });
});

describe("Feature: Scales and their differences", () => {
  test("Scale contents", () => {
    const cases = [
      ["natural-minor", "C# D# E F# G# A B"],
      ["dorian", "C# D# E F# G# A# B"],
      ["minor-pentatonic", "C# E F# G# B"],
      ["harmonic-minor", "C# D# E F# G# A C"],
      ["phrygian", "C# D E F# G# A B"],
      ["blues", "C# E F# G G# B"],
    ];
    for (const [id, expected] of cases) {
      assert.equal(names(scalePcs(PC["C#"], id)), expected, id);
    }
  });

  test("Dorian differs from natural minor by exactly one note", () => {
    const nat = scalePcs(PC["C#"], "natural-minor");
    const dor = scalePcs(PC["C#"], "dorian");
    const gained = dor.filter((p) => !nat.includes(p));
    const lost = nat.filter((p) => !dor.includes(p));
    assert.deepEqual(gained.map((p) => noteName(p, "letters")), ["A#"]);
    assert.deepEqual(lost.map((p) => noteName(p, "letters")), ["A"]);
  });

  test("The one-note difference holds in every key", () => {
    for (let tonic = 0; tonic < 12; tonic++) {
      const nat = scalePcs(tonic, "natural-minor");
      const dor = scalePcs(tonic, "dorian");
      assert.equal(dor.filter((p) => !nat.includes(p)).length, 1, `tonic ${tonic}`);
    }
  });

  test("Every scale definition is well formed", () => {
    for (const s of SCALES) {
      assert.equal(s.iv[0], 0, `${s.id} starts on the tonic`);
      assert.deepEqual([...s.iv].sort((a, b) => a - b), s.iv, `${s.id} intervals ascend`);
      assert.equal(new Set(s.iv).size, s.iv.length, `${s.id} has no duplicates`);
      assert.ok(s.iv.every((i) => i >= 0 && i < 12), `${s.id} stays within an octave`);
      assert.ok(s.mood && s.tags.length, `${s.id} has a mood and tags`);
    }
  });
});

describe("Feature: Finding the scale that fits what I built", () => {
  test("A diatonic loop fits its own scale", () => {
    const p = palette(PC["C#"], "minor");
    const loop = ["C#m", "A", "E", "B"].map((n) => find(p, n));
    const fits = fitScales(loop, PC["C#"]);
    const nat = fits.find((f) => f.scale.id === "natural-minor");
    assert.equal(nat.fit, 1, "natural minor covers every note");
    assert.equal(nat.missing.length, 0);
    const pent = fitScales(loop, PC["C#"]).find((f) => f.scale.id === "minor-pentatonic");
    if (pent) assert.ok(pent.fit < 1, "pentatonic cannot cover all seven");
  });

  test("A loop with a borrowed chord names what does not fit", () => {
    const p = palette(PC["C#"], "minor");
    const loop = [find(p, "C#m"), find(p, "A"), find(p, "E"),
                  { rootPc: PC["G#"], sym: "7", notes: [56, 60, 63, 66] }];
    const fits = fitScales(loop, PC["C#"]);
    assert.ok(fits.every((f) => f.fit < 1), "nothing covers everything");
    assert.ok(fits[0].missing.map((m) => noteName(m, "letters")).includes("C"),
      "the borrowed note is reported");
  });

  test("An empty loop returns nothing rather than throwing", () => {
    assert.deepEqual(fitScales([], PC["C#"]), []);
  });
});

describe("Feature: The piano shows harmony and palette at the same time", () => {
  // C#m voiced at C#3 E3 G#3
  const cm = { chordNotes: [49, 52, 56], chordRootMidi: 49, loopNotes: [], sounding: [] };
  const scale = { tonic: PC["C#"], scaleSet: scalePcs(PC["C#"], "natural-minor") };

  test("A chord tone inside the scale", () => {
    assert.equal(keyRole(52, cm), "chordTone");        // E3
    assert.equal(keyMarker(52, scale), "scale");
  });

  test("The root of the selected chord is distinguished", () => {
    assert.equal(keyRole(49, cm), "chordRoot");        // C#3
    assert.equal(keyMarker(49, scale), "home");
  });

  test("A chord lights only the octave it is voiced in", () => {
    assert.equal(keyRole(49, cm), "chordRoot");        // C#3, the voiced root
    assert.equal(keyRole(61, cm), "plain");            // C#4 — same note name, not in this voicing
    assert.equal(keyRole(37, cm), "plain");            // C#2
    assert.equal(keyRole(64, cm), "plain");            // E4, not the voiced E3
  });

  test("The scale marker still covers every octave", () => {
    // a voicing is specific; a palette is not
    for (const midi of [37, 49, 61, 73]) assert.equal(keyMarker(midi, scale), "home");
    for (const midi of [52, 64]) assert.equal(keyMarker(midi, scale), "scale");
  });

  test("A note only used elsewhere in the loop", () => {
    const state = { ...cm, loopNotes: [59] };
    assert.equal(keyRole(59, state), "inLoop");        // B3
    assert.equal(keyRole(71, state), "plain");         // B4 is not in the loop's voicings
  });

  test("A sounding note overrides every other fill", () => {
    assert.equal(keyRole(49, { ...cm, sounding: [49] }), "sounding");
  });

  test("A note outside chord, loop and scale has neither fill nor marker", () => {
    assert.equal(keyRole(55, cm), "plain");            // G3
    assert.equal(keyMarker(55, scale), null);
  });

  test("The two channels are independent", () => {
    // G#7 voiced G#3 C4 D#4 F#4 — the C is a chord tone from outside the scale
    const borrowed = { chordNotes: [56, 60, 63, 66], chordRootMidi: 56, loopNotes: [], sounding: [] };
    assert.equal(keyRole(60, borrowed), "chordTone");  // C4: fill yes
    assert.equal(keyMarker(60, scale), null);          // marker no
  });
});

describe("Feature: Note naming", () => {
  test("Fixed-do naming", () => {
    const cases = [["C", "Do"], ["D", "Re"], ["E", "Mi"], ["F", "Fa"],
                   ["G", "Sol"], ["A", "La"], ["B", "Si"], ["C#", "Do#"]];
    for (const [letter, solfege] of cases) {
      assert.equal(noteName(PC[letter], "solfege"), solfege);
    }
  });

  test("Chord labels follow the naming system", () => {
    const home = palette(PC["C#"], "minor")[0];
    assert.equal(chordLabel(home.rootPc, home.sym, "solfege"), "Do#m");
    assert.equal(chordLabel(home.rootPc, home.sym, "letters"), "C#m");
  });

  test("Naming never changes the underlying notes", () => {
    const a = palette(PC["C#"], "minor");
    const b = palette(PC["C#"], "minor");
    assert.deepEqual(a.map((c) => c.notes), b.map((c) => c.notes));
  });
});

describe("Invariants", () => {
  test("Pitch class arithmetic wraps correctly in both directions", () => {
    assert.equal(pc(-1), 11);
    assert.equal(pc(12), 0);
    assert.equal(pc(60), 0);
    assert.equal(pc(-13), 11);
  });

  test("Chord voicings stay in a playable register", () => {
    for (let tonic = 0; tonic < 12; tonic++) {
      for (const c of palette(tonic, "minor", 4)) {
        assert.ok(c.notes[0] >= 48 && c.notes[0] <= 59, "root sits in C3-B3");
        assert.ok(Math.max(...c.notes) <= 72, "nothing above C5");
        assert.ok(c.notes.length <= 8, "at most 8 notes (D-007)");
      }
    }
  });

  test("Chord notes ascend within a voicing", () => {
    for (const c of palette(PC["C#"], "minor", 4)) {
      const sorted = [...c.notes].sort((a, b) => a - b);
      assert.deepEqual(c.notes, sorted, chordLabel(c.rootPc, c.sym, "letters"));
    }
  });
});

/* ==========================================================================
   UC-29 — riffs and basslines
   ========================================================================== */

const { PATTERNS, STYLES, patternsFor, renderFigure, renderProgressionFigure,
        explainFigure, place, STEPS_PER_BAR } = th;

describe("Feature: Riff and bassline suggestions", () => {
  const tonic = PC["C#"];
  const scale = scalePcs(tonic, "natural-minor");
  const p = palette(tonic, "minor");
  const loop = ["C#m", "A", "E", "B"].map((n) => find(p, n));
  const bassPattern = PATTERNS.find((x) => x.id === "bass-walk");
  const riffPattern = PATTERNS.find((x) => x.id === "riff-hook");

  test("A bassline starts on the root of its chord", () => {
    for (const chord of loop) {
      const fig = renderFigure(bassPattern, chord, loop[0], scale, 1, 36);
      assert.equal(pc(fig[0].midi), chord.rootPc, chordLabel(chord.rootPc, chord.sym, "letters"));
    }
  });

  test("Every note is a chord tone, a scale note, or a deliberate approach", () => {
    for (const pattern of PATTERNS) {
      for (let seed = 0; seed < 30; seed++) {
        for (let i = 0; i < loop.length; i++) {
          const fig = renderFigure(pattern, loop[i], loop[(i + 1) % 4], scale, seed, 48);
          for (const n of fig) {
            const inChord = loop[i].notes.map(pc).includes(pc(n.midi));
            const inScale = scale.includes(pc(n.midi));
            assert.ok(inChord || inScale || n.role === "approach",
              `${pattern.id} produced ${noteName(n.midi, "letters")} which is neither chord tone, scale note, nor approach`);
          }
        }
      }
    }
  });

  test("Only approach notes are allowed outside the scale", () => {
    let sawApproachOutside = false;
    for (const pattern of PATTERNS) {
      for (let seed = 0; seed < 30; seed++) {
        const fig = renderFigure(pattern, loop[0], loop[1], scale, seed, 48);
        for (const n of fig) {
          if (!scale.includes(pc(n.midi))) {
            assert.equal(n.role, "approach", `${pattern.id}: non-approach note left the scale`);
            sawApproachOutside = true;
          }
        }
      }
    }
    assert.ok(sawApproachOutside, "at least one approach note should be chromatic, or the feature is doing nothing");
  });

  test("The same seed always gives the same figure", () => {
    const a = renderFigure(riffPattern, loop[0], loop[1], scale, 42, 60);
    const b = renderFigure(riffPattern, loop[0], loop[1], scale, 42, 60);
    assert.deepEqual(a, b);
  });

  test("Different seeds give different figures", () => {
    const variants = new Set();
    for (let seed = 0; seed < 20; seed++) {
      variants.add(JSON.stringify(renderFigure(riffPattern, loop[0], loop[1], scale, seed, 60).map((n) => n.midi)));
    }
    assert.ok(variants.size > 1, "suggest-again must be able to produce something new");
  });

  test("Every note fits inside its bar", () => {
    for (const pattern of PATTERNS) {
      for (const step of pattern.steps) {
        assert.ok(step.p >= 0 && step.p < STEPS_PER_BAR, `${pattern.id}: step starts outside the bar`);
        assert.ok(step.d > 0, `${pattern.id}: zero-length step`);
      }
    }
  });

  test("Pattern steps never overlap", () => {
    for (const pattern of PATTERNS) {
      const sorted = [...pattern.steps].sort((a, b) => a.p - b.p);
      for (let i = 1; i < sorted.length; i++) {
        assert.ok(sorted[i].p >= sorted[i - 1].p + Math.min(sorted[i - 1].d, 4),
          `${pattern.id}: steps at ${sorted[i - 1].p} and ${sorted[i].p} collide`);
      }
    }
  });

  test("Figures stay in a playable register", () => {
    for (const pattern of PATTERNS) {
      const center = pattern.kind === "bass" ? 36 : 60;
      for (let seed = 0; seed < 30; seed++) {
        for (const n of renderFigure(pattern, loop[0], loop[1], scale, seed, center)) {
          assert.ok(Math.abs(n.midi - center) <= 18,
            `${pattern.id} wandered to ${n.midi}, ${Math.abs(n.midi - center)} semitones from centre`);
          assert.ok(n.midi >= 21 && n.midi <= 108, "within a real piano");
        }
      }
    }
  });

  test("Consecutive notes do not leap absurdly", () => {
    for (const pattern of PATTERNS) {
      for (let seed = 0; seed < 30; seed++) {
        const fig = renderFigure(pattern, loop[0], loop[1], scale, seed, 48);
        for (let i = 1; i < fig.length; i++) {
          assert.ok(Math.abs(fig[i].midi - fig[i - 1].midi) <= 14,
            `${pattern.id}: leap of ${Math.abs(fig[i].midi - fig[i - 1].midi)} semitones`);
        }
      }
    }
  });

  test("Bass roots stay anchored to the register centre", () => {
    // Mutation survivor: resolving the root relative to the previous note
    // instead of the centre let a bassline creep upward across a loop.
    for (const pattern of PATTERNS.filter((x) => x.kind === "bass")) {
      for (let seed = 0; seed < 20; seed++) {
        for (let i = 0; i < loop.length; i++) {
          const fig = renderFigure(pattern, loop[i], loop[(i + 1) % 4], scale, seed, 36);
          for (const n of fig.filter((x) => x.role === "root")) {
            assert.ok(Math.abs(n.midi - 36) <= 6,
              `${pattern.id}: root landed at ${n.midi}, ${Math.abs(n.midi - 36)} semitones from centre`);
          }
          const roots = fig.filter((x) => x.role === "root").map((x) => x.midi);
          assert.equal(new Set(roots).size <= 1, true, `${pattern.id}: the root moved within one bar`);
        }
      }
    }
  });

  test("Each bar of the loop is seeded independently", () => {
    // Mutation survivor: a fixed per-bar seed made every bar make the same
    // choices, so repeated chords produced identical figures every time.
    const twice = [loop[0], loop[0]];
    let sawDifference = false;
    for (let seed = 0; seed < 40 && !sawDifference; seed++) {
      const figs = renderProgressionFigure(riffPattern, twice, scale, seed, 60);
      if (JSON.stringify(figs[0]) !== JSON.stringify(figs[1])) sawDifference = true;
    }
    assert.ok(sawDifference, "the same chord twice in a row should not always give an identical figure");
  });

  test("A figure is generated for every chord in the loop", () => {
    const figs = renderProgressionFigure(bassPattern, loop, scale, 7, 36);
    assert.equal(figs.length, loop.length);
    figs.forEach((f, i) => assert.ok(f.length > 0, `chord ${i} got an empty figure`));
  });

  test("The last chord's approach aims at the first chord, so the loop closes", () => {
    const figs = renderProgressionFigure(bassPattern, loop, scale, 3, 36);
    const last = figs[figs.length - 1].filter((n) => n.role === "approach").pop();
    assert.ok(last, "the walking pattern ends with an approach");
    const distance = Math.min(pc(last.midi - loop[0].rootPc), pc(loop[0].rootPc - last.midi));
    assert.equal(distance, 1, "it should sit a semitone from the chord it is walking into");
  });

  test("Every style offers both a bassline and a riff", () => {
    for (const style of STYLES) {
      assert.ok(patternsFor("bass", style).length > 0, `${style} has no bassline`);
      assert.ok(patternsFor("melody", style).length > 0, `${style} has no riff`);
    }
  });

  test("Every pattern is described for the user", () => {
    for (const pattern of PATTERNS) {
      assert.ok(pattern.name && pattern.note, `${pattern.id} is missing its description`);
      assert.ok(pattern.styles.every((s) => STYLES.includes(s)), `${pattern.id} claims an unknown style`);
    }
  });

  test("Figures are explained in the chosen naming system", () => {
    const fig = renderFigure(bassPattern, loop[0], loop[1], scale, 1, 36);
    // Compare the note list the sentence quotes, not the prose around it.
    // The earlier version matched /Si/ against the word "Sits" and passed
    // whatever naming system was used — a vacuous assertion.
    const quoted = (text) => (text.match(/Lands on ([^.]+) on the strong beats/) || [, ""])[1];
    const letters = quoted(explainFigure(bassPattern, fig, "letters"));
    const solfege = quoted(explainFigure(bassPattern, fig, "solfege"));
    assert.ok(letters.length, "the explanation should quote the strong-beat notes");
    assert.notEqual(letters, solfege, "the two naming systems must produce different note lists");
    assert.match(letters, /^[A-G#, ]+$/, `letters mode leaked non-letter names: ${letters}`);
    assert.match(solfege, /^(Do|Re|Mi|Fa|Sol|La|Si)#?(, (Do|Re|Mi|Fa|Sol|La|Si)#?)*$/,
      `solfege mode leaked letter names: ${solfege}`);
  });

  test("place() finds the nearest octave, not a random one", () => {
    assert.equal(place(0, 60), 60);        // C nearest to C4 is C4
    assert.equal(place(11, 60), 59);       // B nearest to C4 is below
    assert.equal(place(1, 60), 61);        // C# nearest to C4 is above
    assert.equal(place(6, 60), 54);        // exactly six semitones either way: ties resolve downward,
                                           // which keeps basslines from creeping upward over a loop
  });
});

describe("Feature: A pattern that promises a shape keeps it", () => {
  const tonic = PC["C#"];
  const scale = scalePcs(tonic, "natural-minor");
  const p = palette(tonic, "minor");
  const loop = ["C#m", "A", "E", "B"].map((n) => find(p, n));

  test("The rising line rises", () => {
    const pat = PATTERNS.find((x) => x.id === "riff-rise");
    for (let seed = 0; seed < 30; seed++) {
      const fig = renderFigure(pat, loop[0], loop[1], scale, seed, 64);
      const climb = fig.filter((n) => n.role === "root" || n.role === "stepUp");
      for (let i = 1; i < climb.length; i++) {
        assert.ok(climb[i].midi > climb[i - 1].midi,
          `seed ${seed}: went from ${climb[i - 1].midi} to ${climb[i].midi}`);
      }
    }
  });

  test("The falling line falls", () => {
    const pat = PATTERNS.find((x) => x.id === "riff-fall");
    for (let seed = 0; seed < 30; seed++) {
      const fig = renderFigure(pat, loop[0], loop[1], scale, seed, 64);
      const fall = fig.filter((n) => n.role === "top" || n.role === "stepDown");
      for (let i = 1; i < fall.length; i++) {
        assert.ok(fall[i].midi < fall[i - 1].midi,
          `seed ${seed}: went from ${fall[i - 1].midi} to ${fall[i].midi}`);
      }
    }
  });

  test("Directional steps still land on scale notes", () => {
    for (const id of ["riff-rise", "riff-fall"]) {
      const pat = PATTERNS.find((x) => x.id === id);
      for (let seed = 0; seed < 20; seed++) {
        for (const n of renderFigure(pat, loop[0], loop[1], scale, seed, 64)) {
          if (n.role === "stepUp" || n.role === "stepDown") {
            assert.ok(scale.includes(pc(n.midi)), `${id} stepped outside the scale`);
          }
        }
      }
    }
  });
});

describe("Feature: The bass has its own visual channel", () => {
  const state = { chordNotes: [49, 52, 56], chordRootMidi: 49, loopNotes: [], sounding: [], bass: [37] };

  test("A sounding bass note reads as bass, not as a chord tone", () => {
    assert.equal(keyRole(37, state), "bass");
  });

  test("The melody still outranks the bass when both sound", () => {
    assert.equal(keyRole(37, { ...state, sounding: [37] }), "sounding");
  });

  test("With no bassline playing, the note falls back to its harmonic role", () => {
    // C#2 is an octave below the voiced root, so it now reads as plain
    assert.equal(keyRole(37, { ...state, bass: [] }), "plain");
    assert.equal(keyRole(49, { ...state, bass: [] }), "chordRoot");
  });
});


/* ==========================================================================
   Bar scheduling — the bug class behind "the sound keeps going and then dies"
   ========================================================================== */

const { planBar, planIsClean, VOICES } = th;

describe("Feature: A bar of playback is planned before it is played", () => {
  const tonic = PC["C#"];
  const scale = scalePcs(tonic, "natural-minor");
  const p = palette(tonic, "minor");
  const loop = ["C#m", "A", "E", "B"].map((n) => find(p, n));
  const bar = (bpm) => ({ sixteenth: 60 / bpm / 4, barSeconds: (60 / bpm) * 4 });

  const everyPlan = (fn) => {
    for (const bpm of [60, 88, 120, 140]) {
      const { sixteenth, barSeconds } = bar(bpm);
      for (const bassPat of PATTERNS.filter((x) => x.kind === "bass")) {
        for (const riffPat of PATTERNS.filter((x) => x.kind === "melody")) {
          for (let seed = 0; seed < 6; seed++) {
            for (let i = 0; i < loop.length; i++) {
              const events = planBar({
                chordNotes: loop[i].notes,
                bassFigure: renderFigure(bassPat, loop[i], loop[(i + 1) % 4], scale, seed, 36),
                riffFigure: renderFigure(riffPat, loop[i], loop[(i + 1) % 4], scale, seed, 64),
                sixteenth, barSeconds,
              });
              fn(events, barSeconds, `${bpm}bpm ${bassPat.id}+${riffPat.id} seed ${seed} bar ${i}`);
            }
          }
        }
      }
    }
  };

  test("No voice is ever asked to hold two notes at once", () => {
    everyPlan((events, barSeconds, where) => {
      assert.ok(planIsClean(events, barSeconds), `overlapping or invalid plan: ${where}`);
    });
  });

  test("Every note ends before the note that follows it on the same voice", () => {
    everyPlan((events, barSeconds, where) => {
      for (const voice of VOICES) {
        const v = events.filter((e) => e.voice === voice).sort((a, b) => a.at - b.at);
        for (let i = 0; i + 1 < v.length; i++) {
          assert.ok(v[i].at + v[i].dur <= v[i + 1].at + 1e-9,
            `${where}: ${voice} note at ${v[i].at.toFixed(3)}s runs ${(v[i].at + v[i].dur - v[i + 1].at).toFixed(3)}s into the next`);
        }
      }
    });
  });

  test("Nothing spills past the end of its bar", () => {
    everyPlan((events, barSeconds, where) => {
      for (const e of events) {
        assert.ok(e.at >= 0 && e.at < barSeconds, `${where}: event starts outside the bar`);
        assert.ok(e.at + e.dur <= barSeconds + 1e-9,
          `${where}: ${e.voice} overruns the bar by ${(e.at + e.dur - barSeconds).toFixed(3)}s`);
      }
    });
  });

  test("Durations are numbers of seconds, never strings", () => {
    everyPlan((events, _b, where) => {
      for (const e of events) {
        assert.equal(typeof e.dur, "number", `${where}: duration is not a number`);
        assert.equal(typeof e.at, "number", `${where}: start time is not a number`);
        assert.ok(Number.isFinite(e.dur) && e.dur > 0, `${where}: duration ${e.dur}`);
      }
    });
  });

  test("A bar never asks for more voices than the instrument has", () => {
    everyPlan((events, _b, where) => {
      // count the maximum simultaneous notes at any event boundary
      const points = events.flatMap((e) => [e.at, e.at + e.dur - 1e-6]);
      for (const t of points) {
        const sounding = events
          .filter((e) => t >= e.at && t < e.at + e.dur)
          .reduce((n, e) => n + e.notes.length, 0);
        assert.ok(sounding <= 12, `${where}: ${sounding} notes at once`);
      }
    });
  });

  test("Every note is followed by a moment of silence", () => {
    // Mutation survivor: removing the clamp left notes butting straight into
    // the next one. Most patterns did not visibly overlap, so an overlap-only
    // assertion missed it — but the run-on is what makes playback sound smeared.
    const GAP = 0.05;
    everyPlan((events, barSeconds, where) => {
      for (const voice of VOICES) {
        const v = events.filter((e) => e.voice === voice).sort((a, b) => a.at - b.at);
        v.forEach((e, i) => {
          const nextAt = i + 1 < v.length ? v[i + 1].at : barSeconds;
          const space = nextAt - e.at;
          if (space > GAP * 2) {
            assert.ok(e.at + e.dur <= nextAt - GAP * 0.9 + 1e-9,
              `${where}: ${voice} note leaves no silence before the next`);
          }
        });
      }
    });
  });

  test("Each note is as long as its pattern intends, when there is room", () => {
    // Mutation survivor: planning an unsorted figure computed each duration
    // against the wrong neighbour, collapsing notes to the 50ms floor. Nothing
    // overlapped, so the overlap tests stayed green while playback turned to
    // clicks.
    const { sixteenth, barSeconds } = bar(88);
    for (const pattern of PATTERNS) {
      for (let seed = 0; seed < 8; seed++) {
        const figure = renderFigure(pattern, loop[0], loop[1], scale, seed, pattern.kind === "bass" ? 36 : 64);
        const key = pattern.kind === "bass" ? "bassFigure" : "riffFigure";
        const events = planBar({ chordNotes: loop[0].notes, [key]: figure, sixteenth, barSeconds })
          .filter((e) => e.voice !== "chord");
        const sorted = [...figure].sort((a, b) => a.pos - b.pos);
        sorted.forEach((n, i) => {
          const at = n.pos * sixteenth;
          const nextAt = i + 1 < sorted.length ? sorted[i + 1].pos * sixteenth : barSeconds;
          const expected = Math.max(0.05, Math.min(n.dur * sixteenth, nextAt - at - 0.05));
          const actual = events.find((e) => Math.abs(e.at - at) < 1e-9);
          assert.ok(actual, `${pattern.id}: no event planned at ${at.toFixed(3)}s`);
          assert.ok(Math.abs(actual.dur - expected) < 1e-6,
            `${pattern.id} seed ${seed}: note at ${at.toFixed(3)}s lasts ${actual.dur.toFixed(3)}s, should be ${expected.toFixed(3)}s`);
        });
      }
    }
  });

  test("The chord leaves room for the bass and riff to be heard", () => {
    const { sixteenth, barSeconds } = bar(88);
    const events = planBar({ chordNotes: loop[0].notes, sixteenth, barSeconds });
    const chord = events.find((e) => e.voice === "chord");
    assert.ok(chord.dur < barSeconds * 0.6, "the chord should not fill the whole bar");
  });

  test("Chords sit underneath the melody in the mix", () => {
    const { sixteenth, barSeconds } = bar(88);
    const events = planBar({
      chordNotes: loop[0].notes,
      bassFigure: renderFigure(PATTERNS.find((x) => x.id === "bass-walk"), loop[0], loop[1], scale, 1, 36),
      riffFigure: renderFigure(PATTERNS.find((x) => x.id === "riff-hook"), loop[0], loop[1], scale, 1, 64),
      sixteenth, barSeconds,
    });
    const chord = events.find((e) => e.voice === "chord");
    for (const e of events.filter((x) => x.voice !== "chord")) {
      assert.ok(e.vel > chord.vel, `${e.voice} should be louder than the chord bed`);
    }
    for (const e of events) {
      assert.ok(e.vel > 0 && e.vel <= 1, "velocity is a fraction");
    }
  });

  test("A bar with no figures still plans the chord", () => {
    const { sixteenth, barSeconds } = bar(88);
    const events = planBar({ chordNotes: loop[0].notes, sixteenth, barSeconds });
    assert.equal(events.length, 1);
    assert.equal(events[0].voice, "chord");
  });

  test("An empty bar plans nothing rather than failing", () => {
    const { sixteenth, barSeconds } = bar(88);
    assert.deepEqual(planBar({ sixteenth, barSeconds }), []);
  });

  test("Faster tempos shorten notes rather than overlapping them", () => {
    const pat = PATTERNS.find((x) => x.id === "bass-sixteenths");
    const fig = renderFigure(pat, loop[0], loop[1], scale, 1, 36);
    for (const bpm of [60, 200]) {
      const { sixteenth, barSeconds } = bar(bpm);
      const events = planBar({ chordNotes: loop[0].notes, bassFigure: fig, sixteenth, barSeconds });
      assert.ok(planIsClean(events, barSeconds), `plan dirty at ${bpm}bpm`);
    }
  });
});

/* ==========================================================================
   Chord dictionary, inversions, bass roles, transitions, chord sets
   ========================================================================== */

const { dictionaryFor, DICTIONARY, inversions, bassOptions, bassTransitions,
        CHORD_SETS, buildSet, setsFor, explainProgression, stackAscending } = th;

describe("Feature: The chord dictionary", () => {
  test("Every quality in the dictionary is buildable on every root", () => {
    for (let root = 0; root < 12; root++) {
      const entries = dictionaryFor(root);
      assert.equal(entries.length, DICTIONARY.length);
      for (const c of entries) {
        assert.equal(pc(c.notes[0]), root, "the first note is the root");
        assert.equal(new Set(c.notes).size, c.notes.length, `${c.sym}: duplicate notes`);
        assert.ok(c.formula.length, `${c.sym}: no formula`);
        assert.ok(c.plain.length, `${c.sym}: no explanation`);
      }
    }
  });

  test("The dictionary covers the qualities a beginner meets first", () => {
    const syms = DICTIONARY.map((d) => d.q);
    for (const needed of ["", "m", "dim", "aug", "sus4", "maj7", "m7", "7", "m7♭5", "maj9", "m9", "9"]) {
      assert.ok(syms.includes(needed), `missing ${needed || "major"}`);
    }
  });

  test("Chord formulas match the notes they produce", () => {
    for (const c of dictionaryFor(0)) {
      const degrees = c.formula.split(" – ").length;
      assert.equal(degrees, c.notes.length, `${c.sym}: formula and notes disagree`);
    }
  });
});

describe("Feature: Ninth chords are stacked, not folded", () => {
  test("A ninth sits above the seventh rather than beside the root", () => {
    const ninths = harmonize(PC["C#"], "natural-minor", 5);
    for (const c of ninths) {
      assert.equal(c.notes.length, 5);
      for (let i = 1; i < c.notes.length; i++) {
        assert.ok(c.notes[i] > c.notes[i - 1], `${c.sym}: notes not ascending`);
      }
      assert.ok(c.notes[4] - c.notes[0] > 12, `${c.sym}: the ninth folded into the octave`);
    }
  });

  test("Every key produces recognised ninths", () => {
    for (let tonic = 0; tonic < 12; tonic++) {
      for (const mode of ["minor", "major"]) {
        for (const c of palette(tonic, mode, 5)) {
          assert.notEqual(c.sym, "?", `unrecognised ninth in ${noteName(tonic, "letters")} ${mode}`);
        }
      }
    }
  });

  test("Stacking keeps intervals ascending", () => {
    assert.deepEqual(stackAscending([0, 4, 7, 10, 2], 0), [0, 4, 7, 10, 14]);
    assert.deepEqual(stackAscending([1, 4, 8], 1), [0, 3, 7]);
  });
});

describe("Feature: Inversions", () => {
  const cm = palette(PC["C#"], "minor")[0];

  test("An inversion keeps the same notes and changes only the bass", () => {
    const invs = inversions(cm);
    assert.equal(invs.length, 3);
    const asPcs = (ns) => [...new Set(ns.map(pc))].sort((a, b) => a - b);
    for (const inv of invs) {
      assert.deepEqual(asPcs(inv.notes), asPcs(cm.notes), `${inv.name} changed the chord`);
      assert.equal(inv.bass, Math.min(...inv.notes), "the bass is the lowest note");
    }
  });

  test("Each inversion puts a different note at the bottom", () => {
    const bases = inversions(cm).map((i) => pc(i.bass));
    assert.equal(new Set(bases).size, bases.length);
  });

  test("A seventh chord has four inversions", () => {
    assert.equal(inversions(palette(PC["C#"], "minor", 4)[0]).length, 4);
  });
});

describe("Feature: Bass options under a chord", () => {
  const scale = scalePcs(PC["C#"], "natural-minor");
  const cm = palette(PC["C#"], "minor")[0];

  test("The root is offered first and named the strongest", () => {
    const opts = bassOptions(cm, scale);
    assert.equal(opts[0].pc, cm.rootPc);
    assert.equal(opts[0].label, "Strongest");
  });

  test("Chord tones are offered before passing notes", () => {
    const opts = bassOptions(cm, scale);
    const firstPassing = opts.findIndex((o) => o.role === "passing");
    const chordPcs = cm.notes.map(pc);
    for (let i = 0; i < firstPassing; i++) {
      assert.ok(chordPcs.includes(opts[i].pc), `${opts[i].role} is not a chord tone`);
    }
  });

  test("Every scale note appears somewhere in the options", () => {
    const opts = bassOptions(cm, scale).map((o) => o.pc);
    for (const p of scale) assert.ok(opts.includes(p), `${noteName(p, "letters")} was not offered`);
  });

  test("No bass option is offered twice", () => {
    for (const chord of palette(PC["C#"], "minor", 4)) {
      const pcs = bassOptions(chord, scale).map((o) => o.pc);
      assert.equal(new Set(pcs).size, pcs.length, `${chord.sym}: duplicate option`);
    }
  });

  test("Every option explains itself", () => {
    for (const o of bassOptions(cm, scale)) {
      assert.ok(o.label && o.why, "an option with no explanation is not advice");
    }
  });
});

describe("Feature: Getting from one chord to the next", () => {
  const scale = scalePcs(PC["C#"], "natural-minor");
  const p = palette(PC["C#"], "minor");
  const cm = p[0], A = find(p, "A");

  test("Every transition starts on this chord and lands on the next", () => {
    for (const from of p) {
      for (const to of p) {
        if (from === to) continue;
        for (const t of bassTransitions(from, to, scale)) {
          assert.equal(pc(t.notes[0]), from.rootPc, `${t.name}: wrong start`);
          assert.equal(pc(t.notes[t.notes.length - 1]), to.rootPc, `${t.name}: wrong landing`);
        }
      }
    }
  });

  test("The chromatic approach arrives from a semitone away", () => {
    const chrom = bassTransitions(cm, A, scale).find((t) => t.name === "Chromatic");
    const last = chrom.notes[chrom.notes.length - 1];
    assert.equal(Math.abs(chrom.notes[chrom.notes.length - 2] - last), 1);
  });

  test("The direct move is exactly two notes", () => {
    assert.equal(bassTransitions(cm, A, scale).find((t) => t.name === "Direct").notes.length, 2);
  });

  test("Every transition explains itself", () => {
    for (const t of bassTransitions(cm, A, scale)) {
      assert.ok(t.name && t.why, `${t.name}: no explanation`);
      assert.ok(t.notes.length >= 2, `${t.name}: not a transition`);
    }
  });

  test("Transitions never leap absurdly", () => {
    for (const from of p) for (const to of p) {
      if (from === to) continue;
      for (const t of bassTransitions(from, to, scale)) {
        for (let i = 1; i < t.notes.length; i++) {
          assert.ok(Math.abs(t.notes[i] - t.notes[i - 1]) <= 12, `${t.name}: leap of ${Math.abs(t.notes[i] - t.notes[i - 1])}`);
        }
      }
    }
  });
});

describe("Feature: Chord sets", () => {
  test("Every set builds in every key", () => {
    for (let tonic = 0; tonic < 12; tonic++) {
      for (const sd of CHORD_SETS) {
        const built = buildSet(sd, tonic);
        assert.equal(built.chords.length, 8, `${sd.id}: wrong number of slots`);
        assert.equal(built.progressionChords.length, sd.progression.length);
        for (const c of built.chords) {
          assert.ok(c.notes.length >= 3, `${sd.id}: a slot has too few notes`);
          assert.equal(pc(c.notes[0]), c.rootPc);
        }
      }
    }
  });

  test("Every set contains the home chord somewhere", () => {
    // Not necessarily first: the ii-V-I set correctly opens on the second
    // degree. What matters is that home is reachable from within the set.
    for (let tonic = 0; tonic < 12; tonic++) {
      for (const sd of CHORD_SETS) {
        const roots = buildSet(sd, tonic).chords.map((c) => c.rootPc);
        assert.ok(roots.includes(tonic), `${sd.id}: no chord on the tonic`);
      }
    }
  });

  test("Every set names a quality the dictionary knows", () => {
    for (const sd of CHORD_SETS) {
      for (const [, sym] of sd.slots) {
        assert.ok(DICTIONARY.some((d) => d.q === sym), `${sd.id}: unknown quality "${sym}"`);
      }
    }
  });

  test("Every set is described and belongs to a mode", () => {
    for (const sd of CHORD_SETS) {
      assert.ok(sd.name && sd.note && sd.why, `${sd.id}: undescribed`);
      assert.ok(["minor", "major"].includes(sd.mode), `${sd.id}: no mode`);
      assert.ok(sd.progression.every((i) => i >= 0 && i < sd.slots.length), `${sd.id}: progression points outside the set`);
    }
  });

  test("Both modes have sets to choose from", () => {
    assert.ok(setsFor("minor").length >= 2);
    assert.ok(setsFor("major").length >= 2);
  });
});

describe("Feature: A progression explains itself", () => {
  const p = palette(PC["C#"], "minor");
  const loop = ["C#m", "A", "E", "B"].map((n) => find(p, n));
  const ctx = { tonic: PC["C#"], mode: "minor", scaleId: "natural-minor" };

  test("Each move is described, including the wrap back to the start", () => {
    const story = explainProgression(loop, ctx);
    assert.equal(story.moves.length, loop.length, "the return to the first chord is a move too");
    for (const m of story.moves) assert.ok(m.why.length, "an undescribed move");
  });

  test("Shared notes between chords are named", () => {
    const story = explainProgression(loop, ctx);
    const first = story.moves[0];              // C#m → A shares C# and E
    assert.deepEqual(first.shared.sort(), ["C#", "E"]);
  });

  test("A loop starting at home is recognised as such", () => {
    assert.match(explainProgression(loop, ctx).summary, /home/);
  });

  test("A single chord is not a progression", () => {
    assert.equal(explainProgression([loop[0]], ctx), null);
  });
});

/* ==========================================================================
   Voice budget — the arithmetic behind "nothing sounds after thirty notes"
   ========================================================================== */

const { MAX_VOICES, voiceLifetime, reapVoices, allocatable } = th;

describe("Feature: The voice budget cannot leak", () => {
  test("A voice outlives its note, but not by much", () => {
    for (const dur of [0.05, 0.2, 0.45, 0.85, 2.0]) {
      const life = voiceLifetime(dur, 0.4);
      assert.ok(life > dur + 0.4, `a ${dur}s note must outlast its own release`);
      assert.ok(life < dur + 1.0, `a ${dur}s note held ${life}s is hoarding`);
    }
  });

  test("Every voice eventually expires", () => {
    const now = 100;
    const voices = [0.1, 0.5, 1, 3].map((d, i) => ({ id: i, until: now + voiceLifetime(d) }));
    const later = now + voiceLifetime(3) + 0.001;
    assert.equal(reapVoices(voices, later).keep.length, 0, "nothing may outlive the longest note");
  });

  test("Reaping keeps the voices that are still sounding", () => {
    const voices = [{ id: 1, until: 5 }, { id: 2, until: 15 }, { id: 3, until: 25 }];
    const { keep, expired } = reapVoices(voices, 15);
    assert.deepEqual(expired.map((v) => v.id), [1, 2], "a voice due exactly now is finished");
    assert.deepEqual(keep.map((v) => v.id), [3]);
  });

  test("Reaping an empty list is not an error", () => {
    assert.deepEqual(reapVoices([], 0), { keep: [], expired: [] });
  });

  test("The budget is never exceeded, however many notes are asked for", () => {
    for (let live = 0; live <= MAX_VOICES + 5; live++) {
      for (let want = 0; want <= 8; want++) {
        const n = allocatable(live, want);
        assert.ok(n >= 0, "never negative");
        assert.ok(n <= want, "never more than asked for");
        // if we are somehow already over budget, the right answer is to add
        // nothing — not to assert an impossible total
        assert.ok(live + n <= Math.max(live, MAX_VOICES), `${live} live + ${n} new exceeds the budget`);
        if (live >= MAX_VOICES) assert.equal(n, 0, "a full budget starts nothing new");
      }
    }
  });

  test("A full budget drops notes rather than going silent forever", () => {
    assert.equal(allocatable(MAX_VOICES, 4), 0, "nothing starts when full");
    // but as soon as one voice is reaped, sound resumes
    assert.equal(allocatable(MAX_VOICES - 1, 4), 1);
  });

  test("A whole bar fits inside the budget", () => {
    // worst case: a five-note chord, a bass note and a riff note at once
    assert.ok(allocatable(0, 5) === 5);
    assert.ok(5 + 1 + 1 <= MAX_VOICES, "a full bar must never approach the limit");
  });

  test("Voices from a finished loop do not accumulate across passes", () => {
    // simulate eight bars at 88bpm: chord plus six figure notes per bar
    const barSeconds = (60 / 88) * 4;
    let voices = [];
    for (let bar = 0; bar < 8; bar++) {
      const now = bar * barSeconds;
      voices = reapVoices(voices, now).keep;
      const n = allocatable(voices.length, 7);
      assert.equal(n, 7, `bar ${bar}: only ${n} of 7 notes could start — voices are accumulating`);
      for (let i = 0; i < n; i++) voices.push({ until: now + voiceLifetime(0.9) });
    }
  });
});

describe("Feature: A tab always has a chord to talk about", () => {
  const palette4 = palette(PC["C#"], "minor");
  // deliberately does NOT start on the home chord: with a loop of C#m first,
  // "first chord of the loop" and "home chord" are the same object and the
  // fallback order cannot be told apart. A mutation run caught exactly that.
  const loop = ["A", "E", "B"].map((n) => find(palette4, n));
  const { activeChordFor } = th;

  test("An explicitly selected chord always wins", () => {
    const chosen = palette4[0];
    assert.equal(activeChordFor({ selected: chosen, playingIndex: 0, progression: loop, palette: palette4 }), chosen);
  });

  test("While the loop plays, the tab follows the bar being heard", () => {
    assert.equal(activeChordFor({ playingIndex: 1, progression: loop, palette: palette4 }), loop[1]);
  });

  test("With a loop but nothing selected, the first chord is used", () => {
    // the case that made the Bass tab look broken: a loop built entirely with
    // the "add" button, so no chord had ever been selected
    assert.equal(activeChordFor({ progression: loop, palette: palette4 }), loop[0]);
  });

  test("With no loop at all, the home chord is used", () => {
    assert.equal(activeChordFor({ palette: palette4 }), palette4[0]);
  });

  test("With nothing at all, nothing is claimed", () => {
    assert.equal(activeChordFor({}), null);
  });

  test("A playing index that points nowhere falls through safely", () => {
    assert.equal(activeChordFor({ playingIndex: 9, progression: loop, palette: palette4 }), loop[0]);
    assert.equal(activeChordFor({ playingIndex: -1, progression: [], palette: palette4 }), palette4[0]);
  });
});

/* ==========================================================================
   Instruments, echo and voicings
   ========================================================================== */

const { INSTRUMENTS, instrumentById, delaySettings, voicingsFor } = th;

describe("Feature: Instrument presets", () => {
  test("Every preset is complete and playable", () => {
    for (const i of INSTRUMENTS) {
      assert.ok(i.id && i.name && i.note, `${i.id}: undescribed`);
      assert.ok(["fm", "am", "synth", "sampler"].includes(i.kind), `${i.id}: unknown voice kind`);
      assert.ok(i.kind === "sampler" ? i.samples : i.options?.envelope,
        `${i.id}: a synth needs an envelope, a sampler needs samples`);
      assert.ok(i.volume <= 0 && i.volume > -40, `${i.id}: volume ${i.volume} is out of range`);
    }
  });

  test("A preset's release matches its envelope", () => {
    // the voice budget is calculated from `release`; if it disagrees with the
    // envelope, voices are either cut off or hoarded
    for (const i of INSTRUMENTS.filter((x) => x.options.envelope)) {
      assert.equal(i.release, i.options.envelope.release, `${i.id}: release and envelope disagree`);
    }
  });

  test("A recorded instrument declares a release too", () => {
    for (const i of INSTRUMENTS.filter((x) => x.kind === "sampler")) {
      assert.ok(i.release > 0, `${i.id}: the budget needs a release even without an envelope`);
      // the count that matters is the spacing, checked where the samples are
      // embedded; a remote set needed eight, an embedded one is judged by gaps
      assert.ok(Object.keys(i.samples?.urls ?? {}).length >= 5,
        `${i.id}: too few samples to sound like the instrument`);
    }
  });

  test("Struck voices decay; only a pad holds at a level", () => {
    // a real Rhodes has a long tail, not a plateau: a small sustain is the
    // body of the note, a large one is an organ
    for (const i of INSTRUMENTS.filter((x) => x.options.envelope)) {
      const sustain = i.options.envelope.sustain;
      if (i.id === "pad") assert.ok(sustain > 0.4, "a pad must actually sustain");
      else assert.ok(sustain <= 0.1, `${i.id}: sustain ${sustain} is a plateau, not a tail`);
    }
  });

  test("Every instrument's voices fit the budget", () => {
    for (const i of INSTRUMENTS) {
      const life = voiceLifetime(0.9, i.release);
      assert.ok(life < 4, `${i.id}: a voice living ${life.toFixed(1)}s will starve the budget`);
    }
  });

  test("An unknown instrument falls back rather than failing", () => {
    assert.equal(instrumentById("nonsense").id, INSTRUMENTS[0].id);
  });

  test("There is more than one sound to choose from", () => {
    assert.ok(INSTRUMENTS.length >= 3);
    assert.equal(new Set(INSTRUMENTS.map((i) => i.id)).size, INSTRUMENTS.length, "duplicate ids");
  });
});

describe("Feature: Echo", () => {
  test("Echo off is silent, not quiet", () => {
    for (const i of INSTRUMENTS) {
      assert.equal(delaySettings(i.id, false).wet, 0, `${i.id}: echo leaks when off`);
      assert.equal(delaySettings(i.id, false).feedback, 0);
    }
  });

  test("Echo on stays inside safe bounds", () => {
    for (const i of INSTRUMENTS) {
      const s = delaySettings(i.id, true);
      assert.ok(s.wet > 0 && s.wet <= 0.5, `${i.id}: wet ${s.wet} would drown the dry signal`);
      assert.ok(s.feedback > 0 && s.feedback < 0.7, `${i.id}: feedback ${s.feedback} risks runaway`);
      assert.ok(s.time > 0.05 && s.time < 1, `${i.id}: delay time ${s.time} is unmusical`);
    }
  });

  test("The pad gets a wider echo than the struck voices", () => {
    assert.ok(delaySettings("pad", true).time > delaySettings("rhodes", true).time);
  });
});

describe("Feature: Voicings", () => {
  const triad = palette(PC["C#"], "minor")[0];
  const seventh = palette(PC["C#"], "minor", 4)[0];

  test("Close voicing is the chord as written", () => {
    const close = voicingsFor(seventh).find((v) => v.id === "close");
    assert.deepEqual(close.notes, seventh.notes);
  });

  test("Every voicing ascends and stays playable", () => {
    for (const chord of [triad, seventh, palette(PC["C#"], "minor", 5)[0]]) {
      for (const v of voicingsFor(chord)) {
        assert.deepEqual(v.notes, [...v.notes].sort((a, b) => a - b), `${v.id}: not ascending`);
        assert.ok(v.notes.length <= 8, `${v.id}: too many notes`);
        assert.ok(Math.min(...v.notes) >= 21 && Math.max(...v.notes) <= 96, `${v.id}: outside a piano`);
        assert.ok(v.name && v.why, `${v.id}: unexplained`);
      }
    }
  });

  test("Open and spread keep every note of the chord", () => {
    for (const chord of [triad, seventh]) {
      const pcs = (ns) => [...new Set(ns.map(pc))].sort((a, b) => a - b);
      for (const id of ["open", "spread"]) {
        const v = voicingsFor(chord).find((x) => x.id === id);
        assert.deepEqual(pcs(v.notes), pcs(chord.notes), `${id} changed the chord`);
      }
    }
  });

  test("Open really opens: it spans wider than close", () => {
    const span = (ns) => Math.max(...ns) - Math.min(...ns);
    for (const chord of [triad, seventh]) {
      const vs = voicingsFor(chord);
      const close = vs.find((v) => v.id === "close"), open = vs.find((v) => v.id === "open");
      assert.ok(span(open.notes) > span(close.notes), "an open voicing that is not wider is not open");
    }
  });

  test("Rootless drops the root, shell drops the fifth", () => {
    const vs = voicingsFor(seventh);
    const rootless = vs.find((v) => v.id === "rootless");
    assert.ok(!rootless.notes.map(pc).includes(seventh.rootPc), "rootless still has its root");
    const shell = vs.find((v) => v.id === "shell");
    assert.equal(shell.notes.length, 3, "a shell is root, third and seventh");
    assert.ok(shell.notes.map(pc).includes(seventh.rootPc), "a shell keeps its root");
  });

  test("A triad offers no rootless or shell voicing", () => {
    const ids = voicingsFor(triad).map((v) => v.id);
    assert.ok(!ids.includes("rootless"), "three notes are too few to drop one");
    assert.ok(!ids.includes("shell"));
  });

  test("Every chord offers at least three arrangements", () => {
    for (const size of [3, 4, 5]) {
      for (const chord of palette(PC["C#"], "minor", size)) {
        assert.ok(voicingsFor(chord).length >= 3, `${chord.sym}: too few voicings`);
      }
    }
  });
});

describe("Feature: More patterns to choose from", () => {
  test("Every style offers a choice, not a single answer", () => {
    for (const style of STYLES) {
      assert.ok(patternsFor("bass", style).length >= 2, `${style}: only one bassline`);
      assert.ok(patternsFor("melody", style).length >= 2, `${style}: only one riff`);
    }
  });

  test("Pattern names are unique", () => {
    const names = PATTERNS.map((p) => p.name);
    assert.equal(new Set(names).size, names.length);
  });
});

/* ==========================================================================
   Scheduling, compatibility, harmonisation, voice leading, what comes next
   ========================================================================== */

const { barsToSchedule, barSecondsAt, suggestScaleFor, harmonizeSteps,
        voiceLeading, suggestNextChords } = th;

describe("Feature: The loop scheduler", () => {
  test("A bar lasts as long as the tempo says", () => {
    assert.equal(barSecondsAt(60), 4);
    assert.equal(barSecondsAt(120), 2);
    assert.ok(Math.abs(barSecondsAt(88) - 2.727) < 0.01);
  });

  test("Only bars inside the lookahead window are scheduled", () => {
    const { bars } = barsToSchedule({ nextBarAt: 10, barIndex: 0 }, 10, 0.5, 2);
    assert.equal(bars.length, 1, "a 2s bar cannot fit twice in a 0.5s window");
  });

  test("The cursor advances so no bar is scheduled twice", () => {
    let state = { nextBarAt: 0, barIndex: 0 };
    const seen = [];
    for (let now = 0; now < 20; now += 0.12) {
      const r = barsToSchedule(state, now, 0.6, 2);
      state = r.state;
      seen.push(...r.bars.map((b) => b.index));
    }
    assert.deepEqual(seen, [...new Set(seen)], "a bar was scheduled more than once");
    assert.deepEqual(seen, seen.slice().sort((a, b) => a - b), "bars came out of order");
  });

  test("No bar is ever scheduled in the past", () => {
    const { bars } = barsToSchedule({ nextBarAt: 5, barIndex: 3 }, 9, 0.5, 2);
    for (const b of bars) assert.ok(b.at >= 9, "a bar scheduled in the past would never sound");
  });

  test("A stalled clock catches up without scheduling forever", () => {
    // the tab was backgrounded for a minute
    const { bars } = barsToSchedule({ nextBarAt: 0, barIndex: 0 }, 60, 0.6, 2);
    assert.ok(bars.length <= 32, "catching up must be bounded");
  });

  test("Every scheduled bar knows which chord it is", () => {
    const { bars } = barsToSchedule({ nextBarAt: 0, barIndex: 7 }, 0, 5, 2);
    assert.deepEqual(bars.map((b) => b.index), [7, 8, 9]);
  });
});

describe("Feature: Where a borrowed chord comes from", () => {
  const ctx = { tonic: PC["C#"], mode: "minor", scaleId: "natural-minor" };
  const gSharp7 = { rootPc: PC["G#"], sym: "7", full: "dominant 7th", degreeIndex: 4, roman: "V7", notes: [56, 60, 63, 66] };

  test("A chord outside the key is traced to a scale that contains it", () => {
    const hint = suggestScaleFor(gSharp7, ctx);
    assert.ok(hint, "G#7 must be traceable");
    assert.equal(hint.scale.id, "harmonic-minor");
    assert.deepEqual(hint.outside, [PC.C]);
  });

  test("A diatonic chord needs no suggestion", () => {
    assert.equal(suggestScaleFor(palette(PC["C#"], "minor")[0], ctx), null);
  });

  test("The suggested scale really does contain the whole chord", () => {
    for (let tonic = 0; tonic < 12; tonic++) {
      const c = { rootPc: pc(tonic + 7), sym: "7", notes: [55 + tonic, 59 + tonic, 62 + tonic, 65 + tonic] };
      const hint = suggestScaleFor(c, { tonic, mode: "minor", scaleId: "natural-minor" });
      if (!hint) continue;
      const notes = scalePcs(tonic, hint.scale.id);
      for (const p of c.notes.map(pc)) {
        assert.ok(notes.includes(p), `${hint.scale.id} does not contain the chord it was suggested for`);
      }
    }
  });
});

describe("Feature: Building a chord out of the scale", () => {
  test("Every step adds exactly one note", () => {
    for (let d = 0; d < 7; d++) {
      const steps = harmonizeSteps(PC["C#"], "natural-minor", d, 3);
      assert.equal(steps.length, 4, "three notes plus a conclusion");
      steps.slice(0, 3).forEach((s, i) => assert.equal(s.pcs.length, i + 1));
    }
  });

  test("The notes taken are every other note of the scale", () => {
    const steps = harmonizeSteps(PC["C#"], "natural-minor", 0, 3);
    assert.deepEqual(steps[2].pcs.map((p) => noteName(p, "letters")), ["C#", "E", "G#"]);
  });

  test("The steps end on the chord they build", () => {
    for (let d = 0; d < 7; d++) {
      const steps = harmonizeSteps(PC["C#"], "natural-minor", d, 3);
      const chord = palette(PC["C#"], "minor")[d];
      assert.deepEqual(steps[steps.length - 1].pcs.sort(), chord.notes.map(pc).sort());
    }
  });

  test("Every step says what it is doing", () => {
    for (const s of harmonizeSteps(PC["C#"], "natural-minor", 3, 4)) assert.ok(s.text.length > 5);
  });

  test("A five-note scale cannot be harmonised this way", () => {
    assert.deepEqual(harmonizeSteps(PC["C#"], "minor-pentatonic", 0, 3), []);
  });
});

describe("Feature: Voice leading", () => {
  const p = palette(PC["C#"], "minor");

  test("Notes common to both chords are held", () => {
    const vl = voiceLeading(p[0], find(p, "A"));       // C#m -> A
    assert.deepEqual(vl.common.map((x) => noteName(x, "letters")).sort(), ["C#", "E"]);
    assert.equal(vl.smoothness, "very smooth");
  });

  test("Every departing note is paired with its nearest arrival", () => {
    const vl = voiceLeading(p[0], find(p, "A"));
    const real = vl.moves.filter((m) => m.from !== null && m.to !== null);
    assert.equal(real.length, 1, "only one note should have to move");
    assert.ok(real[0].semitones <= 2, `it moved ${real[0].semitones} semitones, which is not the nearest`);
  });

  test("Chords with nothing in common are named as a real move", () => {
    const vl = voiceLeading(p[0], find(p, "D#dim"));
    assert.equal(vl.common.length, 0);
    assert.equal(vl.smoothness, "a real move");
  });

  test("Voice leading is measured, not guessed", () => {
    const near = voiceLeading(p[0], find(p, "A"));
    const far = voiceLeading(p[0], find(p, "D#dim"));
    assert.ok(near.distance < far.distance, "the smoother move must measure shorter");
  });

  test("Every pair of chords in the key can be described", () => {
    for (const a of p) for (const b of p) {
      const vl = voiceLeading(a, b);
      assert.ok(vl.why.length, "an undescribed move");
      assert.ok(vl.common.length + vl.moves.length > 0);
    }
  });
});

describe("Feature: What could come next", () => {
  const p = palette(PC["C#"], "minor");

  test("An empty loop gets somewhere to start", () => {
    const s = suggestNextChords([], PC["C#"], "minor");
    assert.ok(s.length >= 3);
    for (const x of s) assert.ok(x.why.length);
  });

  test("The chord just played is never suggested again", () => {
    for (const last of p) {
      for (const s of suggestNextChords([last], PC["C#"], "minor")) {
        assert.notEqual(s.chord.rootPc, last.rootPc, "suggesting the same chord is not a suggestion");
      }
    }
  });

  test("A fourth up is ranked highly, because it is the strongest move", () => {
    const s = suggestNextChords([p[0]], PC["C#"], "minor");   // from C#m, a fourth up is F#m
    assert.equal(chordLabel(s[0].chord.rootPc, s[0].chord.sym, "letters"), "F#m");
  });

  test("Coming home is suggested once the loop is long enough", () => {
    const s = suggestNextChords([p[0], find(p, "A"), find(p, "E")], PC["C#"], "minor");
    assert.ok(s.some((x) => x.chord.rootPc === PC["C#"]), "a three-chord loop should be offered a way home");
  });

  test("Every suggestion explains itself", () => {
    for (const x of suggestNextChords([p[0], find(p, "A")], PC["C#"], "minor")) {
      assert.ok(x.why.length > 10, "a suggestion without a reason teaches nothing");
    }
  });

  test("Suggestions work for every key and both modes", () => {
    for (let tonic = 0; tonic < 12; tonic++) {
      for (const mode of ["minor", "major"]) {
        const pal = palette(tonic, mode);
        const s = suggestNextChords([pal[0]], tonic, mode);
        assert.ok(s.length >= 3, `${tonic} ${mode}: too few suggestions`);
      }
    }
  });
});

/* ==========================================================================
   Reverse search, arpeggios, smoothest voicing
   ========================================================================== */

const { identifyChord, keysContaining, scalesContaining, arpeggio, smoothestVoicing } = th;

describe("Feature: Reverse search", () => {
  const midi = { "C#3": 49, E3: 52, "G#3": 56, B3: 59, C4: 48, E4: 52, G4: 55, B4: 59, D4: 62, "C#4": 61 };

  test("Notes played in root position name the obvious chord first", () => {
    assert.equal(identifyChord([49, 52, 56, 59])[0].label, "C#m7");
    assert.equal(identifyChord([48, 52, 55])[0].label, "C");
    assert.equal(identifyChord([48, 52, 55, 59, 62])[0].label, "Cmaj9");
  });

  test("An inversion is named as one, with the bass after a slash", () => {
    // E G# B C# — the same notes as C#m7, but with E underneath
    const readings = identifyChord([52, 56, 59, 61]);
    assert.ok(readings.some((r) => r.label === "C#m7/E"), "the inversion reading is missing");
    assert.equal(readings[0].label, "E6", "with E in the bass, E6 is the more likely reading");
  });

  test("Both readings of an ambiguous set are offered, not just one", () => {
    const labels = identifyChord([52, 56, 59, 61]).map((r) => r.label);
    assert.ok(labels.length >= 2, "ambiguity is the interesting part; do not hide it");
    assert.ok(labels.includes("E6") && labels.includes("C#m7/E"));
  });

  test("The lowest note decides which reading ranks first", () => {
    const asCm7 = identifyChord([49, 52, 56, 59])[0];
    const asE6 = identifyChord([52, 56, 59, 61])[0];
    assert.equal(pc(asCm7.rootPc), asCm7.bass, "root position should win when the root is lowest");
    assert.equal(pc(asE6.rootPc), asE6.bass);
    // and it wins on its score, not by being listed first: readings start from
    // the lowest note, so a tie would put root position first by accident (D-074)
    const both = identifyChord([52, 56, 59, 61]);
    const e6 = both.find((r) => r.label === "E6"), cm7 = both.find((r) => r.label === "C#m7/E");
    assert.ok(e6.score > cm7.score, `E6 ${e6.score} should outscore C#m7/E ${cm7.score}`);
  });

  test("Two notes are named as an interval, not forced into a chord", () => {
    const r = identifyChord([48, 55])[0];
    assert.equal(r.full, "perfect 5th");
    assert.match(r.why, /not yet a chord/);
  });

  test("An interval is measured upward from the lowest note played", () => {
    // C up to G is a fifth; taking the smaller of the two inversions called it
    // a fourth, which is the same distance downward and a different interval
    assert.equal(identifyChord([48, 55])[0].full, "perfect 5th");
    assert.equal(identifyChord([48, 53])[0].full, "perfect 4th");
    assert.equal(identifyChord([48, 51])[0].full, "minor 3rd");
    assert.equal(identifyChord([48, 59])[0].full, "major 7th");
  });

  test("One note or none identifies nothing", () => {
    assert.deepEqual(identifyChord([60]), []);
    assert.deepEqual(identifyChord([]), []);
  });

  test("Notes with no standard name return nothing rather than inventing one", () => {
    const cluster = identifyChord([60, 61, 62, 63, 64, 65]);
    assert.equal(cluster.length, 0, "a chromatic cluster has no chord name");
  });

  test("Every chord in the dictionary can be found again from its notes", () => {
    for (let root = 0; root < 12; root++) {
      for (const c of dictionaryFor(root)) {
        const found = identifyChord(c.notes);
        assert.ok(found.length, `${chordLabel(c.rootPc, c.sym, "letters")} could not be identified`);
        assert.equal(pc(found[0].rootPc), root, `${c.sym}: identified with the wrong root`);
      }
    }
  });

  test("Octave doubling does not change the answer", () => {
    assert.equal(identifyChord([48, 52, 55])[0].label, identifyChord([48, 52, 55, 60])[0].label);
  });
});

describe("Feature: Finding the key and scale from notes", () => {
  test("The keys offered all contain every note", () => {
    const notes = [48, 52, 55, 59, 62];    // C E G B D
    const keys = keysContaining(notes);
    assert.ok(keys.length > 0);
    for (const k of keys) {
      const scale = scalePcs(k.tonic, k.mode === "minor" ? "natural-minor" : "major");
      for (const p of notes.map(pc)) assert.ok(scale.includes(p), "a key was offered that does not fit");
    }
  });

  test("Notes from no single key say so", () => {
    assert.equal(keysContaining([60, 61, 62, 63, 64, 65, 66, 67]).length, 0);
  });

  test("Scales are ranked by how few notes they add", () => {
    const found = scalesContaining([49, 52, 56]);      // C# E G#
    assert.ok(found.length > 0);
    for (let i = 1; i < found.length; i++) {
      assert.ok(found[i].extra >= found[i - 1].extra, "a looser fit was ranked above a tighter one");
    }
  });

  test("Every scale offered really contains the notes", () => {
    for (const f of scalesContaining([49, 52, 56, 59])) {
      const notes = scalePcs(f.tonic, f.scale.id);
      for (const p of [49, 52, 56, 59].map(pc)) assert.ok(notes.includes(p));
    }
  });
});

describe("Feature: Arpeggios", () => {
  test("Up plays low to high, down plays high to low", () => {
    assert.deepEqual(arpeggio([55, 48, 52], "up"), [48, 52, 55]);
    assert.deepEqual(arpeggio([48, 52, 55], "down"), [55, 52, 48]);
  });

  test("Up and down comes back without repeating the turning points", () => {
    assert.deepEqual(arpeggio([48, 52, 55], "updown"), [48, 52, 55, 52]);
  });

  test("An arpeggio contains exactly the chord's notes", () => {
    const chord = palette(PC["C#"], "minor", 4)[0];
    assert.deepEqual([...new Set(arpeggio(chord.notes, "updown"))].sort((a, b) => a - b), chord.notes);
  });

  test("A single note arpeggiates to itself", () => {
    assert.deepEqual(arpeggio([60], "updown"), [60]);
  });
});

describe("Feature: The smoothest way to play the next chord", () => {
  const p = palette(PC["C#"], "minor", 4);

  test("The chosen voicing moves less than the alternatives", () => {
    for (let i = 0; i < p.length; i++) {
      const from = p[i], to = p[(i + 1) % p.length];
      const best = smoothestVoicing(from, to);
      for (const alt of best.alternatives) {
        assert.ok(best.distance <= alt.distance, `${alt.name} moves less than the one chosen`);
      }
    }
  });

  test("It is still a real voicing of the right chord", () => {
    const best = smoothestVoicing(p[0], p[3]);
    const wanted = voicingsFor(p[3]).map((v) => v.id);
    assert.ok(wanted.includes(best.id));
    assert.ok(best.notes.every((n) => p[3].notes.map(pc).includes(pc(n)) || best.id === "rootless" || best.id === "shell"));
  });

  test("It explains itself, naming the held notes where there are any", () => {
    const best = smoothestVoicing(p[0], p[5]);
    assert.ok(best.why.length > 20);
  });

  test("Every pair of chords in the key gets an answer", () => {
    for (const a of p) for (const b of p) {
      const best = smoothestVoicing(a, b);
      assert.ok(best.notes.length >= 3, "a voicing with too few notes");
      assert.ok(Number.isFinite(best.distance));
    }
  });
});

/* ==========================================================================
   Your own chords and scales, and style as a way in
   ========================================================================== */

const { customChordFrom, customScaleFrom, customScalePcs, harmonizeCustom,
        harmonizeIntervals, STYLE_COLOURS, scalesForStyle } = th;

describe("Feature: Chords and scales of your own", () => {
  test("A saved chord keeps exactly the notes you chose", () => {
    const notes = [49, 52, 56, 59, 63, 66];
    const c = customChordFrom(notes, "My C#m11");
    assert.deepEqual(c.notes, notes, "a saved voicing must not be tidied up");
    assert.equal(c.name, "My C#m11");
  });

  test("A saved chord is named for you if you don't name it", () => {
    assert.equal(customChordFrom([48, 52, 55]).name, "C");
    assert.equal(customChordFrom([48, 52, 55, 59]).name, "Cmaj7");
  });

  test("A voicing with no standard name is still saveable", () => {
    const c = customChordFrom([60, 61, 62, 63, 64, 65], "Cluster");
    assert.ok(c, "the app must not refuse notes it cannot name");
    assert.equal(c.name, "Cluster");
    assert.equal(c.full, "voicing of your own");
  });

  test("The same notes always produce the same saved chord", () => {
    // ids come from the notes, not from a clock, so the theory stays pure
    assert.equal(customChordFrom([48, 52, 55]).id, customChordFrom([55, 48, 52]).id);
  });

  test("One note is not a chord", () => {
    assert.equal(customChordFrom([60]), null);
  });

  test("A scale needs between five and eight notes", () => {
    assert.equal(customScaleFrom([48, 50, 52], "too few"), null);
    assert.ok(customScaleFrom([48, 50, 52, 53, 55], "five"));
    assert.ok(customScaleFrom([48, 49, 50, 51, 52, 53, 54, 55], "eight"));
    assert.equal(customScaleFrom([48, 49, 50, 51, 52, 53, 54, 55, 56], "nine"), null);
  });

  test("A saved scale starts on its lowest note unless told otherwise", () => {
    const sc = customScaleFrom([50, 53, 55, 57, 60]);
    assert.equal(sc.iv[0], 0);
    assert.equal(sc.tonicPc, PC.D);
    assert.equal(customScaleFrom([50, 53, 55, 57, 60], null, PC.F).tonicPc, PC.F);
  });

  test("A saved scale's notes are the notes you chose", () => {
    const notes = [48, 50, 51, 53, 55, 56, 58];
    const sc = customScaleFrom(notes);
    assert.deepEqual(customScalePcs(sc).sort((a, b) => a - b), [...new Set(notes.map(pc))].sort((a, b) => a - b));
  });

  test("A seven-note scale of your own harmonises into chords", () => {
    const sc = customScaleFrom([48, 50, 52, 53, 55, 57, 59], "Mine");   // C major by another name
    const chords = harmonizeCustom(sc);
    assert.equal(chords.length, 7);
    assert.equal(chords.map((c) => chordLabel(c.rootPc, c.sym, "letters")).join(" "), "C Dm Em F G Am Bdim");
  });

  test("A scale with the wrong number of notes yields no chords, rather than wrong ones", () => {
    assert.deepEqual(harmonizeCustom(customScaleFrom([48, 51, 53, 55, 58])), []);
  });

  test("Harmonising works from bare intervals, not only from named scales", () => {
    const built = harmonizeIntervals(PC.C, [0, 2, 4, 5, 7, 9, 11], 3);
    assert.equal(built.map((c) => chordLabel(c.rootPc, c.sym, "letters")).join(" "), "C Dm Em F G Am Bdim");
  });
});

describe("Feature: Style as a way in", () => {
  test("Every style suggests scales and chord colours", () => {
    for (const style of STYLES) {
      const g = scalesForStyle(style, "minor");
      assert.ok(g.chords?.length, `${style}: no chord colours`);
      assert.ok(g.note?.length, `${style}: no explanation`);
    }
  });

  test("Scales suited to the style come first, and none are lost", () => {
    for (const style of STYLES) {
      for (const mode of ["minor", "major"]) {
        const g = scalesForStyle(style, mode);
        const all = SCALES.filter((s) => s.mode === mode);
        assert.equal(g.suited.length + g.others.length, all.length, "a scale went missing");
        for (const s of g.suited) assert.ok(s.tags.includes(style));
        for (const s of g.others) assert.ok(!s.tags.includes(style));
      }
    }
  });

  test("Every chord colour a style names is one the app can build", () => {
    for (const [style, g] of Object.entries(STYLE_COLOURS)) {
      for (const q of g.chords) {
        assert.ok(DICTIONARY.some((d) => d.q === q), `${style} names "${q}", which the dictionary does not have`);
      }
    }
  });

  test("Every style suits at least one scale in each mode", () => {
    for (const style of STYLES) {
      const minor = scalesForStyle(style, "minor").suited.length;
      const major = scalesForStyle(style, "major").suited.length;
      assert.ok(minor + major > 0, `${style} suits nothing`);
    }
  });
});

describe("Feature: A wider chord-set library", () => {
  test("There are enough sets to browse rather than exhaust", () => {
    assert.ok(CHORD_SETS.length >= 10, `only ${CHORD_SETS.length} sets`);
  });

  test("Both modes are well served", () => {
    assert.ok(setsFor("minor").length >= 4);
    assert.ok(setsFor("major").length >= 4);
  });

  test("Set names and ids are unique", () => {
    assert.equal(new Set(CHORD_SETS.map((s) => s.id)).size, CHORD_SETS.length);
    assert.equal(new Set(CHORD_SETS.map((s) => s.name)).size, CHORD_SETS.length);
  });
});

describe("Feature: The piano follows whichever scale is chosen", () => {
  const { activeScalePcs } = th;

  test("A built-in scale lights its own notes", () => {
    assert.deepEqual(activeScalePcs(null, PC["C#"], "dorian"), scalePcs(PC["C#"], "dorian"));
  });

  test("A scale of your own lights its own notes too", () => {
    // this was dead: the piano ignored a saved scale entirely, which made
    // saving one pointless
    const mine = customScaleFrom([48, 50, 51, 53, 55, 56, 58], "Mine");
    assert.deepEqual(activeScalePcs(mine, PC["C#"], "dorian"), customScalePcs(mine));
  });

  test("Choosing a built-in scale replaces one of your own", () => {
    const mine = customScaleFrom([48, 50, 51, 53, 55, 56, 58]);
    assert.notDeepEqual(activeScalePcs(mine, PC.C, "major"), activeScalePcs(null, PC.C, "major"));
    assert.deepEqual(activeScalePcs(null, PC.C, "major"), scalePcs(PC.C, "major"));
  });
});

describe("Feature: The guide", () => {
  const { TAB_IDS, GUIDE, guideFor } = th;

  test("Every tab is documented", () => {
    // content as data so a new tab cannot quietly ship undocumented
    for (const id of TAB_IDS.filter((t) => t !== "guide")) {
      assert.ok(guideFor(id).length > 0, `the ${id} tab has no section in the guide`);
    }
  });

  test("Every section points at a tab that exists", () => {
    for (const g of GUIDE) {
      if (g.tab !== null) assert.ok(TAB_IDS.includes(g.tab), `${g.id} points at "${g.tab}", which is not a tab`);
    }
  });

  test("Every section actually says something", () => {
    for (const g of GUIDE) {
      assert.ok(g.title?.length, `${g.id}: no title`);
      assert.ok(g.lead?.length > 30, `${g.id}: the lead is too thin to be useful`);
      assert.ok(g.points.length >= 3, `${g.id}: only ${g.points.length} points`);
      for (const p of g.points) assert.ok(p.length > 20, `${g.id}: "${p}" is not a sentence`);
    }
  });

  test("The parts with no tab of their own are still covered", () => {
    const general = GUIDE.filter((g) => g.tab === null).map((g) => g.id);
    for (const needed of ["start", "piano", "sound"]) {
      assert.ok(general.includes(needed), `nothing explains ${needed}`);
    }
  });

  test("It opens with how to begin", () => {
    assert.equal(GUIDE[0].id, "start", "the first thing a new user reads should be where to start");
  });

  test("Section ids are unique", () => {
    const ids = GUIDE.map((g) => g.id);
    assert.equal(new Set(ids).size, ids.length);
  });
});

describe("Feature: Explanations stay short enough to read", () => {
  const { sentenceCount } = th;

  test("Sentences are counted, including the last one", () => {
    assert.equal(sentenceCount("One."), 1);
    assert.equal(sentenceCount("One. Two."), 2);
    assert.equal(sentenceCount("No full stop"), 0);
    assert.equal(sentenceCount("A question? And an answer."), 2);
  });

  test("No chord explanation runs past two sentences, in any key or palette", () => {
    // D-011 set this cap and nothing checked it: two thirds of explanations
    // broke it, in an app whose whole promise is a readable sentence
    for (let tonic = 0; tonic < 12; tonic++) {
      for (const mode of ["minor", "major"]) {
        const parent = mode === "minor" ? "natural-minor" : "major";
        for (const scaleId of [parent, "minor-pentatonic", "blues", "dorian", "mixolydian"]) {
          if (scaleById(scaleId).mode !== mode) continue;
          for (const size of [3, 4, 5]) {
            for (const c of harmonize(tonic, parent, size)) {
              const e = explainChord(c, { tonic, mode, scaleId });
              assert.ok(sentenceCount(e.plain) <= 2,
                `${chordLabel(c.rootPc, c.sym, "letters")} in ${scaleId}: ${sentenceCount(e.plain)} sentences`);
              assert.ok(e.plain.length <= 220, `too long to read on a phone: ${e.plain.length} chars`);
            }
          }
        }
      }
    }
  });

  test("A borrowed chord is explained just as briefly", () => {
    const gSharp7 = { rootPc: PC["G#"], sym: "7", full: "dominant 7th", degreeIndex: 4, roman: "V7", notes: [56, 60, 63, 66] };
    for (let tonic = 0; tonic < 12; tonic++) {
      const e = explainChord(gSharp7, { tonic, mode: "minor", scaleId: "natural-minor" });
      assert.ok(sentenceCount(e.plain) <= 2, `${sentenceCount(e.plain)} sentences`);
    }
  });

  test("Every explanation ends in a full stop", () => {
    for (const c of palette(PC["C#"], "minor", 4)) {
      const e = explainChord(c, { tonic: PC["C#"], mode: "minor", scaleId: "natural-minor" });
      assert.match(e.plain.trim(), /[.!?]$/, "an explanation that trails off reads as a bug");
    }
  });

  test("Figures are explained briefly too", () => {
    const scale = scalePcs(PC["C#"], "natural-minor");
    const loop = palette(PC["C#"], "minor");
    for (const pat of PATTERNS) {
      const fig = renderFigure(pat, loop[0], loop[1], scale, 3, pat.kind === "bass" ? 36 : 64);
      assert.ok(sentenceCount(explainFigure(pat, fig)) <= 3, `${pat.id}: too wordy`);
    }
  });
});

describe("Feature: Several fingers at once", () => {
  const { MAX_HELD, heldAfterDown, heldAfterUp } = th;

  test("A second key joins the first rather than replacing it", () => {
    // the bug: the set was rebuilt on every press, so one finger unlit another
    let held = [];
    held = heldAfterDown(held, 60);
    held = heldAfterDown(held, 64);
    held = heldAfterDown(held, 67);
    assert.deepEqual(held, [60, 64, 67]);
  });

  test("Lifting one finger leaves the others down", () => {
    const held = heldAfterUp([60, 64, 67], 64);
    assert.deepEqual(held, [60, 67], "releasing one key must not clear the rest");
  });

  test("Held notes stay in order however they were pressed", () => {
    let held = [];
    for (const m of [67, 60, 64]) held = heldAfterDown(held, m);
    assert.deepEqual(held, [60, 64, 67]);
  });

  test("Pressing a key that is already down changes nothing", () => {
    assert.deepEqual(heldAfterDown([60, 64], 60), [60, 64]);
  });

  test("Lifting a key that was never down changes nothing", () => {
    assert.deepEqual(heldAfterUp([60, 64], 62), [60, 64]);
  });

  test("Eight fingers is the limit, and a ninth is refused rather than stealing", () => {
    let held = [];
    for (let i = 0; i < 12; i++) held = heldAfterDown(held, 60 + i);
    assert.equal(held.length, MAX_HELD, "the stated polyphony is eight");
    assert.deepEqual(held, [60, 61, 62, 63, 64, 65, 66, 67], "the first eight keep sounding");
  });

  test("Releasing after the limit makes room again", () => {
    let held = [];
    for (let i = 0; i < 10; i++) held = heldAfterDown(held, 60 + i);
    held = heldAfterUp(held, 60);
    held = heldAfterDown(held, 72);
    assert.ok(held.includes(72), "a finger lifted should free a slot");
    assert.equal(held.length, MAX_HELD);
  });

  test("A whole chord can be held at once", () => {
    let held = [];
    for (const m of palette(PC["C#"], "minor", 5)[0].notes) held = heldAfterDown(held, m);
    assert.equal(held.length, 5, "a ninth chord is five fingers and must fit");
  });
});

describe("Feature: Rolling a finger across the keys", () => {
  const { slideTo, notesUnderFingers } = th;

  test("A finger arriving on a key sounds it", () => {
    const r = slideTo({}, 1, 60);
    assert.equal(r.pressed, 60);
    assert.equal(r.released, null);
  });

  test("Rolling onto the next key stops the one behind it", () => {
    const down = slideTo({}, 1, 60).next;
    const r = slideTo(down, 1, 62);
    assert.equal(r.pressed, 62);
    assert.equal(r.released, 60, "a glissando that never releases is a cluster");
  });

  test("Staying on the same key does nothing", () => {
    const down = slideTo({}, 1, 60).next;
    const r = slideTo(down, 1, 60);
    assert.equal(r.pressed, null);
    assert.equal(r.released, null);
    assert.equal(r.next, down, "no work, no new object");
  });

  test("A note another finger is still holding is not cut off", () => {
    let a = slideTo({}, 1, 62).next;
    a = slideTo(a, 2, 62).next;                 // second finger on the same key
    const r = slideTo(a, 1, 64);                // first rolls away
    assert.equal(r.pressed, 64);
    assert.equal(r.released, null, "the other finger is still on 62");
  });

  test("A second finger landing on a sounding key does not retrigger it", () => {
    const a = slideTo({}, 1, 62).next;
    assert.equal(slideTo(a, 2, 62).pressed, null);
  });

  test("Lifting releases only what that finger held", () => {
    let a = slideTo({}, 1, 60).next;
    a = slideTo(a, 2, 64).next;
    const r = slideTo(a, 1, null);
    assert.equal(r.released, 60);
    assert.deepEqual(notesUnderFingers(r.next), [64]);
  });

  test("Sliding off the keyboard releases the note", () => {
    const a = slideTo({}, 1, 60).next;
    const r = slideTo(a, 1, null);
    assert.equal(r.released, 60);
    assert.deepEqual(notesUnderFingers(r.next), []);
  });

  test("A run up the keyboard sounds every key once, in order", () => {
    let a = {}, pressed = [];
    for (const m of [60, 62, 64, 65, 67]) {
      const r = slideTo(a, 1, m);
      if (r.pressed !== null) pressed.push(r.pressed);
      a = r.next;
    }
    assert.deepEqual(pressed, [60, 62, 64, 65, 67]);
    assert.deepEqual(notesUnderFingers(a), [67], "only the last key should still be down");
  });

  test("Two fingers rolling at once stay independent", () => {
    let a = slideTo({}, 1, 60).next;
    a = slideTo(a, 2, 67).next;
    a = slideTo(a, 1, 62).next;
    a = slideTo(a, 2, 69).next;
    assert.deepEqual(notesUnderFingers(a), [62, 69]);
  });
});

describe("Feature: Finding the key under a finger", () => {
  const { keyAtPosition } = th;
  const W = 760, H = 140, START = 48, OCT = 4;
  const WHITES = 29;                       // four octaves plus the top C
  const ww = W / WHITES;
  const at = (x, y) => keyAtPosition(x, y, W, H, START, OCT);

  test("The middle of the first white key is that key", () => {
    assert.equal(at(ww * 0.5, H * 0.9), 48);        // C3
  });

  test("Black keys win in the upper part of the keyboard", () => {
    assert.equal(noteName(at(ww * 1, H * 0.2), "letters"), "C#");
  });

  test("Below the black keys, the white key underneath wins", () => {
    // the same x, lower down, must be the white key — otherwise the bottom
    // half of the keyboard would be unplayable where a black key sits above
    assert.equal(noteName(at(ww * 1, H * 0.9), "letters"), "D");
  });

  test("Every white key is reachable at its own centre", () => {
    for (let i = 0; i < WHITES; i++) {
      const m = at(ww * (i + 0.5), H * 0.9);
      assert.ok(m !== null, `white key ${i} unreachable`);
      assert.ok(WHITE_PCS_TEST.includes(pc(m)), `white key ${i} resolved to a black key`);
    }
  });

  test("Every black key is reachable at its own centre", () => {
    const midis = Array.from({ length: OCT * 12 + 1 }, (_, i) => START + i);
    const whites = midis.filter((m) => WHITE_PCS_TEST.includes(pc(m)));
    for (const m of midis.filter((x) => !WHITE_PCS_TEST.includes(pc(x)))) {
      const before = whites.filter((w) => w < m).length;
      const centre = before * ww;
      assert.equal(at(centre, H * 0.2), m, `${noteName(m, "letters")} unreachable at its centre`);
    }
  });

  test("A point outside the keyboard belongs to no key", () => {
    assert.equal(at(-1, H / 2), null);
    assert.equal(at(W + 1, H / 2), null);
    assert.equal(at(W / 2, -1), null);
    assert.equal(at(W / 2, H + 1), null);
  });

  test("Dragging across the keyboard visits keys in order", () => {
    const seen = [];
    for (let x = 0; x < W; x += 2) {
      const m = at(x, H * 0.9);                     // along the white keys
      if (m !== seen[seen.length - 1]) seen.push(m);
    }
    assert.deepEqual(seen, [...seen].sort((a, b) => a - b), "a left-to-right drag must ascend");
    assert.equal(new Set(seen).size, seen.length, "a key was revisited, so the drag jumped back");
    assert.equal(seen.length, WHITES, "every white key should be crossed exactly once");
  });

  test("The layout follows the octave shift", () => {
    assert.equal(keyAtPosition(ww * 0.5, H * 0.9, W, H, 60, OCT), 60);
    assert.equal(keyAtPosition(ww * 0.5, H * 0.9, W, H, 36, OCT), 36);
  });

  test("A narrow phone-width keyboard still resolves every white key", () => {
    const narrow = 380;
    const found = new Set();
    for (let x = 0; x < narrow; x += 0.5) found.add(keyAtPosition(x, H * 0.9, narrow, H, START, 2));
    assert.equal(found.size, 15, "two octaves is fifteen white keys, all reachable at 380px");
  });
});

/* ==========================================================================
   Melody guide, what changed, tension
   ========================================================================== */

const { melodyRole, MELODY_ROLES, melodyGuide, changedNotes, describeChange,
        TENSION_LEVELS, BORROWED, chordsAtTension } = th;

describe("Feature: Which notes work over this chord", () => {
  const scale = scalePcs(PC["C#"], "natural-minor");
  const A = find(palette(PC["C#"], "minor"), "A");

  test("Chord tones land, scale notes move, the rest pull", () => {
    assert.equal(melodyRole(PC.A, A.notes.map(pc), scale), "stable");
    assert.equal(melodyRole(PC["D#"], A.notes.map(pc), scale), "movement");
    assert.equal(melodyRole(PC.G, A.notes.map(pc), scale), "tension");
  });

  test("Every note of the octave gets exactly one answer", () => {
    const g = melodyGuide(A, scale);
    const all = [...g.stable, ...g.movement, ...g.tension];
    assert.equal(all.length, 12);
    assert.equal(new Set(all).size, 12, "a note was classified twice");
  });

  test("The chord's own notes are always the stable ones", () => {
    for (const c of palette(PC["C#"], "minor", 4)) {
      const g = melodyGuide(c, scale);
      assert.deepEqual(g.stable.sort(), [...new Set(c.notes.map(pc))].sort());
    }
  });

  test("With no chord selected, the scale still divides the octave", () => {
    const g = melodyGuide(null, scale);
    assert.equal(g.stable.length, 0);
    assert.deepEqual(g.movement.sort((a, b) => a - b), [...scale].sort((a, b) => a - b));
    assert.equal(g.tension.length, 5, "the five notes outside a seven-note scale");
  });

  test("Every role explains what to do with it", () => {
    for (const r of ["stable", "movement", "tension"]) {
      assert.ok(MELODY_ROLES[r].label && MELODY_ROLES[r].why.length > 20);
    }
  });
});

describe("Feature: What changed", () => {
  test("A one-note difference is named as one", () => {
    const before = scalePcs(PC["C#"], "natural-minor");
    const after = scalePcs(PC["C#"], "dorian");
    const d = changedNotes(before, after);
    assert.deepEqual(d.added.map((p) => noteName(p, "letters")), ["A#"]);
    assert.deepEqual(d.removed.map((p) => noteName(p, "letters")), ["A"]);
    assert.equal(d.held.length, 6);
    assert.match(describeChange(before, after), /A became A#/);
  });

  test("A bigger change lists both directions and what stayed", () => {
    const text = describeChange(scalePcs(PC.C, "major"), scalePcs(PC.C, "blues"));
    assert.match(text, /came in/);
    assert.match(text, /went out/);
    assert.match(text, /stayed/);
  });

  test("No change says so rather than inventing a difference", () => {
    const s = scalePcs(PC.C, "major");
    assert.equal(describeChange(s, s), "Nothing changed.");
    assert.deepEqual(changedNotes(s, s).added, []);
  });

  test("Octaves are ignored: it is about which notes, not where", () => {
    assert.deepEqual(changedNotes([48, 52, 55], [60, 64, 67]).added, []);
  });

  test("It is described in the chosen naming system", () => {
    const text = describeChange(scalePcs(PC["C#"], "natural-minor"), scalePcs(PC["C#"], "dorian"), "solfege");
    assert.match(text, /La became La#/);
  });
});

describe("Feature: How adventurous?", () => {
  test("Safe gives the plain chords of the key and nothing else", () => {
    const c = chordsAtTension(PC["C#"], "minor", 0);
    assert.equal(c.length, 7);
    assert.ok(c.every((x) => !x.extra));
    assert.equal(c.map((x) => chordLabel(x.rootPc, x.sym, "letters")).join(" "), "C#m D#dim E F#m G#m A B");
  });

  test("Colour keeps the same seven chords, richer", () => {
    const c = chordsAtTension(PC["C#"], "minor", 1);
    assert.equal(c.length, 7);
    assert.ok(c.every((x) => x.notes.length === 4), "colour means sevenths");
  });

  test("Each step up adds chords and never removes any", () => {
    for (let tonic = 0; tonic < 12; tonic++) {
      for (const mode of ["minor", "major"]) {
        let last = 0;
        for (const level of [1, 2, 3]) {
          const n = chordsAtTension(tonic, mode, level).length;
          assert.ok(n >= last, `level ${level} offered fewer chords than ${level - 1}`);
          last = n;
        }
      }
    }
  });

  test("Adventurous actually offers chords from outside the key", () => {
    // three tests below iterate over the borrowed chords, so an empty list
    // passed all of them vacuously. Mutation testing found that.
    for (let tonic = 0; tonic < 12; tonic++) {
      for (const mode of ["minor", "major"]) {
        const borrowed = chordsAtTension(tonic, mode, 3).filter((c) => c.extra);
        assert.ok(borrowed.length >= 3, `${mode}: only ${borrowed.length} borrowed chords`);
        assert.ok(chordsAtTension(tonic, mode, 3).length > chordsAtTension(tonic, mode, 1).length,
          "adventurous must widen the choice, not just relabel it");
        assert.ok(chordsAtTension(tonic, mode, 2).some((c) => c.extra),
          "the borrowed level must borrow something");
      }
    }
  });

  test("Every borrowed chord explains why it is worth trying", () => {
    for (const mode of ["minor", "major"]) {
      for (const c of chordsAtTension(PC.C, mode, 3).filter((x) => x.extra)) {
        assert.ok(c.why?.length > 25, `${chordLabel(c.rootPc, c.sym, "letters")} is offered with no reason`);
      }
    }
  });

  test("Borrowed chords really do leave the key", () => {
    for (let tonic = 0; tonic < 12; tonic++) {
      const inKey = scalePcs(tonic, "natural-minor");
      const borrowed = chordsAtTension(tonic, "minor", 3).filter((c) => c.extra);
      for (const c of borrowed) {
        const outside = c.notes.map(pc).filter((p) => !inKey.includes(p));
        assert.ok(outside.length > 0, `${chordLabel(c.rootPc, c.sym, "letters")} is diatonic and not borrowed at all`);
      }
    }
  });

  test("Every level is named and described", () => {
    assert.equal(TENSION_LEVELS.length, 4);
    for (const l of TENSION_LEVELS) assert.ok(l.name && l.note.length > 25);
  });

  test("Both modes have borrowed chords to offer", () => {
    for (const mode of ["minor", "major"]) assert.ok(BORROWED[mode].length >= 3);
  });

  test("Borrowed chords are playable, like anything else", () => {
    for (const c of chordsAtTension(PC["C#"], "minor", 3)) {
      assert.ok(c.notes.length >= 3);
      assert.equal(pc(c.notes[0]), c.rootPc);
      assert.deepEqual(c.notes, [...c.notes].sort((a, b) => a - b));
    }
  });
});

/* ==========================================================================
   The sheet
   ========================================================================== */

const { diagramKeys, diagramRange, sheetData, sheetAsText } = th;

describe("Feature: A sheet to take to an instrument", () => {
  const p = palette(PC["C#"], "minor", 4);
  const loop = ["C#m7", "Amaj7", "Emaj7", "B7"].map((n) => find(p, n));
  const make = (over = {}) => sheetData({
    tonic: PC["C#"], mode: "minor", scaleId: "natural-minor",
    customScale: null, progression: loop, bpm: 88, ...over,
  });

  test("The sheet carries one chord per bar, in order", () => {
    const s = make();
    assert.equal(s.chords.length, 4);
    assert.deepEqual(s.chords.map((c) => c.bar), [1, 2, 3, 4]);
    assert.equal(s.chords[0].label, "C#m7");
  });

  test("Each chord carries its actual voicing, not just its name", () => {
    // the whole point of a printed sheet: a name tells you nothing you did
    // not already know
    const s = make();
    s.chords.forEach((c, i) => assert.deepEqual(c.notes, loop[i].notes));
  });

  test("Every chord fits inside the drawn range", () => {
    const s = make();
    const lo = s.range.startMidi, hi = lo + s.range.octaves * 12;
    for (const c of s.chords) {
      for (const n of c.notes) assert.ok(n >= lo && n <= hi, `${c.label} has a note off the diagram`);
    }
  });

  test("The range snaps to whole octaves so the diagrams line up", () => {
    assert.equal(make().range.startMidi % 12, 0);
    assert.equal(diagramRange([50, 70]).startMidi % 12, 0);
    assert.ok(diagramRange([]).octaves >= 2, "an empty loop still gets a drawable keyboard");
  });

  test("A wide voicing widens the range rather than being cut off", () => {
    const wide = { ...loop[0], notes: [36, 52, 60, 79] };
    const s = make({ progression: [wide] });
    const lo = s.range.startMidi, hi = lo + s.range.octaves * 12;
    for (const n of wide.notes) assert.ok(n >= lo && n <= hi);
  });

  test("The bass line is on the sheet, one entry per bar", () => {
    const s = make();
    assert.equal(s.bass.length, 4);
    assert.equal(s.bass[0].names[0], "C#");
  });

  test("A generated bassline is used where there is one", () => {
    const fig = [[{ midi: 37 }, { midi: 44 }], [{ midi: 45 }], [{ midi: 40 }], [{ midi: 47 }]];
    const s = make({ bassFigure: fig });
    assert.equal(s.bass[0].notes.length, 2, "the figure should replace the plain root");
  });

  test("The scale is written out once, from the tonic", () => {
    const s = make();
    assert.deepEqual(s.scale.names, ["C#", "D#", "E", "F#", "G#", "A", "B"]);
    assert.equal(s.scale.start % 12, 0);
  });

  test("A scale of your own goes on the sheet under its own name", () => {
    const mine = customScaleFrom([48, 50, 51, 53, 55, 56, 58], "Mine");
    const s = make({ customScale: mine });
    assert.equal(s.scale.name, "Mine");
    assert.deepEqual(s.scale.names.sort(), customScalePcs(mine).map((x) => noteName(x, "letters")).sort());
  });

  test("The heading says what a player needs before starting", () => {
    const s = make();
    assert.match(s.title, /C# minor/);
    assert.ok(s.meta.some((m) => m.includes("88")), "tempo belongs on the sheet");
  });

  test("An empty loop produces an empty sheet rather than failing", () => {
    const s = make({ progression: [] });
    assert.deepEqual(s.chords, []);
    assert.deepEqual(s.bass, []);
    assert.ok(s.scale.names.length, "the scale is still worth printing");
  });

  test("It follows the chosen naming system", () => {
    const s = make({ system: "solfege" });
    assert.equal(s.chords[0].label, "Do#m7");
    assert.ok(s.scale.names.includes("Do#"));
  });

  test("The text version holds everything the picture does", () => {
    const text = sheetAsText(make());
    for (const c of make().chords) assert.match(text, new RegExp(c.label.replace(/[#♭]/g, ".")));
    assert.match(text, /Scale:/);
    assert.match(text, /bass:/);
  });
});

describe("Feature: Chord diagrams", () => {
  test("Every key is drawn exactly once, in order", () => {
    const d = diagramKeys(48, 2, []);
    assert.equal(d.whites.length, 15, "two octaves plus the top note");
    assert.equal(d.blacks.length, 10);
    for (let i = 1; i < d.whites.length; i++) assert.ok(d.whites[i].x > d.whites[i - 1].x);
  });

  test("The keys of the chord are the lit ones, and no others", () => {
    const chord = palette(PC.C, "major")[0];          // C E G
    const d = diagramKeys(48, 2, chord.notes);
    const lit = [...d.whites, ...d.blacks].filter((k) => k.on).map((k) => k.midi);
    assert.deepEqual(lit.sort((a, b) => a - b), chord.notes);
  });

  test("A black key straddles the boundary between its two white keys", () => {
    // "somewhere between C and D" is too loose: a key drawn entirely inside D
    // satisfies it and looks wrong. A black key is centred on the join.
    const d = diagramKeys(48, 2, []);
    const whiteW = d.whites[0].w;
    for (const black of d.blacks) {
      const below = d.whites.filter((w) => w.midi < black.midi).pop();
      const boundary = below.x + below.w;
      const centre = black.x + black.w / 2;
      assert.ok(Math.abs(centre - boundary) < whiteW * 0.12,
        `${noteName(black.midi, "letters")} is centred ${((centre - boundary) / whiteW).toFixed(2)} of a key from the join`);
    }
  });

  test("The layout spans the full width", () => {
    const d = diagramKeys(48, 3, []);
    const last = d.whites[d.whites.length - 1];
    assert.ok(Math.abs(last.x + last.w - 1) < 1e-9, "the keyboard should fill the space given");
  });

  test("Nothing lit means nothing lit", () => {
    const d = diagramKeys(48, 2, []);
    assert.equal([...d.whites, ...d.blacks].filter((k) => k.on).length, 0);
  });
});

/* ==========================================================================
   Levels — how much of the app is on screen
   ========================================================================== */

const { LEVELS, levelIndex, featuresAt, has, tabsAt, TABS_BY_FEATURE, UC00_NEEDS } = th;

describe("Feature: Levels", () => {
  test("The main scenario is completable at the simplest level", () => {
    // if UC-00 needs something Start does not have, the split is wrong
    for (const f of UC00_NEEDS) {
      assert.ok(has("start", f), `Start is missing "${f}", which the main scenario needs`);
    }
  });

  test("Start is genuinely small", () => {
    // five, not four, since Learn joined Start: the one tab a beginner needs
    // most. The levels themselves are on their way out (D-072, D-073).
    const tabs = tabsAt("start");
    assert.ok(tabs.length <= 5, `${tabs.length} tabs is not a first impression, it is a menu`);
    assert.ok(tabs.includes("chords") && tabs.includes("scales") && tabs.includes("prog") && tabs.includes("learn"));
  });

  test("Levels only ever add, so nothing a user found disappears", () => {
    for (let i = 1; i < LEVELS.length; i++) {
      const below = featuresAt(LEVELS[i - 1].id);
      const above = featuresAt(LEVELS[i].id);
      for (const f of below) {
        assert.ok(above.has(f), `"${f}" vanishes when moving up to ${LEVELS[i].name}`);
      }
      assert.ok(above.size > below.size, `${LEVELS[i].name} adds nothing`);
    }
  });

  test("Tabs keep their order, so one never moves when another appears", () => {
    // compared only against each other, reversing every level stayed
    // self-consistent and passed. The order has to be stated outright.
    assert.deepEqual(tabsAt("study"),
      ["chords", "find", "scales", "prog", "bass", "theory", "sheet", "learn", "guide"],
      "chords come first and the guide last");
    assert.equal(tabsAt("start")[0], "chords", "the first tab is where the work starts");
    assert.equal(tabsAt("start")[tabsAt("start").length - 1], "guide");
    const order = tabsAt("study");
    for (const l of LEVELS) {
      const tabs = tabsAt(l.id);
      assert.deepEqual(tabs, order.filter((t) => tabs.includes(t)), `${l.name} reorders the tabs`);
    }
  });

  test("Every tab is reachable at some level", () => {
    const everything = tabsAt(LEVELS[LEVELS.length - 1].id);
    for (const id of th.TAB_IDS) {
      assert.ok(everything.includes(id), `the ${id} tab is unreachable at every level`);
    }
  });

  test("The guide is available from the very beginning", () => {
    assert.ok(tabsAt("start").includes("guide"), "a first-time user is exactly who needs it");
  });

  test("Every level says what it is for", () => {
    for (const l of LEVELS) {
      assert.ok(l.name && l.note.length > 25, `${l.id} is undescribed`);
      assert.ok(l.adds.length > 0);
    }
  });

  test("An unknown level falls back to the simplest rather than showing nothing", () => {
    assert.equal(levelIndex("nonsense"), 0);
    assert.deepEqual(tabsAt("nonsense"), tabsAt("start"));
  });

  test("Theory and the sheet are not in a beginner's way", () => {
    assert.ok(!tabsAt("start").includes("theory"));
    assert.ok(!tabsAt("start").includes("sheet"));
    assert.ok(!has("start", "tension"), "a slider called adventurous is not a first impression");
    assert.ok(!has("start", "voicings"));
  });

  test("Producing does not require studying", () => {
    for (const f of ["voicings", "sets", "riffs", "bass", "sheet", "find"]) {
      assert.ok(has("produce", f), `"${f}" is a working tool and belongs at Produce`);
    }
    assert.ok(!has("produce", "dictionary"), "the dictionary is for studying, not producing");
  });

  test("Every feature named by a level maps to something real", () => {
    const known = new Set([...Object.keys(TABS_BY_FEATURE), "key", "piano", "sound", "explain",
      "sevenths", "voicings", "sets", "tension", "riffs", "numerals", "naming",
      "dictionary", "inversions", "harmonise", "formal", "melodyGuide"]);
    for (const l of LEVELS) {
      for (const f of l.adds) assert.ok(known.has(f), `${l.id} names an unknown feature "${f}"`);
    }
  });
});

describe("Feature: Extended chords and their spacing", () => {
  test("The dictionary reaches elevenths and thirteenths", () => {
    const syms = DICTIONARY.map((d) => d.q);
    for (const needed of ["m11", "maj13", "13", "m13", "6/9", "add9", "maj7♯11", "7♭9", "7♯9", "sus4(9)"]) {
      assert.ok(syms.includes(needed), `missing ${needed}`);
    }
  });

  test("An extended chord offers the spacing it is usually played with", () => {
    // a minor 11th stacked in thirds is mud; in fourths it is the sound
    // people mean by the name
    const gm11 = dictionaryFor(PC.G).find((c) => c.sym === "m11");
    const sig = voicingsFor(gm11).find((v) => v.id === "signature");
    assert.ok(sig, "m11 should have a signature voicing");
    const gaps = sig.notes.slice(1).map((n, i) => n - sig.notes[i]);
    assert.ok(gaps.every((g) => g >= 4), `stacked in thirds after all: ${gaps.join(",")}`);
  });

  test("A signature voicing holds the notes that name the chord", () => {
    for (const d of DICTIONARY.filter((x) => x.voicing)) {
      const chord = dictionaryFor(PC.C).find((c) => c.sym === d.q);
      const sig = voicingsFor(chord).find((v) => v.id === "signature");
      const pcs = sig.notes.map(pc);
      assert.ok(pcs.includes(chord.rootPc), `${d.q}: the signature lost its root`);
      /* Not every extension survives — the classic m11 voicing drops the 9th
         on purpose. What must survive is the one the chord is named for. */
      const top = Math.max(...d.iv);
      if (top > 11) {
        assert.ok(pcs.includes(pc(top)),
          `${d.q}: the extension it is named for is missing from its own voicing`);
      }
      assert.ok(sig.notes.length >= 3, `${d.q}: too few notes to be a voicing`);
    }
  });

  test("Signature voicings stay inside a piano and ascend", () => {
    for (let root = 0; root < 12; root++) {
      for (const d of DICTIONARY.filter((x) => x.voicing)) {
        const chord = dictionaryFor(root).find((c) => c.sym === d.q);
        const sig = voicingsFor(chord).find((v) => v.id === "signature");
        assert.deepEqual(sig.notes, [...sig.notes].sort((a, b) => a - b), `${d.q}: not ascending`);
        assert.ok(Math.max(...sig.notes) <= 96 && Math.min(...sig.notes) >= 21, `${d.q}: off the keyboard`);
        assert.ok(sig.notes.length <= 8, `${d.q}: more notes than the app can sound`);
      }
    }
  });

  test("Plain chords have no signature voicing, because they need none", () => {
    for (const q of ["", "m", "dim", "sus4"]) {
      const chord = dictionaryFor(PC.C).find((c) => c.sym === q);
      assert.ok(!voicingsFor(chord).some((v) => v.id === "signature"), `${q || "major"} does not need one`);
    }
  });

  test("Every extended chord can still be identified from its notes", () => {
    for (let root = 0; root < 12; root++) {
      for (const d of DICTIONARY.filter((x) => ["6/9", "add9", "m(add9)", "m11", "maj13", "13", "m13", "maj7♯11", "7♭9", "7♯9", "sus4(9)"].includes(x.q))) {
        const chord = dictionaryFor(root).find((c) => c.sym === d.q);
        const found = identifyChord(chord.notes);
        assert.ok(found.length, `${NAMES_T[root]}${d.q} cannot be identified`);
      }
    }
  });

  test("The wide chord sets are built from the extended qualities", () => {
    for (const id of ["storybook", "quest"]) {
      const def = CHORD_SETS.find((s) => s.id === id);
      assert.ok(def, `${id} is missing`);
      const extended = def.slots.filter(([, q]) => ["m11", "maj13", "13", "m13", "6/9", "maj7♯11", "sus4(9)", "m(add9)"].includes(q));
      assert.ok(extended.length >= 5, `${id} is not actually a wide set`);
    }
  });
});

describe("Feature: Rooms", () => {
  const { SPACES, reverbSettings } = th;

  test("Dry is actually dry", () => {
    assert.equal(reverbSettings("dry").wet, 0, "a room you can hear is not dry");
  });

  test("Each room is bigger than the last", () => {
    for (let i = 1; i < SPACES.length; i++) {
      assert.ok(SPACES[i].decay > SPACES[i - 1].decay, `${SPACES[i].name} is not bigger than ${SPACES[i - 1].name}`);
      assert.ok(SPACES[i].wet >= SPACES[i - 1].wet);
    }
  });

  test("No room drowns the dry signal", () => {
    for (const s of SPACES) {
      assert.ok(s.wet <= 0.5, `${s.name} at ${s.wet} wet would bury the notes`);
      assert.ok(s.decay <= 8, `${s.name} would still be ringing next bar`);
    }
  });

  test("An unknown room falls back to dry rather than to noise", () => {
    assert.deepEqual(reverbSettings("nonsense"), reverbSettings("dry"));
  });

  test("Every room says what it is for", () => {
    for (const s of SPACES) assert.ok(s.name && s.note.length > 25, `${s.id} is undescribed`);
  });
});

describe("Feature: Chords follow the keyboard", () => {
  test("A chord is built in the octave being shown", () => {
    // shifting the keyboard used to move the picture and leave the sound behind
    for (const base of [36, 48, 60, 72]) {
      const c = harmonize(PC.C, "major", 3, base)[0];
      assert.deepEqual(c.notes, [base, base + 4, base + 7], `base ${base}`);
    }
  });

  test("Every chord source follows the octave", () => {
    const at = (base) => [
      harmonize(PC.C, "major", 4, base)[0].notes[0],
      dictionaryFor(PC.C, base)[0].notes[0],
      buildSet(CHORD_SETS[0], PC.C, base).chords[0].notes[0],
      chordsAtTension(PC.C, "major", 2, base)[0].notes[0],
    ];
    assert.deepEqual(at(36), [36, 36, 36, 36]);
    assert.deepEqual(at(60), [60, 60, 60, 60]);
  });

  test("The default octave is unchanged when none is given", () => {
    assert.equal(harmonize(PC.C, "major", 3)[0].notes[0], 48);
  });

  test("A signature voicing is built around the chord it belongs to", () => {
    for (const base of [36, 60]) {
      const chord = dictionaryFor(PC.G, base).find((c) => c.sym === "m11");
      const sig = voicingsFor(chord).find((v) => v.id === "signature");
      assert.ok(Math.abs(Math.min(...sig.notes) - Math.min(...chord.notes)) <= 12,
        "the signature drifted away from its own chord");
    }
  });
});

describe("Feature: A recorded instrument never leaves you in silence", () => {
  test("Every sampled instrument names a stand-in to use while it loads", () => {
    // waiting in silence is indistinguishable from broken, and was reported
    // as exactly that
    for (const i of INSTRUMENTS.filter((x) => x.kind === "sampler")) {
      assert.ok(i.fallback, `${i.id}: nothing to play while the samples download`);
      const stand = instrumentById(i.fallback);
      assert.ok(stand && stand.kind !== "sampler",
        `${i.id}: its stand-in must be a synth, or it waits on a download too`);
    }
  });

  test("The stand-in is a reasonable substitute, not just anything", () => {
    for (const i of INSTRUMENTS.filter((x) => x.kind === "sampler")) {
      const stand = instrumentById(i.fallback);
      assert.ok(Math.abs(stand.release - i.release) < 1,
        `${i.id}: the stand-in decays quite differently from the real thing`);
    }
  });

  test("Instrument lookup never returns nothing", () => {
    for (const i of INSTRUMENTS) assert.ok(instrumentById(i.fallback ?? i.id));
    assert.ok(instrumentById(undefined));
  });
});

describe("Feature: Voicings are derived from the chord, not from the last choice", () => {
  test("Close stays close, whatever was picked before", () => {
    // choosing an arrangement used to rewrite the chord's notes, so the next
    // list was built from the previous choice and they all converged
    const c13 = dictionaryFor(PC.C).find((c) => c.sym === "13");
    const closeNotes = voicingsFor(c13).find((v) => v.id === "close").notes;
    let chord = c13;
    for (const pick of ["open", "spread", "rootless", "shell", "signature"]) {
      const v = voicingsFor(chord).find((x) => x.id === pick);
      if (!v) continue;
      chord = { ...chord, notes: v.notes };
      assert.deepEqual(voicingsFor(chord).find((x) => x.id === "close").notes, closeNotes,
        `after picking ${pick}, close position was lost`);
    }
  });

  test("Every arrangement of a big chord is audibly different from the others", () => {
    for (const sym of ["13", "maj13", "m11", "m13"]) {
      const chord = dictionaryFor(PC.C).find((c) => c.sym === sym);
      const shapes = voicingsFor(chord).map((v) => v.notes.join(","));
      assert.equal(new Set(shapes).size, shapes.length, `${sym}: two arrangements are identical`);
    }
  });

  test("A big chord opens by dropping two notes, not one", () => {
    // dropping a single note out of a six-note stack leaves the rest just as
    // crowded, which is why the extended chords all sounded alike
    const c13 = dictionaryFor(PC.C).find((c) => c.sym === "13");
    const close = voicingsFor(c13).find((v) => v.id === "close").notes;
    const open = voicingsFor(c13).find((v) => v.id === "open").notes;
    const spread = (ns) => Math.max(...ns) - Math.min(...ns);
    const avgGap = (ns) => (Math.max(...ns) - Math.min(...ns)) / (ns.length - 1);
    assert.ok(spread(open) > spread(close), "the open voicing is not wider than close");
    assert.ok(avgGap(open) > avgGap(close), "the notes are no further apart than before");
  });

  test("Arrangements still contain the chord, however it was reached", () => {
    const chord = dictionaryFor(PC.G).find((c) => c.sym === "maj13");
    for (const v of voicingsFor(chord)) {
      for (const n of v.notes) {
        assert.ok(chord.notes.map(pc).includes(pc(n)), `${v.id} introduced a note the chord does not have`);
      }
    }
  });
});

describe("Feature: A reused pool of voices", () => {
  const { pickVoiceIndex } = th;

  test("A free voice is used before a busy one is stolen", () => {
    assert.equal(pickVoiceIndex([10, 0, 20], 5), 1);
    // and it must be free, not merely the soonest to finish: removing the
    // free-voice check still returned index 1 here, so state it outright
    const chosenIsIdle = (busy, now) => busy[pickVoiceIndex(busy, now)] <= now;
    for (const busy of [[10, 0, 20], [30, 40, 2], [3, 40, 50]]) {
      assert.ok(chosenIsIdle(busy, 5), `${busy}: a sounding voice was cut off while one was idle`);
    }
  });

  test("With everything busy, the one finishing soonest is taken", () => {
    assert.equal(pickVoiceIndex([30, 12, 20], 5), 1);
  });

  test("The first free voice is used, so allocation is predictable", () => {
    assert.equal(pickVoiceIndex([0, 0, 0], 5), 0);
    // when several are free, take them in order rather than by how long they
    // have been idle: otherwise which voice plays a note depends on history,
    // and the same chord can be allocated differently each time
    assert.equal(pickVoiceIndex([5, 0, 5], 10), 0, "a later free voice was preferred to an earlier one");
    assert.equal(pickVoiceIndex([9, 2, 1], 10), 0);
  });

  test("A voice free exactly now counts as free", () => {
    assert.equal(pickVoiceIndex([9, 5, 9], 5), 1);
  });

  test("It always returns a usable index", () => {
    for (const busy of [[1], [5, 5], [9, 8, 7, 6]]) {
      const i = pickVoiceIndex(busy, 3);
      assert.ok(i >= 0 && i < busy.length);
    }
  });

  test("A whole chord fits the pool without stealing from itself", () => {
    const busy = new Array(MAX_VOICES).fill(0);
    const used = new Set();
    for (let n = 0; n < 6; n++) {
      const i = pickVoiceIndex(busy, 0);
      assert.ok(!used.has(i), "a six-note chord took the same voice twice");
      used.add(i);
      busy[i] = 10;
    }
  });
});

describe("Feature: Rolling a chord", () => {
  const { ROLL_STYLES, rollStyleById, rollOffsets } = th;

  test("Together means together", () => {
    assert.deepEqual(rollOffsets(5, rollStyleById("block").spread), [0, 0, 0, 0, 0]);
  });

  test("A roll lays the notes down in order, lowest first", () => {
    const offs = rollOffsets(4, 0.045);
    assert.equal(offs[0], 0, "the first note lands on the beat");
    for (let i = 1; i < offs.length; i++) assert.ok(offs[i] > offs[i - 1], "notes must arrive in order");
  });

  test("The gaps are even", () => {
    const offs = rollOffsets(5, 0.05);
    const gaps = offs.slice(1).map((o, i) => o - offs[i]);
    for (const g of gaps) assert.ok(Math.abs(g - gaps[0]) < 1e-9, "an uneven roll sounds like a mistake");
  });

  test("A slow roll is slower than a quick one", () => {
    const quick = rollOffsets(6, rollStyleById("roll").spread);
    const slow = rollOffsets(6, rollStyleById("slow").spread);
    assert.ok(slow[slow.length - 1] > quick[quick.length - 1]);
  });

  test("The roll never outlasts the note it belongs to", () => {
    // otherwise the last finger arrives after the chord has already stopped
    for (const count of [2, 4, 6, 8]) {
      for (const style of ROLL_STYLES) {
        const offs = rollOffsets(count, style.spread, 0.1);
        assert.ok(offs[offs.length - 1] <= 0.1 + 1e-9,
          `${style.id} on ${count} notes spills past its own note`);
      }
    }
  });

  test("One note cannot be rolled", () => {
    assert.deepEqual(rollOffsets(1, 0.09), [0]);
    assert.deepEqual(rollOffsets(0, 0.09), []);
  });

  test("Every roll style is named and described", () => {
    for (const r of ROLL_STYLES) assert.ok(r.name && r.note.length > 20);
    assert.equal(rollStyleById("nonsense").spread, 0, "an unknown style plays the chord normally");
  });
});

describe("Feature: The piano travels with the app", () => {
  const grand = INSTRUMENTS.find((i) => i.id === "grand");

  test("Nothing is fetched from another site", () => {
    // a sample host that is not on the page's allow-list means silence, which
    // is how this was reported
    assert.equal(grand.samples.baseUrl, "", "a base URL means a network request");
    for (const [note, url] of Object.entries(grand.samples.urls)) {
      assert.ok(url.startsWith("data:audio/mpeg;base64,"), `${note} is not embedded`);
      assert.ok(!/^https?:/.test(url), `${note} points at another site`);
    }
  });

  test("Sample names are read as the notes they claim to be", () => {
    const { sampleMidi } = th;
    assert.equal(sampleMidi("C1"), 24, "C1 is midi 24");
    assert.equal(sampleMidi("C4"), 60, "middle C is midi 60");
    assert.equal(sampleMidi("F#2"), 42, "a sharp is a semitone above its letter");
    assert.equal(sampleMidi("B3"), 59, "B is eleven above its C");
    assert.ok(Number.isNaN(sampleMidi("H2")), "there is no note H");
    assert.ok(Number.isNaN(sampleMidi("C")), "a note without an octave is not a pitch");
  });

  test("Every note the keyboard can reach is near a recording", () => {
    /* This is the one that was wrong. The old version measured the gaps
       between samples and never asked what the keyboard actually plays, so
       seven samples spanning C2 to C5 passed while the top of the range was
       two octaves above the highest one. Walk the real range instead. (R-230) */
    const { PIANO_RANGE, stretchAt, worstStretch } = th;
    for (let m = PIANO_RANGE.lowest; m <= PIANO_RANGE.highest; m++) {
      assert.ok(stretchAt(m) <= 3,
        `midi ${m} is ${stretchAt(m)} semitones from the nearest recording`);
    }
    assert.ok(worstStretch() <= 3, "some playable note is stretched too far");
  });

  test("A set that does not span the range fails", () => {
    /* The seven that used to ship. If this ever passes, the check above has
       stopped measuring anything. */
    const { worstStretch } = th;
    assert.equal(worstStretch([36, 42, 48, 54, 60, 66, 72]), 24,
      "C2-C5 leaves the top of the keyboard two octaves from a recording");
  });

  test("The samples are evenly spaced", () => {
    const midis = th.sampleAnchors();
    assert.ok(midis.length >= 5, "too few samples to sound like a piano");
    for (let i = 1; i < midis.length; i++) {
      assert.ok(midis[i] - midis[i - 1] <= 6,
        `a gap of ${midis[i] - midis[i - 1]} semitones stretches a sample too far`);
    }
  });

  test("The keyboard cannot be scrolled past the recordings", () => {
    /* The clamp on the octave buttons is derived from the sample span rather
       than typed in, so widening the span widens the keyboard and nothing
       else has to be remembered. (D-071) */
    const { PIANO_RANGE, KEYBOARD_OCTAVES, HIGHEST_START_MIDI } = th;
    assert.equal(HIGHEST_START_MIDI,
      PIANO_RANGE.highest - KEYBOARD_OCTAVES * 12,
      "the highest scroll position must leave a full keyboard inside the range");
    assert.ok(HIGHEST_START_MIDI >= PIANO_RANGE.lowest,
      "the range is narrower than the keyboard is wide");
  });

  test("Each sample is small enough to ship", () => {
    for (const [note, url] of Object.entries(grand.samples.urls)) {
      const bytes = (url.length - url.indexOf(",") - 1) * 3 / 4;
      assert.ok(bytes < 40000, `${note} is ${Math.round(bytes / 1024)}k, too heavy to embed`);
      assert.ok(bytes > 2000, `${note} is ${Math.round(bytes)} bytes — that is not a piano note`);
    }
  });

  test("The whole set stays within a sensible budget", () => {
    const total = Object.values(grand.samples.urls).reduce((n, u) => n + u.length, 0);
    assert.ok(total < 200000, `${Math.round(total / 1024)}k of samples is too much to carry`);
  });

  test("The recordings are credited", () => {
    // they are someone else's work, under a licence that requires it
    assert.ok(grand.credit && /CC-BY/i.test(grand.credit), "an embedded recording must carry its credit");
  });

  test("It still names a stand-in, in case decoding fails", () => {
    assert.ok(grand.fallback, "decoding can fail even when downloading cannot");
  });
});

describe("Feature: The embedded recordings are usable audio", () => {
  const { base64Payload, payloadBytes } = th;
  const grand = INSTRUMENTS.find((i) => i.id === "grand");

  test("A data URI yields its payload", () => {
    assert.equal(base64Payload("data:audio/mpeg;base64,QUJD"), "QUJD");
    assert.equal(base64Payload("nonsense"), "", "no comma, no payload");
  });

  test("Every sample decodes to a plausible amount of audio", () => {
    // an empty or truncated payload would be silence, and silence is how a
    // broken piano presents itself
    for (const [note, uri] of Object.entries(grand.samples.urls)) {
      const bytes = payloadBytes(uri);
      assert.ok(bytes > 4000, `${note}: ${bytes} bytes is too little to be a note`);
      assert.ok(bytes < 40000, `${note}: ${bytes} bytes is too heavy to embed`);
    }
  });

  test("The payload is valid base64", () => {
    for (const [note, uri] of Object.entries(grand.samples.urls)) {
      assert.match(base64Payload(uri), /^[A-Za-z0-9+/]+={0,2}$/, `${note}: not decodable`);
    }
  });

  test("Every sample begins with an MPEG frame", () => {
    // catches a truncated or wrongly-encoded embed, which would decode to
    // nothing and look exactly like a network failure
    for (const [note, uri] of Object.entries(grand.samples.urls)) {
      const head = Buffer.from(base64Payload(uri).slice(0, 8), "base64");
      const isId3 = head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33;
      const isFrame = head[0] === 0xff && (head[1] & 0xe0) === 0xe0;
      assert.ok(isId3 || isFrame, `${note}: does not start like an mp3`);
    }
  });

  test("No two samples are the same recording", () => {
    /* Compare the whole payload, not its first few bytes. Those are the mp3
       header, which carries the duration and nothing about the sound: two
       different notes encoded to the same length share it, and one recording
       copied under two names with a re-tagged header would not. (D-071) */
    const seen = new Map();
    for (const [note, uri] of Object.entries(grand.samples.urls)) {
      const body = base64Payload(uri);
      assert.ok(!seen.has(body), `${note} is a duplicate of ${seen.get(body)}`);
      seen.set(body, note);
    }
  });

  test("Samples differ in their audio, not just their header", () => {
    /* The tail of each payload is audio only. If these ever coincide, the set
       has a copied recording in it whatever the headers say. */
    const tails = new Set();
    for (const uri of Object.values(grand.samples.urls)) {
      tails.add(base64Payload(uri).slice(-512));
    }
    assert.equal(tails.size, Object.keys(grand.samples.urls).length,
      "two samples share their audio tail");
  });
});

/* ==========================================================================
   Practising lessons on the piano (D-072, D-073, UC-58, UC-61)
   ========================================================================== */

describe("Feature: Practising lessons on the piano", () => {
  const { LESSONS, LESSON_TOPICS, buildLesson, lessonsFor, practiceNote, practiceFeedback,
          practiceHint, nextKeyRound, sentenceCount, tabsAt } = th;
  const KEYS = [...Array(12).keys()];
  const SYSTEMS = ["letters", "solfege"];
  /* play a list of notes into a target, returning every result on the way */
  const run = (target, notes, start = []) => {
    let attempt = start;
    return notes.map((m) => { const r = practiceNote(target, attempt, m); attempt = r.attempt; return r; });
  };
  const last = (rs) => rs[rs.length - 1];
  const set = (pcs, extra = {}) => ({ kind: "set", pcs, ...extra });
  const seq = (pcs, direction) => ({ kind: "sequence", pcs, direction });

  test("Every lesson builds in all twelve keys", () => {
    for (const root of KEYS) {
      for (const l of lessonsFor(root)) {
        assert.ok(l.intro && l.intro.length > 20, `${l.id} in ${NAMES_T[root]}: no intro`);
        assert.ok(l.steps.length >= 2, `${l.id}: a lesson needs at least two steps`);
        for (const s of l.steps) {
          assert.ok(s.prompt.length > 5 && s.why.length > 20, `${l.id} step ${s.index}: thin text`);
          assert.ok(s.target.pcs.length >= 1 && ["set", "sequence"].includes(s.target.kind));
          assert.ok(s.show.length >= s.target.pcs.length, `${l.id} step ${s.index}: nothing to demonstrate`);
          for (const p of s.target.pcs) assert.ok(p >= 0 && p < 12);
        }
      }
    }
  });

  test("A lesson's demonstration is itself a correct answer", () => {
    // the answer the app shows must be one the app accepts, everywhere
    for (const root of KEYS) {
      for (const base of [24, 48]) {
        for (const l of lessonsFor(root, "letters", base)) {
          for (const s of l.steps) {
            const rs = run(s.target, s.show);
            for (const r of rs) assert.ok(!["wrong", "direction"].includes(r.verdict),
              `${l.id} step ${s.index} in ${NAMES_T[root]}: its own demonstration was called ${r.verdict}`);
            assert.equal(last(rs).verdict, "done", `${l.id} step ${s.index} in ${NAMES_T[root]} never completes`);
          }
        }
      }
    }
  });

  test("A chord can be played one note at a time, in any order, in any octave", () => {
    const t = set([PC.C, PC.E, PC.G]);
    assert.equal(last(run(t, [67, 48, 64])).verdict, "done", "G, low C, E");
    assert.equal(last(run(t, [60, 64, 67])).verdict, "done", "in order");
    const partial = run(t, [60, 60, 72]);
    assert.equal(last(partial).verdict, "progress", "the same note twice is not the whole chord");
    assert.deepEqual(last(partial).missing, [PC.E, PC.G]);
  });

  test("A wrong note in a chord is named and not counted", () => {
    const t = set([PC.C, PC.E, PC.G]);
    const [first, wrong] = run(t, [60, 65]);
    assert.equal(first.verdict, "progress");
    assert.equal(wrong.verdict, "wrong");
    assert.equal(wrong.played, PC.F);
    assert.deepEqual(wrong.missing, [PC.E, PC.G], "what is still to find is named");
    assert.deepEqual(wrong.attempt, [60], "the C already played still counts, and F was not added");
  });

  test("A scale must be played in order", () => {
    const t = seq([PC.C, PC.D, PC.E], "up");
    const rs = run(t, [60, 64]);
    assert.equal(rs[1].verdict, "wrong");
    assert.equal(rs[1].want, PC.D, "the note wanted is named");
    assert.deepEqual(rs[1].attempt, [60], "the slip does not reset the attempt");
    assert.equal(last(run(t, [60, 64, 62, 64])).verdict, "done", "and it carries on from where it was");
    const wrongStart = practiceNote(t, [], 62);
    assert.equal(wrongStart.verdict, "wrong");
    assert.equal(wrongStart.want, PC.C, "a scale starts on its first note");
  });

  test("A scale going up must go up, and one going down must go down", () => {
    const up = seq([PC.C, PC.D, PC.E], "up");
    assert.equal(practiceNote(up, [60], 50).verdict, "direction", "D below C4 is the wrong way");
    assert.equal(practiceNote(up, [60], 62).verdict, "progress");
    const down = seq([PC.E, PC.D, PC.C], "down");
    assert.equal(practiceNote(down, [64], 74).verdict, "direction", "D above E4 is the wrong way");
    assert.equal(practiceNote(down, [64], 62).verdict, "progress");
    const any = seq([PC.C, PC.D], undefined);
    assert.equal(practiceNote(any, [60], 50).verdict, "done", "with no direction, any octave will do");
  });

  test("An inversion needs the right note at the bottom", () => {
    const t = set([PC.C, PC.E, PC.G], { bassPc: PC.E });
    const r = last(run(t, [60, 64, 67]));
    assert.equal(r.verdict, "bass");
    assert.equal(r.lowest, PC.C);
    assert.equal(r.want, PC.E);
    assert.equal(practiceNote(t, r.attempt, 52).verdict, "done", "an E underneath fixes it");
    assert.equal(last(run(t, [64, 67, 72])).verdict, "done", "first inversion played directly");
    // and the lesson's own inversions ask for three different bottoms
    const inv = buildLesson("inversions", PC.D);
    assert.deepEqual(inv.steps.map((s) => s.target.bassPc), [PC.D, PC["F#"], PC.A]);
  });

  test("Lesson text and feedback stay short enough to read", () => {
    const within = (text, where) => assert.ok(sentenceCount(text) <= 2, `${where}: "${text}"`);
    for (const system of SYSTEMS) {
      for (const root of KEYS) {
        for (const l of lessonsFor(root, system)) {
          within(l.intro, `${l.id} intro`);
          for (const s of l.steps) {
            within(s.prompt, `${l.id} prompt`);
            within(s.why, `${l.id} why`);
            // every kind of answer this step can give
            const other = [...Array(12).keys()].find((p) => !s.target.pcs.includes(p));
            const samples = [s.show[0], s.show[0] + 1, 60 + other, s.show[0] - 24];
            for (const m of samples) {
              const fb = practiceFeedback(s, practiceNote(s.target, s.show.slice(0, 1), m), system);
              within(fb.head, `${l.id} feedback head`);
              within(fb.plain, `${l.id} feedback`);
            }
          }
        }
      }
    }
    const bass = { target: set([0, 4, 7], { bassPc: 4 }), why: "First inversion." };
    const fb = practiceFeedback(bass, last(run(bass.target, [60, 64, 67])), "letters");
    within(fb.plain, "bass feedback");
  });

  test("Feedback speaks the chosen note names", () => {
    const step = buildLesson("major-triad", PC.C, "solfege").steps[1];
    const fb = practiceFeedback(step, practiceNote(step.target, [], 65), "solfege");
    assert.ok(fb.head.includes("Fa"), fb.head);
    assert.ok(fb.plain.includes("Do") && fb.plain.includes("Mi") && fb.plain.includes("Sol"), fb.plain);
    assert.ok(!/\b[CEFG]\b/.test(fb.head + fb.plain), "no letter names leak through");
    const letters = practiceFeedback(step, practiceNote(step.target, [], 65), "letters");
    assert.ok(letters.head.startsWith("F "), letters.head);
  });

  test("Lessons follow the key you chose", () => {
    const inD = buildLesson("major-scale", PC.D).steps[0].target.pcs;
    assert.equal(inD[0], PC.D);
    assert.ok(inD.includes(PC["F#"]) && !inD.includes(PC.F));
    const inF = buildLesson("major-scale", PC.F).steps[0].target.pcs;
    assert.ok(inF.includes(PC["A#"]) && !inF.includes(PC.B));
    const minorInA = buildLesson("minor-scale", PC.A).steps[0].target.pcs;
    assert.deepEqual(minorInA, [PC.A, PC.B, PC.C, PC.D, PC.E, PC.F, PC.G, PC.A], "A minor is all white keys");
    assert.equal(buildLesson("home", PC["G#"]).root, PC["G#"]);
    assert.equal(buildLesson("nonsense", 0), null);
  });

  test("The next key is one step round the circle of fifths", () => {
    assert.equal(nextKeyRound(PC.C), PC.G);
    assert.equal(nextKeyRound(PC.G), PC.D);
    assert.equal(nextKeyRound(PC.F), PC.C, "and it wraps");
    const seen = [];
    let k = PC.C;
    for (let i = 0; i < 12; i++) { seen.push(k); k = nextKeyRound(k); }
    assert.equal(new Set(seen).size, 12, "every key once");
    assert.equal(k, PC.C, "and back home");
  });

  test("A hint lights the note you need next", () => {
    const scale = buildLesson("major-scale", PC.C, "letters", 48).steps[0];
    assert.equal(practiceHint(scale, []), 48, "start on C");
    assert.equal(practiceHint(scale, [48]), 50, "then D");
    const chord = buildLesson("major-triad", PC.C, "letters", 48).steps[1];
    assert.equal(practiceHint(chord, [48]), 52, "the first missing note, E");
    assert.equal(practiceHint(chord, [48, 52]), 55, "then G");
    const inv = buildLesson("inversions", PC.C, "letters", 48).steps[1];
    assert.equal(th.pc(practiceHint(inv, [60, 64, 67])), PC.E, "an inversion's hint is its bottom note");
  });

  test("The four-chord loop is I, V, vi and IV in every key", () => {
    for (const root of KEYS) {
      const loop = buildLesson("four-chords", root).loop;
      assert.deepEqual(loop.map((c) => c.rootPc), [0, 7, 9, 5].map((i) => pc(root + i)), `in ${NAMES_T[root]}`);
      assert.deepEqual(loop.map((c) => c.sym), ["", "", "m", ""], `vi is minor in ${NAMES_T[root]}`);
      for (const c of loop) assert.ok(c.notes.length === 3 && c.id, "each is a real chord the loop can play");
    }
    assert.deepEqual(buildLesson("four-chords", PC.C).loop.map(label), ["C", "G", "Am", "F"]);
  });

  test("Lessons come in order, simplest first", () => {
    assert.equal(LESSONS[0].id, "home", "the first lesson is finding the home note");
    assert.equal(LESSONS.length, 10);
    const ids = LESSONS.map((l) => l.id);
    assert.equal(new Set(ids).size, ids.length);
    const topics = LESSON_TOPICS.map((t) => t.id);
    for (const l of LESSONS) assert.ok(topics.includes(l.topic), `${l.id} has an unknown topic`);
    // a chord lesson never comes before the first scale lesson it builds on
    assert.ok(ids.indexOf("major-scale") < ids.indexOf("major-triad"));
    assert.ok(ids.indexOf("major-triad") < ids.indexOf("key-chords"));
    assert.ok(ids.indexOf("key-chords") < ids.indexOf("four-chords"));
  });

  test("Practice is available from the very first screen", () => {
    assert.ok(tabsAt("start").includes("learn"));
    assert.ok(th.guideFor("learn").length > 0, "and the guide explains it");
  });

  test("The reason for a step arrives only once it is played", () => {
    for (const root of [PC.C, PC["F#"]]) {
      for (const l of lessonsFor(root)) {
        for (const s of l.steps) {
          const rs = run(s.target, [s.show[0] + 1, ...s.show, s.show[0] - 24]);
          for (const r of rs) {
            const fb = practiceFeedback(s, r);
            if (r.verdict === "done") assert.equal(fb.plain, s.why);
            else assert.ok(!fb.plain.includes(s.why) && !fb.head.includes(s.why), `${l.id}: the reason arrived early`);
          }
        }
      }
    }
  });
});

/* ==========================================================================
   Spelling notes the way the key writes them, and the sus2 entry (D-074)
   ========================================================================== */

describe("Feature: Notes are spelled the way the key writes them", () => {
  const { spelling, keyNames, buildLesson, harmonizeSteps, voiceLeading, identifyChord,
          smoothestVoicing, harmonize, QUALITIES } = th;
  const scaleNames = (tonic, mode, system = "letters") =>
    scalePcs(tonic, mode === "minor" ? "natural-minor" : "major").map((p) => noteName(p, spelling(system, tonic, mode))).join(" ");
  const nameOf = (p, tonic, mode, system = "letters") => noteName(p, spelling(system, tonic, mode));
  const LETTER_PC_T = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const pitchOf = (name) => pc(LETTER_PC_T[name[0]] + (name.includes("#") ? 1 : 0) - (name.includes("♭") ? 1 : 0));

  test("Keys on the flat side spell their notes with flats", () => {
    assert.equal(scaleNames(PC.C, "minor"), "C D E♭ F G A♭ B♭");
    assert.equal(scaleNames(PC.F, "major"), "F G A B♭ C D E");
    assert.equal(scaleNames(PC["D#"], "major"), "E♭ F G A♭ B♭ C D");
    assert.equal(scaleNames(PC["A#"], "minor"), "B♭ C D♭ E♭ F G♭ A♭");
    assert.equal(scaleNames(PC["C#"], "major"), "D♭ E♭ F G♭ A♭ B♭ C");
    assert.equal(scaleNames(PC.C, "minor", "solfege"), "Do Re Mi♭ Fa Sol La♭ Si♭");
  });

  test("Keys on the sharp side keep their sharps", () => {
    assert.equal(scaleNames(PC.G, "major"), "G A B C D E F#");
    assert.equal(scaleNames(PC.E, "major"), "E F# G# A B C# D#");
    assert.equal(scaleNames(PC["C#"], "minor"), "C# D# E F# G# A B");
    assert.equal(nameOf(PC["G#"], PC.A, "minor"), "G#", "A minor's leading note is G#, not A♭");
  });

  test("Borrowed and altered notes are spelled by their scale degree", () => {
    const inC = (p) => nameOf(p, PC.C, "major");
    assert.deepEqual([PC["A#"], PC["D#"], PC["G#"], PC["F#"]].map(inC), ["B♭", "E♭", "A♭", "F#"], "♭7 ♭3 ♭6 ♯4 in C");
    assert.equal(nameOf(PC["A#"], PC.G, "major"), "B♭", "G minor's third, borrowed into G major");
    assert.equal(nameOf(PC.F, PC.G, "major"), "F", "♭7 in G");
    assert.equal(nameOf(PC["C#"], PC.D, "minor"), "C#", "D minor's raised seventh");
    assert.equal(nameOf(PC.E, PC.C, "minor"), "E", "C minor's major third");
  });

  test("Every spelling names the right pitch, and no white key takes an accidental", () => {
    for (const mode of ["major", "minor"]) {
      for (let t = 0; t < 12; t++) {
        const names = keyNames(t, mode);
        names.forEach((n, p) => {
          assert.equal(pitchOf(n), p, `${n} in key ${t} ${mode} is not pitch ${p}`);
          assert.ok(!["F♭", "C♭", "E#", "B#"].includes(n), `${n} in key ${t} ${mode}`);
          assert.ok(n.length <= 2, `no double accidentals: ${n}`);
        });
      }
    }
  });

  test("Each key uses every letter once in its scale", () => {
    for (const mode of ["major", "minor"]) {
      for (let t = 0; t < 12; t++) {
        const extreme = (mode === "major" && t === PC["F#"]) || (mode === "minor" && t === PC["D#"]);
        const letters = scaleNames(t, mode).split(" ").map((n) => n[0]);
        if (extreme) {
          assert.equal(new Set(letters).size, 6, "F# major and D# minor would need E#, and show F instead");
        } else {
          assert.equal(new Set(letters).size, 7, `${scaleNames(t, mode)} repeats a letter`);
        }
      }
    }
  });

  test("Every key is labelled the way it is written", () => {
    assert.equal(nameOf(PC["D#"], PC["D#"], "major"), "E♭", "E♭ major");
    assert.equal(nameOf(PC["D#"], PC["D#"], "minor"), "D#", "D# minor");
    assert.equal(nameOf(PC["C#"], PC["C#"], "major"), "D♭");
    assert.equal(nameOf(PC["C#"], PC["C#"], "minor"), "C#");
    assert.equal(nameOf(PC["A#"], PC["A#"], "minor"), "B♭");
    assert.equal(nameOf(PC["F#"], PC["F#"], "major"), "F#");
  });

  test("Lessons in flat keys use flats", () => {
    assert.equal(buildLesson("minor-scale", PC.C).steps[0].prompt, "Play C minor going up: C D E♭ F G A♭ B♭ C.");
    assert.ok(buildLesson("minor-triad", PC.G).steps[1].prompt.includes("to B♭, and play G B♭ D"));
    assert.ok(buildLesson("minor-triad", PC.A).steps[1].prompt.includes("C# down one key to C"));
    assert.ok(buildLesson("minor-scale", PC.C, "solfege").steps[0].prompt.includes("Mi♭"));
    // a minor lesson is spelled as its own key, not as the major on the same note:
    // C# minor, not D♭ major's E♭ E G♭
    assert.equal(buildLesson("minor-scale", PC["C#"]).steps[0].prompt, "Play C# minor going up: C# D# E F# G# A B C#.");
    const step = buildLesson("minor-scale", PC.C).steps[0];
    const fb = th.practiceFeedback(step, th.practiceNote(step.target, [60, 62], 64), buildLesson("minor-scale", PC.C).system);
    assert.equal(fb.plain, "From D it's a half step up (the very next key), which lands on E♭, not E.",
      "feedback speaks the lesson's own spelling, and explains the step");
  });

  test("Every note name in an explanation follows the naming system", () => {
    // these four used to read straight from the sharp letter names, ignoring
    // both Do-Re-Mi and the key
    const cMinorSol = spelling("solfege", PC.C, "minor");
    const steps = harmonizeSteps(PC.C, "natural-minor", 2, 3, cMinorSol).map((s) => s.text).join(" ");
    assert.ok(steps.includes("Mi♭") && !/\b[A-G]\b/.test(steps), steps);
    const [Cm, , Eb] = harmonize(PC.C, "natural-minor", 3);
    assert.ok(voiceLeading(Cm, Eb, cMinorSol).why.startsWith("Mi♭ and Sol"), voiceLeading(Cm, Eb, cMinorSol).why);
    assert.equal(identifyChord([63, 67, 70], spelling("letters", PC.C, "minor"))[0].label, "E♭");
    assert.ok(smoothestVoicing(Cm, Eb, cMinorSol).why.includes("Mi♭"), smoothestVoicing(Cm, Eb, cMinorSol).why);
  });

  test("The plain naming systems still spell with sharps", () => {
    assert.equal(noteName(63, "letters"), "D#");
    assert.equal(noteName(63, "solfege"), "Re#");
    assert.equal(chordLabel(PC["A#"], "m", "letters"), "A#m");
  });

  test("A suspended second is in the chord table", () => {
    assert.equal(QUALITIES["0,2,7"]?.sym, "sus2", "C D G is a sus2");
    assert.equal(QUALITIES["0,2,5,7"]?.sym, "sus4(9)", "C D F G is not");
    const best = identifyChord([60, 62, 67])[0];
    assert.equal(best.label, "Csus2");
    assert.equal(best.full, "suspended 2nd");
  });

  test("No chord formula is listed twice", () => {
    // a repeated key in an object literal is not an error: the later one
    // silently wins. That is how sus2 disappeared. Read the source instead.
    const src = readFileSync(new URL("./theory.mjs", import.meta.url), "utf8");
    const block = src.slice(src.indexOf("const QUALITIES = {"), src.indexOf("};", src.indexOf("const QUALITIES = {")));
    const keys = [...block.matchAll(/^\s*"([\d,]+)":/gm)].map((m) => m[1]);
    assert.ok(keys.length > 20, "found the table");
    const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
    assert.deepEqual(dupes, [], "formulas listed more than once");
  });
});

/* ==========================================================================
   How to think: diagnosis, the hint ladder, rules and shapes (D-075)
   ========================================================================== */

describe("Feature: Feedback teaches a way of finding the note", () => {
  const { buildLesson, lessonsFor, practiceNote, practiceFeedback, diagnoseSlip, hintMethod,
          keyLandmark, chordShape, skipWalk, sentenceCount } = th;
  const L = (id, root = PC.C, system = "letters") => buildLesson(id, root, system, 48);
  const wrongPlain = (lesson, stepIndex, attempt, midi) => {
    const s = lesson.steps[stepIndex];
    return practiceFeedback(s, practiceNote(s.target, attempt, midi), lesson.system).plain;
  };
  const mentions = (text, name) => new RegExp(`(^|[\\s(])${name.replace("#", "\\#")}([\\s,.:;)]|$)`).test(text);

  test("A wrong interval is explained by counting keys from the root", () => {
    assert.ok(wrongPlain(L("major-triad"), 1, [48], 51)
      .startsWith("E♭ is 3 keys above C; the major third is 4 keys up, at E."));
    assert.ok(wrongPlain(L("minor-triad", PC.G), 1, [55], 59)
      .startsWith("B is 4 keys above G; the minor third is 3 keys up, at B♭."));
    assert.ok(wrongPlain(L("major-triad"), 1, [48], 54).includes("the fifth is 7 keys up, at G"));
  });

  test("A scale note a chord skips is explained by the skip", () => {
    assert.ok(wrongPlain(L("major-triad"), 1, [48], 53).startsWith("F is in the scale, but a chord takes every other note: C, skip D, E, skip F, G."));
    assert.ok(wrongPlain(L("four-chords"), 2, [57], 55).includes("A, skip B, C, skip D, E"), "vi in C");
    const cmaj7 = L("sevenths").steps[0];
    assert.equal(skipWalk(cmaj7.target.pcs, cmaj7.scale, "letters"), "C, skip D, E, skip F, G, skip A, B");
    assert.equal(skipWalk([PC.C, PC["D#"], PC.G], cmaj7.scale, "letters"), null, "C minor is not every other note of C major");
  });

  test("A skipped scale note is named, with the step to it", () => {
    assert.equal(wrongPlain(L("major-scale"), 0, [48], 52), "You skipped D: from C the next note is a whole step up (skip one key).");
    assert.equal(wrongPlain(L("major-scale"), 1, [60, 59], 55), "You skipped A: from B the next note is a whole step down (skip one key).");
  });

  test("A near miss in a scale names the size of the step", () => {
    assert.equal(wrongPlain(L("major-scale"), 0, [48, 50, 52], 54), "From E it's a half step up (the very next key), which lands on F, not F#.");
    assert.equal(wrongPlain(L("minor-scale"), 0, [48, 50], 52), "From D it's a half step up (the very next key), which lands on E♭, not E.");
    assert.equal(wrongPlain(L("major-scale"), 0, [], 50), "A scale starts on its home note, C, just left of the pair of black keys.");
  });

  test("The first hint gives the method, not the note", () => {
    assert.equal(hintMethod(L("major-triad").steps[1], [48]), "Count 4 keys up from C for the major third, counting every key.");
    assert.equal(hintMethod(L("major-scale").steps[0], [48, 50]), "From D, go a whole step up (skip one key).");
    assert.equal(hintMethod(L("home").steps[1], [48]), "From C, go an octave up (12 keys).");
    assert.equal(hintMethod(L("major-triad").steps[1], []), "Start with the root, C: the chord is named after it.");
    // everywhere: once started, the method never names the note it is leading to
    for (const root of [...Array(12).keys()]) {
      for (const l of lessonsFor(root, "letters", 48)) {
        for (const s of l.steps) {
          if (s.target.kind === "set" && s.target.bassPc !== undefined) continue;
          const attempt = s.show.slice(0, 1);
          const want = s.target.kind === "sequence" ? s.target.pcs[1] : s.target.pcs.find((p) => p !== pc(attempt[0]));
          if (want === undefined || want === pc(attempt[0])) continue;
          const method = hintMethod(s, attempt, l.system);
          assert.ok(!mentions(method, noteName(want, l.system)), `${l.id} in ${NAMES_T[root]}: "${method}" gives away ${noteName(want, l.system)}`);
        }
      }
    }
  });

  test("A landmark finds any note on the keyboard", () => {
    const all = [...Array(12).keys()].map(keyLandmark);
    assert.equal(new Set(all).size, 12, "every note has its own landmark");
    assert.equal(keyLandmark(PC.C), "just left of the pair of black keys");
    assert.equal(keyLandmark(PC["F#"]), "the first of the three black keys");
    assert.equal(keyLandmark(PC.B), "just right of the three black keys");
    assert.ok(L("home", PC.G).steps[0].rule.includes("between the first and second of the three black keys"));
  });

  test("Every step leaves a rule that works in any key", () => {
    for (const system of ["letters", "solfege"]) {
      for (const root of [...Array(12).keys()]) {
        for (const l of lessonsFor(root, system, 48)) {
          for (const s of l.steps) {
            assert.ok(s.rule && s.rule.length > 20, `${l.id} step ${s.index}: no rule`);
            assert.ok(sentenceCount(s.rule) <= 2, `${l.id}: "${s.rule}"`);
            for (const a of [[], s.show.slice(0, 1)]) {
              const m = hintMethod(s, a, l.system);
              assert.ok(m.length > 10 && sentenceCount(m) <= 2, `${l.id}: hint "${m}"`);
            }
          }
        }
      }
    }
  });

  test("Rules that count keys match the chord", () => {
    // a rule that says "4 + 3" is a claim about the notes; check the claim
    for (const root of [...Array(12).keys()]) {
      for (const l of lessonsFor(root, "letters", 48)) {
        for (const s of l.steps) {
          const claim = s.rule.match(/is (\d+(?: \+ \d+)+)/);
          if (!claim || s.target.kind !== "set") continue;
          const gaps = s.target.pcs.slice(1).map((p, i) => pc(p - s.target.pcs[i]));
          assert.equal(gaps.join(" + "), claim[1], `${l.id} in ${NAMES_T[root]}: "${s.rule}"`);
        }
        if (l.id === "key-chords") {
          const [I, IV, V] = l.steps.map((s) => s.target.pcs[0]);
          assert.equal(pc(IV - I), 5, "IV is 5 keys above home");
          assert.equal(pc(V - I), 7, "V is 7 keys above home");
        }
        if (l.id === "four-chords") {
          const [I, , vi] = l.steps.map((s) => s.target.pcs[0]);
          assert.equal(pc(I - vi), 3, "vi is 3 keys below I");
        }
      }
    }
  });

  test("Chord shapes are named by their white and black keys", () => {
    assert.deepEqual(chordShape([PC.C, PC.E, PC.G]).others, ["F", "G"]);
    assert.equal(chordShape([PC.D, PC["F#"], PC.A]).text, "Shape: white, black, white, the same as E, A.");
    assert.deepEqual(chordShape([PC["C#"], PC.F, PC["G#"]]).others, ["E♭", "A♭"], "flat-side keys are spelled with flats");
    assert.deepEqual(chordShape([PC.A, PC.C, PC.E]).others, ["Dm", "Em"]);
    assert.equal(chordShape([PC.B, PC["D#"], PC["F#"]]).text, "Shape: white, black, black, and no other major chord has it.");
    assert.equal(chordShape([PC.C, PC.E, PC.G, PC.B]), null, "sevenths are not triad shapes");
    assert.equal(chordShape([PC.C, PC.D, PC.G]), null, "only major and minor triads");
  });
});

/* ==========================================================================
   Typing chord names (D-077)
   ========================================================================== */

describe("Feature: Typing chord names", () => {
  const { parseChordName, parseChordNames, typedChord, typedLabel, nearestSuffix, TYPING_CHIPS,
          CHORD_ALIASES, romanFor, QUALITIES, spelling, identifyChord, keysContaining } = th;
  const read = (t, system = "letters") => parseChordName(t, system);
  const names = (chord, system = "letters") => chord.notes.map((m) => noteName(m, system)).join(" ");
  const inA = (t) => typedChord(read(t), PC.A, "minor", 48);

  test("A chord name is read into its notes", () => {
    assert.equal(names(inA("Bm7")), "B D F# A");
    assert.equal(names(inA("F#m7")), "F# A C# E");
    assert.equal(names(inA("Fmaj7")), "F A C E");
    assert.equal(names(inA("G7sus4")), "G C D F");
    assert.equal(names(inA("D7sus4(9)")), "D G A C E");
    assert.equal(names(inA("C")), "C E G");
    const d9 = inA("D9sus4");
    assert.ok(d9.notes[4] - d9.notes[0] > 12, "the ninth sits above the seventh, not beside the root");
  });

  test("Typed chords sound like the same chord picked from a list", () => {
    for (let root = 0; root < 12; root++) {
      for (const d of dictionaryFor(root, 48)) {
        const typed = typedChord(read(chordLabel(root, d.sym, "letters")), 0, "major", 48);
        assert.deepEqual(typed.notes, d.notes, `${chordLabel(root, d.sym, "letters")}: typed and picked disagree`);
      }
    }
  });

  test("Common ways of writing a chord are understood", () => {
    const same = (a, b) => {
      const x = read(a), y = read(b);
      assert.ok(x.ok && y.ok, `${a} / ${b}`);
      assert.equal(`${x.rootPc} ${x.sym}`, `${y.rootPc} ${y.sym}`, `${a} should read as ${b}`);
    };
    for (const w of ["CM7", "CΔ7", "CΔ", "C7M", "Cma7", "Cmaj7"]) same(w, "Cmaj7");
    for (const w of ["C-7", "Cmin7", "cm7"]) same(w, "Cm7");
    for (const w of ["Cø", "Cø7", "Cm7b5", "Cm7♭5", "C-7b5"]) same(w, "Cm7♭5");
    for (const w of ["C°7", "Cdim7"]) same(w, "Cdim7");
    for (const w of ["C+", "Caug"]) same(w, "Caug");
    for (const w of ["Csus", "Csus4"]) same(w, "Csus4");
    for (const w of ["G7sus", "G7sus4"]) same(w, "G7sus4");
    for (const w of ["D7(4/9)", "D7sus4(9)", "D9sus"]) same(w, "D9sus4");
    for (const w of ["C69", "C6/9"]) same(w, "C6/9");
    same("CM", "C"); same("Cmaj", "C"); same("Cmin", "Cm"); same("C-", "Cm");
    assert.equal(read("CM7").sym, "maj7", "a capital M is major");
    assert.equal(read("Cm7").sym, "m7", "a small m is minor");
    // every alias leads somewhere the dictionary can voice
    for (const q of Object.values(CHORD_ALIASES)) assert.ok(DICTIONARY.some((d) => d.q === q), `alias to unknown "${q}"`);
  });

  test("Flats and sharps in chord names", () => {
    for (const [t, root] of [["Bb", PC["A#"]], ["B♭", PC["A#"]], ["A#", PC["A#"]], ["A♯", PC["A#"]], ["bb", PC["A#"]],
                             ["Ebm7", PC["D#"]], ["ebm7", PC["D#"]], ["Cb", PC.B], ["E#", PC.F], ["b", PC.B], ["bm7", PC.B]]) {
      const r = read(t);
      assert.ok(r.ok, t);
      assert.equal(r.rootPc, root, `${t} is rooted on ${NAMES_T[root]}`);
    }
    // the name is written the way the key spells it (D-074)
    const cMinor = spelling("letters", PC.C, "minor");
    assert.equal(typedLabel(typedChord(read("A#"), PC.C, "minor", 48), cMinor), "B♭", "typed A#, written B♭ in C minor");
  });

  test("A slash chord puts its bass note at the bottom", () => {
    const ce = typedChord(read("C/E"), PC.C, "major", 48);
    assert.equal(pc(ce.notes[0]), PC.E, "E is the lowest note");
    assert.equal(ce.notes[0], Math.min(...ce.notes));
    assert.deepEqual([...new Set(ce.notes.map(pc))].sort((a, b) => a - b), [PC.C, PC.E, PC.G], "and the chord is still C major");
    assert.equal(typedLabel(ce, "letters"), "C/E");
    const amg = typedChord(read("Am7/G"), PC.A, "minor", 48);
    assert.equal(pc(amg.notes[0]), PC.G);
    assert.ok(amg.notes[1] - amg.notes[0] < 12, "the bass sits just under the chord, not an octave away");
    const dc = typedChord(read("D/C"), PC.C, "major", 48);
    assert.equal(pc(dc.notes[0]), PC.C, "a bass outside the chord is still the bass");
    assert.equal(read("C6/9").bassPc, null, "6/9 is a chord type, not a slash chord");
    assert.equal(typedLabel(typedChord(read("C/C"), 0, "major", 48), "letters"), "C", "a bass on the root is just the chord");
  });

  test("A line of chords is read in order, ignoring bar lines", () => {
    const line = parseChordNames("Am7 | F#m7 - Dm7, G7sus4 |  / . ");
    assert.deepEqual(line.map((r) => r.ok && chordLabel(r.rootPc, r.sym, "letters")), ["Am7", "F#m7", "Dm7", "G7sus4"]);
    assert.deepEqual(parseChordNames("   "), []);
    assert.equal(parseChordNames("A-7 D-7").map((r) => r.sym).join(" "), "m7 m7", "a dash touching a chord still means minor");
  });

  test("An unknown chord is refused with a reason and a suggestion", () => {
    const typo = read("Cmaj8");
    assert.equal(typo.ok, false);
    assert.equal(typo.reason, '"maj8" isn\'t a chord type I know. Did you mean Cmaj7?');
    assert.equal(read("H7").reason, '"H7" doesn\'t start with a note name (A to G).');
    assert.equal(read("Cxyz").reason, '"xyz" isn\'t a chord type I know.', "no suggestion when nothing is close");
    assert.equal(nearestSuffix("7b9x"), "7♭9");
    assert.equal(nearestSuffix("susp"), "sus4");
    const line = parseChordNames("Am7 Qm7 Dm7");
    assert.deepEqual(line.map((r) => r.ok), [true, false, true], "one bad name does not hide the good ones");
  });

  test("Typed chords can be read in Do-Re-Mi", () => {
    const line = parseChordNames("Lam7 Fa#m7 Rem7 Sol7sus4 Do Sibmaj7 sim7", "solfege");
    assert.deepEqual(line.map((r) => r.ok && `${NAMES_T[r.rootPc]}${r.sym}`),
      ["Am7", "F#m7", "Dm7", "G7sus4", "C", "A#maj7", "Bm7"]);
    assert.match(read("H7", "solfege").reason, /Do, Re, Mi/);
    assert.equal(read("Do", "letters").ok, false, "in letters, Do is not a chord");
  });

  test("Typed chords get numerals in the key", () => {
    const r = (t) => inA(t).roman;
    assert.equal(r("Am7"), "i");
    assert.equal(r("Dm7"), "iv");
    assert.equal(r("Fmaj7"), "♭VI");
    assert.equal(r("Gmaj7"), "♭VII");
    assert.equal(r("Amaj7"), "I", "a major chord on home is a capital I, even in a minor key");
    assert.equal(r("F#m7"), "vi", "a chord from outside the key is numbered by its distance from home");
    assert.equal(r("Bm7"), "ii");
    assert.equal(typedChord(read("Eb"), PC.A, "minor", 48).roman, "♭V", "the tritone is a flattened fifth");
  });

  test("A major seventh chord keeps a capital numeral", () => {
    // "maj7" starts with an m; that must not make it minor
    assert.equal(romanFor(0, 0, 0, "maj7"), "I");
    assert.equal(romanFor(0, 5, 3, "maj9"), "IV");
    assert.equal(romanFor(0, 2, 1, "m7"), "ii");
    assert.equal(romanFor(0, 9, 5, "mMaj7"), "vi");
    const cMaj7ths = harmonize(PC.C, "major", 4);
    assert.deepEqual(cMaj7ths.map((c) => c.roman), ["I", "ii", "iii", "IV", "V", "vi", "vii"]);
  });

  test("The chords you type say which keys hold them", () => {
    const notes = (line) => parseChordNames(line).map((r) => typedChord(r, 0, "major", 48)).flatMap((c) => c.notes);
    const keys = (line) => keysContaining(notes(line)).map((k) => `${NAMES_T[k.tonic]} ${k.mode}`);
    const verse = keys("Am7 Dm7 G7sus4");
    assert.ok(verse.includes("A minor") && verse.includes("C major"), verse.join(", "));
    assert.ok(!keys("Am7 Dm7 G7sus4 Bm7♭5").includes("F major"), "adding a B rules out the keys with B♭");
    assert.deepEqual(keys("Am7 F#m7 Dm7 G7sus4"), [], "the verse of Seven Days in Sunny June is in no single key");
  });

  test("Suspended sevenths are chords the app knows", () => {
    for (const q of ["7sus4", "9sus4"]) assert.ok(DICTIONARY.some((d) => d.q === q), `the dictionary has ${q}`);
    // the chord table and the dictionary agree: every dictionary chord's notes are filed under its own name
    for (const d of DICTIONARY) {
      const key = [...new Set(d.iv.map(pc))].sort((a, b) => a - b).join(",");
      assert.equal(QUALITIES[key]?.sym, d.q, `${d.q || "major"}: the chord table files ${key} as "${QUALITIES[key]?.sym}"`);
    }
    const g7sus = identifyChord([55, 60, 62, 65])[0];
    assert.equal(g7sus.label, "G7sus4", "G C D F with G at the bottom reads as G7sus4");
    const d9sus = identifyChord([50, 55, 57, 60, 64])[0];
    assert.equal(d9sus.label, "D9sus4");
  });

  test("The guide explains typing chord names", () => {
    const prog = th.guideFor("prog").flatMap((g) => g.points).join(" ");
    assert.match(prog, /Type chord names/, "the Progression section of How to use mentions the chord box");
    assert.ok(parseChordNames("Am7 F#m7 Dm7 G7sus4").every((r) => r.ok), "and its example reads cleanly");
  });

  test("The typing buttons insert text the reader understands", () => {
    const text = "A" + TYPING_CHIPS.find(([s]) => s === "♭")[1] + TYPING_CHIPS.find(([s]) => s === "maj7")[1]
      + TYPING_CHIPS.find(([s]) => s === "space")[1] + "F" + TYPING_CHIPS.find(([s]) => s === "#")[1]
      + TYPING_CHIPS.find(([s]) => s === "m7")[1] + TYPING_CHIPS.find(([s]) => s === "/")[1] + "E";
    assert.deepEqual(parseChordNames(text).map((r) => r.ok), [true, true], text);
    for (const [, insert] of TYPING_CHIPS) {
      if (insert.trim() && insert !== "/" && insert !== "#" && insert !== "b") assert.ok(read("C" + insert).ok, `C${insert}`);
    }
  });
});

/* ==========================================================================
   Finger numbers (D-078)
   ========================================================================== */

describe("Feature: Finger numbers", () => {
  const { SCALE_FINGERING, HAND_REACH, DEFAULT_REACH, FINGER_HANDS, FINGER_COPY, handFingers, fingerChord,
          fingerCrossings, scaleFingering, stepFingering, litLessonFingers, effectiveFingerHand,
          sheetData, sheetAsText, typedChord, parseChordName, practiceNote, practiceFeedback, GUIDE,
          isWhite, buildLesson, lessonsFor, voicingsFor } = th;
  const keys = (r) => [...r.keys].sort((a, b) => a.midi - b.midi).map((k) => `${k.hand}${k.finger}`).join(" ");
  const triad = (root, minor, inversion) => {
    const n = [root, root + (minor ? 3 : 4), root + 7];
    for (let i = 0; i < inversion; i++) n.push(n.shift() + 12);
    return n;
  };
  const scaleRun = (tonic, mode) => {
    const pcs = scalePcs(tonic, mode === "minor" ? "natural-minor" : "major");
    const run = [48 + tonic];
    for (let i = 1; i < 7; i++) { let m = 48 + pcs[i]; while (m <= run[i - 1]) m += 12; run.push(m); }
    run.push(48 + tonic + 12);
    return run;
  };

  test("A root-position triad is fingered 1-3-5", () => {
    assert.equal(keys(fingerChord([48, 52, 55], { hand: "right" })), "R1 R3 R5");
    assert.equal(keys(fingerChord([48, 52, 55], { hand: "left" })), "L5 L3 L1");
    assert.equal(keys(fingerChord([57, 60, 64], { hand: "right" })), "R1 R3 R5", "minor too");
  });

  test("Inversions change the fingers the standard way", () => {
    const want = { R: ["1 3 5", "1 2 5", "1 3 5"], L: ["5 3 1", "5 3 1", "5 2 1"] };
    for (let root = 48; root < 60; root++) {
      for (const minor of [false, true]) {
        for (let inv = 0; inv < 3; inv++) {
          const n = triad(root, minor, inv);
          assert.equal(handFingers(n, "R").join(" "), want.R[inv], `${NAMES_T[pc(root)]}${minor ? "m" : ""} inversion ${inv}, right`);
          assert.equal(handFingers(n, "L").join(" "), want.L[inv], `${NAMES_T[pc(root)]}${minor ? "m" : ""} inversion ${inv}, left`);
        }
      }
    }
  });

  test("Seventh chords use four fingers", () => {
    assert.equal(keys(fingerChord([48, 52, 55, 59], { hand: "right" })), "R1 R2 R3 R5");
    assert.equal(keys(fingerChord([48, 52, 55, 59], { hand: "left" })), "L5 L3 L2 L1");
    assert.equal(keys(fingerChord([48, 50, 52, 55, 59], { hand: "right" })), "R1 R2 R3 R4 R5", "five notes, five fingers");
  });

  test("Fingers rise with pitch and never repeat", () => {
    const chords = [];
    for (let root = 0; root < 12; root++) {
      for (const d of dictionaryFor(root, 48)) {
        chords.push(d);
        for (const v of voicingsFor(d)) chords.push({ ...d, notes: v.notes });
      }
    }
    let checked = 0;
    for (const c of chords) {
      for (const hand of ["right", "left"]) {
        const r = fingerChord(c.notes, { hand });
        if (r.tooWide) continue;
        for (const h of ["L", "R"]) {
          const ks = r.keys.filter((k) => k.hand === h).sort((a, b) => a.midi - b.midi);
          const f = ks.map((k) => k.finger);
          assert.equal(new Set(f).size, f.length, `${c.sym}: a finger used twice`);
          for (let i = 1; i < f.length; i++) {
            assert.ok(h === "R" ? f[i] > f[i - 1] : f[i] < f[i - 1], `${c.sym} ${h}: ${f.join("-")}`);
          }
          if (ks.length) assert.ok(ks[ks.length - 1].midi - ks[0].midi <= DEFAULT_REACH, `${c.sym}: one hand stretched past an octave`);
        }
        checked++;
      }
    }
    assert.ok(checked > 500, `only ${checked} chords checked`);
  });

  test("A chord too wide for one hand is split between the hands", () => {
    const wide = fingerChord([48, 52, 55, 59, 62], { hand: "right" });
    assert.equal(wide.split, true);
    assert.equal(keys(wide), "L5 R1 R2 R3 R5");
    assert.deepEqual(wide.brackets.map((b) => b.hand), ["L", "R"]);
    assert.equal(FINGER_COPY.split, "Split between hands");
    const six = fingerChord([48, 50, 52, 53, 55, 57], { hand: "right" });
    assert.equal(six.split, true, "six notes are too many for one hand, however close");
  });

  test("A chord no two hands can play is said to be too wide", () => {
    const r = fingerChord([36, 48, 60, 72, 84], { hand: "right" });
    assert.equal(r.tooWide, true);
    assert.deepEqual(r.keys, [], "no numbers rather than impossible ones");
    assert.equal(FINGER_COPY.tooWide, "Too wide to play as written");
  });

  test("Scales use the standard fingering in every key", () => {
    for (const mode of ["major", "minor"]) {
      assert.equal(Object.keys(SCALE_FINGERING[mode]).length, 12, `${mode}: twelve keys`);
      for (let t = 0; t < 12; t++) {
        const e = SCALE_FINGERING[mode][t];
        for (const h of ["R", "L"]) {
          assert.equal(e[h].length, 8, `${NAMES_T[t]} ${mode} ${h}`);
          assert.ok(e[h].every((f) => f >= 1 && f <= 5));
          for (let i = 1; i < 8; i++) assert.notEqual(e[h][i], e[h][i - 1], `${NAMES_T[t]} ${mode} ${h}: same finger twice in a row`);
        }
        const run = scaleFingering(scaleRun(t, mode), mode, "R");
        assert.ok(run, `${NAMES_T[t]} ${mode}: the run is recognised`);
      }
    }
    // spot checks against the published sources (piano-keyboard-guide.com, pianoscales.org)
    const f = (mode, t, h) => SCALE_FINGERING[mode][t][h].join("");
    assert.equal(f("major", PC.C, "R"), "12312345");
    assert.equal(f("major", PC.C, "L"), "54321321");
    assert.equal(f("major", PC.F, "R"), "12341234");
    assert.equal(f("major", PC.B, "L"), "43214321");
    assert.equal(f("major", PC["A#"], "R"), "41231234");
    assert.equal(f("major", PC["F#"], "R"), "23412312");
    assert.equal(f("major", PC["C#"], "L"), "32143213");
    assert.equal(f("minor", PC.A, "R"), "12312345");
    assert.equal(f("minor", PC["C#"], "R"), "34123123");
    assert.equal(f("minor", PC["A#"], "L"), "21321432");
  });

  test("The thumb never lands on a black key in a scale", () => {
    for (const mode of ["major", "minor"]) {
      for (let t = 0; t < 12; t++) {
        for (const h of ["R", "L"]) {
          for (const k of scaleFingering(scaleRun(t, mode), mode, h)) {
            if (k.finger === 1) assert.ok(isWhite(k.midi), `${NAMES_T[t]} ${mode} ${h}: thumb on ${NAMES_T[pc(k.midi)]}`);
          }
        }
      }
    }
  });

  test("The thumb crossing is marked and named", () => {
    const run = scaleRun(PC.C, "major");
    const r = scaleFingering(run, "major", "R");
    assert.deepEqual(r.filter((k) => k.cross).map((k) => [NAMES_T[pc(k.midi)], k.cross]), [["F", "thumb under"]]);
    const l = scaleFingering(run, "major", "L");
    assert.deepEqual(l.filter((k) => k.cross).map((k) => [NAMES_T[pc(k.midi)], k.cross]), [["A", "3 crosses over"]]);
    const down = scaleFingering([...run].reverse(), "major", "R");
    assert.deepEqual(down.filter((k) => k.cross).map((k) => [NAMES_T[pc(k.midi)], k.cross]), [["E", "3 crosses over"]]);
    assert.deepEqual(fingerCrossings([2, 3, 4, 1, 2, 3, 1, 2], "R").map((c) => c.index), [3, 6], "F# major crosses twice");
  });

  test("Scale lessons say where the thumb crosses", () => {
    for (let root = 0; root < 12; root++) {
      for (const id of ["major-scale", "minor-scale"]) {
        const l = buildLesson(id, root, "letters", 48);
        const f = stepFingering(l.steps[0], l.mode, "R", DEFAULT_REACH, l.system);
        assert.ok(f, `${id} in ${NAMES_T[root]}: no fingering`);
        assert.equal(f.keys.length, 8);
        assert.match(f.text, /thumb under onto/, `${id} in ${NAMES_T[root]}: ${f.text}`);
      }
    }
    const c = buildLesson("major-scale", PC.C, "letters", 48);
    assert.equal(stepFingering(c.steps[0], c.mode, "R").text, "Suggested fingering, right hand: 1 2 3, thumb under onto F, 1 2 3 4 5.");
    // chord lessons say which fingers to use, inversions included
    const inv = buildLesson("inversions", PC.C, "letters", 48);
    assert.deepEqual(inv.steps.map((s) => stepFingering(s, inv.mode, "R").text.split(": ")[1]), ["1-3-5.", "1-2-5.", "1-3-5."]);
    // the piano numbers only the keys the lesson has lit
    const s0 = c.steps[0];
    const fing = stepFingering(s0, c.mode, "R");
    assert.deepEqual(litLessonFingers(fing, s0, [48, 50], [], null).map((k) => k.finger), [1, 2]);
    assert.deepEqual(litLessonFingers(fing, s0, [48, 50, 52], [], 53).find((k) => k.midi === 53).finger, 1, "the hinted note shows the thumb");
    assert.equal(stepFingering(buildLesson("pentatonic", 0, "letters", 48).steps[0], "major", "R"), null, "no table, no guess");
  });

  test("The finger switch has four settings and is remembered", () => {
    assert.deepEqual(FINGER_HANDS, ["off", "right", "left", "both"]);
    assert.equal(effectiveFingerHand(null, "learn"), "right", "Learn starts on the right hand");
    assert.equal(effectiveFingerHand(null, "chords"), "off", "everywhere else starts off");
    assert.equal(effectiveFingerHand("left", "chords"), "left", "a choice holds on every tab");
    assert.equal(effectiveFingerHand("off", "learn"), "off", "including turning them off in Learn");
  });

  test("Fingering is suggested, never checked", () => {
    assert.equal(FINGER_COPY.suggested, "Suggested fingering");
    for (const l of lessonsFor(0, "letters", 48)) {
      for (const s of l.steps) {
        const f = stepFingering(s, l.mode, "R");
        if (f) assert.ok(f.text.startsWith("Suggested fingering"), f.text);
        for (const midi of [61, 66, 70]) {
          const fb = practiceFeedback(s, practiceNote(s.target, [], midi), l.system);
          assert.ok(!/finger/i.test(`${fb.head} ${fb.plain}`), `feedback judges fingers: ${fb.plain}`);
        }
      }
    }
  });

  test("The guide explains finger numbers", () => {
    const all = GUIDE.flatMap((g) => g.points).join(" ");
    assert.match(all, /1 the thumb to 5 the little finger/);
    assert.match(all, /left hand/i);
    assert.match(all, /Both puts the bass in the left hand/);
    assert.match(all, /suggests and never checks/);
    assert.match(all, /Show suggested fingering/);
  });

  test("Both hands put the bass in the left hand", () => {
    const c = fingerChord([48, 52, 55], { hand: "both", rootPc: PC.C });
    assert.equal(keys(c), "L5 R1 R3 R5");
    assert.equal(c.extraBass, 36, "the bass sits an octave under the chord");
    const ce = typedChord(parseChordName("C/E"), PC.C, "major", 48);
    const r = fingerChord(ce.notes, { hand: "both", rootPc: ce.rootPc, bassPc: ce.bassPc });
    assert.equal(pc(r.keys.find((k) => k.hand === "L").midi), PC.E, "a slash chord's bass is the left hand's note");
    assert.equal(r.extraBass, null, "it is already on the keyboard");
    assert.equal(keys(r), "L5 R1 R3 R5");
    const big = fingerChord(ce.notes, { hand: "both", rootPc: ce.rootPc, bassPc: ce.bassPc, reach: 16 });
    assert.equal(big.extraBass, null, "with a big hand too, the slash bass is not doubled an octave lower");
    assert.equal(big.keys.find((k) => k.hand === "L").midi, ce.notes[0]);
    const inv = fingerChord([52, 55, 60], { hand: "both", rootPc: PC.C });
    assert.equal(pc(inv.extraBass), PC.C, "an inversion still has the root in the bass");
    assert.ok(inv.extraBass <= 52 - 12);
  });

  test("A chord that needs two hands shows both", () => {
    for (const hand of ["right", "left"]) {
      const r = fingerChord([48, 52, 55, 59, 62], { hand });
      assert.deepEqual([...new Set(r.keys.map((k) => k.hand))].sort(), ["L", "R"], `${hand}: both hands appear`);
      assert.equal(r.brackets.length, 2);
      assert.ok(r.brackets[0].hi < r.brackets[1].lo, "the brackets don't overlap");
    }
  });

  test("Hand reach decides when a chord is split", () => {
    assert.deepEqual(HAND_REACH.map((r) => [r.id, r.keys]), [["7th", 11], ["octave", 12], ["9th", 14], ["10th", 16]]);
    assert.equal(DEFAULT_REACH, 12, "an octave until chosen otherwise");
    const spread = [48, 52, 55, 59, 62];   // 14 keys wide
    assert.equal(fingerChord(spread, { hand: "right", reach: 12 }).split, true);
    assert.equal(fingerChord(spread, { hand: "right", reach: 16 }).split, false);
    assert.equal(fingerChord(spread, { hand: "right" }).split, true, "the default is an octave");
    assert.equal(fingerChord([48, 52, 55, 60], { hand: "right", reach: 11 }).split, true, "a small hand splits an octave");
  });

  test("The sheet can show suggested fingering", () => {
    const prog = ["C", "Am", "F", "G"].map((n) => typedChord(parseChordName(n), PC.C, "major", 48));
    const plain = sheetData({ tonic: PC.C, mode: "major", scaleId: "major", progression: prog });
    assert.ok(plain.chords.every((c) => c.fingers.length === 0) && plain.bass.every((b) => b.finger === null), "unticked: no numbers");
    const on = sheetData({ tonic: PC.C, mode: "major", scaleId: "major", progression: prog, fingering: true });
    assert.deepEqual(on.chords.map((c) => c.fingers.map((k) => k.finger).join("-")), ["1-3-5", "1-3-5", "1-3-5", "1-3-5"]);
    assert.ok(on.bass.every((b) => b.finger === 5), "the left hand's little finger on each bass note");
    assert.match(sheetAsText(on), /fingers 1-3-5/);
    assert.match(sheetAsText(on), /\(L5\)/);
  });
});

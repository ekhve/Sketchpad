// The J-6 Explorer engine (j6/j6.mjs). Test names match the scenario names in sketchpad.feature exactly.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as j from "../j6/j6.mjs";

const names = (r) => r.rows.map((w) => `${j.nameOf(w.want)}:${w.kind}:${w.keys.join("/")}`);
const at = (set, key, t = 0) => j.chordAt(set, j.KEYS.indexOf(key), t);

test("Every chord in sets 29, 47 and 54 is spelled by its J-6 voicing", () => {
  for (const n of [29, 47, 54]) assert.deepEqual(j.validateSet(n), [], `set ${n}`);
});

test("A set whose published voicings contradict their labels is flagged and never recommended", () => {
  const bad = j.validateSet(59);
  assert.equal(bad.length, 12);
  assert.ok(bad.find((r) => r.key === "C#").problems.includes("root not sounded"));
  assert.ok(j.search("Cmaj9 Dm9", { sets: [59] }).length === 0);
});

test("A 4-voice voicing with a missing tone still counts as its chord", () => {
  // set 29, key B: G7 printed as G4 B3 F3 G2 — no D
  assert.deepEqual(j.validateKey("G7", "G4 B3 F3 G2"), []);
  // but a stray note is caught
  assert.deepEqual(j.validateKey("G7", "G4 B3 F3 G#2").length > 0, true);
});

/* What the validator finds in the manual, key by key: DESIGN.md D-082 lists each one. */
const MANUAL_ERRORS = {
  1: ["C#"], 2: ["G"], 3: ["D#"], 4: ["C#"], 5: ["C#"], 6: ["F"], 11: ["C#"], 18: ["E"], 19: ["F#"], 27: ["B"],
  32: ["A#"], 43: ["F"], 59: j.KEYS, 62: ["C#"], 63: ["A#"], 66: ["C"], 68: ["A#"], 69: ["G"], 72: ["F#"],
  73: ["F#"], 80: ["C#", "G#"], 81: ["G"], 83: ["C#", "D#", "F#"], 84: ["C#", "D#", "G#"], 85: ["D", "E", "A"],
  86: ["C#", "B"], 87: ["A", "B"], 89: ["D#"], 90: ["G#", "A#"], 91: ["F#"], 93: ["F#"], 95: ["E"], 97: ["E"],
  100: ["A", "A#"],
};

test("All 100 chord sets are read from the manual, label and voicing as printed", () => {
  const numbers = Object.keys(j.SETS).map(Number);
  assert.deepEqual(numbers, Array.from({ length: 100 }, (_, i) => i + 1));
  const unread = [];
  for (const n of numbers) {
    assert.equal(j.SETS[n].keys.length, 12, `set ${n}`);
    for (const [label, notes] of j.SETS[n].keys) {
      const count = notes.split(" ").length;
      assert.ok(count >= 2 && count <= 4, `set ${n} ${label}: ${notes}`);
      assert.equal(label === "", [14, 15, 16].includes(n), `set ${n}: only the interval stacks are unlabelled`);
      if (label) { try { j.parseChord(label); } catch (e) { unread.push(`${n}:${label}`); } }
    }
  }
  assert.deepEqual(unread, ["19:F#FM7"], "a label that can't be read is a failure, unless it is the manual's typo");
  assert.deepEqual(j.SETS[1].keys[0], ["Cadd9", "E4 D4 G3 C3"]);
  assert.deepEqual(j.SETS[100].keys[11], j.SETS[100].keys[11].slice(0, 2));
  // the prototype's hand transcription of four sets, against the import
  assert.deepEqual(j.SETS[54].keys.map(([l]) => l), ["CM7", "Em7", "Dm7", "FM7", "D#M7", "Gm7", "FM7", "Am7", "Gm7", "A#M7", "Am7", "Bm7"]);
  assert.deepEqual(j.SETS[59].keys[1], ["C6", "F#3 B3 E3 D#3"]);
  assert.deepEqual(j.SETS[29].keys[11], ["G7", "G4 B3 F3 G2"]);
  assert.deepEqual(j.SETS[47].keys[11], ["C#/C", "G#4 F4 C#4 C4"]);
});

test("The manual's chord spellings are read the way it means them", () => {
  const notes = (s) => { const c = j.parseChord(s); return [[...c.iv].sort((a, b) => a - b).map((i) => j.FLAT_NAMES[(c.root + i) % 12]).join(" "), j.FLAT_NAMES[c.bass]]; };
  assert.deepEqual(notes("CM9/#11"), ["C D E G♭ G B", "C"], "#11 after a slash is an added note");
  assert.deepEqual(notes("Cm7/b13"), ["C E♭ G A♭ B♭", "C"]);
  assert.deepEqual(notes("CM9 (no3)/G"), ["C D G B", "G"]);
  assert.deepEqual(notes("Gb6/9"), ["G♭ A♭ B♭ D♭ E♭", "G♭"], "6/9 has no seventh");
  assert.deepEqual(notes("Dm6/9"), ["D E F A B", "D"], "nor has the minor 6/9, which only the manual's reader reads");
  assert.deepEqual(notes("Asus9/13"), ["A B D E G♭ G", "A"]);
  assert.deepEqual(notes("D7alt"), ["D E♭ F G♭ A♭ A B♭ C", "D"], "♭9 ♯9 ♭5 ♯5 over D7");
  assert.deepEqual(notes("D# dim7"), ["E♭ G♭ A C", "E♭"]);
  assert.deepEqual(notes("FmAdd9"), ["F G A♭ C", "F"]);
  assert.deepEqual(notes("AbMaj13"), ["A♭ B♭ C D♭ E♭ F G", "A♭"]);
  assert.equal(j.nameOf(j.parseChord("CM7/9")), "Cmaj9", "a chord in Sketchpad's dictionary takes its name");
  assert.throws(() => j.parseChord("F#FM7"));
});

test("The manual's errors are listed, and the list is pinned", () => {
  const found = {};
  for (const n of Object.keys(j.SETS)) { const v = j.validateSet(n); if (v.length) found[n] = v.map((r) => r.key); }
  assert.deepEqual(found, MANUAL_ERRORS);
  assert.equal(Object.values(found).flat().length, 56);
  assert.deepEqual(Object.keys(j.SETS).filter((n) => j.untrustedSet(n)), ["59"]);
});

test("A key whose printed voicing contradicts its label is never suggested, and the rest of its set still is", () => {
  assert.ok(j.validateSet(18).find((r) => r.key === "E").problems.some((p) => p.includes("outside the chord")));
  const [e] = j.search("E", { sets: [18], transpose: false });
  assert.equal(e.score, 0, "the E key says E but plays Em, so it is never offered as E");
  const [cd] = j.search("Cm Dm", { sets: [18], transpose: false });
  assert.equal(cd.score, 1);
  assert.deepEqual(cd.rows.map((r) => r.keys), [["C"], ["D"]]);
});

test("A rootless voicing counts as its chord", () => {
  assert.deepEqual(j.SETS[88].keys[0], ["Fmaj7/9", "C4 A3 G3 E3"]);
  assert.deepEqual(j.validateKey("Fmaj7/9", "C4 A3 G3 E3"), []);
  assert.ok(j.validateKey("C6", "F#3 B3 E3 D#3").includes("root not sounded"));
  assert.ok(j.validateKey("Fmaj7/9", "C4 A3").includes("root not sounded"), "two notes are too few to be a rootless voicing");
});

test("Pressing D# on set 54 shows Fmaj7 with the J-6 voicing F3 A3 C4 E4", () => {
  const c = at(54, "D#");
  assert.equal(j.nameOf(c.chord), "Fmaj7");
  assert.equal(c.label, "FM7");
  assert.deepEqual(c.midi, [53, 57, 60, 64]);
});

test("Keys C, C#, G, D# on set 54 read as Imaj7 iii7 vi7 IVmaj7 in C major", () => {
  const prog = ["C", "C#", "G", "D#"].map((k) => at(54, k).chord);
  const [best] = j.likelyKeys(prog);
  assert.equal(best.tonic, 0);
  assert.equal(best.inKey, 4);
  assert.deepEqual(prog.map((c) => j.romanOf(c, 0)), ["Imaj7", "iii7", "vi7", "IVmaj7"]);
});

test("J-6 chords are spelled the way their key writes them", () => {
  const played = (t) => ["C", "C#", "G", "D#"].map((k) => at(54, k, t).chord);
  const prog = played(2);
  const [best] = j.likelyKeys(prog);
  assert.equal(best.tonic, 2);
  assert.deepEqual(prog.map((c) => j.nameInKey(c, best.tonic)), ["Dmaj7", "F#m7", "Bm7", "Gmaj7"]);
  assert.equal(j.nameOf(prog[1]), "G♭m7", "without a key the black keys are flats, which is why the key matters");
  for (let t = -6; t <= 5; t++) {
    const p = played(t);
    const names = p.map((c) => j.nameInKey(c, j.likelyKeys(p)[0].tonic)).join(" ");
    assert.ok(!(names.includes("#") && names.includes("♭")), `KEY ${t}: ${names}`);
  }
});

test("Roman numerals follow the key, not the letter C", () => {
  // the same shapes a fourth up, in F major
  const prog = ["Fmaj7", "Am7", "Dm7", "B♭maj7", "C7"].map(j.parseChord);
  assert.equal(j.likelyKeys(prog)[0].tonic, 5);
  assert.deepEqual(prog.map((c) => j.romanOf(c, 5)), ["Imaj7", "iii7", "vi7", "IVmaj7", "V7"]);
});

test("KEY transpose moves every chord and its voicing by the same amount", () => {
  for (const t of [-6, -3, 2, 5]) {
    for (let k = 0; k < 12; k++) {
      const a = j.chordAt(47, k, 0), b = j.chordAt(47, k, t);
      assert.equal(b.chord.root, (a.chord.root + t + 12) % 12);
      assert.deepEqual(b.midi, a.midi.map((m) => m + t));
    }
  }
});

test("Dm7 G7 Cmaj7 Am7 finds set 47 at KEY −3 with four exact matches", () => {
  const [best] = j.search("Dm7 G7 Cmaj7 Am7", { sets: [29, 47, 54] });
  assert.equal(best.set, 47);
  assert.equal(best.transpose, -3);
  assert.equal(best.score, 1);
  assert.deepEqual(names(best), ["Dm7:exact:D#/F#", "G7:exact:A", "Cmaj7:exact:C#/E", "Am7:exact:C"]);
  // set 54 plays Cmaj7 exactly at KEY 0 (C), +2 (A♯), −3 (D♯) and −5 (F): the nearest to 0 wins
  const [one] = j.search("Cmaj7", { sets: [54] });
  assert.equal(one.transpose, 0);
  const [far] = j.search("Dmaj7", { sets: [54] });
  assert.equal(far.transpose, -1, "KEY −1 on D♯ beats KEY +2 on C, −3 on F and +4 on A♯");
});

test("Musical search counts an inversion and a missing seventh as near matches", () => {
  const r = j.search("Dm7 G7 Cmaj7 Am7", { sets: [29], transpose: false })[0];
  assert.deepEqual(names(r), ["Dm7:exact:E", "G7:exact:B", "Cmaj7:inversion:F", "Am7:close:A"]);
  assert.equal(r.score, 0.875);
});

test("A chord with the wrong third is never a musical match", () => {
  assert.equal(j.matchScore(j.parseChord("G7"), j.parseChord("Gm7"), "musical").kind, "none");
  assert.equal(j.matchScore(j.parseChord("Am7"), j.parseChord("A"), "musical").kind, "none");
});

test("Exact search without transpose ranks set 54 first at 75%", () => {
  const r = j.search("Dm7 G7 Cmaj7 Am7", { sets: [29, 47, 54], mode: "exact", transpose: false });
  assert.deepEqual(r.map((x) => [x.set, x.score]), [[54, 0.75], [29, 0.5], [47, 0.25]]);
});

test("Chord symbols are read the way musicians type them", () => {
  for (const [s, want] of [["Cmaj7", "Cmaj7"], ["CM7", "Cmaj7"], ["Bbmaj7", "B♭maj7"], ["A#M7", "B♭maj7"],
    ["CM7/E", "Cmaj7/E"], ["C-7", "Cm7"]]) {
    assert.equal(j.nameOf(j.parseChord(s)), want, s);
  }
  assert.throws(() => j.parseChord("H7"));
  assert.throws(() => j.parseChord("Cfoo"));
});

/* ---------- playing a chord versus keeping it (D-089) ---------- */
import * as pr from "../j6/progression.mjs";
const run = (actions, state = pr.START) => actions.reduce(pr.explore, state);
const tap = (key, set = 54, t = 0) => ({ type: "tap", set, key: j.KEYS.indexOf(key), t });
const chordsOf = (items) => items.map((k) => j.nameOf(pr.resolve(k).chord));

test("Tapping a J-6 key plays it without adding it to the progression", () => {
  assert.equal(pr.START.rec, false, "Rec is off when the page opens");
  const s = run([tap("C#"), tap("G")]);
  assert.equal(j.nameOf(pr.resolve(s.current).chord), "Am7");
  assert.deepEqual(s.items, []);
});

test("Add keeps the chord on screen", () => {
  assert.deepEqual(chordsOf(run([tap("C#"), tap("G"), { type: "add" }]).items), ["Am7"]);
  assert.deepEqual(run([{ type: "add" }]).items, [], "nothing tapped, nothing added");
});

test("With Rec on, every key tapped joins the progression in order", () => {
  const s = run([{ type: "rec", on: true }, tap("C"), tap("C#"), tap("G"), tap("D#")]);
  assert.deepEqual(chordsOf(s.items), ["Cmaj7", "Em7", "Am7", "Fmaj7"]);
  assert.equal(run([{ type: "rec", on: false }, tap("A#")], s).items.length, 4);
});

test("Turning Rec off keeps what was recorded, numbered on the pads, until it is cleared", () => {
  const rec = run([{ type: "rec", on: true }, tap("C"), tap("C#"), tap("G"), tap("D#")]);
  const off = run([{ type: "rec", on: false }], rec);
  assert.deepEqual(chordsOf(off.items), ["Cmaj7", "Em7", "Am7", "Fmaj7"], "turning Rec off keeps the progression");
  const number = (s, key) => pr.padMarks(s, 54, 0, j.KEYS.indexOf(key)).order;
  assert.deepEqual(["C", "C#", "G", "D#"].map((k) => number(off, k)), [1, 2, 3, 4], "and its numbers on the pads");
  const tapped = run([tap("A#")], off);
  assert.deepEqual(pr.padMarks(tapped, 54, 0, j.KEYS.indexOf("A#")), { order: null, lit: false, latest: true });
  assert.equal(pr.padMarks(tapped, 47, 0, j.KEYS.indexOf("C")).order, null, "numbers belong to their own set");
  const cleared = run([{ type: "clear" }], tapped);
  assert.deepEqual(j.KEYS.map((k) => number(cleared, k)).filter(Boolean), []);
});

test("Every chord name fits on its pad", async () => {
  const { keyNames } = await import("./theory.mjs");
  assert.deepEqual(j.typeLines("maj9(no3)/G"), ["maj9", "(no3)", "/G"]);
  assert.deepEqual(j.typeLines("m7"), ["m7"]);
  let longest = 0;
  for (const n of Object.keys(j.SETS)) for (let k = 0; k < 12; k++) for (let t = -6; t <= 5; t++) {
    const c = j.chordAt(n, k, t).chord;
    if (!c) continue;
    for (let tonic = 0; tonic < 12; tonic++) {
      const name = j.nameInKey(c, tonic), rest = name.slice(keyNames(tonic)[c.root].length);
      const lines = j.typeLines(rest);
      assert.equal(lines.join(""), rest, "nothing is lost in the cut");
      for (const l of lines.slice(1)) assert.match(l, /^([(/]|add|sus)/, `${name}: broken only before a bracket, slash, add or sus`);
      longest = Math.max(longest, ...lines.map((l) => l.length));
    }
  }
  assert.ok(longest <= 7, `the longest line is ${longest} characters`);
});

test("A chord can be taken out of the progression, and undo and clear still work", () => {
  const s = run([{ type: "rec", on: true }, tap("C"), tap("C#"), tap("G"), tap("D#")]);
  const removed = run([{ type: "remove", index: 1 }], s);
  assert.deepEqual(chordsOf(removed.items), ["Cmaj7", "Am7", "Fmaj7"]);
  assert.deepEqual(chordsOf(run([{ type: "undo" }], removed).items), ["Cmaj7", "Am7"]);
  assert.deepEqual(run([{ type: "clear" }], removed).items, []);
});

test("The key follows the progression once it has chords, and the last key tapped before that", () => {
  assert.deepEqual(pr.keyFocus(pr.START), []);
  const one = run([tap("D#")]);
  assert.deepEqual(chordsOf(pr.keyFocus(one)), ["Fmaj7"]);
  const s = run([tap("C"), { type: "add" }, tap("G"), { type: "add" }, tap("A#")]);
  assert.deepEqual(chordsOf(pr.keyFocus(s)), ["Cmaj7", "Am7"]);
});

test("A progression can mix chord sets and KEY settings", () => {
  const s = run([tap("C"), { type: "add" }, tap("A", 47, -3), { type: "add" }]);
  assert.deepEqual(chordsOf(s.items), ["Cmaj7", "G7"]);
  assert.deepEqual(s.items.map((k) => [k.set, k.t]), [[54, 0], [47, -3]]);
  assert.deepEqual(pr.resolve(s.items[1]).midi, j.chordAt(47, j.KEYS.indexOf("A"), -3).midi, "played from its own set and KEY");
});

test("A search result can be added to the progression in one tap", () => {
  const [best] = j.search("Dm7 G7 Cmaj7 Am7", { sets: [29, 47, 54] });
  const s = run([{ type: "addMany", items: pr.fromSearch(best) }]);
  assert.deepEqual(s.items.map((k) => [k.set, j.KEYS[k.key], k.t]), [[47, "D#", -3], [47, "A", -3], [47, "C#", -3], [47, "C", -3]]);
  assert.deepEqual(chordsOf(s.items), ["Dm7", "G7", "Cmaj7", "Am7"]);
});

/* ---------- playing the progression back (D-090) ---------- */
import * as pb from "../j6/playback.mjs";
const starts = (count, opts, beats) => Array.from({ length: beats }, (_, n) => pb.beatAt(n, count, opts))
  .map((b, n) => (b.chord !== null ? `${n}:${b.chord}` : null)).filter(Boolean);

test("Tempo runs from 60 to 160 BPM, starting at 90, in steps of 5", () => {
  assert.deepEqual(pb.OPTIONS, { bpm: 90, bars: 1, loop: true, click: false });
  assert.equal(pb.TEMPO.step, 5);
  assert.equal(pb.setTempo(40), 60);
  assert.equal(pb.setTempo(200), 160);
  assert.equal(pb.setTempo(95), 95);
  assert.equal(pb.beatSeconds(120), 0.5);
});

test("Each chord lasts half a bar, one bar or two bars", () => {
  assert.deepEqual(pb.LENGTHS, [0.5, 1, 2]);
  const opts = { loop: false, click: false };
  assert.deepEqual(starts(3, { ...opts, bars: 1 }, 12), ["0:0", "4:1", "8:2"]);
  assert.deepEqual(starts(3, { ...opts, bars: 0.5 }, 6), ["0:0", "2:1", "4:2"]);
  assert.deepEqual(starts(3, { ...opts, bars: 2 }, 24), ["0:0", "8:1", "16:2"]);
  const secs = pb.chordSeconds({ bpm: 120, bars: 1 });
  assert.ok(secs < 2 && secs > 1.7, `a one-bar chord at 120 BPM sounds ${secs} s of its 2 s`);
});

test("With Loop on the progression repeats, and with it off it plays once and stops", () => {
  const loop = pb.beatAt(8, 2, { bars: 1, loop: true, click: false });
  assert.equal(loop.chord, 0);
  assert.equal(loop.end, false);
  assert.equal(pb.beatAt(8, 2, { bars: 1, loop: false, click: false }).end, true);
  assert.equal(pb.beatAt(7, 2, { bars: 1, loop: false, click: false }).end, false);
  assert.equal(pb.beatAt(0, 0, { bars: 1, loop: true, click: false }).end, true, "an empty progression plays nothing");
});

test("The click counts in one bar, then marks every beat with the first of each bar stronger", () => {
  const on = { bars: 1, loop: true, click: true };
  assert.deepEqual([0, 1, 2, 3].map((n) => pb.beatAt(n, 2, on)), [
    { chord: null, click: "accent", end: false }, { chord: null, click: "beat", end: false },
    { chord: null, click: "beat", end: false }, { chord: null, click: "beat", end: false }]);
  assert.deepEqual(pb.beatAt(4, 2, on), { chord: 0, click: "accent", end: false });
  assert.equal(pb.beatAt(5, 2, on).click, "beat");
  const half = { bars: 0.5, loop: true, click: true };
  assert.deepEqual([4, 5, 6, 7, 8].map((n) => [pb.beatAt(n, 4, half).chord, pb.beatAt(n, 4, half).click]),
    [[0, "accent"], [null, "beat"], [1, "beat"], [null, "beat"], [2, "accent"]]);
  assert.deepEqual(pb.beatAt(0, 2, { bars: 1, loop: true, click: false }), { chord: 0, click: null, end: false });
});

/* ---------- naming a misprint, scales to play along, the sheet (D-091–D-093) ---------- */
import * as sh from "../j6/sheet.mjs";
const named = (set, key) => { const c = j.nameFromNotes(j.chordAt(set, j.KEYS.indexOf(key), 0).midi); return c && j.nameOf(c); };

test("A misprinted key is named from the notes it prints", () => {
  assert.equal(named(18, "E"), "Em");
  assert.equal(named(80, "C#"), "D♭9sus4");
  assert.equal(named(3, "D#"), "E♭7♯9");
  assert.equal(j.nameFromNotes([48, 55]), null);
});

test("Two or three scales are offered to play over the progression", () => {
  const { scales, outside } = j.scalesToPlay(["Cmaj7", "Em7", "Am7", "Fmaj7", "Bb7"].map(j.parseChord));
  assert.deepEqual(scales.map((s) => `${j.FLAT_NAMES[s.tonic]} ${s.id}`), ["C major", "C major-pentatonic", "A minor-pentatonic"]);
  const major = new Set(scales[0].notes);
  for (const s of scales.slice(1)) assert.ok(s.notes.every((p) => major.has(p)), `${s.name} lies inside the major scale`);
  assert.deepEqual(outside.map((c) => j.nameOf(c)), ["B♭7"]);
  assert.deepEqual(j.scalesToPlay([]), { scales: [], outside: [] });
});

const kept = [0, 1, 7, 3].map((key) => ({ set: 54, key, t: 0 }));

test("The progression can be taken away as a sheet, with the J-6 keys for each chord", () => {
  const s = sh.j6Sheet(kept, { bpm: 100, bars: 1 });
  assert.equal(s.title, "C major");
  assert.ok(s.meta.includes("100 bpm") && s.meta.includes("each chord 1 bar"));
  assert.deepEqual(s.chords.map((c) => [c.label, c.roman]), [["Cmaj7", "Imaj7"], ["Em7", "iii7"], ["Am7", "vi7"], ["Fmaj7", "IVmaj7"]]);
  assert.deepEqual(s.chords[3].notes, j.chordAt(54, j.KEYS.indexOf("D#"), 0).midi, "the J-6's own voicing");
  assert.deepEqual(s.j6.map((x) => x.where), ["set 54 · KEY 0 · key C", "set 54 · KEY 0 · key C♯", "set 54 · KEY 0 · key G", "set 54 · KEY 0 · key D♯"]);
  assert.match(sh.j6SheetText(s), /On the J-6:\n1\. set 54 · KEY 0 · key C\n2\. set 54 · KEY 0 · key C♯/);
  const moved = sh.j6Sheet([{ set: 47, key: j.KEYS.indexOf("A"), t: -3 }]);
  assert.equal(moved.j6[0].where, "set 47 · KEY −3 · key A");
});

test("The sheet shows suggested fingering only when ticked", () => {
  const off = sh.j6Sheet(kept);
  assert.ok(off.chords.every((c) => c.fingers.length === 0) && off.bass.every((b) => b.finger === null));
  const on = sh.j6Sheet(kept, { fingering: true });
  assert.ok(on.chords.every((c) => c.fingers.length === c.notes.length));
  assert.ok(on.bass.every((b) => b.finger === 5));
});

test("The sheet's scale is the one chosen to play along with", () => {
  const s = sh.j6Sheet(kept, { scale: { tonic: 9, id: "minor-pentatonic" } });
  assert.equal(s.scale.name, "A Minor pentatonic");
  assert.deepEqual(s.scale.names, ["A", "C", "D", "E", "G"]);
  assert.equal(sh.j6Sheet(kept).scale.name, "C Major");
});

/* ---------- the key a set plays in, and the J-6's own steps (D-094) ---------- */
test("Each chord set shows the key it plays in, and KEY moves it", () => {
  assert.deepEqual(j.setKey(54, 0), { tonic: 5, fit: 8, of: 12 }, "F major, or D minor: 8 of 12 pads");
  assert.equal(j.setKey(54, 2).tonic, 7);
  for (const n of Object.keys(j.SETS)) {
    const home = j.setKey(n, 0);
    if ([14, 15, 16].includes(Number(n))) { assert.equal(home, null, `set ${n} is an interval stack`); continue; }
    for (let t = -6; t <= 5; t++) assert.equal(j.setKey(n, t).tonic, (home.tonic + t + 12) % 12, `set ${n} at KEY ${t}`);
  }
});

test("The home chord, its two closest relatives and the relative minor are marked on the pads", () => {
  assert.equal(j.setKey(29, 0).tonic, 0, "set 29 is in C major");
  const role = (key) => j.homeRole(j.chordAt(29, j.KEYS.indexOf(key), 0).chord, 0);
  assert.deepEqual(["C", "F", "C#", "F#", "D", "B", "A", "E"].map(role), ["I", "I", "IV", "IV", "V", "V", "vi", null]);
  assert.equal(j.homeRole(j.parseChord("Gm7"), 0), null, "G minor has a B flat, which isn't in C major");
  assert.equal(j.homeRole(j.parseChord("G7"), 0), "V");
  assert.equal(j.homeRole(null, 0), null);
});

test("Find gives the steps on the J-6 in the manual's words", () => {
  assert.deepEqual(j.hardwareSteps({ set: 47, transpose: -3 }, ["D#", "A", "C#", "C"].map((k) => j.KEYS.indexOf(k))), [
    "SHIFT + [CHORD], turn [TEMPO/VALUE] to 47, press [CHORD]",
    "SHIFT + [A (KEY)], turn [TEMPO/VALUE] to −3, press [C (EXIT)]",
    "Play D♯ → A → C♯ → C",
  ]);
});

/* core/chords — unit tests, one per requirement in core/REQUIREMENTS.md (CR-CHORDS-nn). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { chordLabel, QUALITIES, DEGREE_NAMES, DICTIONARY, inversions, SIGNATURES, identifyChord, customChordFrom } from "../chords.mjs";
import { pc, spelling, NAMES, SOLFEGE } from "../notes.mjs";

const sig = (iv) => [...new Set(iv.map(pc))].sort((a, b) => a - b).join(",");
/** The chord `iv` above `root`, as played from octave 3. */
const play = (root, iv) => iv.map((i) => 48 + root + i);

test("CR-CHORDS-01 chordLabel writes a chord's name in the naming system asked for", () => {
  assert.equal(chordLabel(0, "maj7", "letters"), "Cmaj7");
  assert.equal(chordLabel(6, "m", "letters"), "F#m");
  assert.equal(chordLabel(7, "7", "solfege"), "Sol7");
  assert.equal(chordLabel(3, "m7", spelling("letters", 0, "minor")), "E♭m7", "in the key's own spelling");
  for (let r = 0; r < 12; r++) { assert.equal(chordLabel(r, "", "letters"), NAMES[r]); assert.equal(chordLabel(r, "", "solfege"), SOLFEGE[r]); }
});

test("CR-CHORDS-02 QUALITIES is keyed by interval signature, and every entry has a symbol and a name", () => {
  const keys = Object.keys(QUALITIES);
  assert.ok(keys.length >= 30);
  for (const k of keys) {
    const pcs = k.split(",").map(Number);
    assert.equal(pcs[0], 0, `${k} starts on the root`);
    assert.ok(pcs.every((p, i) => Number.isInteger(p) && p >= 0 && p < 12 && (i === 0 || p > pcs[i - 1])), `${k} is ascending pitch classes`);
    assert.ok(typeof QUALITIES[k].sym === "string" && QUALITIES[k].full, `${k} says what it is`);
  }
  assert.deepEqual(QUALITIES["0,4,7"], { sym: "", full: "major" });
  assert.deepEqual(QUALITIES["0,3,7,10"], { sym: "m7", full: "minor 7th" });
});

test("CR-CHORDS-03 the dictionary lists each chord type once, with its intervals, a name and a plain description", () => {
  assert.ok(DICTIONARY.length >= 30);
  assert.equal(new Set(DICTIONARY.map((d) => d.q)).size, DICTIONARY.length, "a symbol is listed once");
  assert.deepEqual(DICTIONARY.slice(0, 2).map((d) => d.q), ["", "m"], "in the order a learner meets them: major, then minor");
  for (const d of DICTIONARY) {
    assert.equal(d.iv[0], 0, `${d.q} starts on the root`);
    assert.ok(d.iv.every((x, i) => i === 0 || x > d.iv[i - 1]), `${d.q}: intervals ascend (${d.iv})`);
    assert.ok(d.full && d.plain.length > 20, `${d.q} is named and described`);
    if (d.voicing) {
      assert.equal(d.voicing[0], 0, `${d.q}'s signature voicing starts on the root`);
      assert.ok(d.voicing.every((x, i) => i === 0 || x > d.voicing[i - 1]), `${d.q}'s signature voicing ascends`);
      // a signature voicing may add one colour tone the formula omits (maj7♯11 adds the 9th, D-077)
      const chordTones = new Set(d.iv.map(pc));
      assert.ok(d.voicing.filter((x) => !chordTones.has(pc(x))).length <= 1, `${d.q}'s signature voicing adds at most one colour tone`);
    }
  }
});

test("CR-CHORDS-04 every interval a chord uses has a degree name, the flat 9, sharp 9 and sharp 11 included", () => {
  for (const d of DICTIONARY) for (const i of d.iv) assert.ok(DEGREE_NAMES[i], `${d.q}: ${i} semitones`);
  assert.equal(DEGREE_NAMES[0], "1"); assert.equal(DEGREE_NAMES[10], "♭7"); assert.equal(DEGREE_NAMES[14], "9");
  assert.deepEqual([13, 15, 18].map((i) => DEGREE_NAMES[i]), ["♭9", "♯9", "♯11"]);
  for (let i = 0; i < 12; i++) assert.ok(DEGREE_NAMES[i], `${i} within the octave`);
});

test("CR-CHORDS-05 SIGNATURES names every signature either table can name, the quality table first", () => {
  for (const k of Object.keys(QUALITIES)) assert.equal(SIGNATURES[k].sym, QUALITIES[k].sym, `${k} keeps its quality-table name`);
  for (const d of DICTIONARY) {
    const s = SIGNATURES[sig(d.iv)];
    assert.ok(s, `${d.q} has a signature`);
    if (!QUALITIES[sig(d.iv)]) assert.equal(s.sym, d.q, `${d.q} comes from the dictionary`);
  }
  assert.ok(Object.values(SIGNATURES).every((s) => s.rank === 3 || s.rank === 2));
  assert.equal(SIGNATURES["0,4,7"].rank, 3, "the quality table outranks the dictionary");
});

test("CR-CHORDS-06 identifyChord names every dictionary chord in root position, on any root, and ranks that reading first", () => {
  for (const d of DICTIONARY) for (let root = 0; root < 12; root++) {
    const readings = identifyChord(play(root, d.iv));
    assert.ok(readings.length > 0, `${d.q} on ${root} is named`);
    const top = readings[0];
    assert.equal(top.rootPc, root, `${d.q} on ${root}: the lowest note is the root, so it is the first reading`);
    assert.equal(top.sym, SIGNATURES[sig(d.iv)].sym);
    assert.equal(top.label, chordLabel(root, top.sym, "letters"), "no slash bass in root position");
    assert.ok(readings.every((r, i) => i === 0 || r.score <= readings[i - 1].score), "best first");
  }
});

test("CR-CHORDS-07 identifyChord names an inversion with its bass, and every other reading of the same notes", () => {
  const eg = identifyChord([52, 55, 60]);                                   // E G C: C major over E
  assert.equal(eg[0].label, "C/E");
  assert.equal(eg[0].bass, 4);
  const c6 = identifyChord([57, 60, 64, 67]).map((r) => r.label);           // A C E G
  assert.ok(c6.includes("Am7") && c6.includes("C6/A"), `Am7 and C6/A are the same notes: ${c6}`);
  assert.equal(identifyChord([57, 60, 64, 67])[0].label, "Am7", "the root position wins");
  for (const r of identifyChord([57, 60, 64, 67])) assert.deepEqual(r.notes, [57, 60, 64, 67]);
});

test("CR-CHORDS-08 two notes are named as an interval measured upward from the lowest", () => {
  const [up] = identifyChord([60, 67]);
  assert.equal(up.full, "perfect 5th"); assert.equal(up.label, "C + G");
  assert.equal(identifyChord([67, 72])[0].full, "perfect 4th", "G up to C is a fourth");
  assert.equal(identifyChord([60, 61])[0].full, "minor 2nd");
  assert.equal(identifyChord([60, 66])[0].full, "tritone");
  assert.equal(identifyChord([60, 64, 60 + 12 * 0])[0].rootPc, 0, "a doubled note is one note");
});

test("CR-CHORDS-09 notes with no standard name get no name, rather than an invented one", () => {
  assert.deepEqual(identifyChord([]), []);
  assert.deepEqual(identifyChord([60]), []);
  assert.deepEqual(identifyChord([60, 72]), [], "an octave is one pitch class");
  assert.deepEqual(identifyChord([60, 61, 62, 63]), [], "a chromatic cluster");
  assert.deepEqual(identifyChord([60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71]), []);
});

test("CR-CHORDS-10 identifyChord writes names in the naming system it is given, and leaves its input alone", () => {
  assert.equal(identifyChord([60, 64, 67], "solfege")[0].label, "Do");
  assert.equal(identifyChord([62, 65, 69, 72], "solfege")[0].label, "Rem7");
  assert.equal(identifyChord([63, 67, 70], spelling("letters", 0, "minor"))[0].label, "E♭", "E♭, not D#");
  assert.equal(identifyChord([63, 67, 70])[0].label, "D#", "with no key, sharps");
  const input = Object.freeze([67, 60, 64, 60]);
  assert.deepEqual(identifyChord(input), identifyChord([60, 64, 67]), "order and repeats do not matter");
});

test("CR-CHORDS-11 inversions lifts the lowest note an octave at a time, up to four, keeping the chord's notes", () => {
  const c = { rootPc: 0, notes: [64, 60, 67] };
  const out = inversions(c);
  assert.deepEqual(out.map((o) => o.name), ["Root position", "1st inversion", "2nd inversion"]);
  assert.deepEqual(out.map((o) => o.notes), [[60, 64, 67], [64, 67, 72], [67, 72, 76]]);
  assert.deepEqual(out.map((o) => o.bass), [60, 64, 67], "the bass is the lowest note");
  assert.match(out[1].why, /^3 is in the bass/);
  assert.match(out[0].why, /root is lowest/i);
  for (const o of out) assert.deepEqual([...new Set(o.notes.map(pc))].sort((a, b) => a - b), [0, 4, 7]);
  const five = inversions({ rootPc: 0, notes: [60, 64, 67, 71, 74] });
  assert.equal(five.length, 4, "never more than four");
  assert.ok(five.every((o) => o.notes.length === 5));
  assert.deepEqual(c.notes, [64, 60, 67], "the chord is left as it was");
});

test("CR-CHORDS-12 customChordFrom turns a selection into a chord of your own, named if it can be", () => {
  const c = customChordFrom([67, 60, 64, 64], "  my C  ");
  assert.deepEqual(c.notes, [60, 64, 67], "sorted, each note once");
  assert.equal(c.name, "my C"); assert.equal(c.rootPc, 0); assert.equal(c.sym, ""); assert.equal(c.full, "major");
  assert.equal(c.mine, true);
  assert.equal(c.id, "mine-c-60_64_67", "an id from the notes, so the same selection is the same chord");
  assert.deepEqual(customChordFrom([60, 64, 67]), customChordFrom([67, 64, 60]));
  assert.equal(customChordFrom([60, 64, 67]).name, "C", "unnamed, it takes the name the notes have");
  const odd = customChordFrom([60, 61, 62, 63]);
  assert.equal(odd.name, "Untitled"); assert.equal(odd.full, "voicing of your own"); assert.equal(odd.rootPc, 0, "no name: the lowest note is the root");
  assert.equal(customChordFrom([60]), null, "one note is not a chord");
  assert.equal(customChordFrom([]), null);
});

/** The rule the J-6 Explorer used before it was joined to identifyChord (D-093), kept here as an independent reference. */
function reference(midis) {
  const sorted = [...midis].sort((a, b) => a - b), got = [...new Set(sorted.map(pc))];
  if (got.length < 3) return null;
  const bass = pc(sorted[0]); let best = null;
  for (const root of got) {
    const rel = got.map((p) => pc(p - root));
    DICTIONARY.forEach((d, order) => {
      const iv = [...new Set(d.iv.map(pc))];
      if (!rel.every((x) => iv.includes(x))) return;
      const score = (iv.length - rel.length) + (root === bass ? 0 : 2);
      if (!best || score < best.score || (score === best.score && order < best.order)) best = { score, order, root, quality: d.q, iv };
    });
  }
  return best;
}

test("CR-CHORDS-13 in missing mode, notes that are part of a chord are named by it, the root in the bass outweighing two missing tones, then the simpler chord", () => {
  const read = (m) => identifyChord(m, "letters", { missing: true });
  assert.equal(read([48, 52])[0], undefined, "two notes are not enough to name a chord");
  const cgb = read([48, 55, 58]);                       // C G B♭: the third is left out, so major or minor fit equally
  assert.deepEqual(cgb.slice(0, 3).map((r) => r.label), ["Cm7", "C7", "C7sus4"], "equally good readings keep the dictionary's order");
  assert.ok(cgb.slice(0, 3).every((r) => r.missing === 1 && r.score === -1));
  const cEG = read([48, 52, 55])[0]; assert.equal(cEG.sym, ""); assert.equal(cEG.missing, 0, "a whole chord has nothing missing");
  assert.equal(read([52, 55, 60])[0].label, "C/E", "an inversion is named with its bass");
  for (const r of read([48, 52, 58])) assert.equal(r.score, -(r.missing + (r.rootPc === 0 ? 0 : 2)));
  const all = read([48, 52, 55, 59]); assert.ok(all.every((r, i) => i === 0 || r.score <= all[i - 1].score), "best first");
  for (const r of all) { assert.deepEqual(r.notes, [48, 52, 55, 59]); assert.ok(r.tones.length >= 3); }
});

test("CR-CHORDS-14 missing mode agrees with the reference rule on every chord, every root, with any one tone left out and notes spread over octaves", () => {
  let checked = 0;
  for (const d of DICTIONARY) for (let root = 0; root < 12; root++) {
    const full = d.iv.map((i) => 36 + root + i);
    const variants = [full, ...full.map((_, k) => full.filter((_, j) => j !== k)), full.map((m, i) => m + (i % 2) * 12), full.map((m, i) => (i === 1 ? m - 24 : m))];
    for (const notes of variants) {
      const want = reference(notes), got = identifyChord(notes, "letters", { missing: true })[0] ?? null;
      assert.equal(got === null, want === null, `${d.q} ${root} ${notes}`);
      if (want) { assert.deepEqual([got.rootPc, got.sym, got.bass, got.tones], [want.root, want.quality, pc(Math.min(...notes)), want.iv], `${d.q} on ${root}: ${notes}`); checked++; }
    }
  }
  assert.ok(checked > 600, `${checked} readings compared`);
});

test("CR-CHORDS-15 every reading has the same shape in both modes, so a caller handles one answer", () => {
  const keys = ["bass", "full", "label", "missing", "notes", "rootPc", "score", "sym", "tones", "why"];
  for (const opts of [{}, { missing: true }]) for (const notes of [[60, 64, 67], [57, 60, 64, 67], [52, 55, 60]]) for (const r of identifyChord(notes, "letters", opts)) assert.deepEqual(Object.keys(r).sort(), keys);
  assert.deepEqual(Object.keys(identifyChord([60, 67])[0]).sort(), keys, "an interval too");
  assert.equal(identifyChord([60, 64, 67], "letters", { missing: false })[0].label, "C", "exact is the default");
  assert.deepEqual(identifyChord([60, 64, 67]), identifyChord([60, 64, 67], "letters", {}));
});

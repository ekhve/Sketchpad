/* sketchpad/model — unit tests, one per requirement in sketchpad/REQUIREMENTS.md (SR-MODEL-nn). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { soundSections, namingFor, activeChordFor, TAB_IDS, LEVELS, levelIndex, featuresAt, has, TABS_BY_FEATURE, tabsAt, UC00_NEEDS } from "../model.mjs";
import { noteName } from "../../core/notes.mjs";
import { INSTRUMENTS, SPACES } from "../../core/instruments.mjs";
import { ROLL_STYLES } from "../../core/playback.mjs";

test("SR-MODEL-01 there are three levels, Start, Produce and Study, and each one only adds to the one before", () => {
  assert.deepEqual(LEVELS.map((l) => l.id), ["start", "produce", "study"]);
  for (let i = 1; i < LEVELS.length; i++) {
    const before = featuresAt(LEVELS[i - 1].id), now = featuresAt(LEVELS[i].id);
    assert.ok([...before].every((f) => now.has(f)), `${LEVELS[i].id} keeps everything ${LEVELS[i - 1].id} has`);
    assert.ok(now.size > before.size);
  }
  const all = LEVELS.flatMap((l) => l.adds); assert.equal(new Set(all).size, all.length, "a feature is added once");
  assert.ok(LEVELS.every((l) => l.name && l.note));
});

test("SR-MODEL-02 levelIndex finds a level's position, and an unknown level is the first", () => {
  assert.deepEqual(LEVELS.map((l) => levelIndex(l.id)), [0, 1, 2]);
  assert.equal(levelIndex("nope"), 0); assert.equal(levelIndex(undefined), 0);
});

test("SR-MODEL-03 has says whether a level has a feature, counting every level below it", () => {
  assert.equal(has("start", "loop"), true); assert.equal(has("start", "bass"), false); assert.equal(has("produce", "bass"), true); assert.equal(has("produce", "theory"), false); assert.equal(has("study", "theory"), true);
  assert.equal(has("study", "loop"), true, "nothing found at a lower level disappears");
  assert.equal(has("start", "nonsense"), false);
});

test("SR-MODEL-04 tabs follow features and come in a fixed order, so a tab never moves when another appears", () => {
  assert.deepEqual(tabsAt("start"), ["chords", "scales", "prog", "learn", "guide"]);
  for (const lv of LEVELS) { const t = tabsAt(lv.id); assert.deepEqual(t, TAB_IDS.filter((id) => t.includes(id)), `${lv.id} is in the fixed order`); }
  for (let i = 1; i < LEVELS.length; i++) assert.ok(tabsAt(LEVELS[i - 1].id).every((t) => tabsAt(LEVELS[i].id).includes(t)));
  assert.equal(tabsAt("study").length, TAB_IDS.length, "Study shows every tab");
  for (const tab of Object.values(TABS_BY_FEATURE)) assert.ok(TAB_IDS.includes(tab), tab);
});

test("SR-MODEL-05 the main scenario can be done at the first level", () => {
  assert.ok(UC00_NEEDS.length >= 5);
  for (const f of UC00_NEEDS) assert.ok(has("start", f), f);
});

test("SR-MODEL-06 the chord in focus is the selected one, else the one playing, else the loop's first, else home", () => {
  const prog = [{ id: "a" }, { id: "b" }, { id: "c" }], palette = [{ id: "home" }, { id: "x" }];
  assert.equal(activeChordFor({ selected: { id: "s" }, playingIndex: 1, progression: prog, palette }).id, "s");
  assert.equal(activeChordFor({ playingIndex: 1, progression: prog, palette }).id, "b");
  assert.equal(activeChordFor({ playingIndex: -1, progression: prog, palette }).id, "a");
  assert.equal(activeChordFor({ playingIndex: 7, progression: prog, palette }).id, "a", "a playing index that is not in the loop is ignored");
  assert.equal(activeChordFor({ progression: [], palette }).id, "home");
  assert.equal(activeChordFor({}), null);
});

test("SR-MODEL-07 notes are written as sharps unless the key's own spelling is chosen; Do-Re-Mi follows the same choice", () => {
  assert.equal(namingFor(), "letters"); assert.equal(namingFor({ base: "solfege" }), "solfege");
  for (let t = 0; t < 12; t++) for (const mode of ["major", "minor"]) for (let p = 0; p < 12; p++) assert.ok(!noteName(p, namingFor({ tonic: t, mode })).includes("♭"));
  assert.equal(noteName(3, namingFor({ accidentals: "key", tonic: 3, mode: "major" })), "E♭");
  assert.equal(noteName(3, namingFor({ base: "solfege", accidentals: "key", tonic: 3, mode: "major" })), "Mi♭");
  assert.equal(noteName(3, namingFor({ accidentals: "key", tonic: 11, mode: "major" })), "D#", "a sharp key keeps its sharps");
  assert.equal(namingFor({ accidentals: "anything else" }), "letters", "only \"key\" asks for the key's spelling");
});

test("SR-MODEL-08 the sound options are four rows, instrument, how a chord is played, reverb and echo, each offering every choice the catalogues have, once", () => {
  const rows = soundSections();
  assert.deepEqual(rows.map((r) => r.id), ["instrument", "played", "room", "echo"]);
  assert.deepEqual(rows.map((r) => r.label), ["Sound", "Played", "Reverb", "Echo"]);
  const ids = (row) => rows.find((r) => r.id === row).options.map((o) => o.id);
  assert.deepEqual(ids("instrument"), INSTRUMENTS.map((i) => i.id)); assert.deepEqual(ids("played"), ROLL_STYLES.map((r) => r.id));
  assert.deepEqual(ids("room"), SPACES.map((s) => s.id)); assert.deepEqual(ids("echo"), ["on", "off"]);
  for (const row of rows) { assert.equal(new Set(ids(row.id)).size, row.options.length, `${row.id}: a choice once`); for (const o of row.options) assert.ok(o.name && o.note, `${row.id}/${o.id} is named and explained`); }
  assert.deepEqual(soundSections(), soundSections(), "the same each time");
});

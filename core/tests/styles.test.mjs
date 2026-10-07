/* core/styles — unit tests, one per requirement in core/REQUIREMENTS.md (CR-STYLES-nn). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { STYLE_COLOURS, scalesForStyle } from "../styles.mjs";
import { SCALES } from "../scales.mjs";
import { DICTIONARY } from "../chords.mjs";

test("CR-STYLES-01 every style names chord colours the dictionary can voice, and says in a sentence what it is going for", () => {
  assert.ok(Object.keys(STYLE_COLOURS).length >= 6);
  const known = new Set(DICTIONARY.map((d) => d.q));
  for (const [style, c] of Object.entries(STYLE_COLOURS)) {
    assert.ok(c.chords.length >= 3 && c.chords.every((q) => known.has(q)), `${style}: ${c.chords}`);
    assert.equal(new Set(c.chords).size, c.chords.length, `${style} lists a colour once`);
    assert.ok(c.note.length > 20, `${style} explains itself`);
  }
});

test("CR-STYLES-02 every style a scale is tagged with has chord colours, so the two catalogues agree", () => {
  const styles = new Set(SCALES.flatMap((s) => s.tags));
  for (const tag of ["hip-hop", "soul", "funk", "house", "west coast", "cinematic"]) assert.ok(STYLE_COLOURS[tag], `${tag} has colours`);
  for (const s of Object.keys(STYLE_COLOURS)) assert.ok(styles.has(s), `${s} is tagged on at least one scale`);
});

test("CR-STYLES-03 scalesForStyle splits the scales of a mode into those tagged for the style and the rest, nothing lost or repeated", () => {
  for (const style of Object.keys(STYLE_COLOURS)) for (const mode of ["major", "minor"]) {
    const r = scalesForStyle(style, mode);
    const inMode = SCALES.filter((s) => s.mode === mode);
    assert.deepEqual([...r.suited, ...r.others].map((s) => s.id).sort(), inMode.map((s) => s.id).sort(), `${style} ${mode}: every scale once`);
    assert.ok(r.suited.every((s) => s.tags.includes(style) && s.mode === mode));
    assert.ok(r.others.every((s) => !s.tags.includes(style) && s.mode === mode));
    assert.deepEqual(r.chords, STYLE_COLOURS[style].chords); assert.equal(r.note, STYLE_COLOURS[style].note);
  }
  assert.deepEqual(scalesForStyle("funk", "minor").suited.map((s) => s.id), ["dorian", "blues"]);
  assert.deepEqual(scalesForStyle("pop", "major").suited.map((s) => s.id), ["major", "major-pentatonic"], "a tag with no colours still sorts the scales");
});

test("CR-STYLES-04 an unknown style suits nothing and offers no colours, without failing", () => {
  const r = scalesForStyle("polka", "major");
  assert.deepEqual(r.suited, []); assert.equal(r.others.length, SCALES.filter((s) => s.mode === "major").length);
  assert.equal(r.chords, undefined);
});

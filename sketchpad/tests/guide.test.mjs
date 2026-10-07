/* sketchpad/guide — unit tests, one per requirement in sketchpad/REQUIREMENTS.md (SR-GUIDE-nn). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { GUIDE, guideFor, sentenceCount } from "../guide.mjs";
import { TAB_IDS } from "../model.mjs";

test("SR-GUIDE-01 every tab has at least one section of the guide, so no tab ships undocumented; the guide tab itself shows the general sections", () => {
  for (const tab of TAB_IDS.filter((t) => t !== "guide")) assert.ok(guideFor(tab).length >= 1, `the ${tab} tab`);
  assert.ok(guideFor(null).length >= 4, "the sections that belong to no tab");
});

test("SR-GUIDE-02 a section has an id, a title, a lead and points, and ids are not repeated", () => {
  assert.equal(new Set(GUIDE.map((g) => g.id)).size, GUIDE.length);
  for (const g of GUIDE) {
    assert.ok(g.id && g.title && g.lead.length > 20, g.id); assert.ok(Array.isArray(g.points) && g.points.length >= 1, g.id);
    assert.ok(g.points.every((p) => typeof p === "string" && p.length > 10), g.id);
    assert.ok(g.tab === null || TAB_IDS.includes(g.tab), `${g.id} belongs to a tab that exists`);
  }
});

test("SR-GUIDE-03 guideFor gives the sections of one tab, in order, and nothing for a tab that has none", () => {
  for (const tab of TAB_IDS) assert.deepEqual(guideFor(tab), GUIDE.filter((g) => g.tab === tab));
  assert.deepEqual(guideFor("nope"), []);
  assert.deepEqual(guideFor(null).map((g) => g.id).slice(0, 2), ["start", "levels"], "the sections that belong to no tab are the general ones");
});

test("SR-GUIDE-04 sentenceCount counts the sentences of a text", () => {
  assert.equal(sentenceCount(""), 0); assert.equal(sentenceCount("One."), 1); assert.equal(sentenceCount("One. Two! Three?"), 3);
  assert.equal(sentenceCount("No full stop"), 0); assert.equal(sentenceCount(undefined), 0, "not a text, no sentences");
  assert.equal(sentenceCount("Ends with a stop. And a gap  . "), 2);
});

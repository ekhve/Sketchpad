/* The link between sketchpad.feature and the tests was convention only, and it
 * had already rotted after one session: seven scenarios had drifted out of
 * sync with the tests meant to implement them, and twenty-nine tests described
 * behaviour no scenario mentioned. This file makes the drift fail the build.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const feature = readFileSync(join(here, "..", "sketchpad.feature"), "utf8").split("\n");
const testSrc = ["theory.test.mjs", "site.test.mjs", "j6.test.mjs"].map((f) => readFileSync(join(here, f), "utf8")).join("\n");

const scenarios = [];
let tags = [];
for (const line of feature) {
  const t = line.trim();
  if (t.startsWith("@")) tags = t.split(/\s+/);
  else if (t.startsWith("Scenario")) {
    scenarios.push({ name: t.replace(/^Scenario( Outline)?:\s*/, ""), tags });
    tags = [];
  }
}
const testNames = [...testSrc.matchAll(/^\s*test\("([^"]+)"/gm)].map((m) => m[1]);
const auto = scenarios.filter((s) => s.tags.includes("@auto"));

describe("Traceability between the feature file and the tests", () => {
  test("Every scenario is tagged either auto or manual", () => {
    const untagged = scenarios.filter((s) => !s.tags.includes("@auto") && !s.tags.includes("@manual"));
    assert.deepEqual(untagged.map((s) => s.name), [],
      "an untagged scenario is one nobody has decided how to verify");
  });

  test("Every auto scenario has a test with the same name", () => {
    const missing = auto.filter((s) => !testNames.includes(s.name)).map((s) => s.name);
    assert.deepEqual(missing, [], "specified as automatable but never automated");
  });

  test("Every test has a scenario describing why it exists", () => {
    const orphans = testNames.filter((n) => !scenarios.some((s) => s.name === n));
    assert.deepEqual(orphans, [], "a test with no scenario is behaviour nobody agreed to");
  });

  test("No scenario name is used twice", () => {
    const seen = new Set(), dupes = [];
    for (const s of scenarios) { if (seen.has(s.name)) dupes.push(s.name); seen.add(s.name); }
    assert.deepEqual(dupes, [], "duplicate names make the mapping ambiguous");
  });

  test("No test name is used twice", () => {
    const seen = new Set(), dupes = [];
    for (const n of testNames) { if (seen.has(n)) dupes.push(n); seen.add(n); }
    assert.deepEqual(dupes, []);
  });

  test("Manual scenarios stay a minority of the suite", () => {
    const manual = scenarios.length - auto.length;
    assert.ok(manual / scenarios.length < 0.4,
      `${manual} of ${scenarios.length} scenarios are manual — automate some or admit the engine is untestable`);
  });
});

# Sketchpad module requirements

Requirements of the three modules that belong to Sketchpad alone (`CD-001`): its levels and tabs, its guide, its lessons. The same form as [`core/REQUIREMENTS.md`](../core/REQUIREMENTS.md), with `SR-` ids; each has a test in `sketchpad/tests/` whose title begins with the id, and `tools/core-check.mjs` fails the build if a requirement has no test or a test no requirement (gate C1). The product-level requirements (`R-nnn`) in the root `REQUIREMENTS.md` are checked against scenarios; these are the module's own.

## sketchpad/model

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| SR-MODEL-01 | There are three levels, Start, Produce and Study, and each one only adds to the one before. | D-058, D-039, D-097 | A | `sketchpad/tests/model.test.mjs` |
| SR-MODEL-02 | levelIndex finds a level's position, and an unknown level is the first. | D-058, D-039, D-097 | A | `sketchpad/tests/model.test.mjs` |
| SR-MODEL-03 | Has says whether a level has a feature, counting every level below it. | D-058, D-039, D-097 | A | `sketchpad/tests/model.test.mjs` |
| SR-MODEL-04 | Tabs follow features and come in a fixed order, so a tab never moves when another appears. | D-058, D-039, D-097 | A | `sketchpad/tests/model.test.mjs` |
| SR-MODEL-05 | The main scenario can be done at the first level. | D-058, D-039, D-097 | A | `sketchpad/tests/model.test.mjs` |
| SR-MODEL-06 | The chord in focus is the selected one, else the one playing, else the loop's first, else home. | D-058, D-039, D-097 | A | `sketchpad/tests/model.test.mjs` |
| SR-MODEL-07 | Notes are written as sharps unless the key's own spelling is chosen; Do-Re-Mi follows the same choice. | D-058, D-039, D-097 | A | `sketchpad/tests/model.test.mjs` |

## sketchpad/guide

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| SR-GUIDE-01 | Every tab has at least one section of the guide, so no tab ships undocumented; the guide tab itself shows the general sections. | D-050, D-051 | A | `sketchpad/tests/guide.test.mjs` |
| SR-GUIDE-02 | A section has an id, a title, a lead and points, and ids are not repeated. | D-050, D-051 | A | `sketchpad/tests/guide.test.mjs` |
| SR-GUIDE-03 | guideFor gives the sections of one tab, in order, and nothing for a tab that has none. | D-050, D-051 | A | `sketchpad/tests/guide.test.mjs` |
| SR-GUIDE-04 | sentenceCount counts the sentences of a text. | D-050, D-051 | A | `sketchpad/tests/guide.test.mjs` |

## sketchpad/lessons

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| SR-LESSONS-01 | The catalogue has lessons under each of its topics, with unique ids. | D-072, D-073, D-074 | A | `sketchpad/tests/lessons.test.mjs` |
| SR-LESSONS-02 | Every lesson can be built for every key and both naming systems, with steps that say what to play and why. | D-072, D-073, D-074 | A | `sketchpad/tests/lessons.test.mjs` |
| SR-LESSONS-03 | A lesson is spelled for its own key, whatever the app's setting, and its words use that spelling. | D-072, D-073, D-074 | A | `sketchpad/tests/lessons.test.mjs` |
| SR-LESSONS-04 | Every step shows the notes it asks for, in the octave the keyboard is at. | D-072, D-073, D-074 | A | `sketchpad/tests/lessons.test.mjs` |
| SR-LESSONS-05 | A note is judged against a step: a sequence in order, a set in any order, and a slip costs nothing. | D-072, D-073, D-074 | A | `sketchpad/tests/lessons.test.mjs` |
| SR-LESSONS-06 | Feedback is short, answers a wrong note with the right one, and says what to do about the wrong way. | D-072, D-073, D-074 | A | `sketchpad/tests/lessons.test.mjs` |
| SR-LESSONS-07 | A hint lights the next note a step wants, and says how to find it. | D-072, D-073, D-074 | A | `sketchpad/tests/lessons.test.mjs` |
| SR-LESSONS-08 | The words for distances, tones, landmarks and chord shapes are complete over the octave. | D-072, D-073, D-074 | A | `sketchpad/tests/lessons.test.mjs` |

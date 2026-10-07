# Sketchpad modules

The modules that belong to Sketchpad and not to the core asset base (CD-001): the shell's levels and tabs, the guide text and the lessons. They use `core/` for the music and add what is specific to this product. They are described the same way as the core's, and held to the same rules by `tools/core-check.mjs` (C2, C3); their requirements are the product's (`REQUIREMENTS.md`), not the asset base's.

## sketchpad/guide

**Layer** 0 · **Depends on** nothing · **Used by** sketchpad

**Purpose.** The How-to-use text, as data, so that no tab can ship undocumented.

**Behaviour.** A section has a title, a lead and points, and belongs to a tab or to none. `sentenceCount` is what the tests use to hold explanations to the two-sentence cap (D-051). Product-specific (CD-001).

**Requirements.** Product-level: the decisions cited in the module's header, and the requirements in the product's `REQUIREMENTS.md` that cite them. Verified by the product's tests (`tests/theory.test.mjs`, `tests/traceability.test.mjs`) and by mutation (`tools/mutate.mjs`).

### Interface

| Name | Kind | Signature | What it is |
|---|---|---|---|
| `GUIDE` | data | — | The sections of the guide. |
| `guideFor` | function | `(tabId)` | The sections for a tab. |
| `sentenceCount` | function | `(text)` | How many sentences a text has. |

## sketchpad/model

**Layer** 0 · **Depends on** nothing · **Used by** sketchpad

**Purpose.** Sketchpad's feature levels and tabs: which features a level unlocks, which tabs it shows, and which chord is the one in focus.

**Behaviour.** Three levels (Start, Produce, Study) each add features to the one before, so nothing a user has found ever moves or disappears; tabs follow from features, in a fixed order. `UC00_NEEDS` lists what the main scenario needs, which the Start level must cover. When no chord is selected, `activeChordFor` falls back to the one playing, then the first of the loop, then the home chord. Product-specific, so it lives with the product (CD-001); it traces to D-058 and D-039.

**Requirements.** Product-level: the decisions cited in the module's header, and the requirements in the product's `REQUIREMENTS.md` that cite them. Verified by the product's tests (`tests/theory.test.mjs`, `tests/traceability.test.mjs`) and by mutation (`tools/mutate.mjs`).

### Interface

| Name | Kind | Signature | What it is |
|---|---|---|---|
| `LEVELS` | data | — | The three levels, each with what it adds. |
| `TABS_BY_FEATURE` | data | — | Which tab each feature opens. |
| `TAB_IDS` | data | — | Every tab id, in display order. |
| `UC00_NEEDS` | data | — | The features the main scenario needs. |
| `activeChordFor` | function | `({ selected = null, playingIndex = -1, progression = [], palette = [] })` | Which chord is in focus: the selected one, the one playing, the loop's first, or home. |
| `featuresAt` | function | `(levelId)` | Every feature available at a level and below. |
| `has` | function | `(levelId, feature)` | Whether a level has a feature. |
| `levelIndex` | function | `(id)` | A level's position, 0 for an unknown id. |
| `tabsAt` | function | `(levelId)` | The tabs a level shows, in a fixed order. |

## sketchpad/lessons

**Layer** 4 · **Depends on** core/chords, core/harmony, core/notes, core/scales, core/voicing · **Used by** sketchpad

**Purpose.** Sketchpad's lessons: scales, chords and progressions as steps the keyboard follows, with hints, feedback and a diagnosis of a slip.

**Behaviour.** A lesson is data built for a root and a naming system, so each can be practised in all twelve keys. A step's target is a *set* (every pitch class, any order, any octave) or a *sequence* (in order, optionally each higher or lower than the last). A slip costs nothing: the wrong note is named and the step carries on. The reason why appears only after the sound, which keeps D-011. Product-specific: it uses core for the music and adds the teaching (CD-001).

**Requirements.** Product-level: the decisions cited in the module's header, and the requirements in the product's `REQUIREMENTS.md` that cite them. Verified by the product's tests (`tests/theory.test.mjs`, `tests/traceability.test.mjs`) and by mutation (`tools/mutate.mjs`).

### Interface

| Name | Kind | Signature | What it is |
|---|---|---|---|
| `LESSONS` | data | — | The lesson catalogue. |
| `LESSON_TOPICS` | data | — | Scales, Chords, Progressions. |
| `buildLesson` | function | `(id, root, system = "letters", base = 60)` | One lesson built for a root. |
| `chordShape` | function | `(pcsRootFirst, system = "letters")` | A chord's shape in words. |
| `diagnoseSlip` | function | `(step, result, system = "letters")` | What kind of slip an attempt made. |
| `hintMethod` | function | `(step, attempt, system = "letters")` | How a hint is given. |
| `keyLandmark` | function | `(p)` | Where a note is, in words about the black keys. |
| `lessonsFor` | function | `(root, system = "letters", base = 60)` | Every lesson built for a root. |
| `nextKeyRound` | function | `(root)` | The next key to practise: a fifth up. |
| `practiceFeedback` | function | `(step, result, system = "letters")` | What to say about an attempt. |
| `practiceHint` | function | `(step, attempt)` | The next hint for a step. |
| `practiceNote` | function | `(target, attempt, midi)` | Judge one note against a step. |
| `skipWalk` | function | `(chordPcsRootFirst, scale, system)` | Building a chord by skipping notes of a scale, in words. |
| `stepWords` | function | `(n, dir = "up")` | A number of steps as words. |
| `toneWord` | function | `(semis)` | An interval as a word. |

# Core — the reusable assets

The music logic that Sketchpad, the J-6 Explorer and whatever comes next share: naming chords from notes, building and voicing them, bass, rhythm figures, melody roles, fingering, the sheet, the arithmetic of playback. Pure functions on plain data, with no screen, no audio and no clock, so any instrument, any app or a MIDI file can use them.

Each module has a stated purpose, requirements, an interface and tests of its own. Nothing in here is trusted because an app happens to work.

## Where things are

| Read | For |
|---|---|
| [`DESIGN.md`](DESIGN.md) | The architecture: layers, structure, data shapes, variation points, the decisions `CD-001`…`CD-012`, the roadmap |
| [`MODULES.md`](MODULES.md) | One section per module: purpose, behaviour, interface, layer, dependencies, consumers |
| [`REQUIREMENTS.md`](REQUIREMENTS.md) | Every requirement, its source and its test |
| [`VERIFICATION.md`](VERIFICATION.md) | How the assets are shown to hold, level by level, and what is *not* shown |
| [`../sketchpad/MODULES.md`](../sketchpad/MODULES.md) | The three modules that belong to Sketchpad alone |
| `tests/` | One test file per module, plus the architecture and contract tests |

## Using an asset

Import the module you need, so the dependency is visible:

```js
import { identifyChord } from "./core/chords.mjs";
import { voicingsFor, voiceLeading } from "./core/voicing.mjs";
import { bassOptions } from "./core/bass.mjs";

const readings = identifyChord([57, 60, 64, 67]);   // every reading, best first
readings[0].label;                                  // "Am7"
readings[1].label;                                  // "C6/A"
```

Or take everything: `import * as core from "./core/index.mjs"`.

Every function is pure (the same input gives the same answer; the input is never changed), takes the naming system as its last argument (`"letters"`, `"solfege"`, or a key's spelling), and takes the octave of anything it builds as `base`. See `DESIGN.md` §3 and §4 for the shapes and the parameters.

## Checking the assets

```
node --test core/tests/*.test.mjs      the unit, contract and architecture tests
node tools/core-check.mjs              the four checks, one line each
node tools/core-check.mjs --graph      each module's layer and who uses it
node tools/core-check.mjs --report     each requirement, with the number of tests behind it
```

The four checks (C1–C4) are also gates in `node tools/check-done.mjs`, which a change must pass before it is pushed.

## Rules in one place

1. Core imports nothing outside core (`CD-001`).
2. Every module is pure (`CD-002`).
3. The layers are the imports, and the documents say so, and a program checks (`CD-008`).
4. A requirement has one test, named by its id; a test has one requirement (`CD-010`).
5. Where a module interprets input it refuses rather than guesses (`CD-005`).
6. A known limit is written down and tested (`CD-007`).
7. A module is moved verbatim before it is changed (`CD-012`).

## Provenance

The assets were taken out of `sketchpad.jsx`, where they were one 2,770-line block, in a step shown to change nothing (`D-096`): the same lines, the same 455 existing checks, identical screen transcripts of both apps before and after. The modules' requirements and tests are new.

The built-in piano is Salamander Grand Piano by Alexander Holm, CC-BY 3.0, shortened and re-encoded; see `core/instruments.mjs`.

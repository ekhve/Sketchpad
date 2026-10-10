# Core design

How the core asset base is built, and why. The apps (Sketchpad, the J-6 Explorer, whatever comes next) are *products*; this is the *platform* they share. The product's own [`DESIGN.md`](../DESIGN.md) holds decisions `D-nnn` about products; this file holds decisions `CD-nnn` about the assets, and cites the product's where one led to the other.

Read with [`README.md`](README.md) (what is here and how to use it), [`REQUIREMENTS.md`](REQUIREMENTS.md) (what each module must do), [`MODULES.md`](MODULES.md) (each module's interface) and [`VERIFICATION.md`](VERIFICATION.md) (how it is shown to hold).

## 1. Intent

Music theory and the things made from it (naming chords, building them, voicing and bassing them, planning bars of notes, fingering them) are a separate thing from any one instrument or screen. The same logic should serve a piano page, a hardware companion, a MIDI file and the next idea, without being copied, and without one app's quirks leaking into another.

So the logic is a set of **modules**, each one capability, each with a stated purpose, requirements, interface and tests of its own, so that a module can be trusted and reused without reading its neighbours.

## 2. Structure

```
products     sketchpad.jsx    j6/app.jsx     (future apps)
                 │                │
product logic  sketchpad/*     j6/*
                 │                │
                 └───────┬────────┘
                         ▼
core/        layer 3   chordsets   harmony   sheet
             layer 2   bass  explain  fingering  styles  symbols  voicing
             layer 1   chords  figures  instruments  keyboard  melody  scales  transport
             layer 0   notes   piano-samples   instrument-samples   playback
```

**Layers.** A module's layer is the longest chain of imports below it (`notes` imports nothing: layer 0; `chords` imports `notes`: layer 1; `harmony` imports `voicing`, which imports `chords`, which imports `notes`: layer 3). A module imports only from lower layers, so there are no cycles. `node tools/core-check.mjs --graph` prints the live picture; the picture above is checked, not drawn from memory (CD-008).

**Direction.** Products import core; core never imports a product (CD-001). Product-specific logic that is *not* reusable, such as Sketchpad's levels, its lesson catalogue and its guide text, lives in `sketchpad/`, beside the product it belongs to, and is documented and checked the same way.

**Files.** One module per file, named for its capability, with a header that says its layer, its dependencies, and that it is pure. `core/index.mjs` re-exports everything for tests and for apps that want most of it; an app that wants a little imports the module it needs, so the dependency is visible (CD-011).

| Capability | Module | Layer | What an app gets |
|---|---|---|---|
| Notes and spelling | `notes` | 0 | Pitch classes, names in letters and Do-Re-Mi, key spelling |
| Scales and keys | `scales` | 1 | The catalogue, scale notes, fit, scales of your own |
| Chords | `chords` | 1 | The chord dictionary, **naming notes as chords**, inversions |
| Voicing | `voicing` | 2 | Arrangements of a chord, arpeggios, **voice-leading** |
| Chord names as text | `symbols` | 2 | Reading charts (`Bm7 F#m7/C#`) |
| Harmony in a key | `harmony` | 3 | Diatonic chords, numerals, **next-chord suggestions**, borrowed chords |
| Bass | `bass` | 2 | **Bass options and transitions** under any chord |
| Rhythm and figures | `figures` | 1 | **Patterns → bass lines and riffs → events**, seeded |
| Melody | `melody` | 1 | What lands, moves or pulls over a chord |
| Chord sets | `chordsets` | 3 | Genre sets and progressions in any key |
| Styles | `styles` | 2 | Which scales and colours suit an intention |
| Explanation | `explain` | 2 | Plain-language reasons |
| Fingering | `fingering` | 2 | Suggested fingers for chords and scales |
| Sheet | `sheet` | 3 | A progression as a printable sheet and as text |
| Keyboard logic | `keyboard` | 1 | Key roles, held notes, sliding fingers, hit-testing |
| Playback arithmetic | `playback` | 0 | Look-ahead scheduling, tempo, voice budget, rolling |
| **Looping a progression** | `transport` | 1 | What each beat holds (loop, click, count-in), and the **driver** both apps use to play |
| Instruments | `instruments`, `piano-samples`, `instrument-samples` | 1, 0, 0 | Presets as data, effects, the built-in piano, strings and vibraphone |

## 3. Interfaces

Every interface is plain data in, plain data out. The shapes the modules share:

| Shape | Fields | Made by |
|---|---|---|
| **Pitch class** | `0..11` | `pc` |
| **Note** | MIDI number, 60 = middle C | — |
| **Naming system** | `"letters"`, `"solfege"`, or a spelling object | `spelling(base, tonic, mode)` |
| **Chord** | `{ id, rootPc, sym, full, notes[], base, degreeIndex?, roman?, plain?, bassPc? }` | `dictionaryFor`, `harmonize`, `typedChord`, `buildSet`, `customChordFrom` |
| **Scale** | `{ id, name, iv[], mode, mood, tags[] }` (a scale of your own adds `tonicPc`, `mine`) | `SCALES`, `customScaleFrom` |
| **Reading** (of notes as a chord) | `{ rootPc, sym, full, label, bass, notes[], score }` | `identifyChord` |
| **Pattern** | `{ id, name, kind, styles[], note, steps: [{ p, d, r }] }`; `p` the step, `d` its length in steps, `r` the *role* | `PATTERNS` |
| **Figure** | `[{ midi, pos, dur, role }]` — one bar of notes, positions in steps | `renderFigure` |
| **Event** | `{ voice, notes[], at, dur, vel, role? }` — *at* and *dur* in seconds, *vel* 0–1 | `planBar` |
| **Refusal** | `{ ok: false, text, reason }` | `parseChordName` |

A **Figure** is where *what to play* becomes *when, how long, how hard*; an **Event** is the same thing placed in time. Both are instrument-free, so the same plan can drive a sampler, a synth, a hardware pad or a MIDI file (§6).

The call conventions are uniform: the *naming system* is the last argument of any function that writes a name, defaulting to letters; the *octave* of anything built is a `base` argument defaulting to C3; whatever must be chosen (tonic, mode, scale) is an argument, never read from outside.

## 4. Variation

A product line varies by *parameter*, not by branch (CD-009). The places where products differ, and the parameter that expresses each:

| Variation point | Parameter | Used by |
|---|---|---|
| How notes are named | `system` — `"letters"`, `"solfege"`, a key's spelling | every function that writes a name |
| Which octave chords are built in | `base` (default 48) | `voice`, `dictionaryFor`, `harmonize`, `buildSet`, `typedChord` |
| Triads, sevenths or ninths | `size` (3, 4, 5) | `harmonize`, `suggestNextChords` |
| Which scale is the palette | `scaleSet` / `scaleId` / a scale of your own | `bassOptions`, `melodyGuide`, `renderFigure`, `explainChord` |
| What a hand can reach | `reach` (keys) | `fingerChord`, `sheetData` |
| Which notes may differ run to run | `seed` | `renderFigure`, `renderProgressionFigure` |
| Tempo and bar shape | `bpm`, `beats`, `sixteenth`, `barSeconds` | `barSecondsAt`, `planBar`, `barsToSchedule` |
| Who decides the instrument | none: assets never touch audio | the app |

Where a product needs behaviour an asset does not offer, it adds it *in the product* and, if a second product wants it, moves it into core with its requirements and tests. The J-6 Explorer's chord-set data, KEY transposition and label reader are of that kind: they stay in `j6/` because only the J-6 has them.

## 5. Decisions

### CD-001 — Core is independent of its products

**Context.** Sketchpad's theory sat inline in the app; the J-6 reached it through a build step that cut it out. A second app made it plain the theory was not Sketchpad's.

**Decision.** `core/` imports nothing outside `core/`. Products import core. Logic that is specific to one product stays in that product's folder (`sketchpad/`, `j6/`). A module moves to core when a second product needs it, not before.

**Consequence.** A product can be removed without touching core, and core can be tested with no product present. `CR-ARCH-03`, gate C3.

### CD-002 — Pure by construction

**Context.** Several of this project's worst defects were in code that touched time, audio or the screen, where no test could reach (`D-031`, `D-038`, `D-043`). The cure each time was to move the arithmetic out and test it.

**Decision.** A core module uses no React, no audio library, no DOM, no clock, no randomness and no network. Anything that would need one is an *argument*: time is `now`, randomness is a `seed`, sound is left to the caller. The same input always gives the same output, and an input is never changed.

**Consequence.** Everything runs and is tested in Node with no setup, and the same function serves a browser, a worker, a command line or a file writer. `CR-ARCH-04`, `CR-ARCH-11`.

### CD-003 — Intent apart from pitch, and the output is events

**Context.** *Authored rhythm is what makes a figure sound like a genre; generated pitch is what makes it fit the harmony.* Doing both by rule sounds generic; both by hand does not transpose (`D-022`, `D-023`).

**Decision.** A pattern says rhythm and role. Rules turn each role into a note from the chord, the next chord and the scale. The result is a figure, and `planBar` places it in time as **events** carrying only *which notes, when, how long, how hard*. Events know nothing of the instrument that will play them.

**Consequence.** The seam for other outputs is already there: anything that can consume events (a sampler, the J-6, a MIDI writer) can use every figure the assets can make. §6.

### CD-004 — Arrangements are derived, and the octave is a parameter

**Context.** Choosing a voicing used to rewrite the chord's notes, so the next list of voicings was built from the previous choice and every option collapsed towards the others. Chords used to be pinned to one octave regardless of where the keyboard was (`D-060`, `D-065`).

**Decision.** `voicingsFor` derives from the chord's own octave (`base`) and its close position, never from the arrangement it is wearing. Anything built takes a `base` argument.

**Consequence.** Asking twice gives the same list; shifting the keyboard shifts the chords. `CR-VOICING-06`.

### CD-005 — Refuse, and offer; never guess

**Context.** A name typed wrongly and "corrected" silently is a chord the user did not ask for.

**Decision.** Where a function interprets input (`parseChordName`, `identifyChord`, `customChordFrom`), it returns a *refusal with a reason*, an empty list, or nothing, rather than a best guess. A near match is *offered* in the reason, never applied.

**Consequence.** A caller can always tell *understood* from *not understood*. `CR-SYMBOLS-05`, `CR-SYMBOLS-06`, `CR-CHORDS-09`.

### CD-006 — Explanations are data, in plain words, and short

**Context.** The two-sentence cap on explanations was written as a rule, never checked, and two thirds of explanations broke it (`D-011`, `D-051`).

**Decision.** An explanation is a value (`{ head, plain, formal }`), built from the same data the music is, in at most two sentences, and a test measures it.

**Consequence.** An app shows what it is given, and wording is checked in the module, not in each screen. `CR-EXPLAIN-01`.

### CD-007 — Known limits are recorded, and tested

**Context.** Several modules have a boundary they do not handle. A limit nobody wrote down is a bug waiting to be found by a user.

**Decision.** Every known limit is stated in the module's *Behaviour* and pinned by a test that asserts the limited behaviour, so changing it is a deliberate edit to a requirement.

| Limit | Where | Why it stands |
|---|---|---|
| Key signatures that would need E♯ (F♯ major, D♯ minor) use six letters | `notes` — `CR-NOTES-07` | A seventh letter would be E♯, which no chart prints (`D-074`) |
| `C#5` reads as C♯ with an unknown `5`, so the alias `#5` cannot be reached | `symbols` — `CR-SYMBOLS-02` | A sharp root and a sharp-five are indistinguishable in that text |
| A note shorter than 50 ms can overlap the next when a bar is half a second (480 BPM) | `figures` — `CR-FIGURES-12` | Far beyond any tempo the apps offer |
| The built-in piano is at most three semitones from a recording, never more | `instruments` — `CR-INSTRUMENTS-04` | The check exists because it once failed silently (`D-071`) |

### CD-008 — Layers come from the imports, and a program holds them

**Context.** An architecture drawn in a document drifts from the code the day after it is drawn.

**Decision.** The layer is computed from the imports. Each module's header and each document section must state it, along with the dependencies and the consumers, and `tools/core-check.mjs` compares all three with the code. It also forbids cycles.

**Consequence.** The diagram in §2 is true or the build fails. `CR-ARCH-01`, `CR-ARCH-02`, gate C3.

### CD-009 — Variation by parameter

**Decision.** Where products differ, the difference is an argument (§4), not a flag the module reads from the world and not a copy of the module. A module never asks *which app am I in*.

### CD-010 — Verification belongs to the asset

**Context.** An asset tested only through the apps that use it is verified only as far as they happen to exercise it, and a second app inherits no assurance.

**Decision.** Each requirement has one test, named by the requirement's id, in `core/tests/`, which imports only the module under test (and the modules below it) and no app. Contract tests check every exported function for determinism and for leaving its arguments alone. The architecture checks are themselves tested by planting a fault and seeing the check catch it. Mutation testing (`tools/mutate.mjs`) checks the tests would notice a change in the module.

**Consequence.** A module can be trusted on its own evidence. `CR-ARCH-07` to `CR-ARCH-12`; [`VERIFICATION.md`](VERIFICATION.md).

### CD-011 — One module per capability, and an index

**Decision.** One file is one capability, named for it, with a header and a section in `MODULES.md`. `index.mjs` re-exports every module so that tests can reach everything at once and an app can import from one place; `core-check` fails if a module is missing from it. An app that wants a little imports the module itself.

### CD-012 — Moved verbatim, then improved

**Context.** The theory moved out of a 2,770-line app file. Rewriting it while moving it would have made any change in behaviour impossible to tell from a mistake in the move.

**Decision.** The first step was a *verbatim* move, shown by line-for-line comparison and by identical screen transcripts before and after (`D-096`). Improvements follow, each as its own change with its own requirement.

### CD-013 — A stateful part takes its effects as arguments, and is verified with a fake of them

**Context.** Both apps ran the same loop by hand: note the clock, ask the scheduler what is due, hand it over, ask again on a timer. Two copies of a timing loop is where two apps drift, and neither could be tested without a browser.

**Decision.** `core/transport` holds the loop as `createDriver({ now, every, cancel })`. It keeps a timer and a cursor, which makes it stateful; but it reaches the world only through the three functions it is given. The app passes Tone's clock and the browser's timer; a test passes a clock it steps by hand. Stateful assets are allowed on those terms and are verified by driving them, not by the same-input rule that covers the pure functions.

**Consequence.** The timing loop is tested without audio or a screen (`CR-TRANSPORT-09` to `15`), and a change to it reaches both apps. The contract table lists `createDriver` as stateful.

### CD-014 — One question, one answer shape, a parameter for how tolerant

**Context.** *What chord is this?* was answered twice: Sketchpad's `identifyChord` (the notes are a chord; every reading, ranked) and the J-6's `nameFromNotes` (the notes are part of a chord, as a hardware key often leaves out the fifth; the single best). Two functions, two result shapes, two sets of tests, and a fix to one would not reach the other.

**Decision.** `identifyChord(notes, system, { missing })`. Without `missing`, the notes must be the whole chord. With it, tones may be absent, and a root in the bass outweighs two missing tones. Both return the same reading, `{ rootPc, sym, full, label, notes, bass, tones, missing, score, why }`. The J-6's function is now a few lines on top of it. The old J-6 rule is kept in the tests as an independent reference, and the new function is compared with it over every dictionary chord on every root with each tone left out.

**Consequence.** Any app that has some notes and wants a name uses one function and chooses how forgiving to be. `CR-CHORDS-13` to `15`.

## 6. Roadmap

Not built; listed so the shape is deliberate. Each item arrives as a module with requirements and tests before an app uses it.

| Next | What it is | Why it fits |
|---|---|---|
| **Events to MIDI** | A module turning events (§3) into a Standard MIDI File, in bytes | Events are already instrument-free (CD-003); it is a pure function of events and a tempo |
| **Shared progression state** | The J-6's pure progression reducer (add, remove, undo, rec), which Sketchpad's loop could use | The transport is shared (`D-098`); the reducer is next |
| **Melody from harmony** | Motifs and phrases over a progression, seeded, using `melody` and `figures` | The patterns and the rules already generate notes; this arranges them |

## 7. Adding an asset

1. Find the capability. If a second product does not need it yet, it stays in the product.
2. Write the header (layer, dependencies, pure) and a section in `MODULES.md`: purpose, behaviour, interface.
3. Write each requirement as a row in `REQUIREMENTS.md` with its source, and a test whose title begins with the id.
4. Add its functions to the contract table in `core/tests/architecture.test.mjs`.
5. Add it to `core/index.mjs`, add its mutants to `tools/mutate.mjs`, run `node tools/check-done.mjs`.

`node tools/core-check.mjs` says what is missing at each step.
